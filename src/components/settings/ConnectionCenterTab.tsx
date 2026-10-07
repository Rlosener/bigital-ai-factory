import { Cable, KeyRound, ShieldCheck, TerminalSquare } from "lucide-react";
import type { ReactNode } from "react";
import type { ApiProvider, OAuthStatus } from "../../api";
import type { CliStatusMap } from "../../types";
import ConnectionUsagePanel from "./ConnectionUsagePanel";

interface ConnectionCenterTabProps {
  cliStatus: CliStatusMap | null;
  oauthStatus: OAuthStatus | null;
  apiProviders: ApiProvider[];
  children: ReactNode;
}

export default function ConnectionCenterTab({
  cliStatus,
  oauthStatus,
  apiProviders,
  children,
}: ConnectionCenterTabProps) {
  const readyCli = Object.values(cliStatus ?? {}).filter((item) => item.installed && item.authenticated).length;
  const oauthAccounts = Object.values(oauthStatus?.providers ?? {}).reduce(
    (total, provider) => total + (provider.accounts?.filter((account) => account.status === "active").length ?? 0),
    0,
  );
  const enabledApis = apiProviders.filter((provider) => provider.enabled).length;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/60">
        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <Cable size={19} aria-hidden />
              AI Bağlantı Merkezi
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
              CLI araçlarını, OAuth hesaplarını ve API anahtarlarını tek yerden yönetin. Aynı sağlayıcı için farklı
              adlarla birden fazla API anahtarı ekleyebilir ve AI çalışanlara ayrı ayrı atayabilirsiniz.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-700 bg-slate-700 sm:min-w-64">
            <div className="bg-slate-900/80 px-3 py-2.5 text-center">
              <TerminalSquare size={14} className="mx-auto text-slate-400" aria-hidden />
              <strong className="mt-1 block text-lg text-white">{readyCli}</strong>
              <span className="text-[10px] text-slate-500">Hazır CLI</span>
            </div>
            <div className="bg-slate-900/80 px-3 py-2.5 text-center">
              <ShieldCheck size={14} className="mx-auto text-slate-400" aria-hidden />
              <strong className="mt-1 block text-lg text-white">{oauthAccounts}</strong>
              <span className="text-[10px] text-slate-500">OAuth</span>
            </div>
            <div className="bg-slate-900/80 px-3 py-2.5 text-center">
              <KeyRound size={14} className="mx-auto text-slate-400" aria-hidden />
              <strong className="mt-1 block text-lg text-white">{enabledApis}</strong>
              <span className="text-[10px] text-slate-500">API hesabı</span>
            </div>
          </div>
        </div>
        <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs leading-relaxed text-emerald-100 sm:px-5">
          Uygulamayı açmak tek başına AI yanıtı üretmez ve completion tokenı harcamaz. Harcama; bir görev
          başlattığınızda, bir çalışana AI yanıtı ürettirdiğinizde veya açıkça bağlantı/model testi istediğinizde
          başlar.
        </div>
      </section>

      <ConnectionUsagePanel />
      {children}
    </div>
  );
}
