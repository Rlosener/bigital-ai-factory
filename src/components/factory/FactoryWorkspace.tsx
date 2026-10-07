import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CircleHelp, FolderPlus, Plus, RefreshCw, Send } from "lucide-react";
import type { Agent, WSEventType } from "../../types";
import type { ProjectMetaPayload } from "../../app/types";
import type { FactoryWorkflow, FactoryWorkspace as WorkspaceData } from "../../../shared/factory";
import * as api from "../../api/factory";
import { useFactoryWorkspace } from "./useFactoryWorkspace";
import FactoryForms, { type FactoryFormKind } from "./FactoryForms";
import ManagerPlanCard from "./ManagerPlanCard";
import { GraphPanel } from "./GraphNervousSystem";
import AgentLiveFeed from "./AgentLiveFeed";
import HivePanel from "./HivePanel";
import {
  ActivityPanel,
  ApprovalCard,
  DeliverableCard,
  EmptyState,
  ExperiencePanel,
  KnowledgePanel,
  TaskEvidenceDialog,
  TeamPanel,
  UsagePanel,
} from "./FactoryPanels";
import { FactoryError } from "./TechnicalDetails";
import { Status, workflowLabels } from "./presentation";

type Tab =
  | "manager"
  | "overview"
  | "tasks"
  | "outputs"
  | "approvals"
  | "knowledge"
  | "hive"
  | "activity"
  | "experience"
  | "graph";
const tabs: { id: Tab; title: string }[] = [
  { id: "manager", title: "AI Yönetici" },
  { id: "overview", title: "Genel Bakış" },
  { id: "tasks", title: "Görevler" },
  { id: "outputs", title: "Çıktılar" },
  { id: "approvals", title: "Onaylar" },
  { id: "knowledge", title: "Bilgi" },
  { id: "hive", title: "Ortak Alan" },
  { id: "activity", title: "Aktivite" },
  { id: "experience", title: "Deneyim" },
  { id: "graph", title: "Sinir Ağı" },
];
interface Props {
  agents: Agent[];
  connected: boolean;
  onSelectAgent: (agent: Agent, projectMeta?: ProjectMetaPayload) => void;
  onSettings: () => void;
  onOpenTerminal: (id: string) => void;
  onEvent: (type: WSEventType, listener: (payload: unknown) => void) => () => void;
}

