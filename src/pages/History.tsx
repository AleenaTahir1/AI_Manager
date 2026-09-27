import { useEffect, useState } from "react";
import { Clock, Cpu, HardDrive, MemoryStick, Network } from "lucide-react";
import { Card } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { formatPercent, formatRate } from "../lib/format";
import { ipc, type MetricRange, type MetricSample } from "../lib/ipc";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const RANGES: Array<{ key: MetricRange; label: string }> = [
  { key: "1h", label: "Last Hour" },
  { key: "24h", label: "Last 24 Hours" },
  { key: "7d", label: "Last 7 Days" },
];

export function History() {
  const [range, setRange] = useState<MetricRange>("1h");
  const [data, setData] = useState<MetricSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ipc
      .queryMetricHistory(range)
      .then((samples) => {
        if (!cancelled) setData(samples);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  // Format x-axis timestamps based on selected range
  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    if (range === "1h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const cpuData = data.map((s) => ({ ts: s.ts_ms, v: s.cpu_total }));
  const memData = data.map((s) => ({
    ts: s.ts_ms,
    v: s.mem_total > 0 ? (s.mem_used / s.mem_total) * 100 : 0,
    used: s.mem_used,
    total: s.mem_total,
  }));
  const diskData = data.map((s) => ({
    ts: s.ts_ms,
    v: s.disk_read_bps + s.disk_write_bps,
  }));
  const netData = data.map((s) => ({
    ts: s.ts_ms,
    v: s.net_rx_bps + s.net_tx_bps,
  }));

  return (
    <>
      <PageHeader
        title="History"
        subtitle="Historical system performance — stored locally in SQLite, retained for 7 days."
        right={
          <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
                  (range === r.key
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)]")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {error ? (
          <div className="rounded-lg border border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-4 text-sm text-[var(--color-danger)]">
            {error}
            {error.includes("DB query") && data.length === 0 ? (
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                No historical data yet — the database populates after 5 seconds of uptime.
              </p>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-[var(--color-muted)]">
            Loading {range} of data…
          </div>
        ) : data.length === 0 && !error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-[var(--color-muted)]">
            <Clock className="h-8 w-8 opacity-30" />
            <span>No historical data for this range yet.</span>
            <span className="text-xs">Samples are stored every 5 seconds. Check back shortly.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <HistoryCard
              title="CPU Usage"
              icon={Cpu}
              color="var(--color-accent)"
              data={cpuData}
              formatValue={(v) => formatPercent(v)}
              fmtTime={fmtTime}
              domain={[0, 100]}
            />
            <HistoryCard
              title="Memory Usage"
              icon={MemoryStick}
              color="#a78bfa"
              data={memData}
              formatValue={(v) => formatPercent(v)}
              fmtTime={fmtTime}
              domain={[0, 100]}
            />
            <HistoryCard
              title="Disk I/O"
              icon={HardDrive}
              color="var(--color-warn)"
              data={diskData}
              formatValue={(v) => formatRate(v)}
              fmtTime={fmtTime}
            />
            <HistoryCard
              title="Network I/O"
              icon={Network}
              color="var(--color-success)"
              data={netData}
              formatValue={(v) => formatRate(v)}
              fmtTime={fmtTime}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── HistoryCard ──────────────────────────────────────────────────────────────

function HistoryCard(props: {
  title: string;
  icon: typeof Cpu;
  color: string;
  data: Array<{ ts: number; v: number }>;
  formatValue: (v: number) => string;
  fmtTime: (ts: number) => string;
  domain?: [number, number];
}) {
  const Icon = props.icon;
  const last = props.data.at(-1);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: props.color }} />
          <span className="text-sm font-medium text-[var(--color-fg-strong)]">
            {props.title}
          </span>
        </div>
        {last ? (
          <span
            className="text-numeric text-base font-bold"
            style={{ color: props.color }}
          >
            {props.formatValue(last.v)}
          </span>
        ) : null}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart
          data={props.data}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`grad-${props.title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={props.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={props.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="ts"
            tickFormatter={props.fmtTime}
            tick={{ fill: "var(--color-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={props.domain ?? ["auto", "auto"]}
            tick={{ fill: "var(--color-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => props.formatValue(v)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              fontSize: "12px",
              color: "var(--color-fg)",
            }}
            labelFormatter={(ts: number) => new Date(ts).toLocaleString()}
            formatter={(v: number) => [props.formatValue(v), props.title]}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={props.color}
            strokeWidth={1.5}
            fill={`url(#grad-${props.title})`}
            dot={false}
            activeDot={{ r: 3, fill: props.color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
