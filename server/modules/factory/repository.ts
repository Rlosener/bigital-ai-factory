import { randomUUID } from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type {
  FactoryPlan,
  FactoryStep,
  FactoryWorkspace,
  FactoryProject,
  FactoryKnowledge,
  FactoryApproval,
  FactoryDeliverable,
  FactoryBusiness,
  FactoryAgent,
  FactoryRun,
  FactoryIncident,
  FactoryActivity,
  FactoryExperienceEpisode,
  FactoryBlackboardEntry,
  FactoryMailboxMessage,
  FactoryProviderSeat,
  FactoryControlEvent,
} from "../../../shared/factory.ts";
import { FactoryError } from "./types.ts";

export function redactFactoryText(value: string): string {
  return value
    .replace(
      /\b(?:sk-(?:proj-)?[\w-]{16,}|gh[pousr]_[\w]{16,}|github_pat_[\w]{16,}|AIza[\w-]{25,}|xox[baprs]-[\w-]{12,})\b/g,
      "[gizli değer kaldırıldı]",
    )
    .replace(
      /((?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password|service[_ -]?role[_ -]?key|authorization)["']?\s*[:=]\s*)(?:["']?)([^\s"']+)/gi,
      "$1[gizli değer kaldırıldı]",
    )
    .replace(/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, "[gizli token kaldırıldı]")
    .replace(
      /(\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:)[^\s@/]+@/gi,
      "$1[gizli parola kaldırıldı]@",
    )
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[gizli erişim anahtarı kaldırıldı]")
    .replace(/Bearer\s+[\w.\-/+=]{12,}/gi, "Bearer [gizli değer kaldırıldı]")
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[özel anahtar kaldırıldı]");
}
export function rejectFactorySecrets(text: string): void {
  if (redactFactoryText(text) !== text)
    throw new FactoryError(
      400,
      "secret_detected",
      "Gizli anahtar veya parola bu alana kaydedilemez. Güvenli sağlayıcı ayarlarını kullanın.",
    );
}
const json = <T>(value: unknown, fallback: T): T => {
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};
export const sanitizeFactoryValue = <T>(record: T): T => {
  if (typeof record === "string") return redactFactoryText(record) as T;
  if (Array.isArray(record)) return record.map((item) => sanitizeFactoryValue(item)) as T;
  if (record && typeof record === "object")
    return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|service[_-]?role[_-]?key|authorization)$/i.test(
          key,
        ) &&
        typeof value === "string" &&
        value
          ? "[gizli değer kaldırıldı]"
          : sanitizeFactoryValue(value),
      ]),
    ) as T;
  return record;
};
const clean = sanitizeFactoryValue;

