import { useMemo } from "react";
import {
  AlertTriangle,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge, Card, ProgressBar } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { Sparkline } from "../components/Sparkline";
import { formatBytes, formatPercent, formatRate } from "../lib/format";
import type { MetricSample, ProcessRow, SystemSnapshot } from "../lib/ipc";

export function Dashboard(props: {
  processes: ProcessRow[];
  snapshot: SystemSnapshot | null;
  history: MetricSample[];
  onNavigate: (route: string) => void;
}) {
  const { processes, snapshot, history } = props;
  const last = history.at(-1);

  const cpuPct = last?.cpu_total ?? snapshot?.cpu_total ?? 0;
  const memPct =
    last && last.mem_total > 0
       ? (last.mem_used / last.mem_total) * 100
       : snapshot && snapshot.mem_total > 0
       ? (snapshot.mem_used / snapshot.mem_total) * 100
       : 0;
  const memUsed = last?.mem_used ?? snapshot?.mem_used ?? 0;
  const memTotal = last?.mem_total ?? snapshot?.mem_total ?? 1;

  const cpuSeries = useMemo(() => history.map((s) => s.cpu_total), [history]);
  const memSeries = useMemo(
    () => history.map((s) => (s.mem_total > 0 ? (s.mem_used / s.mem_total) * 100 : 0)),
    [history]
  );
  const diskSeries = useMemo(
    () => history.map((s) => s.disk_read_bps + s.disk_write_bps),
    [history]
  );
  const netSeries = useMemo(
    () => history.map((s) => s.net_rx_bps + s.net_tx_bps),
    [history]
  );

  const topCpu = useMemo(
    () => [...processes].sort((a, b) => b.cpu - a.cpu).slice(0, 5),
    [processes]
  );
  const topMem = useMemo(
    () => [...processes].sort((a, b) => b.mem_bytes - a.mem_bytes).slice(0, 5),
    [processes]
  );
  const alerts = useMemo(
    () => processes.filter((p) => p.threat === "red").slice(0, 8),
    [processes]
  );

  const cpuTone =
    cpuPct > 85 ? "danger" : cpuPct > 60 ? "warn" : "accent";
  const memTone =
    memPct > 85 ? "danger" : memPct > 70 ? "warn" : "accent";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${processes.length} processes · ${snapshot?.host_name ?? "—"} · ${snapshot?.os_name ?? "Windows"}`}
        right={
          snapshot ? (
            <span className="text-xs text-[var(--color-muted)]">
              {snapshot.cpu_brand ?? ""} · {snapshot.cpu_cores} cores
            </span>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <div className="grid grid-cols-4 gap-4">

          {/* ── CPU Summary ── */}
          <SummaryCard
            title="CPU"
            icon={Cpu}
            iconColor="var(--color-accent)"
            value={formatPercent(cpuPct)}
            sub={`${snapshot?.cpu_cores ?? 0} cores`}
            pct={cpuPct}
            tone={cpuTone}
            series={cpuSeries}
            seriesColor="var(--color-accent)"
          />

          {/* ── Memory Summary ── */}
          <SummaryCard
            title="Memory"
            icon={MemoryStick}
            iconColor="#a78bfa"
            value={formatPercent(memPct)}
            sub={`${formatBytes(memUsed)} / ${formatBytes(memTotal)}`}
            pct={memPct}
            tone={memTone}
            series={memSeries}
            seriesColor="#a78bfa"
          />

          {/* ── Disk Summary ── */}
          <SummaryCard
            title="Disk I/O"
            icon={HardDrive}
            iconColor="var(--color-warn)"
            value={formatRate((last?.disk_read_bps ?? 0) + (last?.disk_write_bps ?? 0))}
            sub={last ? `R ${formatRate(last.disk_read_bps)} · W ${formatRate(last.disk_write_bps)}` : "—"}
            series={diskSeries}
            seriesColor="var(--color-warn)"
          />

          {/* ── Network Summary ── */}
          <SummaryCard
            title="Network"
            icon={Network}
            iconColor="var(--color-success)"
            value={formatRate((last?.net_rx_bps ?? 0) + (last?.net_tx_bps ?? 0))}
            sub={last ? `↓ ${formatRate(last.net_rx_bps)} · ↑ ${formatRate(last.net_tx_bps)}` : "—"}
            series={netSeries}
            seriesColor="var(--color-success)"
          />

          {/* ── Top CPU Processes ── */}
          <Card className="col-span-2 p-4">
            <SectionHeader icon={Cpu} label="Top CPU Processes" color="var(--color-accent)" />
            <ProcessMiniTable rows={topCpu} metric="cpu" />
          </Card>

          {/* ── Top Memory Processes ── */}
          <Card className="col-span-2 p-4">
            <SectionHeader icon={MemoryStick} label="Top Memory Processes" color="#a78bfa" />
            <ProcessMiniTable rows={topMem} metric="mem" />
          </Card>

          {/* ── Recent Alerts ── */}
          <Card className="col-span-2 p-4">
            <SectionHeader icon={ShieldAlert} label="Security Alerts" color="var(--color-danger)" />
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-success)]">
                <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
                No suspicious processes detected
              </div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {alerts.map((p) => (
                  <div
                    key={p.pid}
                    className="flex items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-2.5 py-1.5"
                  >
                    <AlertTriangle className="h-3 w-3 shrink-0 text-[var(--color-danger)]" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-fg-strong)]">
                      {p.name}
                    </span>
                    <span className="text-numeric text-[11px] text-[var(--color-muted)]">
                      PID {p.pid}
                    </span>
                    {p.risk_reasons && p.risk_reasons.length > 0 ? (
                      <span className="max-w-[160px] truncate text-[10px] text-[var(--color-danger)]">
                        {p.risk_reasons[0]}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── AI System Health ── */}
          <Card className="col-span-2 flex flex-col gap-3 p-4">
            <SectionHeader icon={Sparkles} label="AI Health Summary" color="var(--color-amber)" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Process count" value={processes.length.toString()} />
                <MiniStat label="Alerts" value={alerts.length.toString()} />
                <MiniStat label="Uptime" value={formatUptime(snapshot?.uptime_s ?? 0)} />
                <MiniStat label="Kernel" value={snapshot?.kernel ?? "—"} />
              </div>
              <button
                onClick={() => props.onNavigate("ai")}
                className="mt-auto flex items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--color-amber)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-amber)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--color-amber)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-amber)_18%,transparent)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask AI to diagnose current performance →
              </button>
            </div>
          </Card>

          {/* ── System Info Banner ── */}
          {snapshot && (
            <Card className="col-span-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <InfoChip label="Host" value={snapshot.host_name ?? "—"} />
              <InfoChip label="OS" value={snapshot.os_name ?? "—"} />
              <InfoChip label="Kernel" value={snapshot.kernel ?? "—"} />
              <InfoChip label="CPU" value={snapshot.cpu_brand ?? "—"} />
              <InfoChip label="Cores" value={snapshot.cpu_cores.toString()} />
              <InfoChip
                label="RAM"
                value={`${formatBytes(snapshot.mem_used)} / ${formatBytes(snapshot.mem_total)}`}
              />
              <InfoChip label="Swap" value={`${formatBytes(snapshot.swap_used)} / ${formatBytes(snapshot.swap_total)}`} />
              <InfoChip label="Processes" value={snapshot.process_count.toString()} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard(props: {
  title: string;
  icon: typeof Cpu;
  iconColor: string;
  value: string;
  sub: string;
  pct?: number;
  tone?: "accent" | "warn" | "danger" | "success";
  series: number[];
  seriesColor: string;
}) {
  const Icon = props.icon;
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: props.iconColor }} />
          <span className="text-xs font-medium text-[var(--color-muted)]">
            {props.title}
          </span>
        </div>
        <span className="text-numeric text-base font-bold text-[var(--color-fg-strong)]">
          {props.value}
        </span>
      </div>
      <Sparkline data={props.series} color={props.seriesColor} height={48} max={props.title === "CPU" || props.title === "Memory" ? 100 : undefined} />
      {props.pct !== undefined ? (
        <ProgressBar value={props.pct} tone={props.tone ?? "accent"} />
      ) : null}
      <div className="text-[11px] text-[var(--color-muted)]">{props.sub}</div>
    </Card>
  );
}

function SectionHeader(props: {
  icon: typeof Cpu;
  label: string;
  color: string;
}) {
  const Icon = props.icon;
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5" style={{ color: props.color }} />
      <span className="text-xs font-semibold text-[var(--color-fg-strong)]">
        {props.label}
      </span>
    </div>
  );
}

function ProcessMiniTable(props: {
  rows: ProcessRow[];
  metric: "cpu" | "mem";
}) {
  return (
    <div className="space-y-1">
      {props.rows.map((p) => {
        const val =
          props.metric === "cpu"
            ? formatPercent(p.cpu)
            : formatBytes(p.mem_bytes);
        const pct =
          props.metric === "cpu"
            ? Math.min(p.cpu, 100)
            : 0; // mem % not available here without total
        const color =
          props.metric === "cpu" ? "var(--color-accent)" : "#a78bfa";
        return (
          <div key={p.pid} className="flex items-center gap-2 py-0.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-xs text-[var(--color-fg-strong)]">
                {p.name}
              </span>
              <Badge
                tone={
                  p.threat === "red"
                    ? "red"
                    : p.threat === "yellow"
                    ? "yellow"
                    : "green"
                }
              >
                {p.threat}
              </Badge>
            </div>
            <div className="flex w-24 items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: color,
                  }}
                />
              </div>
              <span
                className="text-numeric w-16 text-right text-[11px] font-medium text-[var(--color-fg-strong)]"
              >
                {val}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-numeric mt-0.5 truncate text-xs font-medium text-[var(--color-fg-strong)]">
        {value}
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-[var(--color-muted)]">{label}:</span>
      <span className="font-medium text-[var(--color-fg-strong)]">{value}</span>
    </div>
  );
}

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
