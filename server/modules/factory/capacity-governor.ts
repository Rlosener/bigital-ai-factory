import { randomUUID } from "node:crypto";
import { evaluateFactoryCapacity } from "./control-policy.ts";

export type FactorySeat = {
  id: string;
  business_id: string;
  provider: string;
  api_provider_id: string | null;
  oauth_account_id: string | null;
  enabled: number;
  max_concurrency: number;
  reserve_slots: number;
  human_reserve_percent: number;
  cooldown_until: number | null;
  health: "unknown" | "healthy" | "degraded" | "blocked";
  remaining_fraction: number | null;
};

export function chooseFactorySeat(
  db: any,
  input: { business_id: string; provider: string; api_provider_id?: string | null; oauth_account_id?: string | null },
  now: number,
): { configured: boolean; seat: FactorySeat | null; reason: string } {
  if (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='factory_provider_seats'").get()?.name !==
    "factory_provider_seats"
  )
    return { configured: false, seat: null, reason: "Legacy sağlayıcı; seat politikası yapılandırılmamış." };
  const seats = db
    .prepare(
      "SELECT * FROM factory_provider_seats WHERE business_id=? AND provider=? AND api_provider_id IS ? AND oauth_account_id IS ? ORDER BY id",
    )
    .all(
      input.business_id,
      input.provider,
      input.api_provider_id || null,
      input.oauth_account_id || null,
    ) as FactorySeat[];
  if (!seats.length)
    return { configured: false, seat: null, reason: "Bu mevcut sağlayıcı kimliği için seat yapılandırılmamış." };
  let reason = "Sağlayıcı seat kapasitesi dolu.";
  for (const seat of seats) {
    const active = Number(
      db.prepare("SELECT COUNT(*) AS count FROM factory_workers WHERE seat_id=? AND status='active'").get(seat.id)
        .count,
    );
    const decision = evaluateFactoryCapacity({ ...seat, enabled: !!seat.enabled, active_leases: active }, now);
    if (decision.allow) return { configured: true, seat, reason: decision.reason };
    reason = decision.reason;
  }
  return { configured: true, seat: null, reason };
}

/** Lease acquisition rechecks the snapshot transactionally; lowering caps never releases live leases. */
export function acquireFactoryWorker(
  db: any,
  input: { run_id: string; seat_id: string; agent_id: string },
  now: number,
): boolean {
  db.exec("SAVEPOINT factory_capacity_lease");
  try {
    const seat = db.prepare("SELECT * FROM factory_provider_seats WHERE id=?").get(input.seat_id) as
      | FactorySeat
      | undefined;
    const active = Number(
      db.prepare("SELECT COUNT(*) AS count FROM factory_workers WHERE seat_id=? AND status='active'").get(input.seat_id)
        .count,
    );
    if (!seat || !evaluateFactoryCapacity({ ...seat, enabled: !!seat.enabled, active_leases: active }, now).allow) {
      db.exec("ROLLBACK TO factory_capacity_lease; RELEASE factory_capacity_lease");
      return false;
    }
    db.prepare(
      "INSERT INTO factory_workers(id,run_id,seat_id,agent_id,status,created_at) VALUES(?,?,?,?,'active',?)",
    ).run(randomUUID(), input.run_id, input.seat_id, input.agent_id, now);
    db.exec("RELEASE factory_capacity_lease");
    return true;
  } catch (error) {
    db.exec("ROLLBACK TO factory_capacity_lease; RELEASE factory_capacity_lease");
    throw error;
  }
}

export function releaseFactoryWorker(db: any, runId: string, now: number): void {
  db.prepare("UPDATE factory_workers SET status='released',released_at=? WHERE run_id=? AND status='active'").run(
    now,
    runId,
  );
}
