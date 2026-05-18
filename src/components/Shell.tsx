import {
  Activity,
  Cog,
  LayoutDashboard,
  Power,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import type { Route } from "../App";
import { Logo } from "./Logo";

const NAV: Array<{ key: Route; label: string; icon: typeof Activity }> = [
  { key: "processes", label: "Processes", icon: Activity },
  { key: "performance", label: "Performance", icon: LayoutDashboard },
  { key: "startup", label: "Startup", icon: Power },
  { key: "services", label: "Services", icon: Cog },
  { key: "ai", label: "AI Insights", icon: Sparkles },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export function Shell(props: {
  route: Route;
  onNavigate: (r: Route) => void;
  cpuPct: number;
  memPct: number;
  procCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="grid h-screen w-screen grid-cols-[224px_1fr] bg-[var(--color-bg)] text-[var(--color-fg)]">
      <aside className="flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="drag-region flex items-center gap-2.5 px-5 py-4">
          <Logo size={28} className="shrink-0 rounded-md shadow-[0_0_0_1px_var(--color-border)]" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-[var(--color-fg-strong)]">
              AI Task Manager
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Windows · v0.1
            </div>
          </div>
        </div>

        <nav className="mt-3 flex flex-col gap-0.5 px-2">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = key === props.route;
            const isAi = key === "ai";
            const activeIconColor = isAi
              ? "text-[var(--color-amber)]"
              : "text-[var(--color-accent)]";
            return (
              <button
                key={key}
                className={clsx(
                  "no-drag group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
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
                  className={clsx("h-4 w-4", active ? activeIconColor : "")}
                  strokeWidth={2}
                />
                <span className="font-medium">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--color-border)] px-5 py-4">
          <MiniStat label="CPU" value={`${props.cpuPct.toFixed(0)}%`} />
          <MiniStat label="Memory" value={`${props.memPct.toFixed(0)}%`} />
          <MiniStat label="Processes" value={props.procCount.toString()} />
        </div>
      </aside>

      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        {props.children}
      </main>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-numeric font-medium text-[var(--color-fg-strong)]">
        {value}
      </span>
    </div>
  );
}
