import { Activity, Coins, Gauge, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import * as api from "../../api";
import type { ProviderConnectionUsage } from "../../api";
import { toUserFriendlyError } from "../../lib/user-facing-errors";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: number | null): string {
  if (!value) return "Henüz kullanılmadı";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-200" title={value}>
        {value}
      </div>
    </div>
  );
}

export default function ConnectionUsagePanel() {
  const [connections, setConnections] = useState<ProviderConnectionUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConnections(await api.getProviderConnectionUsage());
    } catch (cause) {
      setError(toUserFriendlyError(cause, "Kullanım bilgileri şu anda alınamadı."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Gauge size={17} aria-hidden />
            Kullanım ve kota
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            İstek sayısı yerel olarak tutulur. Token, maliyet ve kota yalnızca sağlayıcı gerçek veri bildirdiğinde
            gösterilir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden />
          Yenile
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      {!loading && connections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 px-4 py-5 text-center text-xs text-slate-500">
          Kullanımını izlemek için bir API anahtarı veya OAuth hesabı bağlayın.
        </div>
      ) : (
        <div className="divide-y divide-slate-700/60 overflow-hidden rounded-lg border border-slate-700/60">
          {connections.map((connection) => {
            const tokenValue = connection.tokens_reported
              ? formatNumber(connection.input_tokens + connection.output_tokens)
              : "Sağlayıcı bildirmedi";
            const costValue =
              connection.cost_reported && connection.cost_usd !== null
                ? formatMoney(connection.cost_usd)
                : "Sağlayıcı bildirmedi";
            const quotaValue =
              connection.quota_remaining !== null
                ? `${formatNumber(connection.quota_remaining)}${
                    connection.quota_limit !== null ? ` / ${formatNumber(connection.quota_limit)}` : ""
                  } ${connection.quota_unit ?? ""}`.trim()
                : "Sağlayıcı bildirmedi";
            return (
              <article
                key={`${connection.connection_kind}:${connection.connection_id}`}
                className="bg-slate-900/25 p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">{connection.label}</span>
                      <span className="rounded bg-slate-700/70 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {connection.connection_kind === "api" ? "API anahtarı" : "OAuth hesabı"}
                      </span>
                      <span
                        className={connection.enabled ? "text-[10px] text-emerald-400" : "text-[10px] text-slate-500"}
                      >
                        {connection.enabled ? "Etkin" : "Kapalı"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {connection.provider}
                      {connection.model ? ` · ${connection.model}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Activity size={12} aria-hidden />
                    {formatDate(connection.last_used_at)}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-700/50 pt-3 sm:grid-cols-4">
                  <Metric label="İstek" value={formatNumber(connection.request_count)} />
                  <Metric label="Token" value={tokenValue} />
                  <Metric label="Maliyet" value={costValue} />
                  <Metric label="Kalan kota" value={quotaValue} />
                </div>
                {connection.last_status === "hata" && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
                    <Coins size={13} className="mt-0.5 shrink-0" aria-hidden />
                    Son istek tamamlanamadı. Bağlantıyı test edin veya başka bir hesabı etkinleştirin.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
