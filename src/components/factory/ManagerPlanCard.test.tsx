import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FactoryControllerState, FactoryPlan } from "../../../shared/factory";
import ManagerPlanCard from "./ManagerPlanCard";

function plan(state: FactoryControllerState = "NORMAL"): FactoryPlan {
  return {
    id: "plan1",
    business_id: "b1",
    project_id: "p1",
    instruction: "Doğrulama sürecini çalıştır",
    workflow: "software",
    status: "blocked",
    analysis_mode: "rule_based",
    controller_state: state,
    stopped_reason: state === "STOP" ? "Internal runtime failure trace" : null,
    controller_policy: {
      max_retries: 3,
      same_error_limit: 2,
      max_runtime_ms: 1800000,
      max_cost_usd: null,
      hard_stop: true,
    },
    risk: "low",
    summary: "Çalışma planı",
    missing: state === "STOP" ? ["Internal runtime failure trace"] : [],
    steps: [
      {
        id: "step1",
        plan_id: "plan1",
        position: 1,
        title: "İncele",
        description: "",
        role: "reviewer",
        skills: [],
        depends_on: [],
        agent_id: null,
        task_id: "task1",
        status: "blocked",
        output_type: "review",
        requires_approval: false,
      },
    ],
    created_at: 1,
    updated_at: 1,
  };
}
function props() {
  return {
    agents: [],
    busy: false,
    approvalPending: false,
    planApproved: true,
    onStart: vi.fn(),
    onRecheck: vi.fn(),
    onApprovals: vi.fn(),
    onTask: vi.fn(),
    onSettings: vi.fn(),
  };
}
describe("Manager plan controller and capacity UX", () => {
  it("does not add controller noise for NORMAL state", () => {
    render(<ManagerPlanCard plan={plan()} {...props()} />);
    expect(screen.queryByText("Kontrol durumu: NORMAL")).not.toBeInTheDocument();
    expect(screen.queryByText("Çalışma yaklaşımı incelenmeli")).not.toBeInTheDocument();
  });
  it.each(["STEER", "CONSTRAIN"] as const)("shows truthful %s guidance with a real evidence action", (state) => {
    const callbacks = props();
    render(<ManagerPlanCard plan={plan(state)} {...callbacks} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Çalışma kanıtlarını incele" }));
    expect(callbacks.onTask).toHaveBeenCalledWith("task1");
    expect(screen.getByText(`Kontrol durumu: ${state}`)).not.toBeVisible();
  });
  it("hides futile retry controls for STOP and preserves the raw reason only in technical details", () => {
    render(<ManagerPlanCard plan={plan("STOP")} {...props()} />);
    expect(screen.getByText("Çalışma durduruldu")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Tekrar dene" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eksikleri yeniden kontrol et" })).not.toBeInTheDocument();
    expect(screen.getByText("Internal runtime failure trace")).not.toBeVisible();
  });
  it("rechecks an approved capacity-blocked runtime via start while showing actual cooldown time", () => {
    const data = plan();
    data.missing = ["Sağlayıcı kapasitesi bekleniyor."];
    const callbacks = props();
    render(<ManagerPlanCard plan={data} retryAfter={Date.now() + 60000} {...callbacks} />);
    expect(screen.getByText(/Yeniden deneme zamanı/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kapasiteyi yeniden kontrol et" }));
    expect(callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(callbacks.onRecheck).not.toHaveBeenCalled();
  });
  it("retries an approved plan from the failed output instead of sending the user to integrations", () => {
    const data = plan("CONSTRAIN");
    data.status = "failed";
    data.missing = ["Geçerli JSON çıktı bulunamadı; çıktı şemasını uygulayıp adımı yeniden çalıştırın."];
    const callbacks = props();
    render(<ManagerPlanCard plan={data} {...callbacks} />);
    fireEvent.click(screen.getByRole("button", { name: "Bu adımı yeniden çalıştır" }));
    expect(callbacks.onStart).toHaveBeenCalledTimes(1);
    expect(callbacks.onSettings).not.toHaveBeenCalled();
  });
  it("numbers steps from 1 and labels dependencies and output types for people", () => {
    const data = plan();
    data.steps = [
      { ...data.steps[0], id: "first", position: 0, title: "Ürün planı", output_type: "product", task_id: null },
      { ...data.steps[0], id: "second", position: 1, depends_on: ["first"], task_id: null },
    ];
    const { container } = render(<ManagerPlanCard plan={data} {...props()} />);
    expect(
      [...container.querySelectorAll(".factory-steps .factory-step-number")].map((node) => node.textContent),
    ).toEqual(["1", "2"]);
    expect(screen.getByText(/Önce:\s*1\s*numaralı adım/)).toBeInTheDocument();
    expect(screen.queryByText(/0 numaralı adım/)).not.toBeInTheDocument();
    expect(screen.getByText(/Çıktı: Ürün ve MVP planı/)).toBeInTheDocument();
    expect(screen.getByText(/Çıktı: Bağımsız inceleme/)).toBeInTheDocument();
  });
  it.each(["STEER", "CONSTRAIN", "STOP"] as const)(
    "resets a %s controller only after a required human note",
    async (state) => {
      const callbacks = props();
      const onReset = vi.fn().mockResolvedValue(undefined);
      render(<ManagerPlanCard plan={plan(state)} {...callbacks} onReset={onReset} />);
      fireEvent.click(screen.getByRole("button", { name: "Kontrolü sıfırla" }));
      const confirm = screen.getByRole("button", { name: "Sıfırlamayı onayla" });
      expect(confirm).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Sıfırlama notu"), { target: { value: "  Sağlayıcı kotası yenilendi " } });
      fireEvent.click(confirm);
      await waitFor(() => expect(onReset).toHaveBeenCalledWith("Sağlayıcı kotası yenilendi"));
      expect(await screen.findByRole("button", { name: "Kontrolü sıfırla" })).toBeInTheDocument();
      expect(callbacks.onStart).not.toHaveBeenCalled();
    },
  );
  it("shows the reset failure inline and offers the start button again once the controller is NORMAL", async () => {
    const callbacks = props();
    const onReset = vi.fn().mockRejectedValue(new Error("controller_reset_running"));
    const { rerender } = render(<ManagerPlanCard plan={plan("STOP")} {...callbacks} onReset={onReset} />);
    expect(screen.queryByRole("button", { name: "Tekrar dene" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kontrolü sıfırla" }));
    fireEvent.change(screen.getByLabelText("Sıfırlama notu"), { target: { value: "Kapsam daraltıldı" } });
    fireEvent.click(screen.getByRole("button", { name: "Sıfırlamayı onayla" }));
    expect(await screen.findByText("controller_reset_running")).toBeInTheDocument();
    const reset = plan();
    reset.missing = [];
    rerender(<ManagerPlanCard plan={reset} {...callbacks} onReset={onReset} />);
    expect(screen.queryByRole("button", { name: "Kontrolü sıfırla" })).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Tekrar dene" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(callbacks.onStart).toHaveBeenCalledTimes(1);
  });
  it("does not offer a controller reset for finished plans", () => {
    const data = plan("CONSTRAIN");
    data.status = "completed";
    render(<ManagerPlanCard plan={data} {...props()} onReset={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Kontrolü sıfırla" })).not.toBeInTheDocument();
  });
  it("keeps preflight missing prerequisites on the existing recheck operation", () => {
    const data = plan();
    data.missing = ["Sağlayıcı yapılandırılmadı."];
    const callbacks = props();
    render(<ManagerPlanCard plan={data} {...callbacks} planApproved={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Eksikleri yeniden kontrol et" }));
    expect(callbacks.onRecheck).toHaveBeenCalledTimes(1);
    expect(callbacks.onStart).not.toHaveBeenCalled();
  });
});
