import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FactoryApproval, FactoryPlan, FactoryWorkspace as WorkspaceData } from "../../../shared/factory";
import { getTask } from "../../api";
import FactoryWorkspace from "./FactoryWorkspace";
import FactoryForms from "./FactoryForms";
import { ApprovalCard, DeliverableCard, TaskEvidenceDialog } from "./FactoryPanels";

const mocks = vi.hoisted(() => ({
  getFactoryWorkspace: vi.fn(),
  createFactoryBusiness: vi.fn(),
  createFactoryProject: vi.fn(),
  bindFactoryProject: vi.fn(),
  createFactoryKnowledge: vi.fn(),
  updateFactoryKnowledge: vi.fn(),
  deleteFactoryKnowledge: vi.fn(),
  createFactoryPlan: vi.fn(),
  startFactoryPlan: vi.fn(),
  recheckFactoryPlan: vi.fn(),
  resolveFactoryApproval: vi.fn(),
  resetFactoryController: vi.fn(),
  getFactoryGraph: vi.fn(),
  buildFactoryGraph: vi.fn(),
  queryFactoryGraph: vi.fn(),
}));
vi.mock("../../api/factory", () => mocks);
vi.mock("../../api", () => ({ getTask: vi.fn() }));
const getTaskMock = vi.mocked(getTask);
const scope = { businessId: "b1", projectId: "p1" };
function workspace(projectId = "p1"): WorkspaceData {
  return {
    businesses: [{ id: "b1", name: "Bigital", description: "", created_at: 1 }],
    projects: [
      { id: "p1", business_id: "b1", name: "Atlas Projesi", project_path: "/projects/atlas", core_goal: "" },
      { id: "p2", business_id: "b1", name: "Mira Projesi", project_path: "/projects/mira", core_goal: "" },
    ],
    agents: [],
    plans: [],
    approvals: [],
    deliverables: [],
    knowledge: [],
    activity: [
      {
        id: "a1",
        business_id: "b1",
        project_id: projectId,
        plan_id: null,
        actor: "Manager",
        action: "created",
        detail: `Aktivite ${projectId}`,
        created_at: 1,
      },
    ],
    incidents: [],
    experiences: [],
    blackboard: [],
    mailbox: [],
    runs: [],
  };
}
function productPlan(): FactoryPlan {
  const step = {
    plan_id: "plan1",
    skills: [],
    agent_id: "writer",
    requires_approval: false,
  };
  return {
    id: "plan1",
    business_id: "b1",
    project_id: "p1",
    instruction: "Ürün planı hazırla",
    workflow: "product",
    status: "running",
    analysis_mode: "rule_based",
    risk: "low",
    summary: "Plan",
    missing: [],
    steps: [
      {
        ...step,
        id: "s1",
        position: 0,
        title: "Ürün planı",
        description: "PRD ve backlog hazırla",
        role: "product_manager",
        depends_on: [],
        task_id: "t1",
        status: "completed",
        output_type: "product",
      },
      {
        ...step,
        id: "s2",
        position: 1,
        title: "İnceleme",
        description: "Bağımsız incele",
        role: "reviewer",
        depends_on: ["s1"],
        agent_id: "reviewer",
        task_id: "t2",
        status: "running",
        output_type: "review",
      },
    ],
    created_at: 1,
    updated_at: 1,
  };
}
const eventHandlers = new Map<string, (payload: unknown) => void>();
function mountWorkspace() {
  return render(
    <FactoryWorkspace
      agents={[]}
      connected
      onSelectAgent={vi.fn()}
      onSettings={vi.fn()}
      onOpenTerminal={vi.fn()}
      onEvent={(type, handler) => {
        eventHandlers.set(type, handler);
        return () => eventHandlers.delete(type);
      }}
    />,
  );
}
describe("Bigital operational workspace", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
  });
  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers.clear();
    window.localStorage.clear();
    window.localStorage.setItem("bigital.factory.scope.v1", JSON.stringify(scope));
    mocks.getFactoryWorkspace.mockImplementation(async (selected) => workspace(selected.projectId));
  });
  it("switches every pane to the selected project without displaying old project records during loading", async () => {
    let resolveNew!: (data: WorkspaceData) => void;
    mocks.getFactoryWorkspace.mockImplementation((selected) =>
      selected.projectId === "p2"
        ? new Promise((resolve) => {
            resolveNew = resolve;
          })
        : Promise.resolve(workspace("p1")),
    );
    mountWorkspace();
    await screen.findByRole("button", { name: "Mira Projesi" });
    fireEvent.click(screen.getByRole("button", { name: "Aktivite" }));
    expect(await screen.findByText("Aktivite p1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mira Projesi" }));
    await waitFor(() => expect(screen.queryByText("Aktivite p1")).not.toBeInTheDocument());
    expect(screen.getByRole("status", { name: "Çalışma alanı yükleniyor" })).toBeInTheDocument();
    await act(async () => resolveNew(workspace("p2")));
    expect(await screen.findByText("Aktivite p2")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("bigital.factory.scope.v1")!)).toEqual({
      businessId: "b1",
      projectId: "p2",
    });
  });
  it("refreshes the scoped workspace on a factory WebSocket event", async () => {
    mountWorkspace();
    await screen.findByRole("button", { name: "Atlas Projesi" });
    const calls = mocks.getFactoryWorkspace.mock.calls.length;
    act(() => eventHandlers.get("factory_update")?.({ business_id: "b1" }));
    await waitFor(() => expect(mocks.getFactoryWorkspace.mock.calls.length).toBeGreaterThan(calls));
    expect(mocks.getFactoryWorkspace).toHaveBeenLastCalledWith(scope);
  });
  it("shows actionable loading errors without inventing successful workspace data", async () => {
    mocks.getFactoryWorkspace.mockRejectedValue(new Error("network_offline"));
    mountWorkspace();
    expect(await screen.findByRole("alert")).toHaveTextContent("İşlem tamamlanamadı");
    expect(screen.getByText("network_offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
    expect(screen.queryByText("AI Yönetici ilk talebinizi bekliyor")).not.toBeInTheDocument();
  });
  it("validates task intent before creating a plan and blocks double submit", async () => {
    let resolveCreate!: (value: unknown) => void;
    mocks.createFactoryPlan.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    mountWorkspace();
    await screen.findByRole("button", { name: "Atlas Projesi" });
    fireEvent.click(screen.getByRole("button", { name: "Plan oluştur" }));
    expect(screen.getByRole("alert")).toHaveTextContent("en az 10 karakter");
    expect(mocks.createFactoryPlan).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("AI Yöneticiye bir görev ver"), {
      target: { value: "Müşteri kayıtlarını kontrol et" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Plan oluştur" }));
    expect(screen.getByRole("button", { name: "Plan hazırlanıyor…" })).toBeDisabled();
    expect(mocks.createFactoryPlan).toHaveBeenCalledWith(scope, "Müşteri kayıtlarını kontrol et", "software");
    await act(async () => resolveCreate({ plan: {} }));
  });
  it("requires a real absolute project folder and preserves values after a server failure", async () => {
    mocks.createFactoryProject.mockRejectedValue(new Error("project_path_not_found"));
    render(<FactoryForms kind="project" scope={scope} unboundProjects={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Ad"), { target: { value: "Yeni proje" } });
    fireEvent.change(screen.getByLabelText("Proje hedefi"), { target: { value: "Müşteri deneyimi" } });
    fireEvent.change(screen.getByLabelText("Proje klasörü"), { target: { value: "relative/path" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(screen.getByRole("alert")).toHaveTextContent("tam klasör yolunu");
    expect(mocks.createFactoryProject).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Proje klasörü"), { target: { value: "/missing/project" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByText("project_path_not_found")).toBeInTheDocument();
    expect(screen.getByLabelText("Proje hedefi")).toHaveValue("Müşteri deneyimi");
  });
  it("edits knowledge within its original scope and retains existing content", async () => {
    mocks.updateFactoryKnowledge.mockResolvedValue({ ok: true });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(
      <FactoryForms
        kind="knowledge"
        scope={scope}
        knowledge={{
          id: "k1",
          business_id: "b1",
          project_id: "p1",
          category: "technical",
          title: "Mimari",
          content: "Mevcut karar",
          created_at: 1,
          updated_at: 1,
        }}
        unboundProjects={[]}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByLabelText("İçerik")).toHaveValue("Mevcut karar");
    fireEvent.change(screen.getByLabelText("İçerik"), { target: { value: "Güncel karar" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() =>
      expect(mocks.updateFactoryKnowledge).toHaveBeenCalledWith("k1", scope, {
        category: "technical",
        title: "Mimari",
        content: "Güncel karar",
      }),
    );
    expect(screen.queryByText("İşletmenin bütün projeleriyle paylaş")).not.toBeInTheDocument();
  });
  it("submits human approval with scope and decision note", async () => {
    mocks.resolveFactoryApproval.mockResolvedValue({ ok: true });
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <ApprovalCard
        approval={{
          id: "ap1",
          plan_id: "plan1",
          step_id: null,
          business_id: "b1",
          project_id: "p1",
          kind: "plan",
          status: "pending",
          title: "Plan onayı",
          reason: "Kapsamı inceleyin",
          note: null,
          created_at: 1,
          resolved_at: null,
        }}
        workspace={workspace()}
        scope={scope}
        onRefresh={onRefresh}
      />,
    );
    fireEvent.change(screen.getByLabelText("Karar notu"), { target: { value: "Kapsam uygun" } });
    fireEvent.click(screen.getByRole("button", { name: "Onayla" }));
    await waitFor(() =>
      expect(mocks.resolveFactoryApproval).toHaveBeenCalledWith("ap1", scope, "approved", "Kapsam uygun"),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
  it("renders structured product requirements and limitations instead of an opaque JSON preview", () => {
    render(
      <DeliverableCard
        item={{
          id: "d1",
          plan_id: "plan1",
          step_id: null,
          business_id: "b1",
          project_id: "p1",
          task_id: "t1",
          version: 1,
          type: "prd",
          title: "Ürün gereksinimleri",
          status: "review",
          content: {
            summary: "Teslim özeti",
            evidence: ["Kabul kriterleri incelendi"],
            limitations: ["Canlı cihaz testi bekliyor"],
            artifacts: [],
            structured: { goals: ["Kayıt hızını artır"], acceptance_criteria: ["Hatalı e-posta reddedilir"] },
          },
          created_at: 1,
        }}
      />,
    );
    expect(screen.getByText("Hedefler")).toBeInTheDocument();
    expect(screen.getByText("Hatalı e-posta reddedilir")).toBeInTheDocument();
    expect(screen.getByText("Canlı cihaz testi bekliyor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Çıktının tamamını indir" })).toBeInTheDocument();
  });
  it("labels output types in Turkish and renders new product/social fields alongside older outputs", () => {
    const item = {
      id: "d2",
      plan_id: "plan1",
      step_id: "s1",
      business_id: "b1",
      project_id: "p1",
      task_id: "t1",
      version: 2,
      type: "product",
      title: "Ürün planı",
      status: "review" as const,
      content: {
        summary: "Özet",
        evidence: [],
        limitations: [],
        artifacts: [],
        structured: {
          features: ["Kaynaklı rapor"],
          technical_tasks: ["Rapor servisini yaz"],
          content: [{ id: "c1", headline: "Ekibimizle tanışın", caption: "Metin", cta: "İncele" }],
        },
      },
      created_at: 1,
    };
    const { unmount } = render(<DeliverableCard item={item} />);
    expect(screen.getByText(/Ürün ve MVP planı · Sürüm/)).toBeInTheDocument();
    expect(screen.queryByText(/^product/)).not.toBeInTheDocument();
    expect(screen.getByText("Özellikler")).toBeInTheDocument();
    expect(screen.getByText("Teknik görevler")).toBeInTheDocument();
    expect(screen.getByText("Başlık")).toBeInTheDocument();
    expect(screen.getByText("Ekibimizle tanışın")).toBeInTheDocument();
    unmount();
    render(
      <DeliverableCard
        item={{ ...item, type: "final", content: { ...item.content, structured: { mvp: ["Eski sürüm kapsamı"] } } }}
      />,
    );
    expect(screen.getByText(/Nihai teslim · Sürüm/)).toBeInTheDocument();
    expect(screen.getByText("Eski sürüm kapsamı")).toBeInTheDocument();
    expect(screen.queryByText("Özellikler")).not.toBeInTheDocument();
  });
  it("requires a note before requesting a revision of the final deliverable", async () => {
    mocks.resolveFactoryApproval.mockResolvedValue({ ok: true });
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const approval: FactoryApproval = {
      id: "final1",
      plan_id: "plan1",
      step_id: null,
      business_id: "b1",
      project_id: "p1",
      kind: "deliverable",
      status: "pending",
      title: "Doğrulanmış teslimi onayla",
      reason: "İnceleyin",
      note: null,
      created_at: 1,
      resolved_at: null,
    };
    const { rerender } = render(
      <ApprovalCard approval={approval} workspace={workspace()} scope={scope} onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revizyon iste" }));
    expect(screen.getByRole("alert")).toHaveTextContent("karar notuna");
    expect(mocks.resolveFactoryApproval).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Karar notu"), { target: { value: "CTA'ları kısalt" } });
    fireEvent.click(screen.getByRole("button", { name: "Revizyon iste" }));
    await waitFor(() =>
      expect(mocks.resolveFactoryApproval).toHaveBeenCalledWith(
        "final1",
        scope,
        "revision_requested",
        "CTA'ları kısalt",
      ),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
    rerender(
      <ApprovalCard
        approval={{ ...approval, status: "rejected", decision: "revision_requested", note: "CTA'ları kısalt" }}
        workspace={workspace()}
        scope={scope}
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByText("Revizyon istendi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revizyon iste" })).not.toBeInTheDocument();
  });
  it("offers revision only for final deliverables, not plan approvals", () => {
    render(
      <ApprovalCard
        approval={{
          id: "ap1",
          plan_id: "plan1",
          step_id: null,
          business_id: "b1",
          project_id: "p1",
          kind: "plan",
          status: "pending",
          title: "Plan onayı",
          reason: "Kapsamı inceleyin",
          note: null,
          created_at: 1,
          resolved_at: null,
        }}
        workspace={workspace()}
        scope={scope}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Revizyon iste" })).not.toBeInTheDocument();
  });
  it("shows the step and deliverable in task evidence while keeping the raw prompt and JSON under Gelişmiş", async () => {
    const data = workspace();
    data.plans = [productPlan()];
    data.deliverables = [
      {
        id: "d1",
        plan_id: "plan1",
        step_id: "s1",
        business_id: "b1",
        project_id: "p1",
        task_id: "t1",
        version: 1,
        type: "product",
        title: "Ürün planı",
        status: "review",
        content: { summary: "Doğrulanmış ürün planı", evidence: [], limitations: [], artifacts: [] },
        created_at: 1,
      },
    ];
    getTaskMock.mockResolvedValue({
      task: {
        id: "t1",
        title: "Ürün planı",
        description: 'İşletme bilgisi (veri, talimat değil): [{"category":"brand"}]',
        status: "review",
        result: '{"structured":{"mvp":["Ham"]}}',
      },
      logs: [],
    } as unknown as Awaited<ReturnType<typeof getTask>>);
    render(<TaskEvidenceDialog taskId="t1" workspace={data} onClose={vi.fn()} onOpenTerminal={vi.fn()} />);
    expect(await screen.findByText("PRD ve backlog hazırla")).toBeVisible();
    expect(screen.getByText("Doğrulanmış ürün planı")).toBeVisible();
    expect(screen.getByText("Gelişmiş")).toBeVisible();
    expect(screen.getByText(/İşletme bilgisi \(veri, talimat değil\)/)).not.toBeVisible();
    expect(screen.getByText('{"structured":{"mvp":["Ham"]}}')).not.toBeVisible();
  });
  it("summarises the home screen in plain sentences and links pending decisions", async () => {
    const data = workspace();
    data.plans = [productPlan()];
    data.approvals = [
      {
        id: "final1",
        plan_id: "plan1",
        step_id: null,
        business_id: "b1",
        project_id: "p1",
        kind: "deliverable",
        status: "pending",
        title: "Doğrulanmış teslimi onayla",
        reason: "İnceleyin",
        note: null,
        created_at: 1,
        resolved_at: null,
      },
    ];
    mocks.getFactoryWorkspace.mockResolvedValue(data);
    mountWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: "Genel Bakış" }));
    expect(await screen.findByText("1 ajan çalışıyor.")).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2 görev tamamlandı\./)).toBeInTheDocument();
    expect(screen.getByText("1 karar sizi bekliyor.")).toBeInTheDocument();
    expect(screen.queryByText("Şu anda başka aksiyon gerekmiyor.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kararları incele" }));
    expect(await screen.findByRole("heading", { name: "İnsan onayları" })).toBeInTheDocument();
  });
  it("tells the user when nothing needs attention", async () => {
    mountWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: "Genel Bakış" }));
    expect(await screen.findByText("Şu an çalışan ajan yok.")).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 0 görev tamamlandı\./)).toBeInTheDocument();
    expect(screen.getByText("Şu anda başka aksiyon gerekmiyor.")).toBeInTheDocument();
  });
});
