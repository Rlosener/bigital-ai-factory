import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { applyBaseSchema } from "../bootstrap/schema/base-schema.ts";
import { applyTaskSchemaMigrations } from "../bootstrap/schema/task-schema-migrations.ts";
import { applyFactorySchema } from "./schema.ts";
import { createFactoryRuntime, isFactoryTask } from "./runtime.ts";
import { parseFactoryOutput, validateFactoryOutput, verifyFactorySoftware, extractFactoryUsage } from "./quality.ts";
import { recordFactoryExperience, recordFactoryIncident } from "./incidents.ts";
import { routeFactoryModel } from "./model-router.ts";
import { createReviewFinalizeTools } from "../workflow/orchestration/review-finalize-tools.ts";
import { createRunInTransaction } from "../bootstrap/helpers.ts";
import { createFactoryService } from "./service.ts";
import type { RuntimeContext } from "../../types/runtime-context.ts";
import type { FactoryContext } from "./types.ts";

const product = {
  prd: { problem: "Günlük rapor hazırlığı", users: ["operasyon"], requirements: ["Kaynak doğrulama"] },
  mvp: ["Rapor"],
  features: ["Kaynaklı günlük rapor"],
  backlog: [{ title: "Rapor üret", priority: "high", acceptance_criteria: ["Kaynaklar görünür"] }],
  technical_tasks: ["Rapor kaynak doğrulama servisini yaz"],
  user_flows: ["Seç ve raporla"],
  data_model: ["Report"],
  risks: ["Eksik kaynak"],
  acceptance_criteria: ["Kaynaklar görünür"],
};
const review = { verdict: "pass", findings: [], evidence: ["Backlog ile kabul kriterleri karşılaştırıldı."] };

