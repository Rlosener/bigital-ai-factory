import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { FactoryExperienceEpisode, FactoryIncident } from "../../../shared/factory.ts";
import { createRunInTransaction } from "../bootstrap/helpers.ts";
import { createFactoryRepository, redactFactoryText, sanitizeFactoryValue } from "./repository.ts";

/** Normalization is for scoped repeat detection, never permission to publish private errors globally. */
export function normalizeFactoryError(detail: string): { normalized_error: string; error_hash: string } {
  const normalized = redactFactoryText(detail)
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, "<url>")
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "<email>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "<id>")
    .replace(/\b\d{4}-\d{2}-\d{2}[t ][\d:.+-]+z?\b/gi, "<time>")
    .replace(/(?:[a-z]:\\|\/)(?:[^\s"'<>:]+[\\/])*[^\s"'<>:]+(?::\d+(?::\d+)?)?/gi, "<path>")
    .replace(
      /\b(?:pid|process|request_id|session_id|run_id|task_id)[=: ]+[\w-]+/gi,
      (match) => `${match.split(/[=: ]/)[0]}=<id>`,
    )
    .replace(/\b0x[0-9a-f]{6,}\b/gi, "<address>")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US")
    .slice(0, 8000);
  return {
    normalized_error: normalized || "unknown error",
    error_hash: createHash("sha256")
      .update(normalized || "unknown error")
      .digest("hex"),
  };
}

export function recordFactoryExperience(
  db: DatabaseSync,
  input: {
    business_id: string;
    project_id: string | null;
    plan_id: string | null;
    task_id?: string | null;
    incident_id?: string | null;
    error_hash?: string | null;
    outcome: FactoryExperienceEpisode["outcome"];
    summary: string;
    evidence?: string[];
    created_at?: number;
  },
): void {
  const repository = createFactoryRepository(db);
  repository.scope(input.business_id, input.project_id);
  if (input.plan_id) repository.scopedPlan(input.plan_id, input.business_id, input.project_id);
  db.prepare(
    `INSERT OR IGNORE INTO factory_experience_episodes(id,business_id,project_id,plan_id,task_id,incident_id,error_hash,outcome,summary,evidence_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    randomUUID(),
    input.business_id,
    input.project_id,
    input.plan_id,
    input.task_id ?? null,
    input.incident_id ?? null,
    input.error_hash ?? null,
    input.outcome,
    redactFactoryText(input.summary).slice(0, 8000),
    JSON.stringify((input.evidence ?? []).map((item) => redactFactoryText(item).slice(0, 8000))),
    input.created_at ?? Date.now(),
  );
}

export function recordFactoryIncident(
  db: DatabaseSync,
  input: {
    business_id: string;
    project_id: string | null;
    plan_id: string | null;
    task_id: string | null;
    title: string;
    detail: string;
    outcome: "failed" | "blocked";
    created_at?: number;
  },
): FactoryIncident {
  const repository = createFactoryRepository(db);
  repository.scope(input.business_id, input.project_id);
  if (input.plan_id) repository.scopedPlan(input.plan_id, input.business_id, input.project_id);
  const id = randomUUID();
  const now = input.created_at ?? Date.now();
  const detail = redactFactoryText(input.detail).slice(0, 20000);
  const { normalized_error, error_hash } = normalizeFactoryError(detail);
  createRunInTransaction(db)(() => {
    const prior = db
      .prepare(
        "SELECT COUNT(*) AS count FROM factory_incidents WHERE business_id=? AND project_id IS ? AND error_hash=?",
      )
      .get(input.business_id, input.project_id, error_hash);
    const repeatCount = Number(prior?.count ?? 0) + 1;
    db.prepare(
      `INSERT INTO factory_incidents(id,plan_id,business_id,project_id,task_id,title,detail,status,created_at,normalized_error,error_hash,repeat_count) VALUES(?,?,?,?,?,?,?,'open',?,?,?,?)`,
    ).run(
      id,
      input.plan_id,
      input.business_id,
      input.project_id,
      input.task_id,
      redactFactoryText(input.title),
      detail,
      now,
      normalized_error,
      error_hash,
      repeatCount,
    );
    recordFactoryExperience(db, {
      ...input,
      incident_id: id,
      error_hash,
      summary:
        input.outcome === "failed"
          ? "Doğrulama başarısız; çözüm henüz doğrulanmadı."
          : "Çalışma önkoşul veya kullanıcı durdurması nedeniyle bekliyor.",
      evidence: [normalized_error],
      created_at: now,
    });
  });
  return sanitizeFactoryValue(
    db.prepare("SELECT * FROM factory_incidents WHERE id=?").get(id),
  ) as unknown as FactoryIncident;
}
