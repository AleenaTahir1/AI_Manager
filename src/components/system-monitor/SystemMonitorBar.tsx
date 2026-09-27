import React, { useEffect, useState } from "react";
import { CpuCoreGraph } from "./CpuCoreGraph";
import { RamGraph } from "./RamGraph";
import { NetworkSpeed } from "./NetworkSpeed";
import { ipc, type SystemMonitorMetrics } from "../../lib/ipc";

export interface SystemMonitorBarProps {
  metrics?: SystemMonitorMetrics | null;
  showCpu?: boolean;
  showRam?: boolean;
  showNetwork?: boolean;
  intervalMs?: number;
  isOverlay?: boolean;
}

export const SystemMonitorBar: React.FC<SystemMonitorBarProps> = ({
  metrics: externalMetrics,
  showCpu = true,
  showRam = true,
  showNetwork = true,
  intervalMs = 1000,
  isOverlay = false,
}) => {
  const [internalMetrics, setInternalMetrics] = useState<SystemMonitorMetrics | null>(null);

  useEffect(() => {
    if (externalMetrics) return; // controlled mode

    let isMounted = true;
    const fetchMetrics = async () => {
      try {
        const data = await ipc.systemMonitorMetrics();
        if (isMounted) setInternalMetrics(data);
      } catch (err) {
        console.warn("SystemMonitorBar metrics poll error:", err);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, Math.max(500, intervalMs));
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [externalMetrics, intervalMs]);
  const data = externalMetrics ?? internalMetrics;

  const cpuCores = data?.cpu_cores ?? [0, 0, 0, 0];
  const ramPercent = data?.ram_percent ?? 0;
  const ramHistory = data?.ram_history ?? [];
  const netRx = data?.net_rx_bps ?? 0;
  const netTx = data?.net_tx_bps ?? 0;

  return (
    <div
      className={`inline-flex items-center px-1 py-0 select-none bg-transparent border-0 outline-none h-[40px] ${
        isOverlay ? "pointer-events-none" : ""
      }`}
    >
      {/* CPU Core Graph (Wider bars, 36px height) */}
      {showCpu && (
        <div className="flex items-center h-full">
          <CpuCoreGraph cores={cpuCores} height={36} />
        </div>
      )}

      {/* RAM 48px Graph (Graph only, no text/%, 36px height) */}
      {showRam && (
        <div className="flex items-center h-full ml-1">
          <RamGraph ramPercent={ramPercent} history={ramHistory} height={36} />
        </div>
      )}

      {/* Network Speed (Upload top, Download bottom, 11px white text, 36px height) */}
      {showNetwork && (
        <div className="flex items-center h-full ml-3">
          <NetworkSpeed uploadBps={netTx} downloadBps={netRx} height={36} />
        </div>
      )}
    </div>
  );
};