describe("factory verified lifecycle", () => {
  let db: DatabaseSync;
  let directory: string;
  let ctx: RuntimeContext;
  let launched: string[];
  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    applyBaseSchema(db);
    applyTaskSchemaMigrations(db);
    db.exec("ALTER TABLE tasks ADD COLUMN base_branch TEXT");
    applyFactorySchema(db);
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "factory-runtime-"));
    launched = [];
    for (const [id, dept] of [
      ["writer", "product"],
      ["reviewer", "qa"],
    ]) {
      db.prepare("INSERT INTO departments(id,name,name_ko,icon,color) VALUES(?,?,?,'x','#333')").run(dept, dept, dept);
      db.prepare(
        "INSERT INTO agents(id,name,name_ko,department_id,role,cli_provider) VALUES(?,?,?,?,'senior','codex')",
      ).run(id, id, id, dept);
    }
    ctx = {
      db,
      logsDir: directory,
      nowMs: Date.now,
      broadcast: vi.fn(),
      appendTaskLog: vi.fn(),
      activeProcesses: new Map(),
      taskWorktrees: new Map(),
      stopProgressTimer: vi.fn(),
      detectAllCli: async () => ({ codex: { installed: true, authenticated: true } }),
      getProviderModelConfig: () => ({}),
      getDeptName: (id: string) => id,
      startTaskExecutionForAgent: (taskId: string, agent: any) => {
        launched.push(taskId);
        db.prepare("UPDATE tasks SET status='in_progress',started_at=? WHERE id=?").run(Date.now(), taskId);
        db.prepare("UPDATE agents SET status='working',current_task_id=? WHERE id=?").run(taskId, agent.id);
      },
    } as unknown as RuntimeContext;
  });
  afterEach(() => {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function plan(approved = true) {
    db.prepare(
      "INSERT INTO factory_plans(id,business_id,instruction,workflow,status,risk,summary,created_at,updated_at) VALUES('plan','bigital','Kaynaklı rapor ürünü','product',?,'low','Plan',1,1)",
    ).run(approved ? "approved" : "draft");
    db.exec(
      "INSERT INTO factory_steps(id,plan_id,position,title,description,role,skills_json,depends_on_json,output_type) VALUES('produce','plan',0,'Ürün planı','PRD üret','product_manager','[]','[]','product'),('review','plan',1,'İnceleme','Bağımsız incele','reviewer','[]','[\"produce\"]','review')",
    );
    if (approved)
      db.exec(
        "INSERT INTO factory_approvals(id,plan_id,business_id,kind,status,title,reason,created_at) VALUES('approval','plan','bigital','plan','approved','Plan','İnsan kararı',1)",
      );
    return createFactoryRuntime(ctx);
  }
  async function finish(runtime: ReturnType<typeof createFactoryRuntime>, taskId: string, output: unknown) {
    fs.writeFileSync(
      path.join(directory, `${taskId}.log`),
      JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(output) } }) +
        "\n" +
        JSON.stringify({ type: "turn.completed", usage: { input_tokens: 100, output_tokens: 50 } }),
    );
    await runtime.onTaskComplete(taskId, 0);
  }
  it("requires durable human plan approval before launching anything", async () => {
    const runtime = plan(false);
    await expect(runtime.startPlan("plan")).rejects.toThrow("onaylanmalıdır");
    expect(launched).toEqual([]);
    expect(db.prepare("SELECT count(*) AS count FROM factory_runs").get()?.count).toBe(0);
  });
  it("runs actual existing runtime entry, sequences dependencies and preserves agent identity/model configuration", async () => {
    const runtime = plan();
    expect(await runtime.startPlan("plan")).toEqual({ started: true });
    expect(launched).toHaveLength(1);
    const producer = launched[0];
    expect(runtime.beforeTaskStart(producer)?.noTools).toBe(true);
    expect(fs.existsSync(path.join(runtime.beforeTaskStart(producer)!.workingDirectory!, ".git"))).toBe(false);
    await finish(runtime, producer, product);
    expect(launched).toHaveLength(2);
    const reviewer = launched[1];
    const ids = db.prepare("SELECT agent_id FROM factory_steps ORDER BY position").all();
    expect(ids.map((row) => row.agent_id)).toEqual(["writer", "reviewer"]);
    await finish(runtime, reviewer, review);
    expect(db.prepare("SELECT status FROM factory_plans WHERE id='plan'").get()?.status).toBe("awaiting_approval");
    expect(db.prepare("SELECT DISTINCT status FROM tasks").all()).toEqual([{ status: "review" }]);
    expect(
      db.prepare("SELECT count(*) AS count FROM factory_approvals WHERE kind='deliverable' AND status='pending'").get()
        ?.count,
    ).toBe(1);
    expect(
      db.prepare("SELECT input_tokens,output_tokens,cost_usd FROM factory_runs ORDER BY started_at LIMIT 1").get(),
    ).toEqual({ input_tokens: 100, output_tokens: 50, cost_usd: null });
    expect(db.prepare("SELECT cli_provider,cli_model,api_provider_id FROM agents WHERE id='writer'").get()).toEqual({
      cli_provider: "codex",
      cli_model: null,
      api_provider_id: null,
    });
    expect(() => runtime.validateFinalApproval("plan")).not.toThrow();
  });
  it("does not treat exit zero or the phrase done as completion evidence", async () => {
    const runtime = plan();
    await runtime.startPlan("plan");
    fs.writeFileSync(path.join(directory, `${launched[0]}.log`), "done; everything passed");
    await runtime.onTaskComplete(launched[0], 0);
    expect(db.prepare("SELECT status FROM factory_plans WHERE id='plan'").get()?.status).toBe("failed");
    expect(db.prepare("SELECT status FROM tasks").get()?.status).toBe("pending");
    expect(launched).toHaveLength(1);
    expect(db.prepare("SELECT count(*) AS count FROM factory_deliverables").get()?.count).toBe(0);
  });
  it("blocks provider-less execution and retries the same durable plan when configured", async () => {
    const runtime = plan();
    ctx.detectAllCli = async () => ({});
    const blocked = await runtime.startPlan("plan");
    expect(blocked.started).toBe(false);
    expect(db.prepare("SELECT status FROM factory_plans").get()?.status).toBe("blocked");
    ctx.detectAllCli = async () => ({ codex: { installed: true, authenticated: true } });
    expect((await runtime.startPlan("plan")).started).toBe(true);
    expect(launched).toHaveLength(1);
  });
  it("requires a reviewer different from the author", async () => {
    const runtime = plan();
    db.prepare("UPDATE agents SET status='offline' WHERE id='reviewer'").run();
    await runtime.startPlan("plan");
    await finish(runtime, launched[0], product);
    expect(launched).toHaveLength(1);
    expect(db.prepare("SELECT status FROM factory_plans").get()?.status).toBe("blocked");
    expect(db.prepare("SELECT count(*) AS count FROM factory_approvals WHERE kind='deliverable'").get()?.count).toBe(0);
  });
  it("returns reviewer findings to the producer once, then blocks repeated failures", async () => {
    const runtime = plan();
    await runtime.startPlan("plan");
    await finish(runtime, launched[0], product);
    const rejected = {
      verdict: "changes_requested",
      findings: ["KPI eksik"],
      evidence: ["Kabul kriterleri kontrol edildi"],
    };
    await finish(runtime, launched[1], rejected);
    expect(launched).toHaveLength(3);
    expect(db.prepare("SELECT description FROM tasks WHERE id=?").get(launched[2])?.description).toContain("KPI eksik");
    expect(isFactoryTask(db, launched[0])).toBe(true);
    await finish(runtime, launched[2], product);
    await finish(runtime, launched[3], rejected);
    expect(launched).toHaveLength(4);
    expect(db.prepare("SELECT status FROM factory_plans").get()?.status).toBe("failed");
  });
  it("blocks raw secret output before recording a deliverable", async () => {
    const runtime = plan();
    await runtime.startPlan("plan");
    await finish(runtime, launched[0], { ...product, risks: ["sk-proj-123456789012345678901234567890"] });
    expect(db.prepare("SELECT status FROM factory_plans").get()?.status).toBe("failed");
    expect(db.prepare("SELECT count(*) AS count FROM factory_deliverables").get()?.count).toBe(0);
    expect(JSON.stringify(db.prepare("SELECT * FROM factory_incidents").all())).not.toContain("sk-proj-");
  });
  it("projects concise Manager blackboard findings and routes private reviewer feedback before rework", async () => {
    const runtime = plan();
    db.prepare(
      "INSERT INTO projects(id,business_id,name,project_path,core_goal) VALUES('project','bigital','Project',?,'Goal')",
    ).run(directory);
    db.exec("UPDATE factory_plans SET project_id='project' WHERE id='plan'");
    await runtime.startPlan("plan");
    await finish(runtime, launched[0], product);
    expect(db.prepare("SELECT writer FROM factory_blackboard WHERE section='shared_finding'").get()?.writer).toBe(
      "manager",
    );
    await finish(runtime, launched[1], {
      verdict: "changes_requested",
      findings: [{ severity: "high", finding: "Backlog ölçümünü netleştir", requested_change: "Ölçüm kapısı ekle" }],
      evidence: [`Kriterler karşılaştırıldı ${"kanıt ".repeat(100)}`],
    });
    const feedback = db.prepare("SELECT recipient_agent_id,kind,status FROM factory_mailbox").all();
    expect(feedback).toEqual([{ recipient_agent_id: "writer", kind: "review_feedback", status: "handled" }]);
    const description = String(db.prepare("SELECT description FROM tasks WHERE id=?").get(launched[2])?.description);
    expect(description).toContain("özel mailbox");
    expect(description).toContain("Backlog ölçümünü netleştir");
    expect(db.prepare("SELECT controller_state FROM factory_plans").get()?.controller_state).toBe("STEER");
  });
  it("turns a human revision request into a traceable new round that keeps every earlier version", async () => {
    const runtime = plan();
    db.prepare(
      "INSERT INTO projects(id,business_id,name,project_path,core_goal) VALUES('project','bigital','Project',?,'Goal')",
    ).run(directory);
    db.exec("UPDATE factory_plans SET project_id='project' WHERE id='plan'");
    const service = createFactoryService(
      { db, app: {} as FactoryContext["app"], nowMs: Date.now, runInTransaction: createRunInTransaction(db) },
      { validateFinalApproval: runtime.validateFinalApproval },
    );
    await runtime.startPlan("plan");
    await finish(runtime, launched[0], product);
    await finish(runtime, launched[1], review);
    const first = db.prepare("SELECT id FROM factory_approvals WHERE kind='deliverable' AND status='pending'").get()!;
    expect(() => service.resolveApproval(String(first.id), "bigital", "project", "revision_requested", "  ")).toThrow(
      "Revizyon notu",
    );
    expect(() => service.resolveApproval("approval", "bigital", null, "revision_requested", "Not")).toThrow(
      "yalnızca nihai çıktı",
    );
    const note = "Hedef kitleyi KOBİ yöneticileriyle sınırla";
    const resolved = service.resolveApproval(String(first.id), "bigital", "project", "revision_requested", note);
    expect(resolved.plan.status).toBe("approved");
    expect(resolved.plan.steps.map((step) => step.status)).toEqual(["pending", "pending"]);
    expect(db.prepare("SELECT status,decision,note FROM factory_approvals WHERE id=?").get(String(first.id))).toEqual({
      status: "rejected",
      decision: "revision_requested",
      note,
    });
    expect(
      db.prepare("SELECT type,version,status FROM factory_deliverables ORDER BY created_at,type").all(),
    ).toHaveLength(3);
    expect(db.prepare("SELECT DISTINCT status FROM factory_deliverables").all()).toEqual([{ status: "rejected" }]);
    expect(db.prepare("SELECT recipient_agent_id,kind,status FROM factory_mailbox").all()).toEqual([
      { recipient_agent_id: "writer", kind: "review_feedback", status: "pending" },
    ]);
    expect(
      db.prepare("SELECT detail FROM factory_activity WHERE action='approval.revision_requested'").get()?.detail,
    ).toBe(`İnsan revizyon istedi: ${note}`);
    expect(
      JSON.parse(
        String(db.prepare("SELECT content_json FROM factory_blackboard WHERE section='decision'").get()?.content_json),
      ).items,
    ).toEqual([note]);

    await runtime.onApprovalResolved("plan");
    expect(launched).toHaveLength(3);
    const prompt = String(db.prepare("SELECT description FROM tasks WHERE id=?").get(launched[2])?.description);
    expect(prompt).toContain(`İnsan önceki teslim için revizyon istedi: ${note}`);
    expect(prompt).toContain("Kaynaklı günlük rapor");
    expect(db.prepare("SELECT status FROM factory_mailbox").get()?.status).toBe("handled");

    await finish(runtime, launched[2], { ...product, mvp: ["KOBİ yöneticileri için rapor"] });
    await finish(runtime, launched[3], review);
    expect(db.prepare("SELECT status FROM factory_plans").get()?.status).toBe("awaiting_approval");
    expect(
      db
        .prepare("SELECT version FROM factory_deliverables WHERE step_id='produce' ORDER BY version")
        .all()
        .map((row) => row.version),
    ).toEqual([1, 2]);
    const second = db.prepare("SELECT id FROM factory_approvals WHERE kind='deliverable' AND status='pending'").get()!;
    expect(second.id).not.toBe(first.id);
    expect(service.resolveApproval(String(second.id), "bigital", "project", "approved", null).plan.status).toBe(
      "completed",
    );
    expect(
      db.prepare("SELECT status,COUNT(*) AS count FROM factory_deliverables GROUP BY status ORDER BY status").all(),
    ).toEqual([
      { status: "approved", count: 3 },
      { status: "rejected", count: 3 },
    ]);
  });
  it("records real usage limits as capacity cooldowns instead of failed task retries", async () => {
    const runtime = plan();
    await runtime.startPlan("plan");
    const time = Date.now();
    fs.writeFileSync(path.join(directory, `${launched[0]}.log`), "You've hit your usage limit. Retry-After: 120");
    await runtime.onTaskComplete(launched[0], 1);
    const run = db.prepare("SELECT status,issue_kind,retry_after FROM factory_runs").get()!;
    expect(run.status).toBe("blocked");
    expect(run.issue_kind).toBe("capacity");
    expect(Number(run.retry_after)).toBeGreaterThanOrEqual(time + 120000);
    expect(db.prepare("SELECT controller_state FROM factory_plans").get()?.controller_state).toBe("NORMAL");
    expect(db.prepare("SELECT COUNT(*) AS count FROM factory_runs WHERE status='failed'").get()?.count).toBe(0);
    const retry = await runtime.startPlan("plan");
    expect(retry.started).toBe(false);
    expect(launched).toHaveLength(1);
  });
  it("marks interrupted runs blocked on restart, retaining task history", async () => {
    const runtime = plan();
    await runtime.startPlan("plan");
    createFactoryRuntime(ctx);
    expect(db.prepare("SELECT status FROM factory_runs").get()?.status).toBe("blocked");
    expect(db.prepare("SELECT status FROM tasks").get()?.status).toBe("pending");
    expect(db.prepare("SELECT status FROM factory_plans").get()?.status).toBe("blocked");
  });
  it("prevents core auto-finalization/merge for linked tasks", async () => {
    const runtime = plan();
    await runtime.startPlan("plan");
    await finish(runtime, launched[0], product);
    const mergeWorktree = vi.fn();
    const finalize = createReviewFinalizeTools({ db, appendTaskLog: vi.fn(), mergeWorktree } as any);
    finalize.finishReview(launched[0], "Factory task", { bypassProjectDecisionGate: true });
    expect(mergeWorktree).not.toHaveBeenCalled();
    expect(db.prepare("SELECT status FROM tasks WHERE id=?").get(launched[0])?.status).toBe("review");
  });
  it("routes text API models honestly and excludes them from software tooling", async () => {
    db.exec(
      "INSERT INTO api_providers(id,name,type,enabled,api_key_enc,models_cache,base_url) VALUES('api','Configured','openai',1,'encrypted','[\"actual-cached-model\"]','https://api.deepseek.com/v1')",
    );
    db.exec("UPDATE agents SET cli_provider='api',api_provider_id='api',api_model=NULL WHERE id='writer'");
    const text = await routeFactoryModel(ctx as any, { role: "product_manager", requiresTools: false, noTools: true });
    expect(text?.model).toBe("actual-cached-model");
    expect(text?.providerFamily).toBe("deepseek");
    const software = await routeFactoryModel(ctx as any, {
      role: "developer",
      requiresTools: true,
      excludeAgentIds: ["reviewer"],
    });
    expect(software).toBeNull();
  });
  it("gives a new task the matching verified solution instead of unrelated history", async () => {
    const runtime = plan();
    const incident = recordFactoryIncident(db, {
      business_id: "bigital",
      project_id: null,
      plan_id: null,
      task_id: null,
      title: "Kaynaklı rapor hatası",
      detail: "Kaynaklı rapor kabul kriteri eksik kaldı",
      outcome: "failed",
    });
    recordFactoryExperience(db, {
      business_id: "bigital",
      project_id: null,
      plan_id: null,
      incident_id: incident.id,
      error_hash: incident.error_hash,
      outcome: "verified",
      summary: "Kaynaklı rapor için kabul kriterini backlog maddesine bağla. sk-proj-123456789012345678901234567890",
    });
    recordFactoryIncident(db, {
      business_id: "bigital",
      project_id: null,
      plan_id: null,
      task_id: null,
      title: "Instagram renk paleti",
      detail: "Instagram renk paleti mor olmalı",
      outcome: "failed",
    });
    await runtime.startPlan("plan");
    const description = String(db.prepare("SELECT description FROM tasks WHERE id=?").get(launched[0])?.description);
    expect(description).toContain("Doğrulanmış çözüm");
    expect(description).toContain("kabul kriterini backlog maddesine bağla");
    expect(description).not.toContain("Instagram");
    expect(description).not.toContain("sk-proj-");
  });
});

