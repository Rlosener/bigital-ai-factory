import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createRunInTransaction } from "../../bootstrap/helpers.ts";
import { redactFactoryText } from "../repository.ts";
import { isGeneralizable, sanitizeGlobalExperience } from "./sanitize.ts";
import { rankGraphItems, renderGraphBrief, type GraphConfidence, type RankedGraphItem } from "./optimizer.ts";
import { explainChangeImpact, queryCodeGraph, type GraphifyRunner } from "./graphify-client.ts";

type Scope = "project" | "business" | "global";

interface StoredNode {
  id: string;
  scope: Scope;
  business_id: string | null;
  project_id: string | null;
  kind: string;
  label: string;
  body: string;
  confidence: GraphConfidence;
  technology: string;
  source_ref: string;
  success: number;
  updated_at: number;
}

export interface GraphQueryInput {
  businessId: string;
  projectId?: string | null;
  task: string;
  projectPath?: string | null;
  businessName?: string | null;
  projectName?: string | null;
  technologies?: string[];
  now?: number;
}

const PLAYBOOK_CONFIDENCE = new Set<GraphConfidence>(["VERIFIED", "REPEATED", "PROVEN"]);

function confidenceFor(verifiedCount: number, repeatCount: number, failed: boolean): GraphConfidence {
  if (verifiedCount >= 3 || (verifiedCount >= 1 && repeatCount >= 3)) return "PROVEN";
  if (verifiedCount >= 2 || (verifiedCount >= 1 && repeatCount >= 2)) return "REPEATED";
  if (verifiedCount >= 1) return "VERIFIED";
  if (failed || repeatCount >= 1) return "OBSERVED";
  return "NEW";
}

function remember(nodes: StoredNode[], node: Omit<StoredNode, "id" | "updated_at"> & { updated_at?: number }): string {
  const id = randomUUID();
  nodes.push({ ...node, id, updated_at: node.updated_at ?? Date.now() });
  return id;
}

