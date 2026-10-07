import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyBaseSchema } from "../bootstrap/schema/base-schema.ts";
import { applyTaskSchemaMigrations } from "../bootstrap/schema/task-schema-migrations.ts";
import { createRunInTransaction } from "../bootstrap/helpers.ts";
import { applyFactorySchema } from "./schema.ts";
import { createFactoryService } from "./service.ts";
import {
  createFactoryRepository,
  redactFactoryText,
  rejectFactorySecrets,
  sanitizeFactoryValue,
} from "./repository.ts";
import { registerFactoryRoutes } from "./routes.ts";
import type { FactoryContext } from "./types.ts";

describe("factory durable domain", () => {
  let db: DatabaseSync;
  let ctx: FactoryContext;
  let directory: string;
  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    applyBaseSchema(db);
    applyTaskSchemaMigrations(db);
    applyFactorySchema(db);
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "factory-domain-"));
    const app = express();
    app.use(express.json());
    ctx = { db, app, nowMs: Date.now, runInTransaction: createRunInTransaction(db) };
    for (const [id, department] of [
      ["planner", "planning"],
      ["developer", "dev"],
      ["reviewer", "qa"],
    ]) {
      db.prepare("INSERT INTO departments(id,name,name_ko,icon,color) VALUES(?,?,?,'x','#fff')").run(
        department,
        department,
        department,
      );
      db.prepare("INSERT INTO agents(id,name,department_id,role,cli_provider) VALUES(?,?,?,'senior','codex')").run(
        id,
        id,
        department,
      );
    }
  });
  afterEach(() => {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function setupProject(businessId = "bigital") {
    return createFactoryService(ctx, { providerAvailable: () => true }).project({
      business_id: businessId,
      name: "Factory bağımsız proje",
      project_path: directory,
      core_goal: "Gerçek proje",
    })!;
  }
  it("is repeatable and preserves existing project rows without fabricated projects", () => {
    db.prepare("INSERT INTO projects(id,name,project_path,core_goal) VALUES('old','Existing',?,'Goal')").run(directory);
    applyFactorySchema(db);
    applyFactorySchema(db);
    expect(db.prepare("SELECT count(*) AS count FROM businesses").get()?.count).toBe(1);
    expect(db.prepare("SELECT business_id,name FROM projects WHERE id='old'").get()).toEqual({
      business_id: null,
      name: "Existing",
    });
    expect(db.prepare("SELECT count(*) AS count FROM projects").get()?.count).toBe(1);
  });
  it("validates project paths and explicitly binds legacy projects", () => {
    const service = createFactoryService(ctx);
    expect(() =>
      service.project({ business_id: "bigital", name: "bad", project_path: "relative", core_goal: "goal" }),
    ).toThrow("tam dizin");
    const project = setupProject();
    expect(project.business_id).toBe("bigital");
    expect(() => setupProject()).toThrow("kayıtlı");
    db.prepare("UPDATE projects SET business_id=NULL WHERE id=?").run(project.id);
    expect(service.bindProject(project.id, "bigital")?.business_id).toBe("bigital");
    const other = service.business({ name: "Diğer" }) as { id: string };
    expect(() => service.bindProject(project.id, other.id)).toThrow("başka işletmeye");
  });
  it("isolates knowledge across businesses/projects and includes company context", () => {
    const service = createFactoryService(ctx);
    const project = setupProject();
    const other = service.business({ name: "Other" }) as { id: string };
    service.knowledge({ business_id: "bigital", category: "brand", title: "Marka", content: "Şirket dili" });
    const record = service.knowledge({
      business_id: "bigital",
      project_id: project.id,
      category: "architecture",
      title: "Mimari",
      content: "Gerçek proje mimarisi",
    }) as { id: string };
    service.knowledge({ business_id: other.id, category: "brand", title: "Özel", content: "Diğer işletme bilgisi" });
    expect(
      service.repository
        .workspace("bigital", project.id)
        .knowledge.map((entry) => entry.title)
        .sort(),
    ).toEqual(["Marka", "Mimari"]);
    expect(() => service.removeKnowledge(record.id, other.id)).toThrow("bulunamadı");
    expect(() =>
      service.knowledge({ business_id: other.id, project_id: project.id, category: "x", title: "x", content: "x" }),
    ).toThrow("bağlı değil");
    expect(() => service.updateKnowledge(record.id, other.id, null, { content: "yetkisiz" })).toThrow("bulunamadı");
    expect(service.updateKnowledge(record.id, "bigital", project.id, { content: "Yeni mimari bilgisi" })?.content).toBe(
      "Yeni mimari bilgisi",
    );
    expect(() =>
      service.updateKnowledge(record.id, "bigital", project.id, { content: "password=abcdefghijklmnop" }),
    ).toThrow("Gizli anahtar");
    service.removeKnowledge(record.id, "bigital", project.id);
    expect(service.repository.workspace("bigital", project.id).knowledge).toHaveLength(1);
  });
  it("rejects secrets on ingress and redacts output from older records", () => {
    const service = createFactoryService(ctx);
    const secret = "sk-proj-abcdefghijklmnopqrstuvwx";
    expect(() => service.knowledge({ business_id: "bigital", category: "api", title: "Key", content: secret })).toThrow(
      "Gizli anahtar",
    );
    expect(() => service.createPlan({ business_id: "bigital", instruction: "api_key=abcdefghijklmnopqrst" })).toThrow(
      "Gizli anahtar",
    );
    db.prepare("INSERT INTO factory_knowledge VALUES('legacy','bigital',NULL,'api','Legacy',?,1,1)").run(secret);
    expect(JSON.stringify(service.repository.workspace("bigital"))).not.toContain(secret);
    expect(redactFactoryText("Bearer abcdefghijklmnopqrst")).not.toContain("abcdefghijklmnopqrst");
    expect(() => rejectFactorySecrets(JSON.stringify({ password: "abcdefghijklmnopqrst" }))).toThrow("Gizli anahtar");
    expect(() => rejectFactorySecrets("password=1234")).toThrow("Gizli anahtar");
    expect(sanitizeFactoryValue({ password: "abcdefghijklmnopqrst", title: "Sağlıklı kayıt" })).toEqual({
      password: "[gizli değer kaldırıldı]",
      title: "Sağlıklı kayıt",
    });
    db.prepare("UPDATE factory_knowledge SET content='password=abcdefghijklmnopqrst' WHERE id='legacy'").run();
    expect(service.repository.workspace("bigital").knowledge[0].content).toContain("gizli değer kaldırıldı");
  });
  it("persists an honest blocked plan when project/provider dependencies are absent", () => {
    const service = createFactoryService(ctx, { providerAvailable: () => false });
    const plan = service.createPlan({ business_id: "bigital", instruction: "Webhook API altyapısı oluştur" });
    expect(plan.analysis_mode).toBe("rule_based");
    expect(plan.status).toBe("blocked");
    expect(plan.missing).toHaveLength(2);
    expect(plan.workflow).toBe("software");
    expect(db.prepare("SELECT count(*) AS count FROM factory_approvals").get()?.count).toBe(0);
  });
  it("routes workflows, persists DAG/roles and requires independent review plus human approval", () => {
    const project = setupProject();
    const service = createFactoryService(ctx, { providerAvailable: () => true });
    const plan = service.createPlan({
      business_id: "bigital",
      project_id: project.id,
      instruction: "MVP planı ve PRD hazırla",
    });
    expect(plan.workflow).toBe("product");
    expect(plan.status).toBe("draft");
    expect(plan.steps.map((step) => step.output_type)).toEqual(["product", "review"]);
    expect(plan.steps[1].depends_on).toEqual([plan.steps[0].id]);
    expect(plan.steps[1].agent_id).not.toBe(plan.steps[0].agent_id);
    const approval = db.prepare("SELECT id FROM factory_approvals WHERE plan_id=?").get(plan.id) as { id: string };
    expect(service.resolveApproval(approval.id, "bigital", project.id, "approved", null).plan.status).toBe("approved");
    expect(() => service.resolveApproval(approval.id, "bigital", project.id, "rejected", null)).toThrow("daha önce");
    expect(db.prepare("SELECT status FROM factory_approvals WHERE id=?").get(approval.id)?.status).toBe("approved");
    const social = service.createPlan({
      business_id: "bigital",
      project_id: project.id,
      instruction: "Instagram içerik takvimi hazırla",
    });
    expect(social.workflow).toBe("social");
  });
  it("rolls back final approval when an execution step is incomplete", () => {
    const project = setupProject();
    const service = createFactoryService(ctx, { providerAvailable: () => true });
    const plan = service.createPlan({ business_id: "bigital", project_id: project.id, instruction: "PRD hazırla" });
    db.prepare("UPDATE factory_plans SET status='awaiting_approval' WHERE id=?").run(plan.id);
    db.prepare(
      "INSERT INTO factory_approvals(id,plan_id,business_id,project_id,kind,title,reason,created_at) VALUES('final',?, 'bigital',?,'deliverable','Sonuç','İncele',1)",
    ).run(plan.id, project.id);
    expect(() => service.resolveApproval("final", "bigital", project.id, "approved", null)).toThrow("tamamlanmadan");
    expect(db.prepare("SELECT status FROM factory_approvals WHERE id='final'").get()?.status).toBe("pending");
    expect(createFactoryRepository(db).plan(plan.id)?.status).toBe("awaiting_approval");
  });
  it("recovers the same blocked plan after prerequisites are configured", () => {
    const project = setupProject();
    let ready = false;
    const service = createFactoryService(ctx, { providerAvailable: () => ready });
    const plan = service.createPlan({ business_id: "bigital", instruction: "PRD hazırla" });
    expect(plan.status).toBe("blocked");
    ready = true;
    const recovered = service.recheckPlan(plan.id, "bigital", null, project.id);
    expect(recovered.id).toBe(plan.id);
    expect(recovered.project_id).toBe(project.id);
    expect(recovered.status).toBe("draft");
    expect(recovered.missing).toEqual([]);
    expect(db.prepare("SELECT count(*) AS count FROM factory_plans").get()?.count).toBe(1);
    expect(db.prepare("SELECT count(*) AS count FROM factory_approvals WHERE plan_id=?").get(plan.id)?.count).toBe(1);
    expect(() => service.recheckPlan(plan.id, "bigital")).toThrow("Çalıştırılmış/onaylanmış");
  });
  it("requires persisted passing reviewer evidence for final approval", () => {
    const project = setupProject();
    const service = createFactoryService(ctx, { providerAvailable: () => true });
    const plan = service.createPlan({ business_id: "bigital", project_id: project.id, instruction: "PRD hazırla" });
    db.prepare("UPDATE factory_plans SET status='awaiting_approval' WHERE id=?").run(plan.id);
    db.prepare("UPDATE factory_steps SET status='completed' WHERE plan_id=?").run(plan.id);
    db.prepare(
      "INSERT INTO factory_approvals(id,plan_id,business_id,project_id,kind,title,reason,created_at) VALUES('final',?,'bigital',?,'deliverable','Sonuç','İncele',1)",
    ).run(plan.id, project.id);
    expect(() => service.resolveApproval("final", "bigital", project.id, "approved", null)).toThrow("kanıt kaydı");
    expect(db.prepare("SELECT status FROM factory_approvals WHERE id='final'").get()?.status).toBe("pending");
    const reviewer = plan.steps.find((step) => step.role === "reviewer")!;
    const content = {
      summary: "İnceleme",
      evidence: ["PRD gereksinim kontrolü"],
      limitations: [],
      artifacts: [],
      structured: { verdict: "pass", findings: [] },
    };
    db.prepare(
      "INSERT INTO factory_deliverables(id,plan_id,step_id,business_id,project_id,version,type,title,content_json,created_at) VALUES('review',?,?,'bigital',?,1,'review','İnceleme',?,1)",
    ).run(plan.id, reviewer.id, project.id, JSON.stringify(content));
    const guarded = createFactoryService(ctx, {
      validateFinalApproval: () => {
        throw new Error("Onay öncesi kanıt değişti.");
      },
    });
    expect(() => guarded.resolveApproval("final", "bigital", project.id, "approved", null)).toThrow("kanıt değişti");
    expect(db.prepare("SELECT status FROM factory_approvals WHERE id='final'").get()?.status).toBe("pending");
    expect(service.repository.plan(plan.id)?.status).toBe("awaiting_approval");
    expect(service.resolveApproval("final", "bigital", project.id, "approved", null).plan.status).toBe("completed");
    expect(service.repository.workspace("bigital", project.id).experiences.map((episode) => episode.outcome)).toEqual([
      "verified",
    ]);
  });
  it("retains structured deliverables and nullable unmeasured usage", () => {
    const project = setupProject();
    const service = createFactoryService(ctx, { providerAvailable: () => true });
    const plan = service.createPlan({ business_id: "bigital", project_id: project.id, instruction: "PRD hazırla" });
    const content = {
      summary: "Ürün",
      evidence: ["brief"],
      limitations: [],
      artifacts: [],
      structured: { prd: ["Kullanıcı gereksinimi"], backlog: ["Gerçek iş"] },
    };
    db.prepare(
      "INSERT INTO factory_deliverables(id,plan_id,business_id,project_id,version,type,title,content_json,created_at) VALUES('d',?,'bigital',?,1,'product','PRD',?,1)",
    ).run(plan.id, project.id, JSON.stringify(content));
    expect(service.repository.workspace("bigital", project.id).deliverables[0].content.structured).toEqual(
      content.structured,
    );
  });
  it("API refuses cross-business plan reads and execution without durable approval", async () => {
    const project = setupProject();
    const service = createFactoryService(ctx, { providerAvailable: () => true });
    const plan = service.createPlan({ business_id: "bigital", project_id: project.id, instruction: "PRD hazırla" });
    const other = service.business({ name: "Other" }) as { id: string };
    let starts = 0;
    registerFactoryRoutes(ctx, {
      startPlan: async () => {
        starts += 1;
        return { started: true };
      },
    });
    expect((await request(ctx.app).get(`/api/factory/plans/${plan.id}`).query({ business_id: other.id })).status).toBe(
      404,
    );
    expect(
      (await request(ctx.app).post(`/api/factory/plans/${plan.id}/start`).query({ business_id: "bigital" })).status,
    ).toBe(409);
    expect(starts).toBe(0);
    const approval = db.prepare("SELECT id FROM factory_approvals WHERE plan_id=?").get(plan.id) as { id: string };
    const resolve = (input: Record<string, unknown>) =>
      request(ctx.app)
        .post(`/api/factory/approvals/${approval.id}/resolve`)
        .query({ business_id: "bigital" })
        .send(input);
    expect((await resolve({ decision: "maybe" })).body.error).toBe("invalid_decision");
    expect((await resolve({ decision: "revision_requested", note: " " })).body.error).toBe("revision_note_required");
    expect((await resolve({ decision: "revision_requested", note: "Kapsamı daralt" })).body.error).toBe(
      "revision_unavailable",
    );
    expect((await resolve({ decision: "approved" })).status).toBe(200);
    expect(
      (await request(ctx.app).post(`/api/factory/plans/${plan.id}/start`).query({ business_id: "bigital" })).status,
    ).toBe(200);
    expect(starts).toBe(1);
    expect((await request(ctx.app).get(`/api/factory/plans/${plan.id}`)).status).toBe(400);
  });
});