describe("factory output and actual command evidence", () => {
  it("extracts structured JSON from API log wrappers and Codex transport", () => {
    expect(
      parseFactoryOutput(`[api:openai] header\n---\n\`\`\`json\n${JSON.stringify(product)}\n\`\`\`\n[api] Done.`),
    ).toEqual(product);
    expect(
      parseFactoryOutput(JSON.stringify({ type: "item.completed", item: { text: JSON.stringify(review) } })),
    ).toEqual(review);
  });
  it("rejects empty PRD/backlog and unmatched social calendar references", () => {
    expect(() => validateFactoryOutput("product", { ...product, backlog: [{ title: "x" }] })).toThrow("backlog");
    expect(() => validateFactoryOutput("product", { ...product, features: [] })).toThrow("features");
    expect(() => validateFactoryOutput("product", { ...product, technical_tasks: "Tek metin" })).toThrow(
      "teknik görevler",
    );
    expect(() =>
      validateFactoryOutput("social", {
        strategy: { audience: "KOBİ", goal: "Markayı anlat" },
        calendar: [{ date: "2026-10-05", platform: "Instagram", content_id: "one" }],
        content: [{ id: "one", caption: "Gerçek metin", cta: "İncele" }],
        visual_briefs: [{ content_id: "one", brief: "Ofiste çalışan ekip" }],
        kpis: ["Kaydetme"],
        review_notes: ["Marka dili kontrol edildi"],
      }),
    ).toThrow("başlık");
    expect(() =>
      validateFactoryOutput("social", {
        strategy: "Brand",
        calendar: [{ date: "2026-10-04", platform: "Instagram", content_id: "missing" }],
        content: [{ id: "one", headline: "Başlık", caption: "Text", cta: "Go" }],
        visual_briefs: [{ content_id: "one", brief: "Photo" }],
        kpis: ["Reach"],
        review_notes: ["Review"],
      }),
    ).toThrow("referansı");
    expect(() =>
      validateFactoryOutput("social", {
        strategy: { audience: "Belirtilmedi", goal: "Markayı anlat" },
        calendar: [{ date: "2026-10-05", platform: "Instagram", content_id: "one" }],
        content: [{ id: "one", headline: "Ekibimizle tanışın", caption: "Gerçek metin", cta: "İncele" }],
        visual_briefs: [{ content_id: "one", brief: "Ofiste çalışan ekip" }],
        kpis: ["Kaydetme"],
        review_notes: ["Marka dili kontrol edildi"],
      }),
    ).toThrow("Yer tutucu");
  });
  it("keeps unknown usage/cost null and records only provider supplied values", () => {
    expect(extractFactoryUsage("done")).toEqual({ input_tokens: null, output_tokens: null, cost_usd: null });
    expect(
      extractFactoryUsage(
        JSON.stringify({ type: "result", usage: { input_tokens: 10, output_tokens: 20 }, total_cost_usd: 0.123 }),
      ),
    ).toEqual({ input_tokens: 10, output_tokens: 20, cost_usd: 0.123 });
  });
  it("runs real test/build scripts and refuses failed tests despite success prose", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "factory-evidence-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: directory, stdio: "pipe" }).toString().trim();
    try {
      git(["init", "-b", "fixture"]);
      git(["config", "user.name", "Fixture"]);
      git(["config", "user.email", "fixture@example.test"]);
      fs.writeFileSync(
        path.join(directory, "package.json"),
        JSON.stringify({
          packageManager: "pnpm@10.34.0",
          scripts: {
            test: "node -e \"if(require('./value.json').value!==2)process.exit(1)\"",
            build: "node -e \"console.log('fixture build checked')\"",
          },
        }),
      );
      fs.writeFileSync(path.join(directory, "value.json"), '{"value":1}');
      git(["add", "."]);
      git(["commit", "-m", "fixture baseline"]);
      const base = git(["rev-parse", "HEAD"]);
      fs.writeFileSync(path.join(directory, "value.json"), '{"value":2}');
      const passed = await verifyFactorySoftware(directory, base);
      expect(passed.evidence.map((item) => item.exit_code)).toEqual([0, 0]);
      expect(passed.evidence[0].command).toBe("pnpm run test");
      expect(passed.diff).toContain('"value":2');
      fs.writeFileSync(path.join(directory, "value.json"), '{"value":3}');
      await expect(verifyFactorySoftware(directory, base)).rejects.toThrow("doğrulama başarısız");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