function ManagerComposer({ scope, onPlanned }: { scope: api.FactoryScope; onPlanned: () => Promise<void> }) {
  const [instruction, setInstruction] = useState("");
  const [workflow, setWorkflow] = useState<FactoryWorkflow>("software");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setValidation("");
    if (instruction.trim().length < 10) {
      setValidation("Yapılacak işi en az 10 karakterle açıklayın.");
      return;
    }
    if (!scope.projectId) {
      setValidation("İşin yapılacağı projeyi üstteki sekmelerden seçin veya bir proje ekleyin.");
      return;
    }
    setBusy(true);
    try {
      await api.createFactoryPlan(scope, instruction.trim(), workflow);
      setInstruction("");
      await onPlanned();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="factory-composer" onSubmit={submit} noValidate>
      <label htmlFor="factory-instruction">AI Yöneticiye bir görev ver</label>
      <textarea
        id="factory-instruction"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="Yapılacak işi, beklenen sonucu ve varsa sınırları anlatın…"
        maxLength={10000}
        rows={4}
        disabled={busy}
      />
      <div className="factory-composer-footer">
        <label htmlFor="factory-workflow" className="sr-only">
          İş akışı
        </label>
        <select
          id="factory-workflow"
          value={workflow}
          onChange={(event) => setWorkflow(event.target.value as FactoryWorkflow)}
          disabled={busy}
        >
          {Object.entries(workflowLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="factory-primary" disabled={busy || !scope.businessId}>
          <Send size={15} />
          {busy ? "Plan hazırlanıyor…" : "Plan oluştur"}
        </button>
      </div>
      {validation && (
        <p className="factory-error" role="alert">
          {validation}
        </p>
      )}
      {error && <FactoryError error={error} />}
      <p className="factory-muted factory-composer-hint">
        Kural tabanlı ön plan; uzman atamaları ve eksikler başlatmadan önce görünür. Kod veya içerik çalışması, planı
        başlattığınızda gerçek çalışanlar tarafından yürütülür.
      </p>
    </form>
  );
}

function Overview({ workspace, onTab }: { workspace: WorkspaceData; onTab: (tab: Tab) => void }) {
  const steps = workspace.plans.flatMap((plan) => plan.steps);
  const completed = steps.filter((step) => step.status === "completed").length;
  const pending = workspace.approvals.filter((item) => item.status === "pending").length;
  const working = workspace.runs.filter((run) => run.status === "running").length;
  const activeAgents =
    new Set(steps.filter((step) => step.status === "running" && step.agent_id).map((step) => step.agent_id)).size ||
    working;
  const blocked = workspace.plans.filter((plan) => plan.status === "blocked" || plan.status === "failed");
  const stopped = workspace.plans.filter(
    (plan) =>
      !["completed", "rejected"].includes(plan.status) &&
      (plan.status === "blocked" || plan.controller_state === "STOP"),
  ).length;
  const decisions = pending + stopped;
  return (
    <section>
      <div className="factory-plan" aria-label="Kısa özet">
        <p>{activeAgents ? `${activeAgents} ajan çalışıyor.` : "Şu an çalışan ajan yok."}</p>
        <p>
          {completed} / {steps.length} görev tamamlandı.
        </p>
        {decisions > 0 ? (
          <>
            <p>
              <strong>{decisions} karar sizi bekliyor.</strong>
            </p>
            <div className="factory-actions">
              <button className="factory-primary" onClick={() => onTab(pending > 0 ? "approvals" : "manager")}>
                Kararları incele <ArrowRight size={14} />
              </button>
            </div>
          </>
        ) : (
          <p className="factory-muted">Şu anda başka aksiyon gerekmiyor.</p>
        )}
      </div>
      <div className="factory-section-heading">
        <h2>Çalışma durumu</h2>
        <span className="factory-muted">
          {blocked.length
            ? `${blocked.length} planın ilgilenilmeye ihtiyacı var`
            : working
              ? "Çalışma sürüyor"
              : "Yeni işler için hazır"}
        </span>
      </div>
      {!workspace.plans.length && (
        <EmptyState
          title="İlk işi AI Yönetici ile planlayın"
          description="Bir proje seçip yapılacak işi anlatın. Uzmanlar, bağımlılıklar ve onay adımları planınızda görünecek."
        />
      )}
      {workspace.plans.slice(0, 5).map((plan) => (
        <button key={plan.id} className="factory-list-row" onClick={() => onTab("manager")}>
          <span>{plan.instruction}</span>
          <Status value={plan.status} />
          <ArrowRight size={15} />
        </button>
      ))}
      <div className="factory-cost-note">
        <CircleHelp size={15} />
        <p>
          Gerçek kullanım ve maliyet verileri sağlayıcı tarafından bildirildiğinde kaydedilir. Bilinmeyen maliyetler
          sıfır kabul edilmez.
        </p>
      </div>
    </section>
  );
}

export default function FactoryWorkspace({
  agents,
  connected,
  onSelectAgent,
  onSettings,
  onOpenTerminal,
  onEvent,
}: Props) {
  const { scope, workspace, projects, selectBusiness, selectProject, refresh, loading, error } = useFactoryWorkspace();
  const [tab, setTab] = useState<Tab>("manager");
  const [form, setForm] = useState<FactoryFormKind | null>(null);
  const [taskId, setTaskId] = useState("");
  const [busyPlan, setBusyPlan] = useState("");
  const [actionError, setActionError] = useState("");
  const scopeKey = `${scope.businessId}:${scope.projectId}`;
  const business = workspace?.businesses.find((item) => item.id === scope.businessId);
  const project = projects.find((item) => item.id === scope.projectId);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 120);
    };
    const off = [
      onEvent("factory_update", update),
      onEvent("task_update", update),
      onEvent("agent_status", update),
      onEvent("connected", update),
    ];
    return () => {
      clearTimeout(timer);
      off.forEach((unsubscribe) => unsubscribe());
    };
  }, [onEvent, refresh]);
  async function start(planId: string) {
    if (busyPlan) return;
    setBusyPlan(planId);
    setActionError("");
    try {
      await api.startFactoryPlan(planId, scope);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyPlan("");
    }
  }
  async function recheck(planId: string) {
    if (busyPlan) return;
    setBusyPlan(planId);
    setActionError("");
    try {
      await api.recheckFactoryPlan(planId, scope);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyPlan("");
    }
  }
  async function resetController(planId: string, note: string) {
    if (busyPlan) return;
    setBusyPlan(planId);
    setActionError("");
    try {
      await api.resetFactoryController(planId, scope, note);
      await refresh();
    } finally {
      setBusyPlan("");
    }
  }
  function changeProject(id: string) {
    selectProject(id);
    setTaskId("");
    setForm(null);
    setActionError("");
  }
  return (
    <div className="factory-workspace">
      <header className="factory-workspace-header">
        <div>
          <p className="factory-eyebrow">
            BIGITAL AI FACTORY{" "}
            <span className="factory-connection">{connected ? "Canlı bağlantı" : "Bağlantı yeniden kuruluyor"}</span>
          </p>
          <h1>İşlerinizi birlikte ilerletelim.</h1>
          <p className="factory-muted">İşletme bilgisi, uzman ekip ve insan onayı aynı çalışma alanında.</p>
        </div>
        <div className="factory-workspace-controls">
          <label htmlFor="factory-business" className="sr-only">
            İşletme
          </label>
          <select
            id="factory-business"
            value={scope.businessId}
            onChange={(event) => {
              selectBusiness(event.target.value);
              setForm(null);
              setTaskId("");
              setActionError("");
            }}
            aria-label="İşletme"
          >
            <option value="" disabled>
              İşletme seçin
            </option>
            {workspace?.businesses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button aria-label="Yeni işletme" title="Yeni işletme" onClick={() => setForm("business")}>
            <Plus size={17} />
          </button>
          <button aria-label="Çalışma alanını yenile" title="Yenile" onClick={() => void refresh()}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      <div className="factory-project-tabs" aria-label="Projeler">
        <button className={!scope.projectId ? "active" : ""} onClick={() => changeProject("")}>
          İşletme geneli
        </button>
        {projects.map((item) => (
          <button
            key={item.id}
            className={scope.projectId === item.id ? "active" : ""}
            onClick={() => changeProject(item.id)}
          >
            {item.name}
          </button>
        ))}
        <button onClick={() => setForm("project")} disabled={!scope.businessId}>
          <FolderPlus size={15} />
          Proje ekle
        </button>
      </div>
      <div className="factory-context">
        <div>
          <strong>{project?.name || business?.name || "Çalışma alanı"}</strong>
          <span>{project?.core_goal || business?.description || "Aktif kapsamı seçerek başlayın."}</span>
        </div>
        {project && <span className="factory-context-tag">Proje kapsamı</span>}
      </div>
      <nav className="factory-tabs" aria-label="Çalışma alanı bölümleri">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.title}
            {item.id === "approvals" &&
              workspace &&
              workspace.approvals.some((approval) => approval.status === "pending") && (
                <span>{workspace.approvals.filter((approval) => approval.status === "pending").length}</span>
              )}
          </button>
        ))}
      </nav>
      {error && (
        <div className="factory-fetch-error">
          <FactoryError error={error} />
          <button onClick={() => void refresh()}>Tekrar dene</button>
          {(scope.businessId || scope.projectId) && (
            <button
              onClick={() => {
                selectBusiness("");
                setTaskId("");
                setForm(null);
                setActionError("");
              }}
            >
              Varsayılan çalışma alanını aç
            </button>
          )}
        </div>
      )}
      {loading && (
        <div className="factory-skeleton" role="status" aria-label="Çalışma alanı yükleniyor">
          <span />
          <span />
          <span />
        </div>
      )}
      {workspace && (
        <div className="factory-body">
          <div className="factory-main" key={scopeKey}>
            {actionError && <FactoryError error={actionError} />}
            {tab === "manager" && <AgentLiveFeed workspace={workspace} />}
            {(tab === "manager" || tab === "overview") && <ManagerComposer scope={scope} onPlanned={refresh} />}
            {tab === "overview" && <Overview workspace={workspace} onTab={setTab} />}
            {tab === "graph" && <GraphPanel scope={scope} />}
            {tab === "manager" && (
              <section>
                <div className="factory-section-heading">
                  <h2>Planlar ve çalışmalar</h2>
                  <span className="factory-muted">{workspace.plans.length} plan</span>
                </div>
                {workspace.plans.length === 0 && (
                  <EmptyState
                    title="AI Yönetici ilk talebinizi bekliyor"
                    description="Talebinizi yukarıda yazın. Planı inceleyip başlattıktan sonra görevlerin ilerleyişini buradan takip edebilirsiniz."
                  />
                )}
                {workspace.plans.map((plan) => (
                  <ManagerPlanCard
                    key={plan.id}
                    plan={plan}
                    agents={workspace.agents}
                    busy={busyPlan === plan.id}
                    approvalPending={workspace.approvals.some(
                      (approval) =>
                        approval.plan_id === plan.id && approval.kind === "plan" && approval.status === "pending",
                    )}
                    planApproved={workspace.approvals.some(
                      (approval) =>
                        approval.plan_id === plan.id && approval.kind === "plan" && approval.status === "approved",
                    )}
                    retryAfter={workspace.runs
                      .filter(
                        (run) => run.plan_id === plan.id && run.issue_kind === "capacity" && run.retry_after != null,
                      )
                      .reduce<number | null>((latest, run) => Math.max(latest || 0, run.retry_after!), null)}
                    onStart={() => void start(plan.id)}
                    onRecheck={() => void recheck(plan.id)}
                    onReset={(note) => resetController(plan.id, note)}
                    onApprovals={() => setTab("approvals")}
                    onTask={setTaskId}
                    onSettings={onSettings}
                  />
                ))}
              </section>
            )}
            {tab === "tasks" && (
              <section>
                <h2>Görevler</h2>
                {!workspace.plans.length && (
                  <EmptyState
                    title="Henüz planlanmış görev yok"
                    description="AI Yönetici ile bir iş planlayın; her adımın sorumlusu ve çalışma durumu burada görünür."
                  />
                )}
                {workspace.plans.flatMap((plan) =>
                  plan.steps.map((step) => (
                    <div key={step.id} className="factory-list-row">
                      <div>
                        <strong>{step.title}</strong>
                        <p>{workspace.agents.find((item) => item.id === step.agent_id)?.name || "Çalışan atanmadı"}</p>
                      </div>
                      <Status value={step.status} />
                      {step.task_id && (
                        <button onClick={() => setTaskId(step.task_id!)}>
                          İncele <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  )),
                )}
              </section>
            )}
            {tab === "outputs" && (
              <section>
                <h2>Çıktılar</h2>
                {!workspace.deliverables.length && (
                  <EmptyState
                    title="Henüz çıktı kaydı yok"
                    description="Tamamlanan işlerin özetleri, doğrulama kanıtları ve kalan sınırlar burada görünür."
                  />
                )}
                {workspace.deliverables.map((item) => (
                  <DeliverableCard key={item.id} item={item} />
                ))}
              </section>
            )}
            {tab === "approvals" && (
              <section>
                <h2>İnsan onayları</h2>
                <p className="factory-muted">
                  Karar vermeden önce kapsamı, çıktıyı ve doğrulama kanıtlarını inceleyin.
                </p>
                {!workspace.approvals.length && (
                  <EmptyState
                    title="Bekleyen onay yok"
                    description="Kritik planlar ve çıktı incelemeleri onay gerektirdiğinde burada görünür."
                  />
                )}
                {workspace.approvals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    workspace={workspace}
                    scope={scope}
                    onRefresh={refresh}
                  />
                ))}
              </section>
            )}
            {tab === "knowledge" && (
              <KnowledgePanel
                workspace={workspace}
                scope={scope}
                onAdd={() => setForm("knowledge")}
                onRefresh={refresh}
              />
            )}
            {tab === "hive" && <HivePanel workspace={workspace} />}
            {tab === "activity" && <ActivityPanel workspace={workspace} />}
            {tab === "experience" && <ExperiencePanel workspace={workspace} />}
          </div>
          <aside className="factory-inspector">
            <TeamPanel
              workspace={workspace}
              agents={agents}
              onSelectAgent={(agent) =>
                onSelectAgent(
                  agent,
                  project
                    ? { project_id: project.id, project_path: project.project_path, project_context: project.core_goal }
                    : undefined,
                )
              }
            />
            <section>
              <h2>Aktif bağlam</h2>
              <p>{project?.name || business?.name}</p>
              <p className="factory-muted">
                {workspace.knowledge.length} bilgi kaydı · {workspace.plans.length} plan
              </p>
              <button onClick={() => setTab("knowledge")}>
                Bilgi tabanını aç <ArrowRight size={14} />
              </button>
              <button onClick={onSettings}>
                Entegrasyonlar <ArrowRight size={14} />
              </button>
            </section>
            <UsagePanel workspace={workspace} />
          </aside>
        </div>
      )}
      {form && (
        <FactoryForms
          key={`${scopeKey}:${form}`}
          kind={form}
          scope={scope}
          unboundProjects={workspace?.projects.filter((item) => !item.business_id) ?? []}
          onClose={() => setForm(null)}
          onSaved={async (id) => {
            if (id && form === "business") selectBusiness(id);
            else if (id && form === "project") selectProject(id);
            await refresh();
          }}
        />
      )}
      {taskId && workspace && (
        <TaskEvidenceDialog
          key={`${scopeKey}:${taskId}`}
          taskId={taskId}
          workspace={workspace}
          onClose={() => setTaskId("")}
          onOpenTerminal={onOpenTerminal}
        />
      )}
    </div>
  );
}
