export type ProviderUsageMetrics = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
};

export type ProviderQuotaSnapshot = {
  remaining: number | null;
  limit: number | null;
  unit: string | null;
  resetAt: number | null;
};

type DbLike = {
  prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
};

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseResetAt(value: string | null): number | null {
  if (!value) return null;
  const numeric = finiteNumber(value);
  if (numeric !== null) {
    if (numeric > 10_000_000_000) return Math.round(numeric);
    if (numeric > 1_000_000_000) return Math.round(numeric * 1000);
    return Date.now() + Math.max(0, numeric) * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function redactSecrets(value: string): string {
  return value
    .replace(/\b(?:sk|key|token)-[A-Za-z0-9_-]{8,}\b/gi, "[gizlendi]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi, "Bearer [gizlendi]");
}

export function readQuotaHeaders(headers: Headers): ProviderQuotaSnapshot {
  const remaining = finiteNumber(
    headers.get("x-ratelimit-remaining-tokens") ??
      headers.get("x-ratelimit-remaining-requests") ??
      headers.get("ratelimit-remaining"),
  );
  const limit = finiteNumber(
    headers.get("x-ratelimit-limit-tokens") ??
      headers.get("x-ratelimit-limit-requests") ??
      headers.get("ratelimit-limit"),
  );
  const unit = headers.has("x-ratelimit-remaining-tokens") ? "token" : remaining !== null ? "istek" : null;
  const resetAt = parseResetAt(
    headers.get("x-ratelimit-reset-tokens") ??
      headers.get("x-ratelimit-reset-requests") ??
      headers.get("ratelimit-reset"),
  );
  return { remaining, limit, unit, resetAt };
}

export function recordProviderUsage(
  db: DbLike,
  input: {
    connectionKind: "api" | "oauth";
    connectionId: string;
    provider: string;
    model?: string | null;
    metrics?: ProviderUsageMetrics | null;
    quota?: ProviderQuotaSnapshot | null;
    status: "başarılı" | "hata";
    error?: string | null;
  },
): void {
  const now = Date.now();
  const inputTokens = finiteNumber(input.metrics?.inputTokens) ?? 0;
  const outputTokens = finiteNumber(input.metrics?.outputTokens) ?? 0;
  const tokensReported = input.metrics?.inputTokens != null || input.metrics?.outputTokens != null;
  const costUsd = finiteNumber(input.metrics?.costUsd);
  const costReported = costUsd !== null;
  const error = input.error ? redactSecrets(input.error).replace(/\s+/g, " ").trim().slice(0, 500) : null;

  db.prepare(
    `
      INSERT INTO provider_usage_stats (
        connection_kind, connection_id, provider, model, request_count,
        input_tokens, output_tokens, tokens_reported, cost_usd, cost_reported,
        quota_remaining, quota_limit, quota_unit, quota_reset_at,
        last_status, last_error, last_used_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(connection_kind, connection_id) DO UPDATE SET
        provider = excluded.provider,
        model = COALESCE(excluded.model, provider_usage_stats.model),
        request_count = provider_usage_stats.request_count + 1,
        input_tokens = provider_usage_stats.input_tokens + excluded.input_tokens,
        output_tokens = provider_usage_stats.output_tokens + excluded.output_tokens,
        tokens_reported = MAX(provider_usage_stats.tokens_reported, excluded.tokens_reported),
        cost_usd = CASE
          WHEN excluded.cost_reported = 1 THEN COALESCE(provider_usage_stats.cost_usd, 0) + excluded.cost_usd
          ELSE provider_usage_stats.cost_usd
        END,
        cost_reported = MAX(provider_usage_stats.cost_reported, excluded.cost_reported),
        quota_remaining = COALESCE(excluded.quota_remaining, provider_usage_stats.quota_remaining),
        quota_limit = COALESCE(excluded.quota_limit, provider_usage_stats.quota_limit),
        quota_unit = COALESCE(excluded.quota_unit, provider_usage_stats.quota_unit),
        quota_reset_at = COALESCE(excluded.quota_reset_at, provider_usage_stats.quota_reset_at),
        last_status = excluded.last_status,
        last_error = excluded.last_error,
        last_used_at = excluded.last_used_at,
        updated_at = excluded.updated_at
    `,
  ).run(
    input.connectionKind,
    input.connectionId,
    input.provider,
    input.model ?? null,
    inputTokens,
    outputTokens,
    tokensReported ? 1 : 0,
    costUsd,
    costReported ? 1 : 0,
    input.quota?.remaining ?? null,
    input.quota?.limit ?? null,
    input.quota?.unit ?? null,
    input.quota?.resetAt ?? null,
    input.status,
    error,
    now,
    now,
  );
}
