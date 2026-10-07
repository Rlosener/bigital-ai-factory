import { useEffect, useState } from "react";
import { translateEnglishToTurkish, type UiLanguage } from "../../i18n";

export type Locale = UiLanguage;
export type TFunction = (messages: Record<Exclude<Locale, "tr">, string> & { tr?: string }) => string;

export function useNow(localeTag: string, t: TFunction) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const date = now.toLocaleDateString(localeTag, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const time = now.toLocaleTimeString(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const hour = now.getHours();
  const briefing =
    hour < 12
      ? t({ ko: "오전 브리핑", en: "Morning Briefing", ja: "午前ブリーフィング", zh: "上午简报" })
      : hour < 18
        ? t({ ko: "오후 운영 점검", en: "Afternoon Ops Check", ja: "午後運用点検", zh: "下午运行检查" })
        : t({ ko: "저녁 마감 점검", en: "Evening Wrap-up", ja: "夜間締め点検", zh: "晚间收尾检查" });

  return { date, time, briefing };
}

export function timeAgo(timestamp: number, localeTag: string): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  const relativeTimeFormat = new Intl.RelativeTimeFormat(localeTag, { numeric: "auto" });
  if (seconds < 60) return relativeTimeFormat.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relativeTimeFormat.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeTimeFormat.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  return relativeTimeFormat.format(-days, "day");
}

export const RANK_TIERS = [
  { name: "BRONZE", nameKo: "브론즈", minXp: 0, color: "#a7aaa5", glow: "rgba(167,170,165,0.12)", icon: "⚔️" },
  { name: "SILVER", nameKo: "실버", minXp: 100, color: "#c6c9c3", glow: "rgba(198,201,195,0.12)", icon: "🛡️" },
  { name: "GOLD", nameKo: "골드", minXp: 500, color: "#eabf65", glow: "rgba(234,191,101,0.12)", icon: "⭐" },
  {
    name: "PLATINUM",
    nameKo: "플래티넘",
    minXp: 2000,
    color: "#79d98c",
    glow: "rgba(121,217,140,0.12)",
    icon: "💎",
  },
  { name: "DIAMOND", nameKo: "다이아", minXp: 5000, color: "#c8ff65", glow: "rgba(200,255,101,0.12)", icon: "💠" },
  { name: "MASTER", nameKo: "마스터", minXp: 15000, color: "#b8ff32", glow: "rgba(184,255,50,0.14)", icon: "👑" },
];

export function getRankTier(xp: number) {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (xp >= RANK_TIERS[i].minXp) return { ...RANK_TIERS[i], level: i };
  }
  return { ...RANK_TIERS[0], level: 0 };
}

export const STATUS_LABELS: Record<string, { color: string; dot: string }> = {
  inbox: { color: "bg-slate-500/20 text-slate-200 border-slate-400/30", dot: "bg-slate-400" },
  planned: { color: "bg-slate-500/20 text-slate-200 border-slate-400/30", dot: "bg-slate-300" },
  in_progress: { color: "bg-amber-500/20 text-amber-100 border-amber-400/30", dot: "bg-amber-400" },
  review: { color: "bg-blue-500/10 text-blue-300 border-blue-400/30", dot: "bg-blue-400" },
  done: { color: "bg-emerald-500/20 text-emerald-100 border-emerald-400/30", dot: "bg-emerald-400" },
  pending: { color: "bg-orange-500/20 text-orange-100 border-orange-400/30", dot: "bg-orange-400" },
  cancelled: { color: "bg-rose-500/20 text-rose-100 border-rose-400/30", dot: "bg-rose-400" },
};

export const STATUS_LEFT_BORDER: Record<string, string> = {
  inbox: "border-l-slate-400",
  planned: "border-l-slate-300",
  in_progress: "border-l-amber-400",
  review: "border-l-blue-400",
  done: "border-l-emerald-400",
  pending: "border-l-orange-400",
  cancelled: "border-l-rose-400",
};

export function taskStatusLabel(status: string, t: TFunction) {
  switch (status) {
    case "inbox":
      return t({ ko: "수신함", en: "Inbox", ja: "受信箱", zh: "收件箱" });
    case "planned":
      return t({ ko: "계획됨", en: "Planned", ja: "計画済み", zh: "已计划" });
    case "collaborating":
      return t({ ko: "협업 중", en: "Collaborating", ja: "共同作業中", zh: "协作中" });
    case "in_progress":
      return t({ ko: "진행 중", en: "In Progress", ja: "進行中", zh: "进行中" });
    case "review":
      return t({ ko: "검토 중", en: "Review", ja: "レビュー", zh: "审核" });
    case "done":
      return t({ ko: "완료", en: "Done", ja: "完了", zh: "完成" });
    case "pending":
      return t({ ko: "보류", en: "Pending", ja: "保留", zh: "待处理" });
    case "cancelled":
      return t({ ko: "취소됨", en: "Cancelled", ja: "キャンセル", zh: "已取消" });
    default:
      return status;
  }
}

// Departments share one accent; the name, not the hue, identifies them.
export const DEPT_COLORS = [{ bar: "bg-lime-400", badge: "bg-slate-800 text-slate-300 border-slate-700" }];

export function XpBar({ xp, maxXp, color }: { xp: number; maxXp: number; color: string }) {
  const pct = maxXp > 0 ? Math.min(100, Math.round((xp / maxXp) * 100)) : 0;
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function RankBadge({ xp, size = "md" }: { xp: number; size?: "sm" | "md" | "lg" }) {
  const tier = getRankTier(xp);
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[8px] gap-0.5",
    md: "px-2 py-0.5 text-[10px] gap-1",
    lg: "px-3 py-1 text-xs gap-1",
  };
  return (
    <span
      className={`inline-flex items-center rounded font-medium ${sizeClasses[size]}`}
      style={{
        background: tier.glow,
        color: tier.color,
        border: `1px solid ${tier.color}40`,
      }}
    >
      {translateEnglishToTurkish(tier.name)}
    </span>
  );
}
