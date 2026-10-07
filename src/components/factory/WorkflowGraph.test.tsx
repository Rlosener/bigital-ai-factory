import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FactoryPlan, FactoryStep } from "../../../shared/factory";
import WorkflowGraph from "./WorkflowGraph";
import { buildWorkflowGraph, GRAPH_NODE_HEIGHT } from "./workflow-graph";

const step = (id: string, position: number, depends_on: string[] = []): FactoryStep => ({
  id,
  plan_id: "plan1",
  position,
  title: `Adım ${id}`,
  description: "",
  role: "developer",
  skills: [],
  depends_on,
  agent_id: "agent1",
  task_id: id === "a" ? "task1" : null,
  status: id === "a" ? "running" : "pending",
  output_type: "prd",
  requires_approval: false,
});
const plan: FactoryPlan = {
  id: "plan1",
  business_id: "b1",
  project_id: "p1",
  instruction: "Ürün için akış hazırla",
  workflow: "product",
  status: "running",
  analysis_mode: "rule_based",
  risk: "low",
  summary: "",
  missing: [],
  steps: [step("a", 0), step("b", 1, ["a"]), step("c", 2, ["a"]), step("d", 3, ["b", "c"])],
  created_at: 1,
  updated_at: 1,
};
describe("Read-only workflow graph", () => {
  it("lays out real parallel steps and dependencies without overlapping nodes", () => {
    const graph = buildWorkflowGraph(plan.steps);
    const get = (id: string) => graph.nodes.find((node) => node.step.id === id)!;
    expect(graph.edges).toHaveLength(4);
    expect(get("b").y).toBe(get("c").y);
    expect(get("b").x).not.toBe(get("c").x);
    expect(get("d").y).toBeGreaterThan(get("b").y + GRAPH_NODE_HEIGHT);
    expect(graph.cyclic).toBe(false);
  });
  it("renders assignee, status, dependency edges and opens existing task evidence", () => {
    const onTask = vi.fn();
    const { container } = render(
      <WorkflowGraph
        plan={plan}
        agents={[
          {
            id: "agent1",
            name: "Mira",
            role: "product",
            department_id: null,
            department_name: "Product",
            cli_provider: "codex",
            status: "working",
            avatar_emoji: "",
          },
        ]}
        onTask={onTask}
      />,
    );
    expect(container.querySelectorAll("path[data-from]")).toHaveLength(4);
    expect(screen.getByRole("article", { name: "1. Adım a" })).toBeInTheDocument();
    expect([...container.querySelectorAll(".factory-step-number")].map((node) => node.textContent).sort()).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(screen.getByText("Çalışıyor")).toBeInTheDocument();
    expect(screen.getAllByText("Mira · Yazılım Geliştirici")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Görevi incele" }));
    expect(onTask).toHaveBeenCalledWith("task1");
    expect(screen.queryByRole("button", { name: "Kaydet" })).not.toBeInTheDocument();
  });
  it("reports malformed dependencies without inventing nodes or recursively hanging", () => {
    const malformed = { ...plan, steps: [step("a", 1, ["b"]), step("b", 2, ["a", "missing"])] };
    const graph = buildWorkflowGraph(malformed.steps);
    expect(graph.cyclic).toBe(true);
    expect(graph.missingDependency).toBe(true);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
    render(<WorkflowGraph plan={malformed} agents={[]} onTask={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("döngü bulundu");
  });
});
