import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import request from "supertest";
import { applyBaseSchema } from "../bootstrap/schema/base-schema.ts";
import { createRunInTransaction } from "../bootstrap/helpers.ts";
import { applyFactorySchema } from "./schema.ts";
import { createFactoryRepository } from "./repository.ts";
import { registerFactoryRoutes } from "./routes.ts";
import {
  acknowledgeFactoryMailbox,
  FACTORY_MAILBOX_HOP_LIMIT,
  recordFactoryMailbox,
  writeFactoryBlackboard,
} from "./hive.ts";

describe("Factory Hive on the existing Claw backbone", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    applyBaseSchema(db);
    applyFactorySchema(db);
    db.prepare("INSERT INTO businesses(id,name,created_at) VALUES('other','Other',1)").run();
    db.prepare(
      "INSERT INTO projects(id,business_id,name,project_path,core_goal) VALUES('p','bigital','P','/existing/project','Goal'),('p2','bigital','P2','/other/project','Goal'),('private','other','Private','/private/project','Goal')",
    ).run();
    db.prepare(
      "INSERT INTO agents(id,name,role,cli_provider) VALUES('manager','Manager','team_leader','codex'),('reviewer','Reviewer','senior','codex')",
    ).run();
  });
  afterEach(() => db.close());
  const content = { summary: "Kaynakla doğrulanan bulgu", items: ["Bağımlılık mevcut"], references: ["task:verified"] };
  const message = () => ({
    business_id: "bigital",
    project_id: "p",
    recipient_agent_id: "reviewer",
    kind: "review_feedback",
    content,
    idempotency_key: "review-1",
  });
  it("stores a structured board with optimistic concurrency and trusted writer identity", () => {
    const first = writeFactoryBlackboard(
      db,
      { business_id: "bigital", project_id: "p", section: "shared_finding", content, expected_version: 0 },
      "api",
    );
    expect(first.version).toBe(1);
    expect(first.writer).toBe("api");
    expect(first.content).toEqual(content);
    expect(() =>
      writeFactoryBlackboard(
        db,
        { business_id: "bigital", project_id: "p", section: "shared_finding", content, expected_version: 0 },
        "api",
      ),
    ).toThrow("Blackboard değişti");
    const next = writeFactoryBlackboard(
      db,
      {
        business_id: "bigital",
        project_id: "p",
        section: "shared_finding",
        content: { ...content, summary: "Güncel sonuç" },
      },
      "manager",
    );
    expect(next.version).toBe(2);
    expect(next.writer).toBe("manager");
    expect(createFactoryRepository(db).workspace("bigital", "p2").blackboard).toEqual([]);
    expect(() =>
      writeFactoryBlackboard(db, { business_id: "other", project_id: "p", section: "decision", content }, "manager"),
    ).toThrow("bağlı değil");
  });
  it("makes mailbox insertion and acknowledgement idempotent without losing receipt time", () => {
    const first = recordFactoryMailbox(db, message());
    const duplicate = recordFactoryMailbox(db, message());
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.message.id).toBe(first.message.id);
    expect(() => recordFactoryMailbox(db, { ...message(), content: { ...content, summary: "Farklı ileti" } })).toThrow(
      "farklı bir mesaj",
    );
    const ack = acknowledgeFactoryMailbox(db, first.message.id, "bigital", "p");
    expect(ack.message.status).toBe("handled");
    expect(ack.duplicate).toBe(false);
    const secondAck = acknowledgeFactoryMailbox(db, first.message.id, "bigital", "p");
    expect(secondAck.duplicate).toBe(true);
    expect(secondAck.message.handled_at).toBe(ack.message.handled_at);
    expect(db.prepare("SELECT COUNT(*) AS count FROM factory_mailbox").get()?.count).toBe(1);
  });
  it("enforces a server-derived finite hop count and scoped parent chains", () => {
    let parent = recordFactoryMailbox(db, message()).message;
    for (let i = 1; i <= FACTORY_MAILBOX_HOP_LIMIT; i++)
      parent = recordFactoryMailbox(db, { ...message(), parent_id: parent.id, idempotency_key: `reply-${i}` }).message;
    expect(parent.hop_count).toBe(FACTORY_MAILBOX_HOP_LIMIT);
    expect(() =>
      recordFactoryMailbox(db, { ...message(), parent_id: parent.id, idempotency_key: "beyond-limit" }),
    ).toThrow("zinciri sınırına");
    expect(() =>
      recordFactoryMailbox(db, {
        ...message(),
        project_id: "p2",
        parent_id: parent.id,
        idempotency_key: "cross-project",
      }),
    ).toThrow("proje kapsamında");
    expect(createFactoryRepository(db).workspace("other", "private").mailbox).toEqual([]);
    expect(() => acknowledgeFactoryMailbox(db, parent.id, "other", "private")).toThrow("proje kapsamında");
  });
  it("rejects secrets and invalid recipients before durable Hive writes", () => {
    expect(() => recordFactoryMailbox(db, { ...message(), recipient_agent_id: "missing" })).toThrow(
      "çalışanı bulunamadı",
    );
    expect(() => recordFactoryMailbox(db, { ...message(), content: { ...content, summary: "password=1234" } })).toThrow(
      "Gizli anahtar",
    );
    expect(() =>
      writeFactoryBlackboard(
        db,
        {
          business_id: "bigital",
          project_id: "p",
          section: "blocker",
          content: { ...content, summary: "sk-proj-abcdefghijklmnopqrstuvwx" },
        },
        "manager",
      ),
    ).toThrow("Gizli anahtar");
    expect(db.prepare("SELECT COUNT(*) AS count FROM factory_mailbox").get()?.count).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM factory_blackboard").get()?.count).toBe(0);
  });
  it("exposes authenticated API scope, fixed API writer, duplicate receipts and persisted workspace rows", async () => {
    const app = express();
    app.use(express.json());
    registerFactoryRoutes({ app, db, nowMs: Date.now, runInTransaction: createRunInTransaction(db) });
    const board = await request(app)
      .put("/api/factory/blackboard/current_objective")
      .query({ business_id: "bigital", project_id: "p" })
      .send({ content, expected_version: 0, writer: "agent" });
    expect(board.status).toBe(200);
    expect(board.body.entry.writer).toBe("api");
    expect(
      (
        await request(app)
          .put("/api/factory/blackboard/decision")
          .query({ business_id: "other", project_id: "p" })
          .send({ content, expected_version: 0 })
      ).status,
    ).toBe(404);
    const created = await request(app)
      .post("/api/factory/mailbox")
      .send({ ...message(), hop_count: 999 });
    expect(created.status).toBe(201);
    expect(created.body.message.hop_count).toBe(0);
    expect((await request(app).post("/api/factory/mailbox").send(message())).status).toBe(200);
    const handled = await request(app)
      .post(`/api/factory/mailbox/${created.body.message.id}/handled`)
      .query({ business_id: "bigital", project_id: "p" });
    expect(handled.body.message.status).toBe("handled");
    const workspace = await request(app)
      .get("/api/factory/workspace")
      .query({ business_id: "bigital", project_id: "p" });
    expect(workspace.body.blackboard).toHaveLength(1);
    expect(workspace.body.mailbox).toHaveLength(1);
  });
});
