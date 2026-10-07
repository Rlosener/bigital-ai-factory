import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import request from "supertest";
import { applyBaseSchema } from "../bootstrap/schema/base-schema.ts";
import { createRunInTransaction } from "../bootstrap/helpers.ts";
import { applyFactorySchema } from "./schema.ts";
import { configureFactoryProviderSeat } from "./provider-seats.ts";
import { createFactoryRepository } from "./repository.ts";
import { createFactoryService } from "./service.ts";
import { registerFactoryRoutes } from "./routes.ts";

describe("scoped real identity capacity settings and human recovery", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    applyBaseSchema(db);
    applyFactorySchema(db);
    db.prepare("INSERT INTO businesses(id,name,created_at) VALUES('other','Other',1)").run();
    db.prepare("INSERT INTO agents(id,name,role,cli_provider) VALUES('coder','Coder','senior','codex')").run();
    db.prepare(
      "INSERT INTO api_providers(id,name,type,base_url,enabled) VALUES('actual-api','Actual API','openai','https://api.example.test/v1',1),('disabled-api','Disabled API','openai','https://api.example.test/v1',0)",
    ).run();
    db.prepare(
      "INSERT INTO projects(id,business_id,name,project_path,core_goal) VALUES('p','bigital','Project','/existing/project','Goal')",
    ).run();
    db.prepare(
      "INSERT INTO factory_plans(id,business_id,project_id,instruction,workflow,status,risk,summary,created_at,updated_at,controller_state,stopped_reason) VALUES('plan','bigital','p','Do work','software','blocked','medium','Plan',1,1,'STOP','Same error')",
    ).run();
  });
  afterEach(() => db.close());
  function ctx() {
    const app = express();
    app.use(express.json());
    return { db, app, nowMs: Date.now, runInTransaction: createRunInTransaction(db) };
  }
  it("creates one real CLI/API identity seat and returns typed capacity with private-safe label", () => {
    const cli = configureFactoryProviderSeat(db, "bigital", {
      provider: "codex",
      label: "Efe-Codex",
      max_concurrency: 3,
      reserve_slots: 1,
      human_reserve_percent: 20,
    });
    expect(cli.enabled).toBe(true);
    expect(cli.label).toBe("Efe-Codex");
    expect(cli.human_reserve_percent).toBe(20);
    expect(() => configureFactoryProviderSeat(db, "bigital", { provider: "codex" })).toThrow("zaten mevcut");
    const api = configureFactoryProviderSeat(db, "bigital", {
      provider: "api",
      api_provider_id: "actual-api",
      label: "API Primary",
    });
    expect(api.api_provider_id).toBe("actual-api");
    expect(() => configureFactoryProviderSeat(db, "bigital", { provider: "api", api_provider_id: "invented" })).toThrow(
      "etkin API",
    );
    expect(() =>
      configureFactoryProviderSeat(db, "bigital", { provider: "api", api_provider_id: "disabled-api" }),
    ).toThrow("etkin API");
    expect(() => configureFactoryProviderSeat(db, "bigital", { provider: "gemini" })).toThrow("mevcut çalışan");
    expect(() =>
      configureFactoryProviderSeat(db, "bigital", { provider: "codex", oauth_account_id: "fake-account" }),
    ).toThrow("OAuth");
  });
  it("edits bounded settings without changing identity or erasing active work/history", () => {
    const seat = configureFactoryProviderSeat(db, "bigital", { provider: "codex", max_concurrency: 3 });
    const updated = configureFactoryProviderSeat(
      db,
      "bigital",
      { enabled: false, max_concurrency: 2, reserve_slots: 1, human_reserve_percent: 25, label: "Updated Slot" },
      seat.id,
    );
    expect(updated.enabled).toBe(false);
    expect(updated.max_concurrency).toBe(2);
    expect(updated.label).toBe("Updated Slot");
    expect(() => configureFactoryProviderSeat(db, "other", { enabled: false }, seat.id)).toThrow("işletme kapsamında");
    expect(() => configureFactoryProviderSeat(db, "bigital", { provider: "api" }, seat.id)).toThrow(
      "kimliği değiştirilemez",
    );
    expect(() => configureFactoryProviderSeat(db, "bigital", { reserve_slots: 4 }, seat.id)).toThrow("aşamaz");
    expect(() => configureFactoryProviderSeat(db, "bigital", { human_reserve_percent: 100 }, seat.id)).toThrow("yüzde");
    expect(createFactoryRepository(db).workspace("bigital").provider_seats?.[0].enabled).toBe(false);
  });
  it("records explicit human controller reset with a private audited rationale", () => {
    const service = createFactoryService(ctx());
    expect(() => service.resetController("plan", "other", null, "Review completed")).toThrow("kapsamda bulunamadı");
    expect(() => service.resetController("plan", "bigital", "p", "password=1234")).toThrow("Gizli anahtar");
    const plan = service.resetController("plan", "bigital", "p", "Kök neden giderildi; aynı iş akışını sürdür.");
    expect(plan.controller_state).toBe("NORMAL");
    expect(plan.controller_policy?.max_retries).toBe(3);
    expect(plan.stopped_reason).toBeNull();
    expect(plan.status).toBe("blocked");
    expect(db.prepare("SELECT action,state FROM factory_control_events WHERE plan_id='plan'").get()).toEqual({
      action: "human_reset",
      state: "NORMAL",
    });
    expect(service.repository.workspace("bigital", "p").activity[0].action).toBe("controller.human_reset");
    expect(() => service.resetController("plan", "bigital", "p", "Again")).toThrow("müdahale bekleyen");
    db.prepare("UPDATE factory_plans SET controller_state='STOP',status='completed' WHERE id='plan'").run();
    expect(() => service.resetController("plan", "bigital", "p", "Again")).toThrow("bitmemiş plan");
  });
  it("refuses controller reset while a linked execution is active", () => {
    db.prepare("INSERT INTO tasks(id,title,project_id,status) VALUES('task','Work','p','in_progress')").run();
    db.prepare(
      "INSERT INTO factory_steps(id,plan_id,position,title,description,role,skills_json,agent_id,task_id,status,output_type) VALUES('step','plan',0,'Work','Scope','developer','[]','coder','task','running','implementation')",
    ).run();
    db.prepare(
      "INSERT INTO factory_runs(id,plan_id,step_id,task_id,business_id,project_id,status,started_at) VALUES('run','plan','step','task','bigital','p','running',1)",
    ).run();
    expect(() => createFactoryService(ctx()).resetController("plan", "bigital", "p", "Retry")).toThrow(
      "Aktif çalıştırma",
    );
    expect(db.prepare("SELECT controller_state FROM factory_plans WHERE id='plan'").get()?.controller_state).toBe(
      "STOP",
    );
  });
  it("API applies seat scope and explicit reset without bypassing subsequent plan approval", async () => {
    const context = ctx();
    registerFactoryRoutes(context);
    const created = await request(context.app)
      .post("/api/factory/provider-seats")
      .send({ business_id: "bigital", provider: "codex", label: "Primary" });
    expect(created.status).toBe(201);
    expect(created.body.seat.enabled).toBe(true);
    expect(
      (
        await request(context.app)
          .patch(`/api/factory/provider-seats/${created.body.seat.id}`)
          .query({ business_id: "other" })
          .send({ enabled: false })
      ).status,
    ).toBe(404);
    const reset = await request(context.app)
      .post("/api/factory/plans/plan/controller/reset")
      .query({ business_id: "bigital", project_id: "p" })
      .send({ note: "Verified prerequisite correction" });
    expect(reset.status).toBe(200);
    expect(reset.body.plan.controller_state).toBe("NORMAL");
    expect(
      (
        await request(context.app)
          .post("/api/factory/plans/plan/start")
          .query({ business_id: "bigital", project_id: "p" })
      ).status,
    ).toBe(409);
  });
});
