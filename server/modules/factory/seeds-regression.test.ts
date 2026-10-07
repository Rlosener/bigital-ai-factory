import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { applyBaseSchema } from "../bootstrap/schema/base-schema.ts";
import { applyTaskSchemaMigrations } from "../bootstrap/schema/task-schema-migrations.ts";
import { applyDefaultSeeds } from "../bootstrap/schema/seeds.ts";

describe("Bigital organization seed regression", () => {
  it("creates only five deliberate agents/departments and remains repeatable", () => {
    const db = new DatabaseSync(":memory:");
    try {
      applyBaseSchema(db);
      applyTaskSchemaMigrations(db);
      applyDefaultSeeds(db);
      const agents = db.prepare("SELECT id,name,department_id FROM agents ORDER BY name").all();
      expect(agents.map((agent) => agent.name)).toEqual(["Alex", "Atlas", "Manager", "Mira", "Nova"]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM departments").get()?.count).toBe(5);
      expect(db.prepare("SELECT value FROM settings WHERE key='factoryOrganization'").get()?.value).toBe("true");
      expect(db.prepare("SELECT COUNT(*) AS count FROM projects").get()?.count).toBe(0);
      applyDefaultSeeds(db);
      expect(db.prepare("SELECT id,name,department_id FROM agents ORDER BY name").all()).toEqual(agents);
      expect(db.prepare("SELECT COUNT(*) AS count FROM departments").get()?.count).toBe(5);
    } finally {
      db.close();
    }
  });
  it("preserves legacy company, agent, department and project configuration", () => {
    const db = new DatabaseSync(":memory:");
    try {
      applyBaseSchema(db);
      applyTaskSchemaMigrations(db);
      for (const department of ["planning", "dev", "design", "qa", "devsecops", "operations"])
        db.prepare("INSERT INTO departments(id,name,name_ko,icon,color) VALUES(?,?,?,'old','#123456')").run(
          department,
          `Legacy ${department}`,
          department,
        );
      db.prepare(
        "INSERT INTO agents(id,name,department_id,role,cli_provider,personality) VALUES('custom','Custom Agent','dev','senior','claude','Private custom configuration')",
      ).run();
      db.prepare("INSERT INTO settings(key,value) VALUES('companyName','Existing Company'),('language','en')").run();
      db.prepare(
        "INSERT INTO projects(id,name,project_path,core_goal) VALUES('old','Existing Project','/existing/private/project','Keep original goal')",
      ).run();
      applyDefaultSeeds(db);
      expect(db.prepare("SELECT name,cli_provider,personality FROM agents WHERE id='custom'").get()).toEqual({
        name: "Custom Agent",
        cli_provider: "claude",
        personality: "Private custom configuration",
      });
      expect(db.prepare("SELECT name,color FROM departments WHERE id='dev'").get()).toEqual({
        name: "Legacy dev",
        color: "#123456",
      });
      expect(db.prepare("SELECT value FROM settings WHERE key='companyName'").get()?.value).toBe("Existing Company");
      expect(db.prepare("SELECT value FROM settings WHERE key='language'").get()?.value).toBe("en");
      expect(db.prepare("SELECT value FROM settings WHERE key='factoryOrganization'").get()).toBeUndefined();
      expect(db.prepare("SELECT name,core_goal FROM projects WHERE id='old'").get()).toEqual({
        name: "Existing Project",
        core_goal: "Keep original goal",
      });
      expect(db.prepare("SELECT id FROM agents WHERE name IN ('Manager','Alex','Mira','Nova')").all()).toEqual([]);
    } finally {
      db.close();
    }
  });
});
