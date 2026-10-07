import type { DatabaseSync } from "node:sqlite";

export function applyGraphIntelligenceSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS factory_graph_nodes (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL CHECK(scope IN ('project','business','global')),
      business_id TEXT,
      project_id TEXT,
      kind TEXT NOT NULL CHECK(kind IN ('incident','root_cause','attempt','solution','verification','playbook','prevention')),
      label TEXT NOT NULL,
      body TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK(confidence IN ('NEW','OBSERVED','VERIFIED','REPEATED','PROVEN')),
      technology TEXT NOT NULL DEFAULT '',
      source_ref TEXT NOT NULL,
      success REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_graph_source ON factory_graph_nodes(scope, COALESCE(business_id,''), COALESCE(project_id,''), source_ref);
    CREATE INDEX IF NOT EXISTS idx_factory_graph_scope ON factory_graph_nodes(scope, business_id, project_id, kind);
    CREATE TABLE IF NOT EXISTS factory_graph_edges (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL CHECK(scope IN ('project','business','global')),
      business_id TEXT,
      project_id TEXT,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation TEXT NOT NULL CHECK(relation IN ('caused_by','fixed_by','verified_by','attempted','prevents')),
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_factory_graph_edge_source ON factory_graph_edges(source_id, relation);
  `);
}
