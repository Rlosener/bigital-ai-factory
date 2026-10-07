import { FileText } from "lucide-react";
import { localeName, translateEnglishToTurkish, type UiLanguage } from "../../i18n";
import type { Agent, Task } from "../../types";
import AgentAvatar from "../AgentAvatar";
import { getRankTier, STATUS_LABELS, STATUS_LEFT_BORDER, taskStatusLabel, timeAgo, type TFunction } from "./model";

export interface DepartmentPerformance {
  id: string;
  name: string;
  icon: string;
  done: number;
  total: number;
  ratio: number;
  color: {
    bar: string;
    badge: string;
  };
}

interface DashboardDeptAndSquadProps {
  deptData: DepartmentPerformance[];
  workingAgents: Agent[];
  idleAgentsList: Agent[];
  agents: Agent[];
  language: UiLanguage;
  numberFormatter: Intl.NumberFormat;
  t: TFunction;
}

export function DashboardDeptAndSquad({
  deptData,
  workingAgents,
  idleAgentsList,
  agents,
  language,
  numberFormatter,
  t,
}: DashboardDeptAndSquadProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="game-panel p-5">
        <div className="mb-4">
          <h2 className="bf-section-title">
            {t({ tr: "Departman performansı", ko: "부서 성과", en: "DEPT. PERFORMANCE", ja: "部署パフォーマンス", zh: "部门绩效" })}
          </h2>
          <p className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
            {t({ tr: "Departmanlara göre tamamlanan görevler", ko: "부서별 성과", en: "by department", ja: "部署別", zh: "按部门" })}
          </p>
        </div>

        {deptData.length === 0 ? (
          <div className="bf-empty">
            {t({ ko: "데이터가 없습니다", en: "No data available", ja: "データがありません", zh: "暂无数据" })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {deptData.map((dept) => (
              <article
                key={dept.id}
                className="rounded-lg border border-slate-700 bg-slate-900 p-3 transition-colors hover:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md text-sm"
                      style={{ background: "var(--th-bg-surface)" }}
                    >
                      {dept.icon}
                    </span>
                    <span className="text-sm font-medium" style={{ color: "var(--th-text-primary)" }}>
                      {dept.name}
                    </span>
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${dept.color.badge}`}>
                    {dept.ratio}%
                  </span>
                </div>

                <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className={`h-full rounded-full ${dept.color.bar} transition-all duration-700`}
                    style={{ width: `${dept.ratio}%` }}
                  />
                </div>

                <div
                  className="mt-1.5 flex justify-between text-[10px]"
                  style={{ color: "var(--th-text-muted)" }}
                >
                  <span>
                    {t({ tr: "Tamamlanan", ko: "클리어", en: "cleared", ja: "クリア", zh: "完成" })}{" "}
                    {numberFormatter.format(dept.done)}
                  </span>
                  <span>
                    {t({ ko: "전체", en: "total", ja: "全体", zh: "总计" })} {numberFormatter.format(dept.total)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="game-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="bf-section-title">{t({ tr: "Ekip", ko: "스쿼드", en: "SQUAD", ja: "スクワッド", zh: "小队" })}</h2>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t({ tr: "Çalışıyor", ko: "ON", en: "ON", ja: "ON", zh: "在线" })} {numberFormatter.format(workingAgents.length)}
            </span>
            <span
              className="flex items-center gap-1 rounded border px-2 py-0.5 font-medium"
              style={{
                borderColor: "var(--th-border)",
                background: "var(--th-bg-surface)",
                color: "var(--th-text-secondary)",
              }}
            >
              {t({ tr: "Hazır", ko: "OFF", en: "OFF", ja: "OFF", zh: "离线" })} {numberFormatter.format(idleAgentsList.length)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {agents.map((agent) => {
            const isWorking = agent.status === "working";
            const tier = getRankTier(agent.stats_xp);
            return (
              <div
                key={agent.id}
                title={`${localeName(language, agent)} — ${
                  isWorking
                    ? t({ ko: "작업 중", en: "Working", ja: "作業中", zh: "工作中" })
                    : t({ ko: "대기 중", en: "Idle", ja: "待機中", zh: "空闲" })
                } — ${language === "tr" ? translateEnglishToTurkish(tier.name) : tier.name}`}
                className="relative flex flex-col items-center gap-1.5"
              >
                <div className="relative">
                  <div
                    className="overflow-hidden rounded-xl"
                    style={{ border: `1px solid ${isWorking ? "var(--bf-success-400)" : "var(--th-border)"}` }}
                  >
                    <AgentAvatar agent={agent} agents={agents} size={40} rounded="xl" />
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${
                      isWorking ? "bg-emerald-400" : "bg-slate-600"
                    }`}
                    style={{ borderColor: "var(--th-bg-primary)" }}
                  />
                </div>
                <span
                  className="max-w-[52px] truncate text-center text-[10px] leading-tight"
                  style={{ color: isWorking ? "var(--th-text-primary)" : "var(--th-text-muted)" }}
                >
                  {localeName(language, agent)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface DashboardMissionLogProps {
  recentTasks: Task[];
  agentMap: Map<string, Agent>;
  agents: Agent[];
  language: UiLanguage;
  localeTag: string;
  idleAgents: number;
  numberFormatter: Intl.NumberFormat;
  t: TFunction;
}

export function DashboardMissionLog({
  recentTasks,
  agentMap,
  agents,
  language,
  localeTag,
  idleAgents,
  numberFormatter,
  t,
}: DashboardMissionLogProps) {
  return (
    <div className="game-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="bf-section-title">
            {t({ tr: "Son görevler", ko: "미션 로그", en: "MISSION LOG", ja: "ミッションログ", zh: "任务日志" })}
          </h2>
          <p className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
            {t({ ko: "최근 활동", en: "Recent activity", ja: "最近の活動", zh: "最近活动" })}
          </p>
        </div>
        <span
          className="flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-medium"
          style={{
            borderColor: "var(--th-border)",
            background: "var(--th-bg-surface)",
            color: "var(--th-text-secondary)",
          }}
        >
          {t({ ko: "유휴", en: "Idle", ja: "待機", zh: "空闲" })} {numberFormatter.format(idleAgents)}
          {t({ ko: "명", en: "", ja: "人", zh: "人" })}
        </span>
      </div>

      {recentTasks.length === 0 ? (
        <div className="bf-empty">
          {t({ tr: "Henüz görev hareketi yok", ko: "로그 없음", en: "No logs", ja: "ログなし", zh: "暂无日志" })}
        </div>
      ) : (
        <div className="space-y-2">
          {recentTasks.map((task) => {
            const statusInfo = STATUS_LABELS[task.status] ?? {
              color: "bg-slate-600/20 text-slate-200 border-slate-500/30",
              dot: "bg-slate-400",
            };
            const assignedAgent =
              task.assigned_agent ?? (task.assigned_agent_id ? agentMap.get(task.assigned_agent_id) : undefined);
            const leftBorder = STATUS_LEFT_BORDER[task.status] ?? "border-l-slate-500";

            return (
              <article
                key={task.id}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-slate-700 border-l-2 ${leftBorder} bg-slate-900 p-3 transition-colors hover:bg-slate-800`}
              >
                {assignedAgent ? (
                  <AgentAvatar agent={assignedAgent} agents={agents} size={36} rounded="xl" />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl border"
                    style={{
                      borderColor: "var(--th-border)",
                      background: "var(--th-bg-surface)",
                      color: "var(--th-text-muted)",
                    }}
                  >
                    <FileText size={15} strokeWidth={1.6} aria-hidden="true" />
                  </div>
                )}

                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--th-text-primary)" }}
                  >
                    {task.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px]" style={{ color: "var(--th-text-muted)" }}>
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusInfo.dot}`} />
                    {assignedAgent
                      ? localeName(language, assignedAgent)
                      : t({ ko: "미배정", en: "Unassigned", ja: "未割り当て", zh: "未分配" })}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                  >
                    {taskStatusLabel(task.status, t)}
                  </span>
                  <span className="text-[9px] font-medium" style={{ color: "var(--th-text-muted)" }}>
                    {timeAgo(task.updated_at, localeTag)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
