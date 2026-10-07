import type { DatabaseSync } from "node:sqlite";

export function applyFactoryControlSchema(db: DatabaseSync): void {
  const add = (table: string, fields: Array<[string, string]>) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    for (const [name, definition] of fields)
      if (!columns.some((column) => column.name === name))
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  };
  add("factory_plans", [
    ["controller_state", "TEXT NOT NULL DEFAULT 'NORMAL'"],
    ["controller_policy_json", "TEXT NOT NULL DEFAULT '{}'"],
    ["stopped_reason", "TEXT"],
  ]);
  add("factory_runs", [
    ["issue_kind", "TEXT"],
    ["retry_after", "INTEGER"],
    ["provider_seat_id", "TEXT REFERENCES factory_provider_seats(id)"],
  ]);
  db.exec(`
    CREATE TABLE IF NOT EXISTS factory_control_events (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES factory_plans(id), business_id TEXT NOT NULL REFERENCES businesses(id), project_id TEXT REFERENCES projects(id), run_id TEXT REFERENCES factory_runs(id), state TEXT NOT NULL CHECK(state IN ('NORMAL','STEER','CONSTRAIN','STOP')), action TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_factory_control_events_scope ON factory_control_events(business_id,project_id,created_at);
    CREATE TABLE IF NOT EXISTS factory_provider_seats (id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), provider TEXT NOT NULL, api_provider_id TEXT REFERENCES api_providers(id), oauth_account_id TEXT, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), max_concurrency INTEGER NOT NULL DEFAULT 1 CHECK(max_concurrency BETWEEN 1 AND 64), reserve_slots INTEGER NOT NULL DEFAULT 0 CHECK(reserve_slots BETWEEN 0 AND 64), cooldown_until INTEGER, health TEXT NOT NULL DEFAULT 'unknown' CHECK(health IN ('unknown','healthy','degraded','blocked')), remaining_fraction REAL CHECK(remaining_fraction IS NULL OR remaining_fraction BETWEEN 0 AND 1), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_factory_provider_seat_identity ON factory_provider_seats(business_id,provider,api_provider_id,oauth_account_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_provider_seat_unique_identity ON factory_provider_seats(business_id,provider,COALESCE(api_provider_id,''),COALESCE(oauth_account_id,''));
    CREATE TABLE IF NOT EXISTS factory_workers (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES factory_runs(id), seat_id TEXT NOT NULL REFERENCES factory_provider_seats(id), agent_id TEXT NOT NULL REFERENCES agents(id), status TEXT NOT NULL CHECK(status IN ('active','released')), created_at INTEGER NOT NULL, released_at INTEGER);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_worker_active_run ON factory_workers(run_id) WHERE status='active';
    CREATE INDEX IF NOT EXISTS idx_factory_worker_active_seat ON factory_workers(seat_id,status);
  `);
  add("factory_provider_seats", [
    ["human_reserve_percent", "REAL NOT NULL DEFAULT 20 CHECK(human_reserve_percent BETWEEN 0 AND 99)"],
  ]);
}
