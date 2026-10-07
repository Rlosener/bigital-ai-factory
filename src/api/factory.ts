import { del, patch, post, request } from "./core";

import type {
  FactoryApprovalDecision,
  FactoryBusiness,
  FactoryKnowledge,
  FactoryPlan,
  FactoryProject,
  FactoryWorkflow,
  FactoryWorkspace,
} from "../../shared/factory";

export interface FactoryScope {
  businessId: string;
  projectId: string;
}
export function scopeQuery(scope: FactoryScope): string {
  const query = new URLSearchParams();
  if (scope.businessId) query.set("business_id", scope.businessId);
  if (scope.projectId) query.set("project_id", scope.projectId);
  return query.size ? `?${query}` : "";
}
export const getFactoryWorkspace = (scope: FactoryScope) =>
  request<FactoryWorkspace>(`/api/factory/workspace${scopeQuery(scope)}`);

export interface FactoryGraphNode {
  id: string;
  kind: string;
  label: string;
  body: string;
  confidence: string;
  scope: string;
  success: number;
}
export interface FactoryGraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
}
export interface FactoryCodeGraph {
  installed: boolean;
  ready: boolean;
  building: boolean;
  last_error: string | null;
  location: string;
  built_at: number | null;
  built_at_commit: string | null;
  node_count: number;
  edge_count: number;
  community_count: number;
  communities: Array<{ id: string; name: string; size: number }>;
  links: Array<{ source: string; target: string; weight: number }>;
  hubs: Array<{ label: string; source_file: string; degree: number; community: string }>;
}
export interface FactoryCodeHit {
  label: string;
  source_file: string;
  location: string;
  community: string;
}
export interface FactoryGraphOverview {
  nodes: FactoryGraphNode[];
  edges: FactoryGraphEdge[];
  code_graph: FactoryCodeGraph;
}
export const getFactoryGraph = (scope: FactoryScope) =>
  request<FactoryGraphOverview>(`/api/factory/graph${scopeQuery(scope)}`);
export const buildFactoryGraph = (scope: FactoryScope) =>
  post<{ code_graph: FactoryCodeGraph }>(`/api/factory/graph/build${scopeQuery(scope)}`);
export const queryFactoryGraph = (scope: FactoryScope, question: string) =>
  post<{ brief: string; code: FactoryCodeHit[] }>(`/api/factory/graph/query${scopeQuery(scope)}`, { question });
export const createFactoryBusiness = (input: { name: string; description: string }) =>
  post<{ business: FactoryBusiness }>("/api/factory/businesses", input);
export const createFactoryProject = (input: {
  business_id: string;
  name: string;
  project_path: string;
  core_goal: string;
}) => post<{ project: FactoryProject }>("/api/factory/projects", input);
export const bindFactoryProject = (id: string, businessId: string) =>
  post(`/api/factory/projects/${encodeURIComponent(id)}/bind`, { business_id: businessId });
export const createFactoryKnowledge = (input: {
  business_id: string;
  project_id?: string;
  category: string;
  title: string;
  content: string;
}) => post<{ knowledge: FactoryKnowledge }>("/api/factory/knowledge", input);
export const deleteFactoryKnowledge = (id: string, scope: FactoryScope) =>
  del(`/api/factory/knowledge/${encodeURIComponent(id)}${scopeQuery(scope)}`);
export const updateFactoryKnowledge = (
  id: string,
  scope: FactoryScope,
  input: { category: string; title: string; content: string },
) => patch(`/api/factory/knowledge/${encodeURIComponent(id)}${scopeQuery(scope)}`, input);
export const createFactoryPlan = (scope: FactoryScope, instruction: string, workflow: FactoryWorkflow) =>
  post<{ plan: FactoryPlan }>("/api/factory/plans", {
    business_id: scope.businessId,
    project_id: scope.projectId || undefined,
    instruction,
    workflow,
  });
export const startFactoryPlan = (id: string, scope: FactoryScope) =>
  post<{ plan: FactoryPlan }>(`/api/factory/plans/${encodeURIComponent(id)}/start${scopeQuery(scope)}`);
export const recheckFactoryPlan = (id: string, scope: FactoryScope) =>
  post<{ plan: FactoryPlan }>(`/api/factory/plans/${encodeURIComponent(id)}/recheck${scopeQuery(scope)}`);
export const resetFactoryController = (id: string, scope: FactoryScope, note: string) =>
  post<{ plan: FactoryPlan }>(`/api/factory/plans/${encodeURIComponent(id)}/controller/reset${scopeQuery(scope)}`, {
    note,
  });
export const resolveFactoryApproval = (
  id: string,
  scope: FactoryScope,
  decision: FactoryApprovalDecision,
  note: string,
) => post(`/api/factory/approvals/${encodeURIComponent(id)}/resolve${scopeQuery(scope)}`, { decision, note });
