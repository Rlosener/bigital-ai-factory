import {
  Activity,
  ClipboardList,
  Compass,
  EllipsisVertical,
  FileText,
  LayoutGrid,
  LoaderCircle,
  Megaphone,
  Menu,
} from "lucide-react";
import type { WorkflowPackKey } from "../types";
import type { View } from "./types";

type OfficePackOption = {
  key: WorkflowPackKey;
  label: string;
  summary: string;
  slug: string;
  accent: number;
};

interface AppHeaderBarProps {
  currentView: View;
  connected: boolean;
  viewTitle: string;
  tasksPrimaryLabel: string;
  decisionLabel: string;
  decisionInboxLoading: boolean;
  decisionInboxCount: number;
  agentStatusLabel: string;
  reportLabel: string;
  announcementLabel: string;
  roomManagerLabel: string;
  officePackControl?: {
    label: string;
    value: WorkflowPackKey;
    options: OfficePackOption[];
    onChange: (packKey: WorkflowPackKey) => void;
  } | null;
  mobileHeaderMenuOpen: boolean;
  onOpenMobileNav: () => void;
  onOpenTasks: () => void;
  onOpenDecisionInbox: () => void;
  onOpenAgentStatus: () => void;
  onOpenReportHistory: () => void;
  onOpenAnnouncement: () => void;
  onOpenRoomManager: () => void;
  onToggleMobileHeaderMenu: () => void;
  onCloseMobileHeaderMenu: () => void;
}

const ICON_SIZE = 14;
const ICON_STROKE = 1.7;

export default function AppHeaderBar({
  currentView,
  connected,
  viewTitle,
  tasksPrimaryLabel,
  decisionLabel,
  decisionInboxLoading,
  decisionInboxCount,
  agentStatusLabel,
  reportLabel,
  announcementLabel,
  roomManagerLabel,
  officePackControl,
  mobileHeaderMenuOpen,
  onOpenMobileNav,
  onOpenTasks,
  onOpenDecisionInbox,
  onOpenAgentStatus,
  onOpenReportHistory,
  onOpenAnnouncement,
  onOpenRoomManager,
  onToggleMobileHeaderMenu,
  onCloseMobileHeaderMenu,
}: AppHeaderBarProps) {
  const showRoomManager = currentView === "office";
  return (
    <header className="app-topbar">
      <div className="app-topbar-title">
        <button onClick={onOpenMobileNav} className="app-topbar-icon-btn app-topbar-nav-btn" aria-label="Gezinmeyi aç">
          <Menu size={16} strokeWidth={ICON_STROKE} />
        </button>
        <span className="app-topbar-crumb">Çalışma alanı</span>
        <span className="app-topbar-crumb" aria-hidden="true">
          /
        </span>
        <h1>{viewTitle}</h1>
        {officePackControl && (
          <label className="app-topbar-select hidden xl:flex">
            <span>{officePackControl.label}</span>
            <select
              value={officePackControl.value}
              onChange={(e) => officePackControl.onChange(e.target.value as WorkflowPackKey)}
            >
              {officePackControl.options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.slug} · {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="app-topbar-actions">
        {currentView !== "tasks" && (
          <button
            onClick={onOpenTasks}
            className="header-action-btn header-action-btn-secondary"
            aria-label={tasksPrimaryLabel}
            title={tasksPrimaryLabel}
          >
            <ClipboardList size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className="app-topbar-label">{tasksPrimaryLabel}</span>
          </button>
        )}
        <button
          onClick={onOpenDecisionInbox}
          disabled={decisionInboxLoading}
          className={`header-action-btn header-action-btn-secondary disabled:cursor-wait disabled:opacity-60${
            decisionInboxCount > 0 ? " decision-has-pending" : ""
          }`}
          aria-label={decisionLabel}
          title={decisionLabel}
        >
          {decisionInboxLoading ? (
            <LoaderCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} className="animate-spin" aria-hidden="true" />
          ) : (
            <Compass size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
          )}
          <span className="app-topbar-label">{decisionLabel}</span>
          {decisionInboxCount > 0 && <span className="header-decision-badge">{decisionInboxCount}</span>}
        </button>
        <button
          onClick={onOpenAgentStatus}
          className="header-action-btn header-action-btn-secondary mobile-hidden"
          aria-label={agentStatusLabel}
          title={agentStatusLabel}
        >
          <Activity size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="app-topbar-label">{agentStatusLabel}</span>
        </button>
        <button
          onClick={onOpenReportHistory}
          className="header-action-btn header-action-btn-secondary mobile-hidden"
          aria-label={reportLabel}
          title={reportLabel}
        >
          <FileText size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="app-topbar-label">{reportLabel}</span>
        </button>
        <button
          onClick={onOpenAnnouncement}
          className="header-action-btn header-action-btn-secondary"
          aria-label={announcementLabel}
          title={announcementLabel}
        >
          <Megaphone size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="app-topbar-label">{announcementLabel}</span>
        </button>
        {showRoomManager && (
          <button
            onClick={onOpenRoomManager}
            className="header-action-btn header-action-btn-secondary mobile-hidden"
            aria-label={roomManagerLabel}
            title={roomManagerLabel}
          >
            <LayoutGrid size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className="app-topbar-label">{roomManagerLabel}</span>
          </button>
        )}
        <div className="relative sm:hidden">
          <button onClick={onToggleMobileHeaderMenu} className="app-topbar-icon-btn" aria-label="Diğer işlemler">
            <EllipsisVertical size={16} strokeWidth={ICON_STROKE} />
          </button>
          {mobileHeaderMenuOpen && (
            <>
              <button className="fixed inset-0 z-40" onClick={onCloseMobileHeaderMenu} aria-label="Menüyü kapat" />
              <div className="app-topbar-menu">
                {officePackControl && (
                  <div className="app-topbar-menu-section">
                    <label htmlFor="mobile-office-pack-selector">{officePackControl.label}</label>
                    <select
                      id="mobile-office-pack-selector"
                      value={officePackControl.value}
                      onChange={(e) => {
                        officePackControl.onChange(e.target.value as WorkflowPackKey);
                        onCloseMobileHeaderMenu();
                      }}
                    >
                      {officePackControl.options.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.slug} · {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={() => {
                    onOpenAgentStatus();
                    onCloseMobileHeaderMenu();
                  }}
                >
                  <Activity size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  {agentStatusLabel}
                </button>
                <button
                  onClick={() => {
                    onOpenReportHistory();
                    onCloseMobileHeaderMenu();
                  }}
                >
                  <FileText size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  {reportLabel}
                </button>
                <button
                  onClick={() => {
                    onOpenRoomManager();
                    onCloseMobileHeaderMenu();
                  }}
                >
                  <LayoutGrid size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  {roomManagerLabel}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="app-topbar-status">
          <span className={connected ? "connected" : "disconnected"} />
          <span className="app-topbar-label">{connected ? "Canlı" : "Çevrimdışı"}</span>
        </div>
      </div>
    </header>
  );
}
