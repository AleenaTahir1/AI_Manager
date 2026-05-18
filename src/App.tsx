import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "./components/Shell";
import { Processes } from "./pages/Processes";
import { Performance } from "./pages/Performance";
import { Startup } from "./pages/Startup";
import { Services } from "./pages/Services";
import { AiInsights } from "./pages/AiInsights";
import { Settings } from "./pages/Settings";
import { ipc, type MetricSample, type ProcessRow, type SystemSnapshot } from "./lib/ipc";
import { loadSettings, type StoredSettings } from "./lib/store";

export type Route =
  | "processes"
  | "performance"
  | "startup"
  | "services"
  | "ai"
  | "settings";

export function App() {
  const [route, setRoute] = useState<Route>("processes");
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [history, setHistory] = useState<MetricSample[]>([]);
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [settings, setSettings] = useState<StoredSettings | null>(null);
  const [aiProcess, setAiProcess] = useState<ProcessRow | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [procs, hist, snap] = await Promise.all([
        ipc.listProcesses(),
        ipc.metricsHistory(),
        ipc.systemSnapshot(),
      ]);
      setProcesses(procs);
      setHistory(hist);
      setSnapshot(snap);
    } catch (e) {
      console.warn("refresh failed", e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!settings) return;
    const interval = Math.max(250, 1000 / settings.refresh_hz);
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(refresh, interval);
    return () => {
      if (timer.current != null) window.clearInterval(timer.current);
    };
  }, [settings, refresh]);

  if (!settings) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-[var(--color-bg)] text-sm text-[var(--color-muted)]">
        Loading…
      </div>
    );
  }

  const cpuPct = snapshot?.cpu_total ?? 0;
  const memPct =
    snapshot && snapshot.mem_total > 0
      ? (snapshot.mem_used / snapshot.mem_total) * 100
      : 0;

  const handleAskAi = (proc: ProcessRow) => {
    setAiProcess(proc);
    setRoute("ai");
  };

  return (
    <Shell
      route={route}
      onNavigate={setRoute}
      cpuPct={cpuPct}
      memPct={memPct}
      procCount={snapshot?.process_count ?? processes.length}
    >
      {route === "processes" ? (
        <Processes
          processes={processes}
          onAskAi={handleAskAi}
          refreshHz={settings.refresh_hz}
          onManualRefresh={refresh}
        />
      ) : null}
      {route === "performance" ? (
        <Performance history={history} snapshot={snapshot} />
      ) : null}
      {route === "startup" ? <Startup /> : null}
      {route === "services" ? <Services /> : null}
      {route === "ai" ? (
        <AiInsights
          settings={settings}
          selectedProcess={aiProcess}
          processes={processes}
          cpuTotal={snapshot?.cpu_total ?? 0}
          memUsed={snapshot?.mem_used ?? 0}
          memTotal={snapshot?.mem_total ?? 0}
        />
      ) : null}
      {route === "settings" ? (
        <Settings settings={settings} onChange={setSettings} />
      ) : null}
    </Shell>
  );
}
