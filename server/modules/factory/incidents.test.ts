import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { applyBaseSchema } from "../bootstrap/schema/base-schema.ts";
import { applyFactorySchema } from "./schema.ts";
import { createFactoryRepository } from "./repository.ts";
import { normalizeFactoryError, recordFactoryIncident } from "./incidents.ts";

describe("scoped incident experience", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    applyBaseSchema(db);
    applyFactorySchema(db);
  });
  afterEach(() => db.close());
  const input = {
    business_id: "bigital",
    project_id: null,
    plan_id: null,
    task_id: null,
    title: "Derleme başarısız",
    outcome: "failed" as const,
  };
  it("normalizes transient private identifiers for a stable technical error hash", () => {
    const first = normalizeFactoryError(
      "Error: Cannot read /Users/private/project/app.ts:20:7 request_id=aa1 at https://internal.example.net/api",
    );
    const second = normalizeFactoryError(
      "Error: Cannot read /srv/project/app.ts:88:9 request_id=bb2 at https://private.example.net/api",
    );
    expect(first.error_hash).toBe(second.error_hash);
    expect(first.normalized_error).not.toContain("private");
    expect(first.normalized_error).not.toContain("example.net");
    expect(first.error_hash).toHaveLength(64);
    expect(normalizeFactoryError("Module not found").error_hash).not.toBe(first.error_hash);
  });
  it("records repeated occurrences and failed episodes within the same scope", () => {
    const first = recordFactoryIncident(db, { ...input, detail: "Build failed in /srv/first/app.ts:12:8" });
    const repeated = recordFactoryIncident(db, { ...input, detail: "Build failed in /Users/second/app.ts:42:9" });
    expect(first.repeat_count).toBe(1);
    expect(repeated.repeat_count).toBe(2);
    expect(first.error_hash).toBe(repeated.error_hash);
    const workspace = createFactoryRepository(db).workspace("bigital");
    expect(workspace.incidents).toHaveLength(2);
    expect(workspace.experiences).toHaveLength(2);
    expect(workspace.experiences.every((episode) => episode.outcome === "failed" && episode.incident_id)).toBe(true);
  });
  it("keeps repetition and episode visibility separate across businesses and projects", () => {
    db.prepare("INSERT INTO businesses(id,name,created_at) VALUES('other','Other',1)").run();
    db.prepare(
      "INSERT INTO projects(id,business_id,name,project_path,core_goal) VALUES('one','bigital','One','/project/one','Goal'),('two','bigital','Two','/project/two','Goal')",
    ).run();
    const first = recordFactoryIncident(db, { ...input, project_id: "one", detail: "Build failed" });
    const otherProject = recordFactoryIncident(db, { ...input, project_id: "two", detail: "Build failed" });
    const otherBusiness = recordFactoryIncident(db, { ...input, business_id: "other", detail: "Build failed" });
    expect([first.repeat_count, otherProject.repeat_count, otherBusiness.repeat_count]).toEqual([1, 1, 1]);
    expect(createFactoryRepository(db).workspace("bigital", "one").experiences).toHaveLength(1);
    expect(createFactoryRepository(db).workspace("other").experiences).toHaveLength(1);
    expect(() =>
      recordFactoryIncident(db, { ...input, business_id: "other", project_id: "one", detail: "Error" }),
    ).toThrow("bağlı değil");
  });
  it("redacts credentials before incident and episode persistence", () => {
    const secret = "sk-proj-abcdefghijklmnopqrstuvwx";
    const incident = recordFactoryIncident(db, { ...input, detail: `API failed: ${secret}` });
    expect(incident.detail).not.toContain(secret);
    expect(JSON.stringify(db.prepare("SELECT * FROM factory_incidents").all())).not.toContain(secret);
    expect(JSON.stringify(db.prepare("SELECT * FROM factory_experience_episodes").all())).not.toContain(secret);
  });
  it("adds normalization fields to legacy incident rows without destroying history", () => {
    db.exec("DROP TABLE factory_incidents");
    db.exec(
      "CREATE TABLE factory_incidents(id TEXT PRIMARY KEY,plan_id TEXT,business_id TEXT,project_id TEXT,task_id TEXT,title TEXT,detail TEXT,status TEXT,created_at INTEGER)",
    );
    db.prepare(
      "INSERT INTO factory_incidents VALUES('old1',NULL,'bigital',NULL,NULL,'Error','Build failed /old/private/app.ts:1','open',1),('old2',NULL,'bigital',NULL,NULL,'Error','Build failed /other/private/app.ts:2','open',2)",
    ).run();
    applyFactorySchema(db);
    applyFactorySchema(db);
    const rows = db.prepare("SELECT id,error_hash,repeat_count FROM factory_incidents ORDER BY created_at").all();
    expect(rows).toHaveLength(2);
    expect(rows[0].error_hash).toBe(rows[1].error_hash);
    expect(rows.map((row) => row.repeat_count)).toEqual([1, 2]);
  });
});
