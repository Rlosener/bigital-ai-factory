import type { DatabaseSync } from "node:sqlite";
import { normalizeFactoryError } from "./incidents.ts";
import { applyFactoryControlSchema } from "./control-schema.ts";
import { applyGraphIntelligenceSchema } from "./graph/schema.ts";

/** Additive and repeatable: existing projects remain unbound until explicitly selected. */
export function applyFactorySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
  `);
  const columns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "business_id")) {
    db.exec("ALTER TABLE projects ADD COLUMN business_id TEXT REFERENCES businesses(id)");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS factory_knowledge (id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), project_id TEXT REFERENCES projects(id), category TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS factory_plans (id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), project_id TEXT REFERENCES projects(id), instruction TEXT NOT NULL, workflow TEXT NOT NULL CHECK(workflow IN ('software','product','social')), status TEXT NOT NULL CHECK(status IN ('draft','blocked','approved','running','awaiting_approval','completed','failed','rejected')), analysis_mode TEXT NOT NULL DEFAULT 'rule_based', risk TEXT NOT NULL CHECK(risk IN ('low','medium','high')), summary TEXT NOT NULL, missing_json TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS factory_steps (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES factory_plans(id) ON DELETE CASCADE, position INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, role TEXT NOT NULL, skills_json TEXT NOT NULL, depends_on_json TEXT NOT NULL DEFAULT '[]', agent_id TEXT REFERENCES agents(id), task_id TEXT REFERENCES tasks(id), status TEXT NOT NULL DEFAULT 'pending', output_type TEXT NOT NULL, requires_approval INTEGER NOT NULL DEFAULT 0, UNIQUE(plan_id,position));
    CREATE TABLE IF NOT EXISTS factory_approvals (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES factory_plans(id) ON DELETE CASCADE, step_id TEXT REFERENCES factory_steps(id), business_id TEXT NOT NULL REFERENCES businesses(id), project_id TEXT REFERENCES projects(id), kind TEXT NOT NULL CHECK(kind IN ('plan','deliverable','critical_action')), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), title TEXT NOT NULL, reason TEXT NOT NULL, note TEXT, created_at INTEGER NOT NULL, resolved_at INTEGER);
    CREATE TABLE IF NOT EXISTS factory_deliverables (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES factory_plans(id) ON DELETE CASCADE, step_id TEXT REFERENCES factory_steps(id), business_id TEXT NOT NULL REFERENCES businesses(id), project_id TEXT REFERENCES projects(id), task_id TEXT REFERENCES tasks(id), version INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'review' CHECK(status IN ('draft','review','approved','rejected')), content_json TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(plan_id,step_id,version));
    CREATE TABLE IF NOT EXISTS factory_runs (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES factory_plans(id) ON DELETE CASCADE, step_id TEXT NOT NULL REFERENCES factory_steps(id), task_id TEXT NOT NULL REFERENCES tasks(id), business_id TEXT NOT NULL REFERENCES businesses(id), project_id TEXT REFERENCES projects(id), provider TEXT, model TEXT, status TEXT NOT NULL CHECK(status IN ('running','completed','failed','blocked')), started_at INTEGER NOT NULL, completed_at INTEGER, input_tokens INTEGER, output_tokens INTEGER, cost_usd REAL, retry_count INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS factory_incidents (id TEXT PRIMARY KEY, plan_id TEXT REFERENCES factory_plans(id), business_id TEXT NOT NULL REFERENCES businesses(id), project_id TEXT REFERENCES projects(id), task_id TEXT REFERENCES tasks(id), title TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')), created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS factory_blackboard (id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),project_id TEXT NOT NULL REFERENCES projects(id),section TEXT NOT NULL CHECK(section IN ('current_objective','active_plan','shared_finding','blocker','decision','deliverable')),content_json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,writer TEXT NOT NULL CHECK(writer IN ('manager','api')),updated_at INTEGER NOT NULL,UNIQUE(business_id,project_id,section));
    CREATE TABLE IF NOT EXISTS factory_mailbox (id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),project_id TEXT NOT NULL REFERENCES projects(id),plan_id TEXT REFERENCES factory_plans(id),sender_agent_id TEXT REFERENCES agents(id),recipient_agent_id TEXT NOT NULL REFERENCES agents(id),kind TEXT NOT NULL CHECK(kind IN ('review_feedback','request','inform','done')),content_json TEXT NOT NULL,parent_id TEXT REFERENCES factory_mailbox(id),hop_count INTEGER NOT NULL DEFAULT 0 CHECK(hop_count BETWEEN 0 AND 8),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','handled')),idempotency_key TEXT NOT NULL,created_at INTEGER NOT NULL,handled_at INTEGER,UNIQUE(business_id,project_id,idempotency_key));
    CREATE INDEX IF NOT EXISTS idx_factory_mailbox_recipient ON factory_mailbox(business_id,project_id,recipient_agent_id,status,created_at);
    CREATE TABLE IF NOT EXISTS factory_activity (id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), project_id TEXT REFERENCES projects(id), plan_id TEXT REFERENCES factory_plans(id), action TEXT NOT NULL, detail TEXT NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_factory_projects_business ON projects(business_id);
    CREATE INDEX IF NOT EXISTS idx_factory_knowledge_scope ON factory_knowledge(business_id,project_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_factory_plans_scope ON factory_plans(business_id,project_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_factory_approvals_pending ON factory_approvals(business_id,project_id,status);
    CREATE INDEX IF NOT EXISTS idx_factory_steps_plan ON factory_steps(plan_id,position);
    CREATE INDEX IF NOT EXISTS idx_factory_activity_scope ON factory_activity(business_id,project_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_factory_runs_plan ON factory_runs(plan_id,started_at);
    CREATE INDEX IF NOT EXISTS idx_factory_runs_scope ON factory_runs(business_id,project_id,started_at);
    CREATE INDEX IF NOT EXISTS idx_factory_deliverables_scope ON factory_deliverables(business_id,project_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_factory_incidents_scope ON factory_incidents(business_id,project_id,created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_deliverable_versions ON factory_deliverables(plan_id,COALESCE(step_id,''),version);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_pending_approvals ON factory_approvals(plan_id,kind,COALESCE(step_id,'')) WHERE status='pending';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_step_task ON factory_steps(task_id) WHERE task_id IS NOT NULL;
  `);
  const incidentColumns = db.prepare("PRAGMA table_info(factory_incidents)").all() as Array<{ name: string }>;
  for (const [name, definition] of [
    ["normalized_error", "TEXT NOT NULL DEFAULT ''"],
    ["error_hash", "TEXT NOT NULL DEFAULT ''"],
    ["repeat_count", "INTEGER NOT NULL DEFAULT 1"],
  ]) {
    if (!incidentColumns.some((column) => column.name === name))
      db.exec(`ALTER TABLE factory_incidents ADD COLUMN ${name} ${definition}`);
  }
  const approvalColumns = db.prepare("PRAGMA table_info(factory_approvals)").all() as Array<{ name: string }>;
  if (!approvalColumns.some((column) => column.name === "decision"))
    db.exec("ALTER TABLE factory_approvals ADD COLUMN decision TEXT");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_factory_incident_hash ON factory_incidents(business_id,project_id,error_hash);
    CREATE TABLE IF NOT EXISTS factory_experience_episodes (id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),project_id TEXT REFERENCES projects(id),plan_id TEXT REFERENCES factory_plans(id),task_id TEXT REFERENCES tasks(id),incident_id TEXT REFERENCES factory_incidents(id),error_hash TEXT,outcome TEXT NOT NULL CHECK(outcome IN ('blocked','failed','verified','rejected')),summary TEXT NOT NULL,evidence_json TEXT NOT NULL DEFAULT '[]',created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_factory_experience_scope ON factory_experience_episodes(business_id,project_id,created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_verified_episode ON factory_experience_episodes(plan_id) WHERE outcome='verified';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_incident_episode ON factory_experience_episodes(incident_id,outcome) WHERE incident_id IS NOT NULL;
  `);
  for (const row of db
    .prepare(
      "SELECT id,business_id,project_id,detail FROM factory_incidents WHERE error_hash='' ORDER BY created_at,id",
    )
    .all()) {
    const { normalized_error, error_hash } = normalizeFactoryError(String(row.detail));
    const prior = db
      .prepare(
        "SELECT COUNT(*) AS count FROM factory_incidents WHERE business_id=? AND project_id IS ? AND error_hash=?",
      )
      .get(row.business_id, row.project_id, error_hash);
    db.prepare("UPDATE factory_incidents SET normalized_error=?,error_hash=?,repeat_count=? WHERE id=?").run(
      normalized_error,
      error_hash,
      Number(prior?.count ?? 0) + 1,
      row.id,
    );
  }
  db.prepare(
    "INSERT OR IGNORE INTO businesses(id,name,description,created_at) VALUES ('bigital','Bigital','Bigital şirket içi AI çalışma alanı',?)",
  ).run(Date.now());
  applyFactoryControlSchema(db);
  const seatColumns = db.prepare("PRAGMA table_info(factory_provider_seats)").all() as Array<{ name: string }>;
  if (!seatColumns.some((column) => column.name === "label"))
    db.exec("ALTER TABLE factory_provider_seats ADD COLUMN label TEXT NOT NULL DEFAULT ''");
  applyGraphIntelligenceSchema(db);
}
