import type { FactoryStep } from "../../../shared/factory";

export const GRAPH_NODE_WIDTH = 240;
export const GRAPH_NODE_HEIGHT = 126;
const COLUMN_GAP = 36;
const LEVEL_GAP = 72;
export interface WorkflowGraphNode {
  step: FactoryStep;
  x: number;
  y: number;
}
export interface WorkflowGraphEdge {
  id: string;
  from: WorkflowGraphNode;
  to: WorkflowGraphNode;
}
export function buildWorkflowGraph(steps: FactoryStep[]) {
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  let cyclic = false;
  let missingDependency = false;
  function depth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visiting.has(id)) {
      cyclic = true;
      return 0;
    }
    const step = stepMap.get(id);
    if (!step) {
      missingDependency = true;
      return 0;
    }
    visiting.add(id);
    const parents = step.depends_on.filter((parent) => {
      if (!stepMap.has(parent)) {
        missingDependency = true;
        return false;
      }
      return true;
    });
    const level = parents.length ? Math.max(...parents.map(depth)) + 1 : 0;
    visiting.delete(id);
    depths.set(id, level);
    return level;
  }
  const levels = new Map<number, FactoryStep[]>();
  for (const step of [...steps].sort((a, b) => a.position - b.position)) {
    const level = depth(step.id);
    levels.set(level, [...(levels.get(level) ?? []), step]);
  }
  const columns = Math.max(1, ...[...levels.values()].map((items) => items.length));
  const width = columns * GRAPH_NODE_WIDTH + (columns - 1) * COLUMN_GAP + 32;
  const height = (Math.max(0, ...levels.keys()) + 1) * (GRAPH_NODE_HEIGHT + LEVEL_GAP) - LEVEL_GAP + 32;
  const nodes: WorkflowGraphNode[] = [...levels.entries()].flatMap(([level, items]) => {
    const groupWidth = items.length * GRAPH_NODE_WIDTH + (items.length - 1) * COLUMN_GAP;
    return items.map((step, column) => ({
      step,
      x: (width - groupWidth) / 2 + column * (GRAPH_NODE_WIDTH + COLUMN_GAP),
      y: 16 + level * (GRAPH_NODE_HEIGHT + LEVEL_GAP),
    }));
  });
  const nodeMap = new Map(nodes.map((node) => [node.step.id, node]));
  const edges = nodes.flatMap((to) =>
    to.step.depends_on.flatMap((parent) => {
      const from = nodeMap.get(parent);
      return from ? [{ id: `${parent}:${to.step.id}`, from, to }] : [];
    }),
  );
  return { nodes, edges, width, height, cyclic, missingDependency };
}
