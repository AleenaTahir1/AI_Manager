import { useMemo } from "react";
import { Activity, Cpu, HardDrive, MemoryStick, Network } from "lucide-react";
import { Card } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { Sparkline } from "../components/Sparkline";
import { formatBytes, formatPercent, formatRate } from "../lib/format";
import type { MetricSample, SystemSnapshot } from "../lib/ipc";

export function Performance(props: {
  history: MetricSample[];
  snapshot: SystemSnapshot | null;
}) {
  const cpuSeries = useMemo(
    () => props.history.map((s) => s.cpu_total),
    [props.history]
  );
  const memSeries = useMemo(
    () =>
      props.history.map((s) =>
        s.mem_total > 0 ? (s.mem_used / s.mem_total) * 100 : 0
      ),
    [props.history]
  );
  const diskSeries = useMemo(
    () => props.history.map((s) => s.disk_read_bps + s.disk_write_bps),
    [props.history]
  );
  const netSeries = useMemo(
    () => props.history.map((s) => s.net_rx_bps + s.net_tx_bps),
    [props.history]
  );

  const last = props.history.at(-1);
  const memPct = last && last.mem_total > 0 ? (last.mem_used / last.mem_total) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Performance"
        subtitle="60-second rolling view — CPU, memory, disk and network."
      />
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-auto px-6 py-4">
        <PerfCard
          title="CPU"
          icon={Cpu}
          primary={formatPercent(last?.cpu_total ?? 0)}
          secondary={
            props.snapshot
              ? `${props.snapshot.cpu_cores} cores · ${props.snapshot.cpu_brand ?? "—"}`
              : "—"
          }
          series={cpuSeries}
          max={100}
          color="var(--color-accent)"
        />
        <PerfCard
          title="Memory"
          icon={MemoryStick}
          primary={formatPercent(memPct)}
          secondary={
            last
              ? `${formatBytes(last.mem_used)} of ${formatBytes(last.mem_total)}`
              : "—"
          }
          series={memSeries}
          max={100}
          color="#a78bfa"
        />
        <PerfCard
          title="Disk"
          icon={HardDrive}
          primary={formatRate(
            (last?.disk_read_bps ?? 0) + (last?.disk_write_bps ?? 0)
          )}
          secondary={
            last
              ? `R ${formatRate(last.disk_read_bps)} · W ${formatRate(last.disk_write_bps)}`
              : "—"
          }
          series={diskSeries}
          color="#f5b461"
        />
        <PerfCard
          title="Network"
          icon={Network}
          primary={formatRate(
            (last?.net_rx_bps ?? 0) + (last?.net_tx_bps ?? 0)
          )}
          secondary={
            last
              ? `In ${formatRate(last.net_rx_bps)} · Out ${formatRate(last.net_tx_bps)}`
              : "—"
          }
          series={netSeries}
          color="#4ade80"
        />

        <Card className="col-span-2 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--color-fg-strong)]">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" />
            Per-core utilisation
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {(last?.per_core ?? []).map((v, i) => (
              <div
                key={i}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"
              >
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                  <span>Core {i}</span>
                  <span className="text-numeric text-[var(--color-fg-strong)]">
                    {formatPercent(v, 0)}
                  </span>
                </div>
                <Sparkline
                  data={props.history.map((s) => s.per_core[i] ?? 0)}
                  max={100}
                  height={28}
                  color="var(--color-accent)"
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function PerfCard(props: {
  title: string;
  icon: typeof Cpu;
  primary: string;
  secondary: string;
  series: number[];
  max?: number;
  color: string;
}) {
  const Icon = props.icon;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--color-muted)]" />
          <span className="text-sm font-medium text-[var(--color-fg-strong)]">
            {props.title}
          </span>
        </div>
        <div className="text-numeric text-base font-semibold text-[var(--color-fg-strong)]">
          {props.primary}
        </div>
      </div>
      <Sparkline
        data={props.series}
        max={props.max}
        color={props.color}
        height={88}
      />
      <div className="text-xs text-[var(--color-muted)]">{props.secondary}</div>
    </Card>
  );
}
