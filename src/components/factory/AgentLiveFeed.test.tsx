import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FactoryWorkspace } from "../../../shared/factory";
import AgentLiveFeed from "./AgentLiveFeed";

function workspace(): FactoryWorkspace {
  return {
    businesses: [],
    projects: [],
    agents: [
      {
        id: "a1",
        name: "Mira",
        role: "senior",
        department_id: "product",
        department_name: "Ürün",
        cli_provider: "api",
        status: "working",
        avatar_emoji: "",
      },
    ],
    plans: [],
    approvals: [],
    deliverables: [],
    knowledge: [],
    activity: [
      {
        id: "x1",
        business_id: "b1",
        project_id: null,
        plan_id: "p1",
        action: "agent_note",
        detail: '"Ürün ve MVP planı" adımına başlıyorum.',
        actor: "Mira",
        created_at: Date.now(),
      },
      {
        id: "x2",
        business_id: "b1",
        project_id: null,
        plan_id: "p1",
        action: "step_started",
        detail: "Teknik kayıt",
        actor: "runtime",
        created_at: Date.now(),
      },
    ],
    incidents: [],
    experiences: [],
    blackboard: [],
    mailbox: [],
    runs: [],
  } as unknown as FactoryWorkspace;
}

describe("AgentLiveFeed", () => {
  it("shows only the agents' own short sentences and who is working", () => {
    render(<AgentLiveFeed workspace={workspace()} />);
    expect(screen.getByText("Mira çalışıyor")).toBeInTheDocument();
    expect(screen.getByText('"Ürün ve MVP planı" adımına başlıyorum.')).toBeInTheDocument();
    expect(screen.queryByText("Teknik kayıt")).not.toBeInTheDocument();
  });
});
