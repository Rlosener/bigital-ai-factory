import type { Agent, Department } from "../../types";
import { localeName } from "../../i18n";
import AgentCard from "./AgentCard";
import type { Translator } from "./types";

interface AgentsTabProps {
  tr: Translator;
  locale: string;
  agents: Agent[];
  departments: Department[];
  deptTab: string;
  setDeptTab: (deptId: string) => void;
  search: string;
  setSearch: (next: string) => void;
  sortedAgents: Agent[];
  spriteMap: Map<string, number>;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onEditAgent: (agent: Agent) => void;
  onEditDepartment: (department: Department) => void;
  onDeleteAgent: (agentId: string) => void;
  saving: boolean;
  randomIconSprites: {
    total: [number, number];
  };
}

export default function AgentsTab({
  tr,
  locale,
  agents,
  departments,
  deptTab,
  setDeptTab,
  search,
  setSearch,
  sortedAgents,
  spriteMap,
  confirmDeleteId,
  setConfirmDeleteId,
  onEditAgent,
  onEditDepartment,
  onDeleteAgent,
  saving,
  randomIconSprites,
}: AgentsTabProps) {
  const workingCount = agents.filter((agent) => agent.status === "working").length;
  const deptCounts = new Map<string, { total: number; working: number }>();
  for (const agent of agents) {
    const key = agent.department_id || "__none";
    const count = deptCounts.get(key) ?? { total: 0, working: 0 };
    count.total += 1;
    if (agent.status === "working") count.working += 1;
    deptCounts.set(key, count);
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: tr("전체 인원", "Total"), value: agents.length },
          { label: tr("근무 중", "Working"), value: workingCount },
          { label: tr("부서", "Departments"), value: departments.length },
        ].map((summary) => (
          <div
            key={summary.label}
            className="rounded-lg px-4 py-3"
            style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
          >
            <div className="dash-label mb-1">{summary.label}</div>
            <div className="text-2xl font-semibold tabular-nums" style={{ color: "var(--th-text-heading)" }}>
              {summary.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap" style={{ borderBottom: "1px solid var(--th-card-border)" }}>
        <button
          onClick={() => setDeptTab("all")}
          className={`-mb-px flex items-center gap-1 border-b-2 py-2 text-xs transition-colors ${
            deptTab === "all" ? "border-blue-400 text-slate-100" : "border-transparent hover:text-slate-200"
          }`}
          style={deptTab !== "all" ? { color: "var(--th-text-muted)" } : undefined}
        >
          {tr("전체", "All")} <span className="opacity-60">{agents.length}</span>
        </button>
        {departments.map((department) => {
          const count = deptCounts.get(department.id);
          return (
            <button
              key={department.id}
              onClick={() => setDeptTab(department.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                onEditDepartment(department);
              }}
              title={tr("더블클릭: 부서 편집", "Double-click: edit dept")}
              className={`-mb-px flex items-center gap-1 border-b-2 py-2 text-xs transition-colors ${
                deptTab === department.id ? "border-blue-400 text-slate-100" : "border-transparent hover:text-slate-200"
              }`}
              style={deptTab !== department.id ? { color: "var(--th-text-muted)" } : undefined}
            >
              <span>{department.icon}</span>
              <span className="hidden sm:inline">{localeName(locale, department)}</span>
              <span className="opacity-60">{count?.total ?? 0}</span>
            </button>
          );
        })}
        <div className="ml-auto pb-1">
          <input
            type="text"
            placeholder={`${tr("검색", "Search")}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-md text-xs outline-none focus:border-blue-400 transition-colors w-36"
            style={{
              background: "var(--th-input-bg)",
              border: "1px solid var(--th-input-border)",
              color: "var(--th-text-primary)",
            }}
          />
        </div>
      </div>

      {sortedAgents.length === 0 ? (
        <div className="bf-empty">{tr("검색 결과 없음", "No agents found")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              spriteMap={spriteMap}
              locale={locale}
              tr={tr}
              departments={departments}
              onEdit={() => onEditAgent(agent)}
              confirmDeleteId={confirmDeleteId}
              onDeleteClick={() => setConfirmDeleteId(agent.id)}
              onDeleteConfirm={() => onDeleteAgent(agent.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              saving={saving}
            />
          ))}
        </div>
      )}
    </>
  );
}
