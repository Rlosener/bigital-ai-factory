import { ArrowRight, Clock3, type LucideIcon } from "lucide-react";
import AgentAvatar from "../AgentAvatar";
import type { Agent } from "../../types";
import { getRankTier, RankBadge, XpBar, type TFunction } from "./model";

export interface HudStat {
  id: string;
  label: string;
  value: number | string;
  sub: string;
  color: string;
  icon: LucideIcon;
}

export interface RankedAgent {
  id: string;
  name: string;
  department: string;
  tasksDone: number;
  xp: number;
}

interface DashboardHeroHeaderProps {
  companyName: string;
  time: string;
  date: string;
  briefing: string;
  reviewQueue: number;
  numberFormatter: Intl.NumberFormat;
  primaryCtaEyebrow: string;
  primaryCtaDescription: string;
  primaryCtaLabel: string;
  onPrimaryCtaClick: () => void;
  t: TFunction;
}

export function DashboardHeroHeader({
  companyName,
  time,
  date,
  briefing,
  reviewQueue,
  numberFormatter,
  primaryCtaEyebrow,
  primaryCtaDescription,
  primaryCtaLabel,
  onPrimaryCtaClick,
  t,
}: DashboardHeroHeaderProps) {
  return (
    <div className="game-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="dash-label">{date}</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="bf-page-title">{companyName}</h1>
            <span className="flex items-center gap-1.5 rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t({ tr: "Canlı", ko: "실시간", en: "LIVE", ja: "ライブ", zh: "实时" })}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--th-text-secondary)" }}>
            {t({
              tr: "AI çalışanların görev ilerlemesi ve ekip durumu",
              ko: "에이전트들이 실시간으로 미션을 수행 중입니다",
              en: "Agents are executing missions in real time",
              ja: "エージェントがリアルタイムでミッションを実行中です",
              zh: "代理正在实时执行任务",
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-300">
            <Clock3 size={13} strokeWidth={1.7} aria-hidden="true" />
            <span className="dashboard-time-display font-mono">{time}</span>
            <span className="hidden text-slate-500 sm:inline">· {briefing}</span>
          </span>
          {reviewQueue > 0 && (
            <span className="rounded-md border border-amber-800 bg-amber-950 px-2.5 py-1.5 font-medium text-amber-400">
              {t({ tr: "Sırada", ko: "대기", en: "Queued", ja: "待機", zh: "待处理" })}{" "}
              {numberFormatter.format(reviewQueue)}
              {t({ ko: "건", en: "", ja: "件", zh: "项" })}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="dash-label">{primaryCtaEyebrow}</p>
          <p className="mt-1 text-xs sm:text-sm" style={{ color: "var(--th-text-primary)" }}>
            {primaryCtaDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={onPrimaryCtaClick}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold transition hover:bg-blue-500 sm:w-auto"
        >
          <span>{primaryCtaLabel}</span>
          <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

interface DashboardHudStatsProps {
  hudStats: HudStat[];
  numberFormatter: Intl.NumberFormat;
}

export function DashboardHudStats({ hudStats, numberFormatter }: DashboardHudStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {hudStats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.id} className="game-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="dash-label">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: stat.color }}>
                  {typeof stat.value === "number" ? numberFormatter.format(stat.value) : stat.value}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: "var(--th-text-muted)" }}>
                  {stat.sub}
                </p>
              </div>
              <Icon size={16} strokeWidth={1.6} aria-hidden="true" style={{ color: "var(--th-text-muted)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface DashboardRankingBoardProps {
  topAgents: RankedAgent[];
  podiumOrder: RankedAgent[];
  agentMap: Map<string, Agent>;
  agents: Agent[];
  maxXp: number;
  numberFormatter: Intl.NumberFormat;
  t: TFunction;
}

export function DashboardRankingBoard({
  topAgents,
  podiumOrder,
  agentMap,
  agents,
  maxXp,
  numberFormatter,
  t,
}: DashboardRankingBoardProps) {
  return (
    <div className="game-panel p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="bf-section-title">
            {t({ tr: "Başarı sıralaması", ko: "랭킹 보드", en: "RANKING BOARD", ja: "ランキングボード", zh: "排行榜" })}
          </h2>
          <p className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
            {t({
              ko: "XP 기준 에이전트 순위",
              en: "Agent ranking by XP",
              ja: "XP 基準のエージェント順位",
              zh: "按 XP 排名",
            })}
          </p>
        </div>
        <span className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
          {t({ tr: "İlk", ko: "TOP", en: "TOP", ja: "TOP", zh: "TOP" })} {topAgents.length}
        </span>
      </div>

      {topAgents.length === 0 ? (
        <div className="bf-empty">
          <p>
            {t({
              ko: "등록된 에이전트가 없습니다",
              en: "No agents registered",
              ja: "登録されたエージェントがいません",
              zh: "暂无已注册代理",
            })}
          </p>
          <p className="text-[11px]">
            {t({
              tr: "AI çalışan ekleyip görev başlattığınızda sıralama burada görünür.",
              ko: "에이전트를 추가하고 미션을 시작하세요",
              en: "Add agents and start missions",
              ja: "エージェントを追加してミッションを開始しましょう",
              zh: "添加代理并开始任务",
            })}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {topAgents.length >= 2 && (
            <div className="flex items-end justify-center gap-4 pb-3 pt-2 sm:gap-6">
              {podiumOrder.map((agent, visualIdx) => {
                const ranks = topAgents.length >= 3 ? [2, 1, 3] : [2, 1];
                const rank = ranks[visualIdx];
                const isFirst = rank === 1;
                const avatarSize = isFirst ? 56 : 44;
                const podiumHeight = isFirst ? "h-20" : rank === 2 ? "h-14" : "h-10";

                return (
                  <div key={agent.id} className="flex flex-col items-center gap-2">
                    <div
                      className="overflow-hidden rounded-xl border"
                      style={{ borderColor: isFirst ? "var(--bf-accent-400)" : "var(--th-border)" }}
                    >
                      <AgentAvatar agent={agentMap.get(agent.id)} agents={agents} size={avatarSize} rounded="xl" />
                    </div>

                    <span
                      className={`max-w-[80px] truncate text-center font-medium ${isFirst ? "text-sm" : "text-xs"}`}
                      style={{ color: "var(--th-text-primary)" }}
                    >
                      {agent.name}
                    </span>

                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-[11px]" style={{ color: "var(--th-text-secondary)" }}>
                        {numberFormatter.format(agent.xp)} XP
                      </span>
                      <RankBadge xp={agent.xp} size="sm" />
                    </div>

                    <div
                      className={`${podiumHeight} flex w-20 items-center justify-center rounded-t-md border border-b-0 sm:w-24`}
                      style={{
                        borderColor: "var(--th-border)",
                        background: isFirst ? "var(--bf-accent-900)" : "var(--th-bg-surface)",
                      }}
                    >
                      <span
                        className="text-lg font-semibold"
                        style={{ color: isFirst ? "var(--bf-accent-400)" : "var(--th-text-muted)" }}
                      >
                        #{rank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {topAgents.length > 3 && (
            <div className="space-y-2 border-t border-slate-700 pt-4">
              {topAgents.slice(3).map((agent, idx) => {
                const rank = idx + 4;
                const tier = getRankTier(agent.xp);
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3 transition-colors hover:bg-slate-800"
                  >
                    <span className="w-8 text-center font-mono text-xs" style={{ color: "var(--th-text-muted)" }}>
                      #{rank}
                    </span>
                    <div className="flex-shrink-0 overflow-hidden rounded-lg border border-slate-700">
                      <AgentAvatar agent={agentMap.get(agent.id)} agents={agents} size={36} rounded="xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--th-text-primary)" }}>
                        {agent.name}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
                        {agent.department || t({ ko: "미지정", en: "Unassigned", ja: "未指定", zh: "未指定" })}
                      </p>
                    </div>
                    <div className="hidden w-28 sm:block">
                      <XpBar xp={agent.xp} maxXp={maxXp} color={tier.color} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs" style={{ color: "var(--th-text-secondary)" }}>
                        {numberFormatter.format(agent.xp)}
                      </span>
                      <RankBadge xp={agent.xp} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {topAgents.length === 1 &&
            (() => {
              const agent = topAgents[0];
              return (
                <div className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
                  <div className="overflow-hidden rounded-xl border border-slate-700">
                    <AgentAvatar agent={agentMap.get(agent.id)} agents={agents} size={48} rounded="xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--th-text-primary)" }}>
                      {agent.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--th-text-muted)" }}>
                      {agent.department || t({ ko: "미지정", en: "Unassigned", ja: "未指定", zh: "未指定" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm" style={{ color: "var(--th-text-secondary)" }}>
                      {numberFormatter.format(agent.xp)} XP
                    </p>
                    <RankBadge xp={agent.xp} size="md" />
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
