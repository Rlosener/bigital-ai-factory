/** Public factory contracts. Secrets and provider credentials are never part of these records. */
export type FactoryWorkflow = "software" | "product" | "social";
export type FactoryRisk = "low" | "medium" | "high";
export type FactoryPlanStatus =
  | "draft"
  | "blocked"
  | "approved"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "rejected";
export type FactoryStepStatus = "pending" | "ready" | "running" | "review" | "completed" | "failed" | "blocked";
export interface FactoryBusiness {
  id: string;
  name: string;
  description: string;
  created_at: number;
}
export interface FactoryProject {
  id: string;
  business_id: string | null;
  name: string;
  project_path: string;
  core_goal: string;
  github_repo?: string | null;
}
export interface FactoryAgent {
  id: string;
  name: string;
  role: string;
  department_id: string | null;
  department_name: string | null;
  cli_provider: string | null;
  status: string;
  avatar_emoji: string;
}
export interface FactoryKnowledge {
  id: string;
  business_id: string;
  project_id: string | null;
  category: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
}
export interface FactoryStep {
  id: string;
  plan_id: string;
  position: number;
  title: string;
  description: string;
  role: string;
  skills: string[];
  depends_on: string[];
  agent_id: string | null;
  task_id: string | null;
  status: FactoryStepStatus;
  output_type: string;
  requires_approval: boolean;
}
export type FactoryControllerState = "NORMAL" | "STEER" | "CONSTRAIN" | "STOP";
export interface FactoryControllerPolicy {
  max_retries: number;
  same_error_limit: number;
  max_runtime_ms: number;
  max_cost_usd: number | null;
  hard_stop: boolean;
}
export interface FactoryProviderSeat {
  id: string;
  business_id: string;
  provider: string;
  label?: string;
  api_provider_id: string | null;
  oauth_account_id: string | null;
  enabled: boolean;
  max_concurrency: number;
  reserve_slots: number;
  human_reserve_percent?: number;
  cooldown_until: number | null;
  health: "unknown" | "healthy" | "degraded" | "blocked";
  remaining_fraction: number | null;
  created_at: number;
  updated_at: number;
}
export interface FactoryControlEvent {
  id: string;
  plan_id: string;
  business_id: string;
  project_id: string | null;
  run_id: string | null;
  state: FactoryControllerState;
  action: string;
  reason: string;
  created_at: number;
}
export interface FactoryPlan {
  id: string;
  business_id: string;
  project_id: string | null;
  instruction: string;
  workflow: FactoryWorkflow;
  status: FactoryPlanStatus;
  analysis_mode: "rule_based";
  controller_state?: FactoryControllerState;
  controller_policy?: FactoryControllerPolicy;
  stopped_reason?: string | null;
  risk: FactoryRisk;
  summary: string;
  missing: string[];
  steps: FactoryStep[];
  created_at: number;
  updated_at: number;
}
export type FactoryApprovalDecision = "approved" | "rejected" | "revision_requested";
export interface FactoryApproval {
  id: string;
  plan_id: string;
  step_id: string | null;
  business_id: string;
  project_id: string | null;
  kind: "plan" | "deliverable" | "critical_action";
  status: "pending" | "approved" | "rejected";
  decision?: FactoryApprovalDecision | null;
  title: string;
  reason: string;
  note: string | null;
  created_at: number;
  resolved_at: number | null;
}
export interface FactoryDeliverable {
  id: string;
  plan_id: string;
  step_id: string | null;
  business_id: string;
  project_id: string | null;
  task_id: string | null;
  version: number;
  type: string;
  title: string;
  status: "draft" | "review" | "approved" | "rejected";
  content: {
    summary: string;
    evidence: string[];
    limitations: string[];
    artifacts: string[];
    structured?: Record<string, unknown>;
  };
  created_at: number;
}
export interface FactoryRun {
  id: string;
  plan_id: string;
  step_id: string;
  task_id: string;
  business_id: string;
  project_id: string | null;
  provider: string | null;
  model: string | null;
  status: "running" | "completed" | "failed" | "blocked";
  started_at: number;
  completed_at: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  retry_count: number;
  issue_kind?: "execution" | "quality" | "capacity" | "interrupted" | null;
  retry_after?: number | null;
  provider_seat_id?: string | null;
}
export interface FactoryExperienceEpisode {
  id: string;
  business_id: string;
  project_id: string | null;
  plan_id: string | null;
  task_id: string | null;
  incident_id: string | null;
  error_hash: string | null;
  outcome: "blocked" | "failed" | "verified" | "rejected";
  summary: string;
  evidence: string[];
  created_at: number;
}
export interface FactoryIncident {
  id: string;
  plan_id: string | null;
  business_id: string;
  project_id: string | null;
  task_id: string | null;
  title: string;
  detail: string;
  normalized_error: string;
  error_hash: string;
  repeat_count: number;
  status: "open" | "resolved";
  created_at: number;
}
export interface FactoryActivity {
  id: string;
  business_id: string;
  project_id: string | null;
  plan_id: string | null;
  action: string;
  detail: string;
  actor: string;
  created_at: number;
}
export type FactoryBlackboardSection =
  | "current_objective"
  | "active_plan"
  | "shared_finding"
  | "blocker"
  | "decision"
  | "deliverable";
export interface FactoryHiveContent {
  summary: string;
  items: string[];
  references: string[];
}
export interface FactoryBlackboardEntry {
  id: string;
  business_id: string;
  project_id: string;
  section: FactoryBlackboardSection;
  content: FactoryHiveContent;
  version: number;
  writer: "manager" | "api";
  updated_at: number;
}
export interface FactoryMailboxMessage {
  id: string;
  business_id: string;
  project_id: string;
  plan_id: string | null;
  sender_agent_id: string | null;
  recipient_agent_id: string;
  kind: "review_feedback" | "request" | "inform" | "done";
  content: FactoryHiveContent;
  parent_id: string | null;
  hop_count: number;
  status: "pending" | "handled";
  idempotency_key: string;
  created_at: number;
  handled_at: number | null;
}
export interface FactoryWorkspace {
  businesses: FactoryBusiness[];
  projects: FactoryProject[];
  agents: FactoryAgent[];
  plans: FactoryPlan[];
  approvals: FactoryApproval[];
  deliverables: FactoryDeliverable[];
  knowledge: FactoryKnowledge[];
  activity: FactoryActivity[];
  incidents: FactoryIncident[];
  experiences: FactoryExperienceEpisode[];
  blackboard: FactoryBlackboardEntry[];
  mailbox: FactoryMailboxMessage[];
  provider_seats?: FactoryProviderSeat[];
  control_events?: FactoryControlEvent[];
  runs: FactoryRun[];
}
