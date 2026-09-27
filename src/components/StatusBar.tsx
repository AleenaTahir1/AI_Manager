import React, { useEffect, useState } from "react";
import { Activity, Clock, Cpu, HardDrive, RefreshCw } from "lucide-react";
import { type Route } from "./Shell";

interface StatusBarProps {
  currentRoute: Route;
  procCount: number;
  cpuPct: number;
  memPct: number;
  refreshHz: number;
}

const ROUTE_LABELS: Record<Route, string> = {
  dashboard: "Dashboard",
  processes: "Processes",
  performance: "Performance",
  history: "Historical Metrics",
  startup: "Startup Apps",
  services: "Windows Services",
  ai: "AI Insights",
  settings: "Settings",
};

export const StatusBar: React.FC<StatusBarProps> = ({
  currentRoute,
  procCount,
  cpuPct,
  memPct,
  refreshHz,
}) => {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="h-6 w-full bg-[var(--color-surface)] border-t border-[var(--color-border)] select-none flex items-center justify-between px-3 text-[10px] text-[var(--color-muted)] font-mono z-40">
      {/* Left side: Status dot + route */}
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
        <span className="text-[var(--color-fg)] font-sans font-medium">
          {ROUTE_LABELS[currentRoute] ?? currentRoute}
        </span>
      </div>

      {/* Right side: Telemetry chips */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-[var(--color-muted)]" />
          <span>{procCount} procs</span>
        </div>

        <div className="w-[1px] h-2.5 bg-[var(--color-border)]" />

        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-[var(--color-accent)]" />
          <span className="text-numeric">CPU {Math.round(cpuPct)}%</span>
        </div>

        <div className="w-[1px] h-2.5 bg-[var(--color-border)]" />

        <div className="flex items-center gap-1">
          <HardDrive className="w-3 h-3 text-[var(--color-warn)]" />
          <span className="text-numeric">RAM {Math.round(memPct)}%</span>
        </div>

        <div className="w-[1px] h-2.5 bg-[var(--color-border)]" />

        <div className="flex items-center gap-1">
          <RefreshCw className="w-2.5 h-2.5 text-[var(--color-muted)]" />
          <span className="text-numeric">{refreshHz}Hz</span>
        </div>

        <div className="w-[1px] h-2.5 bg-[var(--color-border)]" />

        <div className="flex items-center gap-1 text-[var(--color-fg-strong)]">
          <Clock className="w-2.5 h-2.5 text-[var(--color-muted)]" />
          <span className="text-numeric">{timeStr}</span>
        </div>
      </div>
    </footer>
  );
};
