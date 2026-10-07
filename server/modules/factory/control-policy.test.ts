import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  evaluateFactoryController,
  evaluateFactoryCapacity,
  parseFactoryCapacityFailure,
  type FactoryControlSignal,
  type FactorySeatSnapshot,
} from "./control-policy.ts";
import { createFactoryController } from "./controller.ts";
import { chooseFactorySeat, acquireFactoryWorker, releaseFactoryWorker } from "./capacity-governor.ts";
import { applyBaseSchema } from "../bootstrap/schema/base-schema.ts";
import { applyTaskSchemaMigrations } from "../bootstrap/schema/task-schema-migrations.ts";
import { applyFactorySchema } from "./schema.ts";

const signal: FactoryControlSignal = {
  state: "NORMAL",
  failure: false,
  retry_count: 0,
  same_error_count: 0,
  elapsed_ms: 0,
  measured_cost_usd: null,
};
const seat: FactorySeatSnapshot = {
  enabled: true,
  max_concurrency: 3,
  reserve_slots: 1,
  human_reserve_percent: 20,
  active_leases: 0,
  cooldown_until: null,
  health: "healthy",
  remaining_fraction: 0.6,
};

describe("factory circuit breaker and capacity policies", () => {
  it("progresses one level per failure beat and latches STOP", () => {
    const first = evaluateFactoryController({ ...signal, failure: true, same_error_count: 1 });
    expect(first.state).toBe("STEER");
    const second = evaluateFactoryController({
      ...signal,
      state: first.state,
      failure: true,
      retry_count: 1,
      same_error_count: 2,
    });
    expect(second.state).toBe("CONSTRAIN");
    const third = evaluateFactoryController({
      ...signal,
      state: second.state,
      failure: true,
      retry_count: 2,
      same_error_count: 3,
    });
    expect(third).toMatchObject({ state: "STOP", action: "stop", allow_dispatch: false });
    expect(evaluateFactoryController({ ...signal, state: "STOP" }).state).toBe("STOP");
  });
  it("hard limits block new dispatch while escalating only one level", () => {
    expect(evaluateFactoryController({ ...signal, retry_count: 3 })).toMatchObject({
      state: "STEER",
      allow_dispatch: false,
    });
    expect(evaluateFactoryController({ ...signal, elapsed_ms: 1_800_000 })).toMatchObject({
      state: "STEER",
      allow_dispatch: false,
    });
    expect(evaluateFactoryController({ ...signal, measured_cost_usd: 1 }, { max_cost_usd: 1 })).toMatchObject({
      state: "STEER",
      allow_dispatch: false,
    });
    expect(evaluateFactoryController({ ...signal, cost_unknown: true }, { max_cost_usd: 1 })).toMatchObject({
      allow_dispatch: false,
    });
  });
  it("capacity waiting preserves state and never claims a deterministic task failure", () => {
    expect(evaluateFactoryController({ ...signal, state: "STEER", capacity_blocked: true })).toMatchObject({
      state: "STEER",
      action: "wait_capacity",
      allow_dispatch: false,
    });
  });
  it("parses exact Codex usage-limit ordinal date and relative retry_after", () => {
    const now = Date.parse("Oct 4, 2026 11:50 PM");
    const exact = parseFactoryCapacityFailure("You've hit your usage limit. Try again at Oct 5th, 2026 12:15 AM.", now);
    expect(exact?.retry_after).toBe(Date.parse("Oct 5, 2026 12:15 AM"));
    expect(parseFactoryCapacityFailure("HTTP 429 rate limit, Retry-After: 120", now)?.retry_after).toBe(now + 120000);
    expect(parseFactoryCapacityFailure("Quota exhausted; try again in 5 minutes", now)?.retry_after).toBe(now + 300000);
    expect(parseFactoryCapacityFailure("usage limit reached without reset", now)?.retry_after).toBeNull();
    expect(parseFactoryCapacityFailure("All tests passed", now)).toBeNull();
  });
  it("allows one measurement for unknown snapshots and checks hard gates first", () => {
    expect(evaluateFactoryCapacity({ ...seat, health: "unknown", remaining_fraction: null }, 100)).toMatchObject({
      allow: true,
      cap: 1,
      measurement: true,
    });
    expect(
      evaluateFactoryCapacity({ ...seat, health: "unknown", remaining_fraction: null, active_leases: 1 }, 100).allow,
    ).toBe(false);
    expect(evaluateFactoryCapacity({ ...seat, remaining_fraction: 0 }, 100).allow).toBe(false);
    expect(evaluateFactoryCapacity({ ...seat, cooldown_until: 101 }, 100).allow).toBe(false);
  });
  it("reserves a percentage for humans separately from slots and does not mutate active leases", () => {
    expect(evaluateFactoryCapacity({ ...seat, remaining_fraction: 0.2 }, 100).allow).toBe(false);
    expect(evaluateFactoryCapacity({ ...seat, remaining_fraction: 0.21 }, 100).allow).toBe(true);
    const live = { ...seat, max_concurrency: 1, reserve_slots: 0, active_leases: 2 };
    expect(evaluateFactoryCapacity(live, 100)).toMatchObject({ allow: false, cap: 1 });
    expect(live.active_leases).toBe(2);
    expect(evaluateFactoryCapacity({ ...seat, active_leases: 2 }, 100).allow).toBe(false);
  });
});

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  applyBaseSchema(db);
  applyTaskSchemaMigrations(db);
  applyFactorySchema(db);
  db.exec("INSERT INTO departments(id,name,name_ko,icon,color) VALUES('qa','QA','QA','q','#000')");
  db.exec(
    "INSERT INTO agents(id,name,name_ko,department_id,role,cli_provider) VALUES('agent','Agent','Agent','qa','senior','codex')",
  );
  db.exec(
    "INSERT INTO factory_plans(id,business_id,instruction,workflow,status,risk,summary,created_at,updated_at) VALUES('plan','bigital','Test','product','running','low','Summary',1,1)",
  );
  db.exec(
    "INSERT INTO factory_steps(id,plan_id,position,title,description,role,skills_json,output_type) VALUES('step','plan',0,'Step','Step','reviewer','[]','review')",
  );
  for (const id of ["one", "two"]) {
    db.prepare("INSERT INTO tasks(id,title,assigned_agent_id,status) VALUES(?,?,'agent','in_progress')").run(id, id);
    db.prepare(
      "INSERT INTO factory_runs(id,plan_id,step_id,task_id,business_id,provider,status,started_at) VALUES(?,'plan','step',?,'bigital','codex','running',1)",
    ).run(id, id);
  }
  db.exec(
    "INSERT INTO factory_provider_seats(id,business_id,provider,max_concurrency,reserve_slots,health,remaining_fraction,created_at,updated_at) VALUES('seat','bigital','codex',1,0,'healthy',0.8,1,1)",
  );
  return db;
}

