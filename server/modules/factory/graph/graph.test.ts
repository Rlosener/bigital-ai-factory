import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { applyBaseSchema } from "../../bootstrap/schema/base-schema.ts";
import { applyFactorySchema } from "../schema.ts";
import { recordFactoryExperience, recordFactoryIncident } from "../incidents.ts";
import { buildGraphTaskBrief, getPlaybooks, readGraphOverview } from "./intelligence.ts";
import { codeGraphStatus, parseGraphifyNodes, queryCodeGraph, updateProjectCodeGraph } from "./graphify-client.ts";
import { sanitizeGlobalExperience } from "./sanitize.ts";

function database(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  applyBaseSchema(db);
  applyFactorySchema(db);
  return db;
}

describe("graph intelligence", () => {
  const databases: DatabaseSync[] = [];
  afterEach(() => {
    for (const db of databases.splice(0)) db.close();
  });

  it("keeps project experience private and publishes only a sanitized playbook", () => {
    const db = database();
    databases.push(db);
    db.prepare(
      "INSERT INTO projects(id,business_id,name,project_path,core_goal) VALUES('alpha','bigital','Alpha','/work/alpha','Goal'),('beta','bigital','Beta','/work/beta','Goal')",
    ).run();
    const incident = recordFactoryIncident(db, {
      business_id: "bigital",
      project_id: "alpha",
      plan_id: null,
      task_id: null,
      title: "Kaynaklı rapor hatası",
      detail: "Kaynaklı rapor kabul kriteri Bigital müşterisinde /Users/rlosener/secret/app.ts içinde koptu",
      outcome: "failed",
    });
    recordFactoryExperience(db, {
      business_id: "bigital",
      project_id: "alpha",
      plan_id: null,
      incident_id: incident.id,
      error_hash: incident.error_hash,
      outcome: "verified",
      summary:
        "Bigital için /Users/rlosener/secret/app.ts yolundaki kaynaklı rapor hatasında kabul kriterini backlog maddesine bağla. sk-proj-123456789012345678901234567890",
    });
    recordFactoryIncident(db, {
      business_id: "bigital",
      project_id: "alpha",
      plan_id: null,
      task_id: null,
      title: "Instagram renk paleti",
      detail: "Instagram renk paleti mor olmalı",
      outcome: "failed",
    });
    const alpha = buildGraphTaskBrief(db, {
      businessId: "bigital",
      projectId: "alpha",
      task: "Kaynaklı rapor ürünü için kabul kriterini tamamla",
      businessName: "Bigital",
      projectName: "Alpha",
      now: Date.now(),
    });
    expect(alpha).toContain("Doğrulanmış çözüm");
    expect(alpha).toContain("kabul kriterini backlog maddesine bağla");
    expect(alpha).not.toContain("sk-proj-");
    expect(alpha).not.toContain("Instagram");

    const beta = buildGraphTaskBrief(db, {
      businessId: "bigital",
      projectId: "beta",
      task: "Kaynaklı rapor ürünü için kabul kriterini tamamla",
      businessName: "Bigital",
      projectName: "Beta",
      now: Date.now(),
    });
    expect(beta).not.toContain("/Users/rlosener");
    expect(beta).not.toContain("sk-proj-");
    const playbooks = getPlaybooks(db, {
      businessId: "other",
      projectId: null,
      task: "Kaynaklı rapor kabul kriteri",
      now: Date.now(),
    });
    expect(playbooks.length).toBeGreaterThan(0);
    expect(playbooks.every((item) => item.scope === "global")).toBe(true);
    expect(JSON.stringify(playbooks)).not.toContain("Bigital");
    expect(JSON.stringify(playbooks)).not.toContain("rlosener");
    expect(sanitizeGlobalExperience("Bigital https://client.example/a /tmp/a.ts", ["Bigital"])).not.toContain(
      "Bigital",
    );
  });

  it("records a failed attempt without turning it into a playbook", () => {
    const db = database();
    databases.push(db);
    recordFactoryIncident(db, {
      business_id: "bigital",
      project_id: null,
      plan_id: null,
      task_id: null,
      title: "Kaynaklı rapor hatası",
      detail: "Kaynaklı rapor tüm repository silinerek üretilemedi",
      outcome: "failed",
    });
    const brief = buildGraphTaskBrief(db, {
      businessId: "bigital",
      projectId: null,
      task: "Kaynaklı rapor ürünü",
      businessName: "Bigital",
      now: Date.now(),
    });
    expect(brief).toContain("Başarısız deneme");
    expect(getPlaybooks(db, { businessId: "bigital", task: "Kaynaklı rapor", now: Date.now() })).toEqual([]);
  });

  it("shows only the active project's nervous system", () => {
    const db = database();
    databases.push(db);
    db.prepare("INSERT INTO businesses(id,name,created_at) VALUES('other','Other',1)").run();
    db.prepare(
      "INSERT INTO projects(id,business_id,name,project_path,core_goal) VALUES('alpha','bigital','Alpha','/work/alpha','Goal'),('beta','other','Beta','/work/beta','Goal')",
    ).run();
    recordFactoryIncident(db, {
      business_id: "bigital",
      project_id: "alpha",
      plan_id: null,
      task_id: null,
      title: "Takvim tarihi",
      detail: "Instagram takviminde tarih biçimi geçersiz",
      outcome: "failed",
    });
    recordFactoryIncident(db, {
      business_id: "other",
      project_id: "beta",
      plan_id: null,
      task_id: null,
      title: "Gizli olay",
      detail: "Başka işletmenin özel hatası",
      outcome: "failed",
    });
    const overview = readGraphOverview(db, { businessId: "bigital", projectId: "alpha", task: "" });
    expect(overview.nodes.some((node) => node.label === "Takvim tarihi")).toBe(true);
    expect(JSON.stringify(overview)).not.toContain("Gizli olay");
    const businessWide = readGraphOverview(db, { businessId: "bigital", projectId: null, task: "" });
    expect(businessWide.nodes.some((node) => node.label === "Takvim tarihi")).toBe(true);
    expect(JSON.stringify(businessWide)).not.toContain("Gizli olay");
  });

  it("asks Graphify for code context and skips graph updates while tests are running", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "graphify-client-"));
    fs.mkdirSync(path.join(directory, "graphify-out"));
    fs.writeFileSync(path.join(directory, "graphify-out", "graph.json"), "{}");
    const calls: string[] = [];
    const runner = (command: { args: string[] }) => {
      calls.push(command.args[0]);
      return "Function calls Service accesses Database";
    };
    expect(queryCodeGraph(directory, "rapor servisi", 200, runner, true)).toContain("Function calls Service");
    updateProjectCodeGraph(directory, runner);
    expect(calls).toEqual(["query"]);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("reads Graphify node lines and summarizes graph.json communities", () => {
    const hits = parseGraphifyNodes(
      [
        "Graph: graphify-out/graph.json (3 nodes)",
        "NODE schedule() [src=server/modules/factory/runtime.ts loc=L393 community=factory/runtime.ts]",
        "NODE ref_node_path [src= loc= community=ref_node_path]",
      ].join("\n"),
    );
    expect(hits).toEqual([
      {
        label: "schedule()",
        source_file: "server/modules/factory/runtime.ts",
        location: "L393",
        community: "factory/runtime.ts",
      },
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "graphify-summary-"));
    fs.mkdirSync(path.join(directory, "graphify-out"));
    fs.writeFileSync(
      path.join(directory, "graphify-out", "graph.json"),
      JSON.stringify({
        built_at_commit: "abc1234",
        nodes: [
          { id: "a", label: "schedule()", community: 1, community_name: "runtime", source_file: "runtime.ts" },
          { id: "b", label: "plan()", community: 1, community_name: "runtime", source_file: "runtime.ts" },
          { id: "c", label: "Plan", community: 2, community_name: "shared", source_file: "shared.ts" },
        ],
        links: [
          { source: "a", target: "b" },
          { source: "a", target: "c" },
        ],
      }),
    );
    const summary = codeGraphStatus(directory);
    expect(summary).toMatchObject({ ready: true, node_count: 3, edge_count: 2, community_count: 2 });
    expect(summary.communities[0]).toEqual({ id: "1", name: "runtime", size: 2 });
    expect(summary.links).toEqual([{ source: "1", target: "2", weight: 1 }]);
    expect(summary.hubs[0]).toMatchObject({ label: "schedule()", degree: 2 });
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
