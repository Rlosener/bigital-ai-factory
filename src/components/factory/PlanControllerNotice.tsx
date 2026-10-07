import { ArrowRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { FactoryPlan } from "../../../shared/factory";
import TechnicalDetails, { FactoryError } from "./TechnicalDetails";

const explanations = {
  STEER: {
    title: "Çalışma yaklaşımı incelenmeli",
    description: "Kontrol sistemi bir çalışma hatası kaydetti. Yaklaşımı ve doğrulama kanıtlarını inceleyin.",
  },
  CONSTRAIN: {
    title: "Çalışma kısıtlandı",
    description:
      "Hatalar veya kaynak sınırları nedeniyle kontrol sistemi çalışmayı kısıtladı. Tekrar denemeden önce çalışma kanıtlarını ve sınırları kontrol edin.",
  },
  STOP: {
    title: "Çalışma durduruldu",
    description:
      "Kontrol sınırları nedeniyle bu planda yeni görev başlatılmıyor. Durma gerekçesini ve çalışma kanıtlarını inceleyin; yeni bir plan oluşturmadan önce engeli giderin.",
  },
};
export default function PlanControllerNotice({
  plan,
  onTask,
  onReset,
}: {
  plan: FactoryPlan;
  onTask: (id: string) => void;
  onReset?: (note: string) => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!plan.controller_state || plan.controller_state === "NORMAL") return null;
  const explanation = explanations[plan.controller_state];
  const task =
    [...plan.steps].reverse().find((step) => step.task_id && ["failed", "blocked"].includes(step.status)) ||
    [...plan.steps].reverse().find((step) => step.task_id);
  const canReset = !!onReset && !["completed", "rejected", "running"].includes(plan.status);
  async function confirmReset() {
    if (busy || !onReset || !note.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onReset(note.trim());
      setResetting(false);
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`factory-controller factory-controller--${plan.controller_state.toLowerCase()}`} role="status">
      <strong>{explanation.title}</strong>
      <p>{explanation.description}</p>
      {task?.task_id && (
        <button onClick={() => onTask(task.task_id!)}>
          Çalışma kanıtlarını incele <ArrowRight size={14} />
        </button>
      )}
      {canReset && !resetting && (
        <button onClick={() => setResetting(true)}>
          Kontrolü sıfırla <RotateCcw size={14} />
        </button>
      )}
      {canReset && resetting && (
        <div className="factory-confirm">
          <label className="factory-field">
            Sıfırlama notu
            <textarea
              value={note}
              maxLength={2000}
              rows={2}
              placeholder="Engeli nasıl giderdiğinizi kısaca yazın"
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <p className="factory-muted">
            Kontrol normale döner; plan yeniden başlatılabilir. Not, karar geçmişine kaydedilir.
          </p>
          {error && <FactoryError error={error} />}
          <div className="factory-actions">
            <button
              onClick={() => {
                setResetting(false);
                setError("");
              }}
              disabled={busy}
            >
              Vazgeç
            </button>
            <button className="factory-primary" onClick={() => void confirmReset()} disabled={busy || !note.trim()}>
              {busy ? "Sıfırlanıyor…" : "Sıfırlamayı onayla"}
            </button>
          </div>
        </div>
      )}
      <TechnicalDetails label="Kontrol durumu ve sınırları">
        <p>Kontrol durumu: {plan.controller_state}</p>
        {plan.stopped_reason && <pre>{plan.stopped_reason}</pre>}
        {plan.controller_policy && (
          <dl>
            <div>
              <dt>Yeniden deneme sınırı</dt>
              <dd>{plan.controller_policy.max_retries}</dd>
            </div>
            <div>
              <dt>Aynı hata tekrar sınırı</dt>
              <dd>{plan.controller_policy.same_error_limit}</dd>
            </div>
            <div>
              <dt>Çalışma süresi sınırı</dt>
              <dd>{plan.controller_policy.max_runtime_ms / 60000} dakika</dd>
            </div>
            <div>
              <dt>Ölçülen maliyet sınırı</dt>
              <dd>
                {plan.controller_policy.max_cost_usd === null
                  ? "Tanımlanmadı"
                  : `${plan.controller_policy.max_cost_usd} USD`}
              </dd>
            </div>
          </dl>
        )}
      </TechnicalDetails>
    </div>
  );
}
