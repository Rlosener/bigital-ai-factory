import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { FactoryPlan, FactoryStep, FactoryWorkflow, FactoryControllerPolicy } from "../../../shared/factory.ts";
import { createProjectRouteHelpers } from "../routes/core/projects/helpers.ts";
import { resolveHostCliBinary } from "../workflow/core/host-cli-path.ts";
import {
  createFactoryRepository,
  rejectFactorySecrets,
  sanitizeFactoryValue,
  redactFactoryText,
} from "./repository.ts";
import { FactoryError, type FactoryContext } from "./types.ts";
import { recordFactoryExperience } from "./incidents.ts";
import { recordFactoryMailbox, writeFactoryBlackboard } from "./hive.ts";

type PlannerAgent = {
  id: string;
  department_id: string | null;
  status: string;
  cli_provider: string | null;
  api_provider_id: string | null;
  role: string;
};
export function factoryText(value: unknown, label: string, max = 5000, required = true): string {
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max)
    throw new FactoryError(400, "invalid_input", `${label} geçerli bir metin olmalı (en çok ${max} karakter).`);
  const result = value.trim();
  rejectFactorySecrets(result);
  return result;
}
export function createFactoryService(
  ctx: FactoryContext,
  options: {
    providerAvailable?: (agent: PlannerAgent) => boolean;
    validateFinalApproval?: (planId: string) => void;
  } = {},
) {
  const repository = createFactoryRepository(ctx.db);
  const { db } = ctx;
  const helpers = createProjectRouteHelpers({
    db,
    normalizeTextField: (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  });
  function emit(action: string, businessId: string, projectId: string | null, planId: string | null, detail: string) {
    repository.activity(businessId, projectId, planId, action, detail);
    ctx.broadcast?.("factory_update", {
      factory_changed: true,
      business_id: businessId,
      project_id: projectId,
      plan_id: planId,
      action,
    });
  }
  function providerAvailable(agent: PlannerAgent): boolean {
    if (options.providerAvailable) return options.providerAvailable(agent);
    if (!agent.cli_provider) return false;
    if (agent.cli_provider === "api")
      return Boolean(
        agent.api_provider_id &&
        db.prepare("SELECT id FROM api_providers WHERE id=? AND enabled=1").get(agent.api_provider_id),
      );
    if (agent.cli_provider === "antigravity")
      return Boolean(
        db
          .prepare("SELECT id FROM oauth_accounts WHERE provider='google_antigravity' AND status='active' LIMIT 1")
          .get(),
      );
    return Boolean(resolveHostCliBinary(agent.cli_provider));
  }
  function business(input: Record<string, unknown>) {
    const id = randomUUID();
    const name = factoryText(input.name, "İşletme adı", 120);
    const description = input.description == null ? "" : factoryText(input.description, "Açıklama", 5000, false);
    ctx.runInTransaction(() => {
      db.prepare("INSERT INTO businesses(id,name,description,created_at) VALUES(?,?,?,?)").run(
        id,
        name,
        description,
        ctx.nowMs(),
      );
      emit("business.created", id, null, null, `${name} işletmesi oluşturuldu.`);
    });
    return db.prepare("SELECT * FROM businesses WHERE id=?").get(id);
  }
  function project(input: Record<string, unknown>) {
    const businessId = factoryText(input.business_id, "İşletme", 100);
    repository.scope(businessId);
    const name = factoryText(input.name, "Proje adı", 120);
    const goal = factoryText(input.core_goal, "Proje amacı", 10000);
    const requestedPath = factoryText(input.project_path, "Proje dizini", 2000);
    if (!path.isAbsolute(requestedPath))
      throw new FactoryError(400, "absolute_path_required", "Mevcut projenin tam dizin yolunu girin.");
    let projectPath: string;
    try {
      projectPath = fs.realpathSync(requestedPath);
      if (!fs.statSync(projectPath).isDirectory()) throw new Error("not_directory");
    } catch {
      throw new FactoryError(400, "project_path_not_found", "Mevcut proje dizini bulunamadı.");
    }
    if (!helpers.isPathInsideAllowedRoots(projectPath))
      throw new FactoryError(
        403,
        "project_path_outside_allowed_roots",
        "Proje dizini izin verilen çalışma alanlarının dışında.",
      );
    const conflict = helpers.findConflictingProjectByPath(projectPath);
    if (conflict)
      throw new FactoryError(
        409,
        "project_path_conflict",
        "Bu dizin kayıtlı bir projeye ait. Mevcut projeyi işletmeye bağlayın.",
      );
    const id = randomUUID();
    const now = ctx.nowMs();
    ctx.runInTransaction(() => {
      db.prepare(
        "INSERT INTO projects(id,business_id,name,project_path,core_goal,default_pack_key,created_at,updated_at) VALUES(?,?,?,?,?,'development',?,?)",
      ).run(id, businessId, name, projectPath, goal, now, now);
      emit("project.created", businessId, id, null, `${name} projesi mevcut dizine bağlandı.`);
    });
    return repository.scope(businessId, id);
  }
  function bindProject(id: string, businessId: string) {
    repository.scope(businessId);
    const row = db.prepare("SELECT business_id FROM projects WHERE id=?").get(id);
    if (!row) throw new FactoryError(404, "project_not_found", "Proje bulunamadı.");
    if (row.business_id && row.business_id !== businessId)
      throw new FactoryError(
        409,
        "project_already_bound",
        "Proje başka işletmeye bağlı; kapsam taşıma işlemi V0'da kapalı.",
      );
    ctx.runInTransaction(() => {
      const changed = db
        .prepare("UPDATE projects SET business_id=?,updated_at=? WHERE id=? AND (business_id IS NULL OR business_id=?)")
        .run(businessId, ctx.nowMs(), id, businessId);
      if (Number(changed.changes) !== 1)
        throw new FactoryError(409, "project_scope_changed", "Proje kapsamı başka işlemde değişti.");
      emit("project.bound", businessId, id, null, "Mevcut proje işletmeye bağlandı.");
    });
    return repository.scope(businessId, id);
  }
  function knowledge(input: Record<string, unknown>) {
    const businessId = factoryText(input.business_id, "İşletme", 100);
    const projectId = input.project_id ? factoryText(input.project_id, "Proje", 100) : null;
    repository.scope(businessId, projectId);
    const category = factoryText(input.category, "Bilgi kategorisi", 80);
    const title = factoryText(input.title, "Başlık", 240);
    const content = factoryText(input.content, "Bilgi", 20000);
    const id = randomUUID();
    const now = ctx.nowMs();
    ctx.runInTransaction(() => {
      db.prepare(
        "INSERT INTO factory_knowledge(id,business_id,project_id,category,title,content,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      ).run(id, businessId, projectId, category, title, content, now, now);
      emit("knowledge.created", businessId, projectId, null, `${title} bilgisi eklendi.`);
    });
    return db.prepare("SELECT * FROM factory_knowledge WHERE id=?").get(id);
  }
  function updateKnowledge(
    id: string,
    businessId: string,
    projectId: string | null | undefined,
    input: Record<string, unknown>,
  ) {
    repository.scope(businessId, projectId);
    const row = db.prepare("SELECT * FROM factory_knowledge WHERE id=? AND business_id=?").get(id, businessId);
    if (!row || (projectId && row.project_id !== projectId))
      throw new FactoryError(404, "knowledge_not_found", "Bilgi bu kapsamda bulunamadı.");
    if (!["category", "title", "content"].some((field) => field in input))
      throw new FactoryError(400, "knowledge_update_empty", "Düzenlenecek bilgi alanını gönderin.");
    const category =
      input.category == null ? String(row.category) : factoryText(input.category, "Bilgi kategorisi", 80);
    const title = input.title == null ? String(row.title) : factoryText(input.title, "Başlık", 240);
    const content = input.content == null ? String(row.content) : factoryText(input.content, "Bilgi", 20000);
    rejectFactorySecrets([category, title, content].join("\n"));
    ctx.runInTransaction(() => {
      db.prepare(
        "UPDATE factory_knowledge SET category=?,title=?,content=?,updated_at=? WHERE id=? AND business_id=?",
      ).run(category, title, content, ctx.nowMs(), id, businessId);
      emit("knowledge.updated", businessId, row.project_id as string | null, null, `${title} bilgisi güncellendi.`);
    });
    return db.prepare("SELECT * FROM factory_knowledge WHERE id=? AND business_id=?").get(id, businessId);
  }
  function removeKnowledge(id: string, businessId: string, projectId?: string | null) {
    repository.scope(businessId, projectId);
    const row = db.prepare("SELECT * FROM factory_knowledge WHERE id=? AND business_id=?").get(id, businessId);
    if (!row || (projectId && row.project_id !== projectId))
      throw new FactoryError(404, "knowledge_not_found", "Bilgi bu kapsamda bulunamadı.");
    ctx.runInTransaction(() => {
      db.prepare("DELETE FROM factory_knowledge WHERE id=? AND business_id=?").run(id, businessId);
      emit("knowledge.deleted", businessId, row.project_id as string | null, null, `${row.title} bilgisi silindi.`);
    });
  }
  function createPlan(input: Record<string, unknown>, existingPlanId?: string): FactoryPlan {
    const businessId = factoryText(input.business_id, "İşletme", 100);
    const projectId = input.project_id ? factoryText(input.project_id, "Proje", 100) : null;
    const project = repository.scope(businessId, projectId);
    const rawPolicy = input.controller_policy == null ? {} : input.controller_policy;
    if (!rawPolicy || typeof rawPolicy !== "object" || Array.isArray(rawPolicy))
      throw new FactoryError(400, "invalid_controller_policy", "Controller politikası nesne olmalı.");
    const policyInput = rawPolicy as Record<string, unknown>;
    const bounded = (name: string, defaultValue: number, min: number, max: number) => {
      const value = policyInput[name] ?? defaultValue;
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < min ||
        value > max
      )
        throw new FactoryError(400, "invalid_controller_policy", `${name} ${min}–${max} aralığında tam sayı olmalı.`);
      return value;
    };
    const maxCost = policyInput.max_cost_usd ?? null;
    if (
      maxCost !== null &&
      (typeof maxCost !== "number" || !Number.isFinite(maxCost) || maxCost <= 0 || maxCost > 10000)
    )
      throw new FactoryError(400, "invalid_controller_policy", "USD bütçesi 0'dan büyük ve en çok 10000 olmalı.");
    if (policyInput.hard_stop != null && typeof policyInput.hard_stop !== "boolean")
      throw new FactoryError(400, "invalid_controller_policy", "hard_stop boolean olmalı.");
    const controllerPolicy: FactoryControllerPolicy = {
      max_retries: bounded("max_retries", 3, 0, 10),
      same_error_limit: bounded("same_error_limit", 2, 1, 20),
      max_runtime_ms: bounded("max_runtime_ms", 1800000, 60000, 86400000),
      max_cost_usd: maxCost as number | null,
      hard_stop: policyInput.hard_stop == null ? true : Boolean(policyInput.hard_stop),
    };
    const instruction = factoryText(input.instruction, "İstek", 12000);
    const workflow: FactoryWorkflow =
      input.workflow == null
        ? /sosyal|instagram|linkedin|reels|içerik takvim|kampanya|social|content calendar/i.test(instruction)
          ? "social"
          : /prd|ürün plan|mvp plan|backlog|user flow|product/i.test(instruction)
            ? "product"
            : "software"
        : (input.workflow as FactoryWorkflow);
    if (!["software", "product", "social"].includes(workflow))
      throw new FactoryError(400, "invalid_workflow", "İş akışı software, product veya social olmalı.");
    const risk =
      /deploy|yayınla|publish|sil\b|delete|drop\b|production|üretim|payment|ödeme|migration|secret|token|auth|yetki|parola/i.test(
        instruction,
      )
        ? "high"
        : workflow === "software"
          ? "medium"
          : "low";
    const missing: string[] = [];
    if (!project) missing.push("İşletmeye bağlı aktif proje seçilmedi.");
    if (project) {
      try {
        if (!fs.statSync(project.project_path).isDirectory()) missing.push("Proje dizini erişilebilir değil.");
      } catch {
        missing.push("Proje dizini erişilebilir değil.");
      }
      if (workflow === "software") {
        try {
          execFileSync("git", ["-C", project.project_path, "rev-parse", "--show-toplevel"], {
            timeout: 3000,
            stdio: ["ignore", "pipe", "ignore"],
          });
        } catch {
          missing.push("Yazılım akışı için mevcut Git repository bağlantısı gerekli.");
        }
      }
    }
    const agents = db
      .prepare("SELECT id,department_id,status,cli_provider,api_provider_id,role FROM agents")
      .all() as unknown as PlannerAgent[];
    const available = agents.filter(
      (agent) =>
        providerAvailable(agent) &&
        (workflow !== "software" || !["api", "antigravity"].includes(agent.cli_provider ?? "")),
    );
    const used = new Set<string>();
    function choose(department: string, distinct = false) {
      const sorted = available
        .filter((agent) => !distinct || !used.has(agent.id))
        .sort(
          (a, b) =>
            (b.department_id === department ? 20 : 0) +
              (b.status === "idle" ? 5 : 0) +
              (b.role === "senior" || b.role === "team_leader" ? 2 : 0) -
              ((a.department_id === department ? 20 : 0) +
                (a.status === "idle" ? 5 : 0) +
                (a.role === "senior" || a.role === "team_leader" ? 2 : 0)) || a.id.localeCompare(b.id),
        );
      const agent = sorted[0] ?? (!distinct ? available[0] : undefined);
      if (agent) used.add(agent.id);
      return agent?.id ?? null;
    }
    const definitions =
      workflow === "software"
        ? [
            {
              title: "Repository ve kapsam analizi",
              role: "analyst",
              department: "planning",
              output: "analysis",
              skills: ["repository_analysis", "requirements"],
              description: "Mevcut mimariyi, ilgili dosyaları, gereksinimleri ve kabul kriterlerini incele.",
            },
            {
              title: "Uygulama ve doğrulama",
              role: "developer",
              department: "dev",
              output: "implementation",
              skills: ["software_development", "testing"],
              description: "Onaylanan kapsamı mevcut mimaride uygula; test ve build kanıtlarını üret.",
            },
            {
              title: "Bağımsız kalite incelemesi",
              role: "reviewer",
              department: "qa",
              output: "review",
              skills: ["code_review", "quality_assurance"],
              description: "Gerçek diff, test ve build sonuçlarını kabul kriterleriyle karşılaştır; eksikleri bildir.",
            },
          ]
        : workflow === "product"
          ? [
              {
                title: "Ürün ve MVP planı",
                role: "product_manager",
                department: "product",
                output: "product",
                skills: ["product_strategy", "prd", "backlog"],
                description:
                  "İşletme/proje bilgilerine dayanarak PRD, MVP kapsamı, backlog, kullanıcı akışları ve kabul kriterlerini hazırla.",
              },
              {
                title: "Ürün planı incelemesi",
                role: "reviewer",
                department: "qa",
                output: "review",
                skills: ["product_review", "quality_assurance"],
                description:
                  "Çıktının kapsam, tutarlılık, risk ve kabul kriterlerini kontrol et; eksikleri geri bildir.",
              },
            ]
          : [
              {
                title: "Sosyal medya stratejisi ve içerik",
                role: "content_strategist",
                department: "marketing",
                output: "social",
                skills: ["content_strategy", "copywriting", "social_calendar"],
                description:
                  "Marka bilgileriyle strateji, içerik takvimi, içerik metinleri, görsel brief ve KPI önerilerini hazırla. Harici yayın yapma.",
              },
              {
                title: "Marka ve içerik incelemesi",
                role: "reviewer",
                department: "qa",
                output: "review",
                skills: ["brand_review", "quality_assurance"],
                description:
                  "Marka dilini, brief uyumunu ve içerik tamlığını kontrol et; yayın öncesi insan onayına hazırla.",
              },
            ];
    const id = existingPlanId ?? randomUUID();
    const now = ctx.nowMs();
    const stepIds = definitions.map(() => randomUUID());
    const steps: FactoryStep[] = definitions.map((definition, position) => ({
      id: stepIds[position],
      plan_id: id,
      position,
      title: definition.title,
      description: definition.description,
      role: definition.role,
      skills: definition.skills,
      depends_on: position ? [stepIds[position - 1]] : [],
      agent_id: choose(definition.department, definition.role === "reviewer"),
      task_id: null,
      status: "pending",
      output_type: definition.output,
      requires_approval: false,
    }));
    if (steps.some((step) => !step.agent_id))
      missing.push(
        "Görev ve bağımsız inceleme için kullanılabilir sağlayıcıya sahip çalışanlar gerekli. CLI kurulumu/hesabı veya API sağlayıcı ayarlarını tamamlayın.",
      );
    const summary = `${workflow === "software" ? "Yazılım geliştirme" : workflow === "product" ? "Ürün/MVP planlama" : "Sosyal medya içerik"} akışı; ${steps.length} bağımlı adım. Kural tabanlı V0 analizi, insan plan onayı ve sonuç onayı gerekir.${risk === "high" ? " Kritik işlemler için ayrıca insan onayı gerekir; dış yayın/dağıtım otomatik yapılmaz." : ""}`;
    ctx.runInTransaction(() => {
      if (existingPlanId) {
        const current = repository.plan(id);
        if (
          !current ||
          !["blocked", "failed"].includes(current.status) ||
          current.steps.some((step) => step.task_id) ||
          db.prepare("SELECT id FROM factory_approvals WHERE plan_id=? AND kind='plan' AND status='approved'").get(id)
        )
          throw new FactoryError(409, "plan_state_changed", "Plan durumu değişti. Güncel planı kontrol edin.");
        db.prepare("DELETE FROM factory_approvals WHERE plan_id=? AND kind='plan' AND status='pending'").run(id);
        db.prepare("DELETE FROM factory_steps WHERE plan_id=? AND task_id IS NULL").run(id);
        db.prepare(
          "UPDATE factory_plans SET project_id=?,status=?,risk=?,summary=?,missing_json=?,updated_at=? WHERE id=? AND status IN ('blocked','failed')",
        ).run(projectId, missing.length ? "blocked" : "draft", risk, summary, JSON.stringify(missing), now, id);
      } else {
        db.prepare(
          "INSERT INTO factory_plans(id,business_id,project_id,instruction,workflow,status,analysis_mode,risk,summary,missing_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'rule_based',?,?,?,?,?)",
        ).run(
          id,
          businessId,
          projectId,
          instruction,
          workflow,
          missing.length ? "blocked" : "draft",
          risk,
          summary,
          JSON.stringify(missing),
          now,
          now,
        );
      }
      db.prepare("UPDATE factory_plans SET controller_policy_json=? WHERE id=?").run(
        JSON.stringify(controllerPolicy),
        id,
      );
      if (projectId) {
        writeFactoryBlackboard(
          db,
          {
            business_id: businessId,
            project_id: projectId,
            section: "current_objective",
            content: { summary: instruction, items: [], references: [`plan:${id}`] },
          },
          "manager",
        );
        writeFactoryBlackboard(
          db,
          {
            business_id: businessId,
            project_id: projectId,
            section: "active_plan",
            content: { summary, items: steps.map((step) => step.title), references: [`plan:${id}`] },
          },
          "manager",
        );
        writeFactoryBlackboard(
          db,
          {
            business_id: businessId,
            project_id: projectId,
            section: "blocker",
            content: {
              summary: missing.length
                ? "Plan önkoşulları eksik."
                : "Plan önkoşulları kontrol edildi; insan onayı bekleniyor.",
              items: missing,
              references: [`plan:${id}`],
            },
          },
          "manager",
        );
      }
      const insert = db.prepare(
        "INSERT INTO factory_steps(id,plan_id,position,title,description,role,skills_json,depends_on_json,agent_id,task_id,status,output_type,requires_approval) VALUES(?,?,?,?,?,?,?,?,?,?,?, ?,?)",
      );
      for (const step of steps)
        insert.run(
          step.id,
          id,
          step.position,
          step.title,
          step.description,
          step.role,
          JSON.stringify(step.skills),
          JSON.stringify(step.depends_on),
          step.agent_id,
          null,
          "pending",
          step.output_type,
          0,
        );
      if (!missing.length)
        db.prepare(
          "INSERT INTO factory_approvals(id,plan_id,business_id,project_id,kind,title,reason,created_at) VALUES(?,?,?,?,'plan',?,?,?)",
        ).run(
          randomUUID(),
          id,
          businessId,
          projectId,
          "Çalışma planını onayla",
          risk === "high"
            ? "Yüksek riskli talep. Kapsam ve kritik işlemleri inceleyin; çalışma yerel/draft sınırında kalır."
            : "Agent çalıştırılmadan önce kapsamı, atamaları ve bağımlılıkları onaylayın.",
          now,
        );
      emit(
        existingPlanId ? "plan.rechecked" : "plan.created",
        businessId,
        projectId,
        id,
        missing.length ? "Plan eksik bağlantılar nedeniyle bekliyor." : "Plan insan incelemesi için hazır.",
      );
    });
    return repository.plan(id)!;
  }
  function recheckPlan(id: string, businessId: string, projectId?: string | null, selectedProjectId?: unknown) {
    const plan = repository.scopedPlan(id, businessId, projectId);
    if (
      !["blocked", "failed"].includes(plan.status) ||
      plan.steps.some((step) => step.task_id) ||
      db.prepare("SELECT id FROM factory_approvals WHERE plan_id=? AND kind='plan' AND status='approved'").get(id)
    ) {
      throw new FactoryError(
        409,
        "plan_recheck_unavailable",
        "Çalıştırılmış/onaylanmış planı aynı planın yeniden çalıştırma eylemiyle sürdürün.",
      );
    }
    const selectedProject = selectedProjectId ? factoryText(selectedProjectId, "Proje", 100) : plan.project_id;
    if (plan.project_id && selectedProject !== plan.project_id)
      throw new FactoryError(
        409,
        "plan_project_immutable",
        "Planın mevcut proje kapsamı değiştirilemez. Farklı proje için yeni plan oluşturun.",
      );
    return createPlan(
      {
        business_id: businessId,
        project_id: selectedProject,
        instruction: plan.instruction,
        workflow: plan.workflow,
        controller_policy: plan.controller_policy,
      },
      id,
    );
  }
  function resetController(id: string, businessId: string, projectId: string | null | undefined, note: unknown) {
    const plan = repository.scopedPlan(id, businessId, projectId);
    const resetNote = factoryText(note, "İnsan yeniden başlatma gerekçesi", 2000);
    if (
      ["completed", "rejected"].includes(plan.status) ||
      !["STEER", "CONSTRAIN", "STOP"].includes(plan.controller_state ?? "NORMAL")
    )
      throw new FactoryError(
        409,
        "controller_reset_unavailable",
        "Yalnızca müdahale bekleyen ve bitmemiş planın controller durumu sıfırlanabilir.",
      );
    ctx.runInTransaction(() => {
      if (db.prepare("SELECT id FROM factory_runs WHERE plan_id=? AND status='running' LIMIT 1").get(id))
        throw new FactoryError(
          409,
          "controller_reset_running",
          "Aktif çalıştırma sürerken controller sıfırlanamaz; önce mevcut işi durdurun.",
        );
      const changed = db
        .prepare(
          "UPDATE factory_plans SET controller_state='NORMAL',stopped_reason=NULL,updated_at=? WHERE id=? AND status NOT IN ('completed','rejected') AND controller_state IN ('STEER','CONSTRAIN','STOP')",
        )
        .run(ctx.nowMs(), id);
      if (Number(changed.changes) !== 1)
        throw new FactoryError(
          409,
          "controller_state_changed",
          "Controller durumu değişti; güncel planı kontrol edin.",
        );
      db.prepare(
        "INSERT INTO factory_control_events(id,plan_id,business_id,project_id,run_id,state,action,reason,created_at) VALUES(?,?,?,?,NULL,'NORMAL','human_reset',?,?)",
      ).run(randomUUID(), id, businessId, plan.project_id, resetNote, ctx.nowMs());
      emit("controller.human_reset", businessId, plan.project_id, id, resetNote);
      if (plan.project_id)
        writeFactoryBlackboard(
          db,
          {
            business_id: businessId,
            project_id: plan.project_id,
            section: "decision",
            content: {
              summary:
                "Controller insan incelemesiyle NORMAL durumuna alındı. Aynı planın başlatma eylemiyle sürdürün.",
              items: [resetNote],
              references: [`plan:${id}`],
            },
          },
          "manager",
        );
    });
    return repository.plan(id)!;
  }
  function resolveApproval(
    id: string,
    businessId: string,
    projectId: string | null | undefined,
    decision: unknown,
    note: unknown,
  ) {
    repository.scope(businessId, projectId);
    if (decision !== "approved" && decision !== "rejected" && decision !== "revision_requested")
      throw new FactoryError(400, "invalid_decision", "Onay kararı approved, rejected veya revision_requested olmalı.");
    const approval = db.prepare("SELECT * FROM factory_approvals WHERE id=? AND business_id=?").get(id, businessId);
    if (!approval || (projectId && approval.project_id !== projectId))
      throw new FactoryError(404, "approval_not_found", "Onay bu kapsamda bulunamadı.");
    const revision = decision === "revision_requested";
    if (revision && approval.kind !== "deliverable")
      throw new FactoryError(400, "revision_unavailable", "Revizyon yalnızca nihai çıktı onayında istenebilir.");
    const approvalNote = revision
      ? factoryText(note, "Revizyon notu", 5000)
      : note == null
        ? null
        : factoryText(note, "Onay notu", 5000, false);
    ctx.runInTransaction(() => {
      // factory_approvals.status CHECK predates revisions; the decision column keeps the precise outcome.
      const changed = db
        .prepare(
          "UPDATE factory_approvals SET status=?,decision=?,note=?,resolved_at=? WHERE id=? AND status='pending'",
        )
        .run(revision ? "rejected" : decision, decision, approvalNote, ctx.nowMs(), id);
      if (Number(changed.changes) !== 1)
        throw new FactoryError(409, "approval_already_resolved", "Bu onay daha önce sonuçlandırılmış.");
      if (revision) {
        const plan = repository.plan(String(approval.plan_id))!;
        if (plan.status !== "awaiting_approval")
          throw new FactoryError(409, "delivery_not_ready", "Revizyon yalnızca onay bekleyen teslim için istenebilir.");
        const now = ctx.nowMs();
        db.prepare("UPDATE factory_deliverables SET status='rejected' WHERE plan_id=? AND status='review'").run(
          plan.id,
        );
        db.prepare(
          "UPDATE factory_steps SET status='pending' WHERE plan_id=? AND output_type IN ('implementation','product','social','review')",
        ).run(plan.id);
        db.prepare(
          "UPDATE factory_plans SET status='approved',missing_json='[]',controller_state='NORMAL',stopped_reason=NULL,updated_at=? WHERE id=? AND status='awaiting_approval'",
        ).run(now, plan.id);
        db.prepare(
          "INSERT INTO factory_control_events(id,plan_id,business_id,project_id,run_id,state,action,reason,created_at) VALUES(?,?,?,?,NULL,'NORMAL','human_revision',?,?)",
        ).run(randomUUID(), plan.id, businessId, plan.project_id, approvalNote, now);
        const producer = plan.steps.find((step) => ["implementation", "product", "social"].includes(step.output_type));
        if (plan.project_id && producer?.agent_id)
          recordFactoryMailbox(db, {
            business_id: businessId,
            project_id: plan.project_id,
            plan_id: plan.id,
            sender_agent_id: null,
            recipient_agent_id: producer.agent_id,
            kind: "review_feedback",
            content: {
              summary: "İnsan revizyon istedi; bu notu yeni çalışma turunda öncelikle uygula.",
              items: [approvalNote!],
              references: [`approval:${id}`],
            },
            idempotency_key: `factory-human-revision:${id}`,
          });
        if (plan.project_id)
          writeFactoryBlackboard(
            db,
            {
              business_id: businessId,
              project_id: plan.project_id,
              section: "decision",
              content: {
                summary: "İnsan revizyon istedi; önceki sürümler saklandı ve yeni çalışma turu başlıyor.",
                items: [approvalNote!],
                references: [`plan:${plan.id}`, `approval:${id}`],
              },
            },
            "manager",
          );
        emit(
          "approval.revision_requested",
          businessId,
          plan.project_id,
          plan.id,
          `İnsan revizyon istedi: ${approvalNote}`,
        );
        return;
      }
      if (approval.kind === "plan") {
        const update = db
          .prepare("UPDATE factory_plans SET status=?,updated_at=? WHERE id=? AND status='draft'")
          .run(decision === "approved" ? "approved" : "rejected", ctx.nowMs(), approval.plan_id);
        if (Number(update.changes) !== 1)
          throw new FactoryError(409, "invalid_plan_state", "Plan artık bu onay için uygun durumda değil.");
      } else if (approval.kind === "deliverable") {
        const plan = repository.plan(String(approval.plan_id))!;
        if (plan.status !== "awaiting_approval" || !plan.steps.every((step) => step.status === "completed"))
          throw new FactoryError(409, "delivery_not_ready", "Tüm adımlar ve inceleme tamamlanmadan sonuç onaylanamaz.");
        const reviewer = plan.steps.find((step) => step.role === "reviewer");
        const review = reviewer
          ? db
              .prepare("SELECT content_json FROM factory_deliverables WHERE step_id=? ORDER BY version DESC LIMIT 1")
              .get(reviewer.id)
          : null;
        let reviewContent: { structured?: { verdict?: string; findings?: unknown[] }; evidence?: unknown[] } | null =
          null;
        try {
          reviewContent = review ? JSON.parse(String(review.content_json)) : null;
        } catch {
          /* Invalid evidence fails closed. */
        }
        if (
          !reviewContent ||
          reviewContent.structured?.verdict !== "pass" ||
          !Array.isArray(reviewContent.structured.findings) ||
          reviewContent.structured.findings.length ||
          !Array.isArray(reviewContent.evidence) ||
          !reviewContent.evidence.length
        )
          throw new FactoryError(
            409,
            "review_evidence_missing",
            "Başarılı bağımsız inceleme ve kanıt kaydı olmadan sonuç onaylanamaz.",
          );
        if (decision === "approved") {
          try {
            options.validateFinalApproval?.(plan.id);
          } catch (error) {
            throw new FactoryError(
              409,
              "final_evidence_invalid",
              error instanceof Error ? redactFactoryText(error.message) : "Sonuç kanıtları artık geçerli değil.",
            );
          }
        }
        db.prepare("UPDATE factory_deliverables SET status=? WHERE plan_id=? AND status='review'").run(
          decision,
          approval.plan_id,
        );
        db.prepare("UPDATE factory_plans SET status=?,updated_at=? WHERE id=? AND status='awaiting_approval'").run(
          decision === "approved" ? "completed" : "rejected",
          ctx.nowMs(),
          approval.plan_id,
        );
        if (decision === "approved")
          db.prepare(
            "UPDATE tasks SET status='done',completed_at=?,updated_at=? WHERE id IN (SELECT task_id FROM factory_steps WHERE plan_id=?) AND status='review'",
          ).run(ctx.nowMs(), ctx.nowMs(), approval.plan_id);
      }
      if (approval.project_id)
        writeFactoryBlackboard(
          db,
          {
            business_id: businessId,
            project_id: String(approval.project_id),
            section: "decision",
            content: {
              summary: decision === "approved" ? "İnsan onayı kaydedildi." : "İnsan reddi kaydedildi.",
              items: approvalNote ? [approvalNote] : [],
              references: [`plan:${approval.plan_id}`, `approval:${id}`],
            },
          },
          "manager",
        );
      const resolvedIncident =
        approval.kind === "deliverable" && decision === "approved"
          ? db
              .prepare(
                "SELECT id,error_hash FROM factory_incidents WHERE plan_id=? AND business_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
              )
              .get(approval.plan_id, businessId)
          : null;
      if (approval.kind === "deliverable" && decision === "approved")
        db.prepare(
          "UPDATE factory_incidents SET status='resolved' WHERE plan_id=? AND business_id=? AND status='open'",
        ).run(approval.plan_id, businessId);
      if (decision === "rejected" || (approval.kind === "deliverable" && decision === "approved"))
        recordFactoryExperience(db, {
          business_id: businessId,
          project_id: approval.project_id as string | null,
          plan_id: String(approval.plan_id),
          incident_id: resolvedIncident ? String(resolvedIncident.id) : null,
          error_hash: resolvedIncident ? String(resolvedIncident.error_hash) : null,
          outcome: decision === "approved" ? "verified" : "rejected",
          summary:
            decision === "approved"
              ? "Çıktı kalite kapılarını ve bağımsız incelemeyi geçti; insan nihai onayı kaydedildi. Uzun dönem regresyon kontrolü henüz doğrulanmadı."
              : "Kullanıcı planı veya teslimi reddetti; başarı olarak öğrenilmedi.",
          evidence: [`approval:${id}`],
          created_at: ctx.nowMs(),
        });
      emit(
        "approval.resolved",
        businessId,
        approval.project_id as string | null,
        String(approval.plan_id),
        decision === "approved" ? "İnsan onayı verildi." : "İnsan onayı reddedildi.",
      );
    });
    return {
      approval: sanitizeFactoryValue(db.prepare("SELECT * FROM factory_approvals WHERE id=?").get(id)),
      plan: repository.plan(String(approval.plan_id))!,
    };
  }
  return {
    repository,
    business,
    project,
    bindProject,
    knowledge,
    removeKnowledge,
    updateKnowledge,
    createPlan,
    recheckPlan,
    resolveApproval,
    resetController,
  };
}
