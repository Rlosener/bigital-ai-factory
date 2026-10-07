import type { Request, Response } from "express";
import {
  buildProjectCodeGraph,
  codeGraphStatus,
  queryCodeGraphHits,
  recordProjectGraphFeedback,
} from "./graph/graphify-client.ts";
import { buildGraphTaskBrief, readGraphOverview } from "./graph/intelligence.ts";
import { configureFactoryProviderSeat } from "./provider-seats.ts";
import type { FactoryBlackboardSection } from "../../../shared/factory.ts";
import { writeFactoryBlackboard, recordFactoryMailbox, acknowledgeFactoryMailbox } from "./hive.ts";
import { createFactoryService, factoryText } from "./service.ts";
import { FactoryError, type FactoryContext, type FactoryRouteOptions } from "./types.ts";

export function registerFactoryRoutes(ctx: FactoryContext, options: FactoryRouteOptions = {}) {
  const service = createFactoryService(ctx, { validateFinalApproval: options.validateFinalApproval });
  const { app } = ctx;
  const body = (req: Request): Record<string, unknown> =>
    req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  function scope(req: Request) {
    const businessId = factoryText(req.query.business_id ?? body(req).business_id, "İşletme kapsamı", 100);
    const rawProject = req.query.project_id ?? body(req).project_id;
    return { businessId, projectId: rawProject ? factoryText(rawProject, "Proje kapsamı", 100) : null };
  }
  const route = (handler: (req: Request, res: Response) => unknown) => async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof FactoryError) res.status(error.status).json({ error: error.code, message: error.message });
      else {
        console.error("[factory] operation failed", error instanceof Error ? error.name : "unknown");
        res.status(500).json({ error: "factory_operation_failed", message: "İşlem tamamlanamadı. Tekrar deneyin." });
      }
    }
  };
  const seatChanged = (businessId: string) => {
    service.repository.activity(
      businessId,
      null,
      null,
      "provider_seat.configured",
      "Mevcut sağlayıcı kimliği için kapasite politikası güncellendi.",
    );
    ctx.broadcast?.("factory_update", { business_id: businessId, action: "provider_seat.configured" });
  };
  app.post(
    "/api/factory/provider-seats",
    route((req, res) => {
      const { businessId } = scope(req);
      const seat = configureFactoryProviderSeat(ctx.db, businessId, body(req));
      seatChanged(businessId);
      res.status(201).json({ seat });
    }),
  );
  app.patch(
    "/api/factory/provider-seats/:id",
    route((req, res) => {
      const { businessId } = scope(req);
      const seat = configureFactoryProviderSeat(ctx.db, businessId, body(req), String(req.params.id));
      seatChanged(businessId);
      res.json({ seat });
    }),
  );
  app.post(
    "/api/factory/plans/:id/controller/reset",
    route((req, res) => {
      const { businessId, projectId } = scope(req);
      res.json({ plan: service.resetController(String(req.params.id), businessId, projectId, body(req).note) });
    }),
  );
  const hiveScope = (req: Request) => {
    const selected = scope(req);
    if (!selected.projectId)
      throw new FactoryError(400, "project_required", "Hive için işletmeye bağlı proje gerekli.");
    return { ...selected, projectId: selected.projectId };
  };
  const hiveEvent = (businessId: string, projectId: string, action: string) => {
    service.repository.activity(businessId, projectId, null, action, "Hive kaydı güncellendi.");
    ctx.broadcast?.("factory_update", { business_id: businessId, project_id: projectId, action });
  };
  app.put(
    "/api/factory/blackboard/:section",
    route((req, res) => {
      const { businessId, projectId } = hiveScope(req);
      const input = body(req);
      if (!Number.isInteger(input.expected_version) || Number(input.expected_version) < 0)
        throw new FactoryError(
          400,
          "invalid_blackboard_version",
          "Güncel Blackboard sürümünü gönderin (yeni kayıt: 0).",
        );
      const entry = writeFactoryBlackboard(
        ctx.db,
        {
          business_id: businessId,
          project_id: projectId,
          section: String(req.params.section) as FactoryBlackboardSection,
          content: input.content,
          expected_version: Number(input.expected_version),
        },
        "api",
      );
      hiveEvent(businessId, projectId, "blackboard.updated");
      res.json({ entry });
    }),
  );
  app.post(
    "/api/factory/mailbox",
    route((req, res) => {
      const { businessId, projectId } = hiveScope(req);
      const input = body(req);
      const result = recordFactoryMailbox(ctx.db, {
        business_id: businessId,
        project_id: projectId,
        plan_id: input.plan_id ? factoryText(input.plan_id, "Plan", 100) : null,
        sender_agent_id: input.sender_agent_id ? factoryText(input.sender_agent_id, "Gönderen", 100) : null,
        recipient_agent_id: factoryText(input.recipient_agent_id, "Alıcı", 100),
        kind: factoryText(input.kind, "Mesaj türü", 40),
        content: input.content,
        parent_id: input.parent_id ? factoryText(input.parent_id, "Önceki mesaj", 100) : null,
        idempotency_key: factoryText(input.idempotency_key, "Tekrarlama anahtarı", 120),
      });
      if (!result.duplicate) hiveEvent(businessId, projectId, "mailbox.created");
      res.status(result.duplicate ? 200 : 201).json(result);
    }),
  );
  app.post(
    "/api/factory/mailbox/:id/handled",
    route((req, res) => {
      const { businessId, projectId } = hiveScope(req);
      const result = acknowledgeFactoryMailbox(ctx.db, String(req.params.id), businessId, projectId);
      if (!result.duplicate) hiveEvent(businessId, projectId, "mailbox.handled");
      res.json(result);
    }),
  );
  app.get(
    "/api/factory/workspace",
    route((req, res) => {
      const businessId = req.query.business_id == null ? "bigital" : factoryText(req.query.business_id, "İşletme", 100);
      const projectId = req.query.project_id ? factoryText(req.query.project_id, "Proje", 100) : null;
      res.json(service.repository.workspace(businessId, projectId));
    }),
  );
  app.post(
    "/api/factory/businesses",
    route((req, res) => {
      res.status(201).json({ business: service.business(body(req)) });
    }),
  );
  app.post(
    "/api/factory/projects",
    route((req, res) => {
      res.status(201).json({ project: service.project(body(req)) });
    }),
  );
  app.post(
    "/api/factory/projects/:id/bind",
    route((req, res) => {
      const { businessId } = scope(req);
      res.json({ project: service.bindProject(String(req.params.id), businessId) });
    }),
  );
  app.post(
    "/api/factory/knowledge",
    route((req, res) => {
      res.status(201).json({ knowledge: service.knowledge(body(req)) });
    }),
  );
  app.patch(
    "/api/factory/knowledge/:id",
    route((req, res) => {
      const { businessId, projectId } = scope(req);
      res.json({ knowledge: service.updateKnowledge(String(req.params.id), businessId, projectId, body(req)) });
    }),
  );
  app.delete(
    "/api/factory/knowledge/:id",
    route((req, res) => {
      const { businessId, projectId } = scope(req);
      service.removeKnowledge(String(req.params.id), businessId, projectId);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/factory/plans",
    route((req, res) => {
      res.status(201).json({ plan: service.createPlan(body(req)) });
    }),
  );
  function projectPath(businessId: string, projectId: string | null): string | null {
    const row = (
      projectId
        ? ctx.db.prepare("SELECT project_path FROM projects WHERE id=? AND business_id=?").get(projectId, businessId)
        : ctx.db
            .prepare("SELECT project_path FROM projects WHERE business_id=? ORDER BY created_at LIMIT 1")
            .get(businessId)
    ) as { project_path?: string } | undefined;
    return row?.project_path || null;
  }
  app.get(
    "/api/factory/graph",
    route((req, res) => {
      const { businessId, projectId } = scope(req);
      res.json({
        ...readGraphOverview(ctx.db, { businessId, projectId, task: "" }),
        code_graph: codeGraphStatus(projectPath(businessId, projectId)),
      });
    }),
  );
  app.post(
    "/api/factory/graph/build",
    route((req, res) => {
      const { businessId, projectId } = scope(req);
      const pathValue = projectPath(businessId, projectId);
      if (!pathValue) throw new FactoryError(400, "project_required", "Kod grafiği için bir proje klasörü gerekli.");
      if (!codeGraphStatus(pathValue).installed)
        throw new FactoryError(503, "code_graph_unavailable", "Bigital kod ağı motoru bu bilgisayarda hazır değil.");
      void buildProjectCodeGraph(pathValue);
      res.status(202).json({ code_graph: codeGraphStatus(pathValue) });
    }),
  );
  app.post(
    "/api/factory/graph/query",
    route((req, res) => {
      const { businessId, projectId } = scope(req);
      const question = factoryText(body(req).question, "Soru", 500);
      const pathValue = projectPath(businessId, projectId);
      res.json({
        brief: buildGraphTaskBrief(ctx.db, { businessId, projectId, task: question, projectPath: pathValue }),
        code: pathValue ? queryCodeGraphHits(pathValue, question) : [],
      });
    }),
  );
  app.get(
    "/api/factory/plans/:id",
    route((req, res) => {
      const { businessId, projectId } = scope(req);
      res.json({ plan: service.repository.scopedPlan(String(req.params.id), businessId, projectId) });
    }),
  );
  app.post(
    "/api/factory/plans/:id/recheck",
    route((req, res) => {
      const { businessId, projectId } = scope(req);
      res.json({
        plan: service.recheckPlan(String(req.params.id), businessId, projectId, body(req).selected_project_id),
      });
    }),
  );
  app.post(
    "/api/factory/plans/:id/start",
    route(async (req, res) => {
      const { businessId, projectId } = scope(req);
      const plan = service.repository.scopedPlan(String(req.params.id), businessId, projectId);
      if (!["approved", "blocked", "failed"].includes(plan.status))
        throw new FactoryError(
          409,
          "plan_not_approved",
          "Çalıştırmadan önce planın insan onayı gerekir veya plan zaten çalışıyor.",
        );
      const approved = ctx.db
        .prepare("SELECT id FROM factory_approvals WHERE plan_id=? AND kind='plan' AND status='approved'")
        .get(plan.id);
      if (!approved)
        throw new FactoryError(
          409,
          "plan_not_approved",
          "Bu plan için onay kaydı bulunmuyor. Eksikleri giderip yeni plan hazırlayın.",
        );
      if (!options.startPlan) throw new FactoryError(503, "runtime_unavailable", "Çalıştırma servisi hazır değil.");
      const result = await options.startPlan(plan.id);
      res.status(result.started ? 200 : 409).json({ ...result, plan: service.repository.plan(plan.id) });
    }),
  );
  app.post(
    "/api/factory/approvals/:id/resolve",
    route(async (req, res) => {
      const { businessId, projectId } = scope(req);
      const input = body(req);
      if (!["approved", "rejected", "revision_requested"].includes(String(input.decision)))
        throw new FactoryError(
          400,
          "invalid_decision",
          "Onay kararı approved, rejected veya revision_requested olmalı.",
        );
      if (input.decision === "revision_requested" && (typeof input.note !== "string" || !input.note.trim()))
        throw new FactoryError(400, "revision_note_required", "Revizyon için kısa bir not yazın.");
      const result = service.resolveApproval(String(req.params.id), businessId, projectId, input.decision, input.note);
      await options.onApprovalResolved?.(result.plan.id);
      if (result.approval?.kind === "deliverable") {
        const pathValue = projectPath(businessId, result.plan.project_id);
        if (pathValue) {
          const decision = String(input.decision);
          recordProjectGraphFeedback(pathValue, {
            question: result.plan.instruction,
            answer:
              decision === "approved"
                ? "Çıktı kalite kapılarını, bağımsız incelemeyi ve nihai insan onayını geçti."
                : decision === "revision_requested"
                  ? `İnsan revizyon istedi: ${String(input.note || "Çıktı düzeltilmeli.")}`
                  : "İnsan teslimi reddetti; bu çözüm yolu başarılı kabul edilmedi.",
            outcome: decision === "approved" ? "useful" : decision === "revision_requested" ? "corrected" : "dead_end",
            correction: decision === "revision_requested" ? String(input.note || "") : null,
          });
        }
      }
      res.json({ ...result, plan: service.repository.plan(result.plan.id) ?? result.plan });
    }),
  );
  return service;
}
