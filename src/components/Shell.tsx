import React from "react";
import {
  Activity,
  Clock,
  Cog,
  LayoutDashboard,
  Power,
  Settings as SettingsIcon,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";
import { TitleBar } from "./TitleBar";
import { StatusBar } from "./StatusBar";
import type { Route } from "../App";

export { type Route };

const NAV: Array<{ key: Route; label: string; icon: typeof Activity }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "processes", label: "Processes", icon: Activity },
  { key: "performance", label: "Performance", icon: TrendingUp },
  { key: "history", label: "History", icon: Clock },
  { key: "startup", label: "Startup", icon: Power },
  { key: "services", label: "Services", icon: Cog },
  { key: "ai", label: "AI Insights", icon: Sparkles },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export interface ShellProps {
  route: Route;
  onNavigate: (r: Route) => void;
  cpuPct: number;
  memPct: number;
  procCount: number;
  refreshHz: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  children: React.ReactNode;
}

export function Shell(props: ShellProps) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Custom Frameless Titlebar */}
      <TitleBar
        sidebarCollapsed={props.sidebarCollapsed}
        onToggleSidebar={props.onToggleSidebar}
        theme={props.theme}
        onToggleTheme={props.onToggleTheme}
      />

      {/* Main Workspace: Collapsible Sidebar + Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside
          className={clsx(
            "flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 ease-in-out shrink-0",
            props.sidebarCollapsed ? "w-12" : "w-56"
          )}
        >
          <nav className="mt-2 flex flex-col gap-0.5 px-1.5">
            {NAV.map(({ key, label, icon: Icon }) => {
              const active = key === props.route;
              const isAi = key === "ai";
              const activeIconColor = isAi
                ? "text-[var(--color-amber)]"
                : "text-[var(--color-accent)]";

              return (
                <button
                  key={key}
                  title={label}
                  className={clsx(
                    "no-drag group relative flex items-center rounded-md py-2 text-sm transition-colors",
                    props.sidebarCollapsed
                      ? "justify-center px-0 w-full h-9"
                      : "gap-3 px-3 w-full",
                    active
                      ? "bg-[var(--color-surface-2)] text-[var(--color-fg-strong)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                  )}
                  onClick={() => props.onNavigate(key)}
                >
                  {active ? (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                      style={{
                        background: isAi
                          ? "var(--color-amber)"
                          : "var(--color-accent)",
                      }}
                    />
                  ) : null}
                  <Icon
                    className={clsx("h-4 w-4 shrink-0", active ? activeIconColor : "")}
                    strokeWidth={2}
                  />
                  {!props.sidebarCollapsed && (
                    <span className="font-medium truncate text-left">{label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {!props.sidebarCollapsed && (
            <div className="mt-auto border-t border-[var(--color-border)] px-4 py-3">
              <MiniStat label="CPU" value={`${props.cpuPct.toFixed(0)}%`} />
              <MiniStat label="Memory" value={`${props.memPct.toFixed(0)}%`} />
              <MiniStat label="Processes" value={props.procCount.toString()} />
            </div>
          )}
        </aside>

        <main className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-[var(--color-bg)]">
          {props.children}
        </main>
      </div>

      {/* Bottom Telemetry Status Bar */}
      <StatusBar
        currentRoute={props.route}
        procCount={props.procCount}
        cpuPct={props.cpuPct}
        memPct={props.memPct}
        refreshHz={props.refreshHz}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-numeric font-medium text-[var(--color-fg-strong)]">
        {value}
      </span>
    </div>
  );
}
