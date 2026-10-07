import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FactoryWorkspace } from "../../../shared/factory";
import HivePanel from "./HivePanel";

function workspace(): FactoryWorkspace {
  return {
    businesses: [],
    projects: [],
    agents: [
      {
        id: "reviewer",
        name: "Atlas",
        role: "reviewer",
        department_id: null,
        department_name: null,
        cli_provider: "codex",
        status: "working",
        avatar_emoji: "",
      },
    ],
    plans: [],
    approvals: [],
    deliverables: [],
    knowledge: [],
    activity: [],
    incidents: [],
    experiences: [],
    runs: [],
    blackboard: [
      {
        id: "board1",
        business_id: "b1",
        project_id: "p1",
        section: "shared_finding",
        content: {
          summary: "İnceleme kapsamı belirlendi",
          items: ["E-posta doğrulaması kontrol edilecek"],
          references: ["task:private-ref"],
        },
        version: 3,
        writer: "manager",
        updated_at: 1,
      },
    ],
    mailbox: [
      {
        id: "message1",
        business_id: "b1",
        project_id: "p1",
        plan_id: "plan1",
        sender_agent_id: null,
        recipient_agent_id: "reviewer",
        kind: "review_feedback",
        content: {
          summary: "İç değerlendirme talimatı",
          items: ["Internal tool trace"],
          references: ["private:source"],
        },
        parent_id: null,
        hop_count: 1,
        status: "pending",
        idempotency_key: "one",
        created_at: 1,
        handled_at: null,
      },
    ],
  };
}
describe("Hive scoped coordination", () => {
  it("shows structured shared findings and actual version while keeping raw references collapsed", () => {
    render(<HivePanel workspace={workspace()} />);
    expect(screen.getByText("Ortak bulgular")).toBeInTheDocument();
    expect(screen.getByText("Sürüm 3")).toBeInTheDocument();
    expect(screen.getByText("E-posta doğrulaması kontrol edilecek")).toBeVisible();
    expect(screen.getByText("task:private-ref")).not.toBeVisible();
  });
  it("shows human-readable mailbox activity and actual counts without exposing internal message content in the primary view", () => {
    const data = workspace();
    data.mailbox.push({ ...data.mailbox[0], id: "message2", idempotency_key: "two", status: "handled", handled_at: 2 });
    render(<HivePanel workspace={data} />);
    expect(screen.getAllByText("İnceleme geri bildirimi iletildi")).toHaveLength(2);
    expect(screen.getAllByText("AI Yönetici → Atlas")).toHaveLength(2);
    expect(screen.getByText("Bekliyor")).toBeInTheDocument();
    expect(screen.getByText("İşlendi")).toBeInTheDocument();
    expect(screen.getAllByText("İç değerlendirme talimatı")[0]).not.toBeVisible();
    expect(screen.getAllByText("Internal tool trace")[0]).not.toBeVisible();
    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).not.toBeInTheDocument();
  });
  it("replaces all displayed records on scope data change and has a real empty state", () => {
    const { rerender } = render(<HivePanel workspace={workspace()} />);
    const next = { ...workspace(), blackboard: [], mailbox: [] };
    rerender(<HivePanel workspace={next} />);
    expect(screen.queryByText("İnceleme kapsamı belirlendi")).not.toBeInTheDocument();
    expect(screen.queryByText("İç değerlendirme talimatı")).not.toBeInTheDocument();
    expect(screen.getByText("Henüz ortak çalışma bilgisi yok")).toBeInTheDocument();
    expect(screen.getByText("Henüz koordinasyon kaydı yok")).toBeInTheDocument();
  });
});
