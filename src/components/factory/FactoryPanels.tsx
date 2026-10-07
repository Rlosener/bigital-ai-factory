import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import type {
  FactoryApproval,
  FactoryApprovalDecision,
  FactoryDeliverable,
  FactoryWorkspace,
} from "../../../shared/factory";
import { translateEnglishToTurkish } from "../../i18n";
import type { Agent } from "../../types";
import { getTask } from "../../api";
import * as api from "../../api/factory";
import { dateLabel, outputTypeLabel, Status } from "./presentation";
import TechnicalDetails, { FactoryError } from "./TechnicalDetails";
import StructuredOutput from "./StructuredOutput";
import FactoryForms from "./FactoryForms";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="factory-empty">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function DeliverableCard({ item }: { item: FactoryDeliverable }) {
  function download() {
    const content = JSON.stringify(
      {
        title: item.title,
        type: item.type,
        version: item.version,
        status: item.status,
        created_at: item.created_at,
        content: item.content,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bigital-cikti-${item.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <article className="factory-plan">
      <div className="factory-section-heading">
        <div>
          <p className="factory-eyebrow">
            {outputTypeLabel(item.type)} · Sürüm {item.version}
          </p>
          <h3>{item.title}</h3>
        </div>
        <Status value={item.status} />
      </div>
      <p className="factory-output-content">{item.content.summary}</p>
      {item.content.structured && <StructuredOutput value={item.content.structured} />}
      <h4>Doğrulama kanıtları</h4>
      {item.content.evidence.length ? (
        <ul className="factory-evidence">
          {item.content.evidence.map((evidence, index) => (
            <li key={index}>{evidence}</li>
          ))}
        </ul>
      ) : (
        <p className="factory-muted">Bu çıktı için henüz doğrulama kanıtı kaydedilmedi.</p>
      )}
      {item.content.limitations.length > 0 && (
        <>
          <h4>Sınırlar ve kalan işler</h4>
          <ul className="factory-evidence">
            {item.content.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </>
      )}
      <TechnicalDetails label="Dosyalar ve kayıt bilgisi">
        <p>{dateLabel(item.created_at)}</p>
        {item.content.artifacts.map((artifact, index) => (
          <p key={index}>{artifact}</p>
        ))}
      </TechnicalDetails>
      <button onClick={download}>
        <ArrowDownToLine size={14} />
        Çıktının tamamını indir
      </button>
    </article>
  );
}
export function ApprovalCard({
  approval,
  workspace,
  scope,
  onRefresh,
}: {
  approval: FactoryApproval;
  workspace: FactoryWorkspace;
  scope: api.FactoryScope;
  onRefresh: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const canRevise = approval.kind === "deliverable";
  async function resolve(decision: FactoryApprovalDecision) {
    if (busy) return;
    if (decision === "revision_requested" && !note.trim()) {
      setError("");
      setValidation("Revizyon için neyin değişmesi gerektiğini karar notuna kısaca yazın.");
      return;
    }
    setBusy(true);
    setError("");
    setValidation("");
    try {
      await api.resolveFactoryApproval(approval.id, scope, decision, note);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  const outputs = workspace.deliverables.filter((item) => item.plan_id === approval.plan_id);
  return (
    <article className="factory-plan">
      <div className="factory-section-heading">
        <div>
          <p className="factory-eyebrow">
            {approval.kind === "critical_action"
              ? "Kritik işlem"
              : approval.kind === "plan"
                ? "Plan onayı"
                : "Çıktı onayı"}
          </p>
          <h3>{approval.title}</h3>
        </div>
        <Status value={approval.decision === "revision_requested" ? "revision_requested" : approval.status} />
      </div>
      <p>{approval.reason}</p>
      <p className="factory-muted">{dateLabel(approval.created_at)}</p>
      {outputs.length > 0 && (
        <details className="factory-technical">
          <summary>Çıktı ve doğrulama kanıtlarını incele ({outputs.length})</summary>
          {outputs.map((item) => (
            <DeliverableCard key={item.id} item={item} />
          ))}
        </details>
      )}
      {approval.status === "pending" && (
        <>
          <label className="factory-field">
            Karar notu
            <textarea
              value={note}
              maxLength={2000}
              rows={2}
              placeholder={
                canRevise ? "Onay için isteğe bağlı, revizyon için zorunlu açıklama" : "İsteğe bağlı açıklama"
              }
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {canRevise && (
            <p className="factory-muted">
              Revizyon istediğinizde mevcut sürümler saklanır, notunuz üreticiye iletilir ve yeni bir çalışma turu
              başlar.
            </p>
          )}
          {validation && (
            <p className="factory-error" role="alert">
              {validation}
            </p>
          )}
          {error && <FactoryError error={error} />}
          <div className="factory-actions">
            <button onClick={() => void resolve("rejected")} disabled={busy}>
              Reddet
            </button>
            {canRevise && (
              <button onClick={() => void resolve("revision_requested")} disabled={busy}>
                Revizyon iste
              </button>
            )}
            <button className="factory-primary" onClick={() => void resolve("approved")} disabled={busy}>
              {busy ? "Kaydediliyor…" : "Onayla"}
            </button>
          </div>
        </>
      )}
      {approval.note && <p className="factory-muted">Karar notu: {approval.note}</p>}
    </article>
  );
}
export function KnowledgePanel({
  workspace,
  scope,
  onAdd,
  onRefresh,
}: {
  workspace: FactoryWorkspace;
  scope: api.FactoryScope;
  onAdd: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [deleteId, setDeleteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState("");
  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteFactoryKnowledge(id, scope);
      setDeleteId("");
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  const editing = workspace.knowledge.find((item) => item.id === editId);
  return (
    <section>
      <div className="factory-section-heading">
        <div>
          <h2>İşletme ve proje bilgisi</h2>
          <p className="factory-muted">AI Yönetici planları, bu kapsamda kaydedilen bilgileri kullanır.</p>
        </div>
        <button className="factory-primary" onClick={onAdd}>
          Bilgi ekle
        </button>
      </div>
      {error && <FactoryError error={error} />}
      {workspace.knowledge.length === 0 && (
        <EmptyState
          title="Bilgi tabanı henüz boş"
          description="Marka kuralları, proje hedefleri, mimari kararlar veya çalışma kurallarını ekleyin."
        />
      )}
      {workspace.knowledge.map((item) => (
        <article className="factory-knowledge" key={item.id}>
          <div className="factory-section-heading">
            <div>
              <p className="factory-eyebrow">
                {item.project_id ? "Proje bilgisi" : "İşletme bilgisi"} · {item.category}
              </p>
              <h3>{item.title}</h3>
            </div>
            {deleteId !== item.id && (
              <div className="flex gap-2">
                <button aria-label={`${item.title} bilgisini düzenle`} onClick={() => setEditId(item.id)}>
                  <Pencil size={15} />
                </button>
                <button aria-label={`${item.title} bilgisini sil`} onClick={() => setDeleteId(item.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>
          <p className="factory-output-content">{item.content}</p>
          <p className="factory-muted">{dateLabel(item.updated_at)}</p>
          {deleteId === item.id && (
            <div className="factory-confirm">
              <p>Bu bilgi silinsin mi? Yeni planlarda kullanılamayacak.</p>
              <div className="factory-actions">
                <button onClick={() => setDeleteId("")} disabled={busy}>
                  Vazgeç
                </button>
                <button onClick={() => void remove(item.id)} disabled={busy}>
                  {busy ? "Siliniyor…" : "Bilgiyi sil"}
                </button>
              </div>
            </div>
          )}
        </article>
      ))}
      {editing && (
        <FactoryForms
          key={editing.id}
          kind="knowledge"
          scope={scope}
          knowledge={editing}
          unboundProjects={[]}
          onClose={() => setEditId("")}
          onSaved={onRefresh}
        />
      )}
    </section>
  );
}
export function ActivityPanel({ workspace }: { workspace: FactoryWorkspace }) {
  return (
    <section>
      <h2>Aktivite geçmişi</h2>
      {workspace.activity.length === 0 && (
        <EmptyState
          title="Henüz aktivite yok"
          description="Plan, görev ve onay işlemleri bu kapsamda kronolojik olarak görünür."
        />
      )}
      <ol className="factory-timeline">
        {workspace.activity.map((item) => (
          <li key={item.id}>
            <time>{dateLabel(item.created_at)}</time>
            <div>
              <strong>{item.detail}</strong>
              <p>{item.actor}</p>
              <TechnicalDetails>
                <p>{item.action}</p>
              </TechnicalDetails>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function ExperiencePanel({ workspace }: { workspace: FactoryWorkspace }) {
  return (
    <section>
      <h2>Olaylar ve deneyim</h2>
      <p className="factory-muted">
        Projeye ait çalışma sonuçları ve tekrar eden sorunlar. Doğrulanan kayıtlar, bağımsız inceleme ve insan onayından
        geçmiştir.
      </p>
      {workspace.incidents.length === 0 && workspace.experiences.length === 0 && (
        <EmptyState
          title="Bu kapsamda olay kaydı yok"
          description="Çalışma sırasında oluşan engeller ve hata kayıtları burada görünür."
        />
      )}
      {workspace.experiences.length > 0 && <h3>Çalışma deneyimleri</h3>}
      {workspace.experiences.map((item) => (
        <article className="factory-knowledge" key={item.id}>
          <div className="factory-section-heading">
            <h3>{item.summary}</h3>
            <Status value={item.outcome} />
          </div>
          {item.evidence.length > 0 && (
            <ul className="factory-evidence">
              {item.evidence.map((evidence, index) => (
                <li key={index}>{evidence}</li>
              ))}
            </ul>
          )}
          <p className="factory-muted">{dateLabel(item.created_at)}</p>
          {item.outcome !== "verified" && (
            <p className="factory-muted">Bu kayıt henüz doğrulanmış bir çözüm olarak kabul edilmez.</p>
          )}
        </article>
      ))}
      {workspace.incidents.length > 0 && <h3>Olay kayıtları</h3>}
      {workspace.incidents.map((item) => (
        <article className="factory-knowledge" key={item.id}>
          <div className="factory-section-heading">
            <h3>{item.title}</h3>
            <Status value={item.status} />
          </div>
          <p className="factory-muted">
            {item.repeat_count > 1 ? `${item.repeat_count} kez tekrarlandı.` : "İlk kaydedilen olay."} Olay kaydı,
            doğrulanmış çözüm anlamına gelmez.
          </p>
          <TechnicalDetails label="Hata ve tekrar bilgisi">
            <pre>{item.detail}</pre>
            <p>Normalize edilen hata: {item.normalized_error}</p>
            <p>Hata kimliği: {item.error_hash}</p>
          </TechnicalDetails>
          <p className="factory-muted">{dateLabel(item.created_at)}</p>
        </article>
      ))}
    </section>
  );
}
export function TeamPanel({
  workspace,
  agents,
  onSelectAgent,
}: {
  workspace: FactoryWorkspace;
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
}) {
  return (
    <section className="factory-team">
      <div className="factory-section-heading">
        <h2>AI çalışanlar</h2>
        <span className="factory-muted">{workspace.agents.length}</span>
      </div>
      {workspace.agents.map((item) => {
        const agent = agents.find((candidate) => candidate.id === item.id);
        const displayName = translateEnglishToTurkish(item.name);
        return (
          <div className="factory-agent" key={item.id}>
            <div className="factory-monogram" aria-hidden="true">
              {displayName.slice(0, 2).toLocaleUpperCase("tr")}
            </div>
            <div className="min-w-0 flex-1">
              <strong>{displayName}</strong>
              <p>{translateEnglishToTurkish(item.department_name || item.role)}</p>
              <Status value={item.status} />
            </div>
            {agent && (
              <button
                aria-label={`${displayName} ile konuş`}
                title={`${displayName} ile konuş`}
                onClick={() => onSelectAgent(agent)}
              >
                <MessageSquare size={16} />
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
export function UsagePanel({ workspace }: { workspace: FactoryWorkspace }) {
  const knownCosts = workspace.runs.filter((run) => run.cost_usd !== null);
  const unknownCosts = workspace.runs.length - knownCosts.length;
  const knownCost = knownCosts.reduce((sum, run) => sum + (run.cost_usd ?? 0), 0);
  return (
    <section>
      <h2>Kullanım</h2>
      <p>{workspace.runs.length} çalışma kaydı</p>
      <p className="factory-muted">
        {knownCosts.length
          ? `Bildirilen maliyet: ${new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(knownCost)}`
          : "Maliyet henüz bildirilmedi"}
      </p>
      {unknownCosts > 0 && <p className="factory-muted">{unknownCosts} çalışmanın maliyeti bilinmiyor.</p>}
      <TechnicalDetails label="Sağlayıcı ve model kayıtları">
        {workspace.runs.map((run) => (
          <div key={run.id}>
            <p>
              {run.provider || "Sağlayıcı belirtilmedi"} · {run.model || "Model belirtilmedi"}
            </p>
            <p>
              Token: {run.input_tokens ?? "?"} giriş / {run.output_tokens ?? "?"} çıkış · Yeniden deneme:{" "}
              {run.retry_count}
            </p>
          </div>
        ))}
      </TechnicalDetails>
    </section>
  );
}
export function TaskEvidenceDialog({
  taskId,
  workspace,
  onClose,
  onOpenTerminal,
}: {
  taskId: string;
  workspace: FactoryWorkspace;
  onClose: () => void;
  onOpenTerminal: (id: string) => void;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getTask>> | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    getTask(taskId)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
    };
  }, [taskId]);
  const outputs = workspace.deliverables.filter((item) => item.task_id === taskId);
  const runStepId = workspace.runs.find((run) => run.task_id === taskId)?.step_id;
  const step = workspace.plans
    .flatMap((plan) => plan.steps)
    .find((item) => item.task_id === taskId || item.id === runStepId);
  return (
    <dialog
      ref={dialog}
      className="factory-dialog factory-dialog--wide"
      onCancel={onClose}
      aria-labelledby="factory-task-title"
    >
      <div className="factory-form">
        <div className="factory-section-heading">
          <h2 id="factory-task-title">Görev ve kanıtlar</h2>
          <button aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {error && <FactoryError error={error} />}
        {!detail && !error && <p role="status">Görev yükleniyor…</p>}
        {detail && (
          <>
            <div className="factory-section-heading">
              <div>
                {step && <p className="factory-eyebrow">{outputTypeLabel(step.output_type)}</p>}
                <h3>{step?.title || detail.task.title}</h3>
              </div>
              <Status value={detail.task.status} />
            </div>
            {step?.description && <p>{step.description}</p>}
            {outputs.map((item) => (
              <DeliverableCard key={item.id} item={item} />
            ))}
            {!outputs.length && <p className="factory-muted">Henüz doğrulanmış bir çıktı kaydı yok.</p>}
            <TechnicalDetails label="Gelişmiş">
              {detail.task.description && (
                <>
                  <h4>Modele gönderilen talimat</h4>
                  <pre>{detail.task.description}</pre>
                </>
              )}
              {detail.task.result && (
                <>
                  <h4>Ham sonuç</h4>
                  <pre>{detail.task.result}</pre>
                </>
              )}
              <h4>Çalışma kayıtları</h4>
              <ol className="factory-evidence">
                {detail.logs.map((log) => (
                  <li key={log.id}>
                    <time>{dateLabel(log.created_at)}</time>
                    <pre>{log.message}</pre>
                  </li>
                ))}
              </ol>
              <button
                onClick={() => {
                  onClose();
                  onOpenTerminal(taskId);
                }}
              >
                Canlı terminali aç <ArrowRight size={14} />
              </button>
            </TechnicalDetails>
          </>
        )}
      </div>
    </dialog>
  );
}