describe("durable controller events and seat leases", () => {
  it("rechecks concurrent lease acquisition and releases idempotently without killing active runs", () => {
    const db = fixture();
    try {
      expect(acquireFactoryWorker(db, { run_id: "one", seat_id: "seat", agent_id: "agent" }, 10)).toBe(true);
      expect(acquireFactoryWorker(db, { run_id: "two", seat_id: "seat", agent_id: "agent" }, 10)).toBe(false);
      db.exec("UPDATE factory_provider_seats SET reserve_slots=1 WHERE id='seat'");
      expect(chooseFactorySeat(db, { business_id: "bigital", provider: "codex" }, 11).seat).toBeNull();
      expect(db.prepare("SELECT status FROM factory_workers").get()?.status).toBe("active");
      expect(db.prepare("SELECT status FROM factory_runs WHERE id='one'").get()?.status).toBe("running");
      releaseFactoryWorker(db, "one", 12);
      releaseFactoryWorker(db, "one", 13);
      expect(db.prepare("SELECT status,released_at FROM factory_workers").get()).toEqual({
        status: "released",
        released_at: 12,
      });
    } finally {
      db.close();
    }
  });
  it("supports no-signal dispatch beats, excludes capacity retries, and preserves cost after human reset", () => {
    const db = fixture();
    let time = 100;
    try {
      const controller = createFactoryController(
        db,
        () => time,
        () => {},
      );
      expect(controller.beat("plan")).toMatchObject({ state: "NORMAL", allow_dispatch: true });
      db.exec("UPDATE factory_runs SET status='blocked',issue_kind='capacity',completed_at=50 WHERE id='one'");
      expect(controller.beat("plan", { capacity_blocked: true }).state).toBe("NORMAL");
      db.exec("UPDATE factory_runs SET status='failed',issue_kind='quality',completed_at=50,cost_usd=1 WHERE id='two'");
      expect(controller.beat("plan", { failure: true }).state).toBe("STEER");
      time = 200;
      db.exec(
        "UPDATE factory_plans SET controller_state='NORMAL',controller_policy_json='{\"max_cost_usd\":1}' WHERE id='plan'",
      );
      db.exec(
        "INSERT INTO factory_control_events(id,plan_id,business_id,state,action,reason,created_at) VALUES('reset','plan','bigital','NORMAL','human_reset','Human reviewed',150)",
      );
      const reset = controller.beat("plan");
      expect(reset.reason).toContain("USD");
      expect(reset.allow_dispatch).toBe(false);
      db.exec("UPDATE factory_plans SET controller_policy_json='{}',controller_state='NORMAL' WHERE id='plan'");
      expect(controller.beat("plan")).toMatchObject({ state: "NORMAL", allow_dispatch: true });
      expect(Number(db.prepare("SELECT COUNT(*) AS count FROM factory_control_events").get()?.count)).toBeGreaterThan(
        3,
      );
    } finally {
      db.close();
    }
  });
});
