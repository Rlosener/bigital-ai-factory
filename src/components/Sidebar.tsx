import { useState } from "react";
import {
  BookOpen,
  Bot,
  Building2,
  ChartNoAxesCombined,
  Share2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Settings,
  Workflow,
} from "lucide-react";
import type { Department, Agent, CompanySettings } from "../types";
import type { View } from "../app/types";
import { localeName, useI18n } from "../i18n";

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
  departments: Department[];
  agents: Agent[];
  settings: CompanySettings;
  connected: boolean;
}
const items = [
  { view: "factory" as const, icon: Workflow, label: "AI Yönetici" },
  { view: "graph" as const, icon: Share2, label: "Sinir Ağı" },
  { view: "agents" as const, icon: Bot, label: "AI Çalışanlar" },
  { view: "tasks" as const, icon: ClipboardList, label: "Görev panosu" },
  { view: "skills" as const, icon: BookOpen, label: "Yetenekler" },
  { view: "dashboard" as const, icon: ChartNoAxesCombined, label: "İstatistikler" },
  { view: "office" as const, icon: Building2, label: "Piksel Ofis" },
  { view: "settings" as const, icon: Settings, label: "Ayarlar" },
];
export default function Sidebar({ currentView, onChangeView, departments, agents, connected }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { locale } = useI18n();
  const working = agents.filter((agent) => agent.status === "working").length;
  return (
    <aside className={`bigital-sidebar ${collapsed ? "bigital-sidebar--collapsed" : ""}`}>
      <div className="bigital-brand">
        <img src="/bigital.svg" alt="Bigital" />
        {!collapsed && (
          <div>
            <strong>BIGITAL</strong>
            <span>AI FABRİKASI</span>
          </div>
        )}
        <button
          aria-label={collapsed ? "Gezinmeyi genişlet" : "Gezinmeyi daralt"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      {!collapsed && <p className="bigital-nav-caption">ÇALIŞMA ALANI</p>}
      <nav aria-label="Ana gezinme">
        {items.map(({ view, icon: Icon, label }) => (
          <button
            key={view}
            className={view === currentView ? "active" : ""}
            onClick={() => onChangeView(view)}
            title={label}
            aria-label={label}
            aria-current={view === currentView ? "page" : undefined}
          >
            <Icon size={17} strokeWidth={1.6} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>
      {!collapsed && (
        <div className="bigital-departments">
          <p className="bigital-nav-caption">EKİP</p>
          {departments.map((department) => (
            <div key={department.id}>
              <span>{localeName(locale, department)}</span>
              <small>
                {agents.filter((agent) => agent.department_id === department.id && agent.status === "working").length}/
                {agents.filter((agent) => agent.department_id === department.id).length}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="bigital-sidebar-status">
        <span className={connected ? "connected" : "disconnected"} />
        {!collapsed && (
          <div>
            {connected ? "Canlı bağlantı" : "Bağlantı bekleniyor"}
            <small>
              {working}/{agents.length} çalışan aktif
            </small>
          </div>
        )}
      </div>
    </aside>
  );
}
