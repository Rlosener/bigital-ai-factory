import { chooseFactorySeat } from "./capacity-governor.ts";

export type FactoryModelSelection = {
  agent: Record<string, any>;
  provider: string;
  model: string | null;
  toolCapable: boolean;
  providerFamily: string;
  seatId: string | null;
  reason: string;
};

type RouterContext = {
  db: any;
  detectAllCli: () => Promise<Record<string, { installed: boolean; authenticated: boolean }>>;
  getProviderModelConfig: () => Record<string, { model?: string }>;
};

const TOOL_PROVIDERS = new Set(["claude", "codex", "gemini", "opencode", "kimi"]);

export function resolveFactoryProviderFamily(provider: string, model: string | null, baseUrl?: string): string {
  const value = `${model || ""} ${baseUrl || ""}`;
  if (/deepseek/i.test(value)) return "deepseek";
  if (/xiaomi|mimo/i.test(value)) return "xiaomi";
  if (/anthropic|claude/i.test(value) || provider === "claude") return "anthropic";
  if (/google|gemini/i.test(value) || provider === "gemini") return "google";
  if (/openai|\bgpt[-/]|\bo[134]-/i.test(value) || provider === "codex") return "openai";
  if (provider === "api" && baseUrl) {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return "unknown";
    }
  }
  return provider;
}

/** Routing uses configured identities/models only; it never overwrites an agent's provider settings. */
export async function routeFactoryModel(
  ctx: RouterContext,
  options: {
    role: string;
    requiresTools: boolean;
    noTools?: boolean;
    businessId?: string;
    excludeAgentIds?: string[];
    preferDifferentProvider?: string;
  },
): Promise<FactoryModelSelection | null> {
  const cli = await ctx.detectAllCli();
  const config = ctx.getProviderModelConfig();
  const agents = ctx.db
    .prepare("SELECT * FROM agents WHERE status = 'idle' AND current_task_id IS NULL")
    .all() as Record<string, any>[];
  const candidates: Array<FactoryModelSelection & { score: number }> = [];
  for (const identity of agents) {
    if (options.excludeAgentIds?.includes(identity.id)) continue;
    const provider = identity.cli_provider || "claude";
    const toolCapable = TOOL_PROVIDERS.has(provider);
    if (options.noTools && provider !== "api" && !["claude", "codex", "gemini"].includes(provider)) continue;
    if (options.requiresTools && !toolCapable) continue;
    let model: string | null = identity.cli_model || config[provider]?.model || null;
    let agent = { ...identity };
    let providerKey = provider;
    let providerFamily = resolveFactoryProviderFamily(provider, model);
    if (provider === "api") {
      const api = identity.api_provider_id
        ? ctx.db
            .prepare("SELECT id,type,name,enabled,api_key_enc,models_cache,base_url FROM api_providers WHERE id = ?")
            .get(identity.api_provider_id)
        : null;
      if (!api?.enabled || (!api.api_key_enc && api.type !== "ollama")) continue;
      let cached: string[] = [];
      try {
        cached = JSON.parse(api.models_cache || "[]").filter((item: unknown) => typeof item === "string");
      } catch {
        /* Invalid cache is unavailable. */
      }
      model = identity.api_model || cached[0] || null;
      if (!model) continue;
      agent = { ...agent, api_model: model };
      providerKey = `api:${api.id}`;
      providerFamily = resolveFactoryProviderFamily("api", model, api.base_url);
    } else {
      if (!toolCapable || !cli[provider]?.installed || !cli[provider]?.authenticated) continue;
    }
    const departments =
      options.role === "reviewer"
        ? ["qa", "devsecops"]
        : options.role === "developer"
          ? ["dev"]
          : options.role === "product_manager"
            ? ["product", "planning"]
            : options.role === "content_strategist"
              ? ["marketing", "design"]
              : ["planning"];
    const score =
      (departments.includes(identity.department_id) ? 20 : 0) +
      (options.preferDifferentProvider && providerFamily !== options.preferDifferentProvider ? 30 : 0) +
      (identity.role === "senior" || identity.role === "team_leader" ? 4 : 0);
    const capacity = chooseFactorySeat(
      ctx.db,
      {
        business_id: options.businessId || "bigital",
        provider,
        api_provider_id: agent.api_provider_id || null,
        oauth_account_id: agent.oauth_account_id || null,
      },
      Date.now(),
    );
    if (capacity.configured && !capacity.seat) continue;
    const cooldown =
      ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='factory_runs'").get()?.name ===
      "factory_runs"
        ? ctx.db
            .prepare(
              "SELECT retry_after FROM factory_runs WHERE business_id=? AND provider=? AND issue_kind='capacity' AND retry_after>? ORDER BY retry_after DESC LIMIT 1",
            )
            .get(options.businessId || "bigital", providerKey, Date.now())
        : null;
    if (cooldown) continue;
    candidates.push({
      agent,
      provider: providerKey,
      providerFamily,
      seatId: capacity.seat?.id || null,
      model,
      toolCapable,
      score,
      reason: `${toolCapable ? "CLI araç erişimi" : "Yapılandırılmış metin sağlayıcısı"}; ${options.role} rolü; mevcut model ${model || "sağlayıcı varsayılanı"}`,
    });
  }
  candidates.sort((a, b) => b.score - a.score || String(a.agent.id).localeCompare(String(b.agent.id)));
  return candidates[0] || null;
}
