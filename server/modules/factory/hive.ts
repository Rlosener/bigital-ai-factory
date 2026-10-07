import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  FactoryBlackboardEntry,
  FactoryBlackboardSection,
  FactoryHiveContent,
  FactoryMailboxMessage,
} from "../../../shared/factory.ts";
import { createRunInTransaction } from "../bootstrap/helpers.ts";
import { createFactoryRepository, rejectFactorySecrets, sanitizeFactoryValue } from "./repository.ts";
import { FactoryError } from "./types.ts";

export const FACTORY_MAILBOX_HOP_LIMIT = 8;
export const FACTORY_BLACKBOARD_SECTIONS: FactoryBlackboardSection[] = [
  "current_objective",
  "active_plan",
  "shared_finding",
  "blocker",
  "decision",
  "deliverable",
];
const kinds = ["review_feedback", "request", "inform", "done"];
function text(value: unknown, label: string, max = 5000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new FactoryError(400, "invalid_hive_content", `${label} geçerli ve ${max} karakterden kısa metin olmalı.`);
  rejectFactorySecrets(value);
  return value.trim();
}
export function factoryHiveContent(value: unknown): FactoryHiveContent {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FactoryError(400, "invalid_hive_content", "Blackboard/mailbox içeriği yapılandırılmış nesne olmalı.");
  const record = value as Record<string, unknown>;
  const list = (input: unknown, label: string, max: number) => {
    if (input == null) return [];
    if (!Array.isArray(input) || input.length > 100)
      throw new FactoryError(400, "invalid_hive_content", `${label} en çok 100 metinden oluşmalı.`);
    return input.map((item) => text(item, label, max));
  };
  return {
    summary: text(record.summary, "Özet"),
    items: list(record.items, "Madde", 2000),
    references: list(record.references, "Referans", 500),
  };
}
function readBlackboard(row: Record<string, unknown>): FactoryBlackboardEntry {
  const { content_json, ...rest } = row;
  return sanitizeFactoryValue({
    ...rest,
    content: JSON.parse(String(content_json)),
  }) as unknown as FactoryBlackboardEntry;
}
function readMailbox(row: Record<string, unknown>): FactoryMailboxMessage {
  const { content_json, ...rest } = row;
  return sanitizeFactoryValue({
    ...rest,
    content: JSON.parse(String(content_json)),
  }) as unknown as FactoryMailboxMessage;
}
export function writeFactoryBlackboard(
  db: DatabaseSync,
  input: {
    business_id: string;
    project_id: string;
    section: FactoryBlackboardSection;
    content: unknown;
    expected_version?: number;
  },
  writer: "manager" | "api" = "manager",
): FactoryBlackboardEntry {
  createFactoryRepository(db).scope(input.business_id, input.project_id);
  if (!input.project_id || !FACTORY_BLACKBOARD_SECTIONS.includes(input.section))
    throw new FactoryError(400, "invalid_blackboard_scope", "Blackboard için bağlı proje ve geçerli bölüm gerekli.");
  const content = factoryHiveContent(input.content);
  let id = "";
  createRunInTransaction(db)(() => {
    const prior = db
      .prepare("SELECT id,version FROM factory_blackboard WHERE business_id=? AND project_id=? AND section=?")
      .get(input.business_id, input.project_id, input.section);
    const version = Number(prior?.version ?? 0);
    if (
      (writer === "api" && input.expected_version == null) ||
      (input.expected_version != null && input.expected_version !== version)
    )
      throw new FactoryError(
        409,
        "blackboard_version_conflict",
        "Blackboard değişti. Güncel içeriği okuyup yeniden kaydedin.",
      );
    if (prior) {
      id = String(prior.id);
      db.prepare(
        "UPDATE factory_blackboard SET content_json=?,version=version+1,writer=?,updated_at=? WHERE id=? AND version=?",
      ).run(JSON.stringify(content), writer, Date.now(), id, version);
    } else {
      id = randomUUID();
      db.prepare(
        "INSERT INTO factory_blackboard(id,business_id,project_id,section,content_json,version,writer,updated_at) VALUES(?,?,?,?,?,1,?,?)",
      ).run(id, input.business_id, input.project_id, input.section, JSON.stringify(content), writer, Date.now());
    }
  });
  return readBlackboard(db.prepare("SELECT * FROM factory_blackboard WHERE id=?").get(id)!);
}
export function recordFactoryMailbox(
  db: DatabaseSync,
  input: {
    business_id: string;
    project_id: string;
    plan_id?: string | null;
    sender_agent_id?: string | null;
    recipient_agent_id: string;
    kind: string;
    content: unknown;
    parent_id?: string | null;
    idempotency_key: string;
  },
): { message: FactoryMailboxMessage; duplicate: boolean } {
  const repository = createFactoryRepository(db);
  repository.scope(input.business_id, input.project_id);
  if (!input.project_id) throw new FactoryError(400, "project_required", "Mailbox için işletmeye bağlı proje gerekli.");
  if (input.plan_id) repository.scopedPlan(input.plan_id, input.business_id, input.project_id);
  if (!kinds.includes(input.kind))
    throw new FactoryError(
      400,
      "invalid_mailbox_kind",
      "Mesaj türü review_feedback, request, inform veya done olmalı.",
    );
  const content = factoryHiveContent(input.content);
  const idempotencyKey = text(input.idempotency_key, "Tekrarlama anahtarı", 120);
  for (const agentId of [input.sender_agent_id, input.recipient_agent_id].filter(Boolean))
    if (typeof agentId !== "string" || !db.prepare("SELECT id FROM agents WHERE id=?").get(agentId))
      throw new FactoryError(404, "mailbox_agent_not_found", "Mailbox çalışanı bulunamadı.");
  if (!input.recipient_agent_id) throw new FactoryError(400, "mailbox_recipient_required", "Mesaj alıcısı gerekli.");
  let id = "";
  let duplicate = false;
  createRunInTransaction(db)(() => {
    const prior = db
      .prepare("SELECT * FROM factory_mailbox WHERE business_id=? AND project_id=? AND idempotency_key=?")
      .get(input.business_id, input.project_id, idempotencyKey);
    const messageFields = [
      input.plan_id ?? null,
      input.sender_agent_id ?? null,
      input.recipient_agent_id,
      input.kind,
      JSON.stringify(content),
      input.parent_id ?? null,
    ];
    if (prior) {
      if (
        JSON.stringify([
          prior.plan_id,
          prior.sender_agent_id,
          prior.recipient_agent_id,
          prior.kind,
          prior.content_json,
          prior.parent_id,
        ]) !== JSON.stringify(messageFields)
      )
        throw new FactoryError(
          409,
          "mailbox_idempotency_conflict",
          "Bu tekrarlama anahtarı farklı bir mesaj için kullanılmış.",
        );
      id = String(prior.id);
      duplicate = true;
      return;
    }
    const parent = input.parent_id
      ? db
          .prepare("SELECT hop_count FROM factory_mailbox WHERE id=? AND business_id=? AND project_id=?")
          .get(input.parent_id, input.business_id, input.project_id)
      : null;
    if (input.parent_id && !parent)
      throw new FactoryError(404, "mailbox_parent_not_found", "Önceki mesaj bu proje kapsamında bulunamadı.");
    const hops = parent ? Number(parent.hop_count) + 1 : 0;
    if (hops > FACTORY_MAILBOX_HOP_LIMIT)
      throw new FactoryError(
        409,
        "mailbox_hop_limit",
        "Agent mesaj zinciri sınırına ulaştı. Manager incelemesi gerekiyor.",
      );
    id = randomUUID();
    db.prepare(
      "INSERT INTO factory_mailbox(id,business_id,project_id,plan_id,sender_agent_id,recipient_agent_id,kind,content_json,parent_id,hop_count,status,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?,?)",
    ).run(
      id,
      input.business_id,
      input.project_id,
      ...messageFields.slice(0, 4),
      messageFields[4],
      input.parent_id ?? null,
      hops,
      idempotencyKey,
      Date.now(),
    );
  });
  return { message: readMailbox(db.prepare("SELECT * FROM factory_mailbox WHERE id=?").get(id)!), duplicate };
}
export function acknowledgeFactoryMailbox(
  db: DatabaseSync,
  id: string,
  businessId: string,
  projectId: string,
): { message: FactoryMailboxMessage; duplicate: boolean } {
  createFactoryRepository(db).scope(businessId, projectId);
  const row = db
    .prepare("SELECT * FROM factory_mailbox WHERE id=? AND business_id=? AND project_id=?")
    .get(id, businessId, projectId);
  if (!row) throw new FactoryError(404, "mailbox_message_not_found", "Mesaj bu proje kapsamında bulunamadı.");
  const changed = db
    .prepare("UPDATE factory_mailbox SET status='handled',handled_at=? WHERE id=? AND status='pending'")
    .run(Date.now(), id);
  return {
    message: readMailbox(db.prepare("SELECT * FROM factory_mailbox WHERE id=?").get(id)!),
    duplicate: Number(changed.changes) === 0,
  };
}