export function reindexExperienceGraph(db: DatabaseSync, input: GraphQueryInput): void {
  const privateNames = [input.businessName ?? "", input.projectName ?? ""].filter(Boolean);
  const scoped = input.projectId ? "AND (project_id=? OR project_id IS NULL)" : "";
  const scopeArgs = input.projectId ? [input.businessId, input.projectId] : [input.businessId];
  const incidents = db
    .prepare(
      `SELECT id, project_id, title, detail, normalized_error, error_hash, repeat_count, created_at
       FROM factory_incidents
       WHERE business_id=? ${scoped}`,
    )
    .all(...scopeArgs) as Array<Record<string, unknown>>;
  const episodes = db
    .prepare(
      `SELECT id, project_id, incident_id, error_hash, outcome, summary, created_at
       FROM factory_experience_episodes
       WHERE business_id=? ${scoped}`,
    )
    .all(...scopeArgs) as Array<Record<string, unknown>>;
  const nodes: StoredNode[] = [];
  const edges: Array<{ source: string; target: string; relation: string; scope: Scope }> = [];
  const publishedPlaybooks = new Set<string>();
  const now = input.now ?? Date.now();

  for (const incident of incidents) {
    const scope: Scope = incident.project_id ? "project" : "business";
    const related = episodes.filter(
      (episode) => episode.incident_id === incident.id || episode.error_hash === incident.error_hash,
    );
    const verified = related.filter((episode) => episode.outcome === "verified");
    const failed = related.filter(
      (episode) => episode.outcome === "failed" || episode.outcome === "blocked" || episode.outcome === "rejected",
    );
    const confidence = confidenceFor(verified.length, Number(incident.repeat_count ?? 1), failed.length > 0);
    const incidentId = remember(nodes, {
      scope,
      business_id: input.businessId,
      project_id: (incident.project_id as string | null) ?? null,
      kind: "incident",
      label: redactFactoryText(String(incident.title)).slice(0, 180),
      body: redactFactoryText(String(incident.normalized_error || incident.detail)).slice(0, 500),
      confidence,
      technology: "",
      source_ref: `incident:${incident.id}`,
      success: verified.length ? 1 : 0,
      updated_at: Number(incident.created_at) || now,
    });
    const causeId = remember(nodes, {
      scope,
      business_id: input.businessId,
      project_id: (incident.project_id as string | null) ?? null,
      kind: "root_cause",
      label: "Kök neden",
      body: redactFactoryText(String(incident.normalized_error || incident.detail)).slice(0, 500),
      confidence,
      technology: "",
      source_ref: `cause:${incident.id}`,
      success: verified.length ? 1 : 0,
      updated_at: Number(incident.created_at) || now,
    });
    edges.push({ source: incidentId, target: causeId, relation: "caused_by", scope });
    for (const episode of failed) {
      const attemptId = remember(nodes, {
        scope,
        business_id: input.businessId,
        project_id: (episode.project_id as string | null) ?? null,
        kind: "attempt",
        label: "Başarısız deneme",
        body: redactFactoryText(`${episode.summary} ${incident.normalized_error || ""}`).slice(0, 500),
        confidence: "OBSERVED",
        technology: "",
        source_ref: `attempt:${episode.id}`,
        success: 0,
        updated_at: Number(episode.created_at) || now,
      });
      edges.push({ source: incidentId, target: attemptId, relation: "attempted", scope });
    }
    for (const episode of verified) {
      const solutionBody = redactFactoryText(String(episode.summary)).slice(0, 500);
      const solutionId = remember(nodes, {
        scope,
        business_id: input.businessId,
        project_id: (episode.project_id as string | null) ?? null,
        kind: "solution",
        label: "Doğrulanmış çözüm",
        body: solutionBody,
        confidence,
        technology: "",
        source_ref: `solution:${episode.id}`,
        success: 1,
        updated_at: Number(episode.created_at) || now,
      });
      const verificationId = remember(nodes, {
        scope,
        business_id: input.businessId,
        project_id: (episode.project_id as string | null) ?? null,
        kind: "verification",
        label: "Doğrulama",
        body: "Bağımsız inceleme ve kayıtlı deneyim sonucu doğrulandı.",
        confidence,
        technology: "",
        source_ref: `verification:${episode.id}`,
        success: 1,
        updated_at: Number(episode.created_at) || now,
      });
      edges.push({ source: incidentId, target: solutionId, relation: "fixed_by", scope });
      edges.push({ source: solutionId, target: verificationId, relation: "verified_by", scope });
      if (
        PLAYBOOK_CONFIDENCE.has(confidence) &&
        !publishedPlaybooks.has(String(incident.error_hash)) &&
        isGeneralizable(solutionBody, privateNames)
      ) {
        publishedPlaybooks.add(String(incident.error_hash));
        const generic = sanitizeGlobalExperience(solutionBody, privateNames);
        const playbookId = remember(nodes, {
          scope: "global",
          business_id: null,
          project_id: null,
          kind: "playbook",
          label: "Genel playbook",
          body: generic,
          confidence,
          technology: "",
          source_ref: `playbook:${incident.error_hash}`,
          success: 1,
          updated_at: now,
        });
        const preventionId = remember(nodes, {
          scope: "global",
          business_id: null,
          project_id: null,
          kind: "prevention",
          label: "Önleme kuralı",
          body: generic,
          confidence,
          technology: "",
          source_ref: `prevention:${incident.error_hash}`,
          success: 1,
          updated_at: now,
        });
        edges.push({ source: playbookId, target: preventionId, relation: "prevents", scope: "global" });
      }
    }
  }

  const replace = createRunInTransaction(db);
  replace(() => {
    db.prepare(`DELETE FROM factory_graph_edges WHERE business_id=? ${scoped}`).run(...scopeArgs);
    db.prepare(`DELETE FROM factory_graph_nodes WHERE business_id=? ${scoped}`).run(...scopeArgs);
    const hashes = [...new Set(incidents.map((incident) => String(incident.error_hash || "")).filter(Boolean))];
    for (const hash of hashes) {
      db.prepare(
        "DELETE FROM factory_graph_edges WHERE scope='global' AND source_id IN (SELECT id FROM factory_graph_nodes WHERE source_ref IN (?, ?))",
      ).run(`playbook:${hash}`, `prevention:${hash}`);
      db.prepare("DELETE FROM factory_graph_nodes WHERE scope='global' AND source_ref IN (?, ?)").run(
        `playbook:${hash}`,
        `prevention:${hash}`,
      );
    }
    const insertNode = db.prepare(
      `INSERT INTO factory_graph_nodes(id,scope,business_id,project_id,kind,label,body,confidence,technology,source_ref,success,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const node of nodes) {
      insertNode.run(
        node.id,
        node.scope,
        node.business_id,
        node.project_id,
        node.kind,
        node.label,
        node.body,
        node.confidence,
        node.technology,
        node.source_ref,
        node.success,
        node.updated_at,
      );
    }
    const insertEdge = db.prepare(
      `INSERT INTO factory_graph_edges(id,scope,business_id,project_id,source_id,target_id,relation,updated_at)
       VALUES(?,?,?,?,?,?,?,?)`,
    );
    for (const edge of edges) {
      const source = nodes.find((node) => node.id === edge.source);
      insertEdge.run(
        randomUUID(),
        edge.scope,
        source?.business_id ?? null,
        source?.project_id ?? null,
        edge.source,
        edge.target,
        edge.relation,
        now,
      );
    }
  });
}

function visibleNodes(db: DatabaseSync, input: GraphQueryInput): StoredNode[] {
  return db
    .prepare(
      `SELECT * FROM factory_graph_nodes
       WHERE scope='global'
          OR (business_id=? AND (project_id IS NULL OR project_id=? OR ? IS NULL))`,
    )
    .all(input.businessId, input.projectId ?? null, input.projectId ?? null) as unknown as StoredNode[];
}

function ranked(db: DatabaseSync, input: GraphQueryInput, kinds?: string[]): RankedGraphItem[] {
  reindexExperienceGraph(db, input);
  const items = visibleNodes(db, input)
    .filter((node) => !kinds || kinds.includes(node.kind))
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      body: node.body,
      confidence: node.confidence,
      technology: node.technology,
      scope: node.scope,
      success: node.success,
      updatedAt: node.updated_at,
    }));
  return rankGraphItems(items, input);
}

export interface GraphOverviewNode {
  id: string;
  kind: string;
  label: string;
  body: string;
  confidence: string;
  scope: string;
  success: number;
}

export interface GraphOverviewEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
}

export function readGraphOverview(
  db: DatabaseSync,
  input: GraphQueryInput,
): { nodes: GraphOverviewNode[]; edges: GraphOverviewEdge[] } {
  reindexExperienceGraph(db, input);
  const nodes = visibleNodes(db, input)
    .sort((left, right) => right.updated_at - left.updated_at)
    .slice(0, 80)
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      body: node.body.slice(0, 400),
      confidence: node.confidence,
      scope: node.scope,
      success: node.success,
    }));
  const visible = new Set(nodes.map((node) => node.id));
  const edges = (
    db
      .prepare(
        `SELECT id, source_id, target_id, relation FROM factory_graph_edges
         WHERE scope='global'
            OR (business_id=? AND (project_id IS NULL OR project_id=? OR ? IS NULL))`,
      )
      .all(input.businessId, input.projectId ?? null, input.projectId ?? null) as unknown as GraphOverviewEdge[]
  ).filter((edge) => visible.has(edge.source_id) && visible.has(edge.target_id));
  return { nodes, edges };
}

export function findSimilarIncidents(db: DatabaseSync, input: GraphQueryInput): RankedGraphItem[] {
  return ranked(db, input, ["incident", "root_cause"]).slice(0, 4);
}

export function getVerifiedSolutions(db: DatabaseSync, input: GraphQueryInput): RankedGraphItem[] {
  return ranked(db, input, ["solution", "verification"])
    .filter((item) => PLAYBOOK_CONFIDENCE.has(item.confidence))
    .slice(0, 4);
}

export function getPlaybooks(db: DatabaseSync, input: GraphQueryInput): RankedGraphItem[] {
  return ranked(db, input, ["playbook", "prevention"]).slice(0, 3);
}

export function buildGraphTaskBrief(db: DatabaseSync, input: GraphQueryInput, runner?: GraphifyRunner): string {
  const experience = ranked(db, input);
  const code = input.projectPath ? queryCodeGraph(input.projectPath, input.task, 700, runner) : "";
  const fileToken = input.task.match(/[\w./-]+\.(?:ts|tsx|js|py|go|sql)/)?.[0] ?? "";
  const impact = input.projectPath && fileToken ? explainChangeImpact(input.projectPath, fileToken, runner) : "";
  const codeItems: RankedGraphItem[] = [];
  if (code) {
    codeItems.push({
      id: "code",
      kind: "code",
      label: "Kod grafiği",
      body: code,
      confidence: "OBSERVED",
      technology: "",
      scope: "project",
      success: 0.5,
      updatedAt: input.now ?? Date.now(),
      score: 1,
    });
  }
  if (impact) {
    codeItems.push({
      id: "impact",
      kind: "code",
      label: "Değişiklik etkisi",
      body: impact,
      confidence: "OBSERVED",
      technology: "",
      scope: "project",
      success: 0.5,
      updatedAt: input.now ?? Date.now(),
      score: 1,
    });
  }
  return renderGraphBrief([...codeItems, ...experience.filter((item) => item.kind !== "verification")]);
}

export type GraphToolName =
  | "query_project_graph"
  | "find_related_code"
  | "find_similar_incidents"
  | "get_verified_solutions"
  | "get_playbook"
  | "get_change_impact";

export function runGraphTool(
  db: DatabaseSync,
  name: GraphToolName,
  input: GraphQueryInput,
  runner?: GraphifyRunner,
): string {
  if (name === "query_project_graph") return buildGraphTaskBrief(db, input, runner);
  if (name === "find_related_code")
    return input.projectPath ? queryCodeGraph(input.projectPath, input.task, 700, runner) : "";
  if (name === "find_similar_incidents") return renderGraphBrief(findSimilarIncidents(db, input));
  if (name === "get_verified_solutions") return renderGraphBrief(getVerifiedSolutions(db, input));
  if (name === "get_playbook") return renderGraphBrief(getPlaybooks(db, input));
  return input.projectPath ? explainChangeImpact(input.projectPath, input.task, runner) : "";
}