export function createFactoryRepository(db: DatabaseSync) {
  const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  const projectFields = `id,business_id,name,project_path,core_goal,${projectColumns.some((column) => column.name === "github_repo") ? "github_repo" : "NULL AS github_repo"}`;
  function scope(businessId: string, projectId?: string | null): FactoryProject | null {
    if (!db.prepare("SELECT id FROM businesses WHERE id=?").get(businessId))
      throw new FactoryError(404, "business_not_found", "İşletme bulunamadı.");
    if (!projectId) return null;
    const project = db
      .prepare(`SELECT ${projectFields} FROM projects WHERE id=? AND business_id=?`)
      .get(projectId, businessId) as unknown as FactoryProject | undefined;
    if (!project) throw new FactoryError(404, "project_not_in_business", "Proje bu işletmeye bağlı değil.");
    return clean(project);
  }
  function plan(id: string): FactoryPlan | null {
    const row = db.prepare("SELECT * FROM factory_plans WHERE id=?").get(id);
    if (!row) return null;
    const { missing_json, controller_policy_json, ...record } = row;
    const steps = db
      .prepare("SELECT * FROM factory_steps WHERE plan_id=? ORDER BY position")
      .all(id)
      .map((step) => {
        const { skills_json, depends_on_json, requires_approval, ...rest } = step;
        return {
          ...rest,
          skills: json(skills_json, [] as string[]),
          depends_on: json(depends_on_json, [] as string[]),
          requires_approval: Boolean(requires_approval),
        } as unknown as FactoryStep;
      });
    return clean({
      ...record,
      controller_policy: {
        max_retries: 3,
        same_error_limit: 2,
        max_runtime_ms: 1800000,
        max_cost_usd: null,
        hard_stop: true,
        ...json(controller_policy_json, {}),
      },
      missing: json(missing_json, [] as string[]),
      steps,
    } as unknown as FactoryPlan);
  }
  function scopedPlan(id: string, businessId: string, projectId?: string | null): FactoryPlan {
    scope(businessId, projectId);
    const result = plan(id);
    if (!result || result.business_id !== businessId || (projectId && result.project_id !== projectId))
      throw new FactoryError(404, "plan_not_found", "Plan bu kapsamda bulunamadı.");
    return result;
  }
  function activity(
    businessId: string,
    projectId: string | null,
    planId: string | null,
    action: string,
    detail: string,
    actor = "user",
  ) {
    db.prepare(
      "INSERT INTO factory_activity(id,business_id,project_id,plan_id,action,detail,actor,created_at) VALUES(?,?,?,?,?,?,?,?)",
    ).run(randomUUID(), businessId, projectId, planId, action, redactFactoryText(detail), actor, Date.now());
  }
  function workspace(businessId: string, projectId?: string | null): FactoryWorkspace {
    scope(businessId, projectId);
    const values: SQLInputValue[] = projectId ? [businessId, projectId] : [businessId];
    const where = projectId ? "business_id=? AND project_id=?" : "business_id=?";
    const read = (table: string, limit = 100) =>
      clean(db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY created_at DESC LIMIT ?`).all(...values, limit));
    return {
      businesses: clean(
        db.prepare("SELECT * FROM businesses ORDER BY created_at,name").all(),
      ) as unknown as FactoryBusiness[],
      projects: clean(
        db
          .prepare(
            `SELECT ${projectFields} FROM projects WHERE business_id=? OR business_id IS NULL ORDER BY updated_at DESC`,
          )
          .all(businessId),
      ) as unknown as FactoryProject[],
      agents: clean(
        db
          .prepare(
            "SELECT a.id,a.name,a.role,a.department_id,d.name AS department_name,a.cli_provider,a.status,a.avatar_emoji FROM agents a LEFT JOIN departments d ON d.id=a.department_id ORDER BY d.sort_order,a.name",
          )
          .all(),
      ) as unknown as FactoryAgent[],
      plans: (
        db
          .prepare(`SELECT id FROM factory_plans WHERE ${where} ORDER BY created_at DESC LIMIT 50`)
          .all(...values) as Array<{ id: string }>
      ).map((row) => plan(row.id)!),
      approvals: read("factory_approvals") as unknown as FactoryApproval[],
      deliverables: read("factory_deliverables").map((row) => {
        const { content_json, ...rest } = row;
        return { ...rest, content: json(content_json, { summary: "", evidence: [], limitations: [], artifacts: [] }) };
      }) as unknown as FactoryDeliverable[],
      knowledge: clean(
        db
          .prepare(
            `SELECT * FROM factory_knowledge WHERE business_id=?${projectId ? " AND (project_id=? OR project_id IS NULL)" : ""} ORDER BY updated_at DESC LIMIT 100`,
          )
          .all(...values),
      ) as unknown as FactoryKnowledge[],
      activity: read("factory_activity") as unknown as FactoryActivity[],
      provider_seats: clean(
        db
          .prepare("SELECT * FROM factory_provider_seats WHERE business_id=? ORDER BY created_at DESC LIMIT 100")
          .all(businessId),
      ).map((row) => ({ ...row, enabled: Boolean(row.enabled) })) as unknown as FactoryProviderSeat[],
      control_events: read("factory_control_events") as unknown as FactoryControlEvent[],
      blackboard: clean(
        db.prepare(`SELECT * FROM factory_blackboard WHERE ${where} ORDER BY updated_at DESC LIMIT 100`).all(...values),
      ).map((row) => {
        const { content_json, ...rest } = row;
        return { ...rest, content: json(content_json, { summary: "", items: [], references: [] }) };
      }) as unknown as FactoryBlackboardEntry[],
      mailbox: read("factory_mailbox").map((row) => {
        const { content_json, ...rest } = row;
        return { ...rest, content: json(content_json, { summary: "", items: [], references: [] }) };
      }) as unknown as FactoryMailboxMessage[],
      incidents: read("factory_incidents") as unknown as FactoryIncident[],
      experiences: read("factory_experience_episodes").map((row) => {
        const { evidence_json, ...rest } = row;
        return { ...rest, evidence: json(evidence_json, [] as string[]) };
      }) as unknown as FactoryExperienceEpisode[],
      runs: clean(
        db.prepare(`SELECT * FROM factory_runs WHERE ${where} ORDER BY started_at DESC LIMIT 100`).all(...values),
      ) as unknown as FactoryRun[],
    };
  }
  return { db, scope, plan, scopedPlan, activity, workspace };
}
export type FactoryRepository = ReturnType<typeof createFactoryRepository>;
