import type { SettingsTab, TFunction } from "./types";

interface SettingsTabNavProps {
  tab: SettingsTab;
  setTab: (tab: SettingsTab) => void;
  t: TFunction;
}

const TAB_ITEMS: Array<{ key: SettingsTab; label: (t: TFunction) => string }> = [
  { key: "general", label: (t) => t({ ko: "일반 설정", en: "General", ja: "一般設定", zh: "常规设置" }) },
  {
    key: "connections",
    label: (t) => t({ tr: "AI Bağlantıları", ko: "AI 연결", en: "AI Connections", ja: "AI 接続", zh: "AI 连接" }),
  },
  {
    key: "gateway",
    label: (t) => t({ tr: "Kanal mesajları", ko: "채널 메시지", en: "Channel", ja: "チャネル", zh: "频道" }),
  },
];

export default function SettingsTabNav({ tab, setTab, t }: SettingsTabNavProps) {
  return (
    <div className="bf-tabs" role="tablist">
      {TAB_ITEMS.map((item) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={tab === item.key}
          onClick={() => setTab(item.key)}
          className={tab === item.key ? "active" : ""}
        >
          {item.label(t)}
        </button>
      ))}
    </div>
  );
}
