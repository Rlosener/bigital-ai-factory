import { ArrowRight, Play } from "lucide-react";
import { useState } from "react";
import type { FactoryAgent, FactoryPlan } from "../../../shared/factory";
import { translateEnglishToTurkish } from "../../i18n";
import { dateLabel, outputTypeLabel, riskLabels, Status, workflowLabels } from "./presentation";
import TechnicalDetails from "./TechnicalDetails";
import WorkflowGraph from "./WorkflowGraph";
import PlanControllerNotice from "./PlanControllerNotice";
interface Props {
  plan: FactoryPlan;
  agents: FactoryAgent[];
  busy: boolean;
  approvalPending: boolean;
  planApproved: boolean;
  retryAfter?: number | null;
  onStart: () => void;
  onRecheck: () => void;
  onApprovals: () => void;
  onTask: (taskId: string) => void;
  onSettings: () => void;
  onReset?: (note: string) => Promise<void>;
}
export default function ManagerPlanCard({
  plan,
  agents,
  busy,
  approvalPending,
  planApproved,
  retryAfter,
  onStart,
  onRecheck,
  onApprovals,
  onTask,
  onSettings,
  onReset,
}: Props) {
  const canStart = ["draft", "approved", "blocked", "failed"].includes(plan.status) && plan.controller_state !== "STOP";
  const cooldownActive = !!retryAfter && retryAfter > Date.now();
  const [representation, setRepresentation] = useState<"list" | "graph">("list");
  return (
    <article className="factory-plan">
      <div className="factory-section-heading">
        <div>
          <p className="factory-eyebrow">
            {workflowLabels[plan.workflow]} · {dateLabel(plan.created_at)}
          </p>
          <h3>{plan.instruction}</h3>
        </div>
        <Status value={plan.status} />
      </div>
      <p className="factory-muted">{plan.summary}</p>
      <PlanControllerNotice plan={plan} onTask={onTask} onReset={onReset} />
      <div className="factory-plan-meta">
        <span>{plan.steps.length} adım</span>
        <span>
          Risk: <strong>{riskLabels[plan.risk]}</strong>
        </span>
        <span>Kural tabanlı ön plan</span>
      </div>
      {plan.missing.length > 0 && plan.controller_state !== "STOP" && (
        <div className="factory-blocked">
          <strong>{planApproved ? "Son çalışma tamamlanamadı" : "Başlamak için tamamlanması gerekenler"}</strong>
          <ul>
            {plan.missing.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          {cooldownActive && (
            <p>
              Sağlayıcı kapasitesi bekleniyor. Yeniden deneme zamanı: {dateLabel(retryAfter!)}. Bu bekleme, doğrulanmış
              görev hatası anlamına gelmez.
            </p>
          )}
          {planApproved && !cooldownActive ? (
            <button onClick={onStart} disabled={busy}>
              Bu adımı yeniden çalıştır <ArrowRight size={14} />
            </button>
          ) : !planApproved ? (
            <button onClick={onSettings}>
              Entegrasyonları düzenle <ArrowRight size={14} />
            </button>
          ) : null}
        </div>
      )}
      <div className="factory-plan-view" aria-label="Plan görünümü">
        <button aria-pressed={representation === "list"} onClick={() => setRepresentation("list")}>
          Adım listesi
        </button>
        <button aria-pressed={representation === "graph"} onClick={() => setRepresentation("graph")}>
          Akış grafiği
        </button>
      </div>
      {representation === "graph" ? (
        <WorkflowGraph plan={plan} agents={agents} onTask={onTask} />
      ) : (
        <ol className="factory-steps">
          {plan.steps.map((step) => (
            <li key={step.id}>
              <span className="factory-step-number">{step.position + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="factory-section-heading">
                  <strong>{step.title}</strong>
                  <Status value={step.status} />
                </div>
                <p>{step.description}</p>
                <div className="factory-step-meta">
                  <span>
                    {translateEnglishToTurkish(
                      agents.find((agent) => agent.id === step.agent_id)?.name || "Çalışan atanmadı",
                    )}{" "}
                    · {translateEnglishToTurkish(step.role)}
                  </span>
                  {step.depends_on.length > 0 && (
                    <span>
                      Önce:{" "}
                      {step.depends_on
                        .map((id) => {
                          const parent = plan.steps.find((item) => item.id === id);
                          return parent ? parent.position + 1 : "?";
                        })
                        .join(", ")}{" "}
                      numaralı adım
                    </span>
                  )}
                  {step.requires_approval && <span>İnsan onayı gerekli</span>}
                  {step.task_id && (
                    <button onClick={() => onTask(step.task_id!)}>
                      Görev ve kanıtlar <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <TechnicalDetails label="Planın teknik kapsamı">
        <dl>
          {plan.steps.map((step) => (
            <div key={step.id}>
              <dt>{step.title}</dt>
              <dd>
                Çıktı: {outputTypeLabel(step.output_type)} · Yetenekler: {step.skills.join(", ") || "Belirtilmedi"}
              </dd>
            </div>
          ))}
        </dl>
      </TechnicalDetails>
      {canStart && (
        <div className="factory-actions">
          {plan.missing.length > 0 && !planApproved ? (
            <button className="factory-primary" onClick={onRecheck} disabled={busy}>
              {busy ? "Kontrol ediliyor…" : "Eksikleri yeniden kontrol et"}
            </button>
          ) : approvalPending ? (
            <button className="factory-primary" onClick={onApprovals}>
              Plan onayını incele <ArrowRight size={14} />
            </button>
          ) : (
            <button className="factory-primary" onClick={onStart} disabled={busy}>
              <Play size={14} />
              {busy
                ? "Başlatılıyor…"
                : cooldownActive
                  ? "Kapasiteyi yeniden kontrol et"
                  : ["failed", "blocked"].includes(plan.status)
                    ? "Tekrar dene"
                    : "Planı başlat"}
            </button>
          )}
        </div>
      )}
      {plan.status === "awaiting_approval" && (
        <p className="factory-muted">Devam etmek için Onaylar bölümündeki kararı inceleyin.</p>
      )}
    </article>
  );
}
