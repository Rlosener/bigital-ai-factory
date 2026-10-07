import { randomUUID } from "node:crypto";
import {
  DEFAULT_FACTORY_CONTROLLER_POLICY,
  evaluateFactoryController,
  type FactoryControllerState,
  type FactoryControllerPolicy,
} from "./control-policy.ts";
import { redactFactoryText } from "./repository.ts";

export function createFactoryController(
  db: any,
  nowMs: () => number,
  broadcast: (event: string, payload: unknown) => void,
) {
  function policyFor(planId: string): FactoryControllerPolicy {
    const row = db.prepare("SELECT controller_policy_json FROM factory_plans WHERE id=?").get(planId);
    let configured: Partial<FactoryControllerPolicy> = {};
    try {
      configured = JSON.parse(row?.controller_policy_json || "{}");
    } catch {
      /* Migration defaults remain safe. */
    }
    return { ...DEFAULT_FACTORY_CONTROLLER_POLICY, ...configured };
  }

  function beat(
    planId: string,
    input: {
      run_id?: string | null;
      failure?: boolean;
      capacity_blocked?: boolean;
      error_hash?: string | null;
      detail?: string;
    } = {},
  ) {
    const plan = db.prepare("SELECT * FROM factory_plans WHERE id=?").get(planId);
    if (!plan) throw new Error("Kontrol planı bulunamadı.");
    const policy = policyFor(planId);
    const epoch = Number(
      db
        .prepare(
          "SELECT MAX(created_at) AS epoch FROM factory_control_events WHERE plan_id=? AND action IN ('human_reset','human_revision')",
        )
        .get(planId)?.epoch || 0,
    );
    const failed = db
      .prepare(
        "SELECT COUNT(*) AS count FROM factory_runs WHERE plan_id=? AND started_at>? AND status='failed' AND COALESCE(issue_kind,'execution') <> 'capacity'",
      )
      .get(planId, epoch);
    const errors = input.error_hash
      ? db
          .prepare("SELECT COUNT(*) AS count FROM factory_incidents WHERE plan_id=? AND error_hash=? AND created_at>?")
          .get(planId, input.error_hash, epoch)
      : null;
    const totals = db
      .prepare(
        "SELECT SUM(CASE WHEN started_at>? THEN CASE WHEN completed_at IS NOT NULL THEN MAX(0,completed_at-started_at) ELSE MAX(0,?-started_at) END ELSE 0 END) AS duration_ms,SUM(cost_usd) AS cost_usd FROM factory_runs WHERE plan_id=?",
      )
      .get(epoch, nowMs(), planId);
    const unknownCost = Number(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM factory_runs WHERE plan_id=? AND status='completed' AND cost_usd IS NULL",
        )
        .get(planId)?.count || 0,
    );
    const decision = evaluateFactoryController(
      {
        state: (plan.controller_state || "NORMAL") as FactoryControllerState,
        failure: !!input.failure,
        retry_count: Math.max(0, Number(failed?.count || 0) - 1),
        same_error_count: Number(errors?.count || 0),
        elapsed_ms: Number(totals?.duration_ms || 0),
        measured_cost_usd: totals?.cost_usd ?? null,
        capacity_blocked: !!input.capacity_blocked,
        cost_unknown: unknownCost > 0,
      },
      policy,
    );
    const reason = redactFactoryText(input.detail ? `${decision.reason} ${input.detail}` : decision.reason).slice(
      0,
      12000,
    );
    db.prepare("UPDATE factory_plans SET controller_state=?,stopped_reason=?,updated_at=? WHERE id=?").run(
      decision.state,
      decision.state === "STOP" ? reason : null,
      nowMs(),
      planId,
    );
    db.prepare(
      "INSERT INTO factory_control_events(id,plan_id,business_id,project_id,run_id,state,action,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      planId,
      plan.business_id,
      plan.project_id,
      input.run_id || null,
      decision.state,
      decision.action,
      reason,
      nowMs(),
    );
    if (decision.state === "STOP")
      db.prepare("UPDATE factory_plans SET status='blocked',missing_json=? WHERE id=?").run(
        JSON.stringify([reason]),
        planId,
      );
    broadcast("factory_update", { plan_id: planId, controller_state: decision.state, action: decision.action });
    return { ...decision, reason };
  }

  return { beat, policyFor };
}
