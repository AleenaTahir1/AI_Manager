import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TreePine,
  X,
} from "lucide-react";
import { Badge, Button, Card, Empty, Input } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { RiskPanel } from "../components/RiskPanel";
import { ipc, type NetConnection, type ProcessDetail, type ProcessRow } from "../lib/ipc";
import { formatBytes, formatPercent, formatRate } from "../lib/format";

type SortKey = "cpu" | "mem_bytes" | "name" | "pid" | "disk";
type DetailTab = "overview" | "network";

// ── Process Tree helpers ──────────────────────────────────────────────────────

type TreeNode = {
  proc: ProcessRow;
  children: TreeNode[];
  depth: number;
};

function buildTree(processes: ProcessRow[]): TreeNode[] {
  const byPid = new Map<number, ProcessRow>(processes.map((p) => [p.pid, p]));
  const children = new Map<number, ProcessRow[]>();

  for (const p of processes) {
    if (p.parent_pid != null && byPid.has(p.parent_pid)) {
      const list = children.get(p.parent_pid) ?? [];
      list.push(p);
      children.set(p.parent_pid, list);
    }
  }

  const roots = processes.filter(
    (p) => p.parent_pid == null || !byPid.has(p.parent_pid)
  );

  function buildNode(proc: ProcessRow, depth: number): TreeNode {
    return {
      proc,
      children: (children.get(proc.pid) ?? []).map((c) => buildNode(c, depth + 1)),
      depth,
    };
  }

  return roots.map((r) => buildNode(r, 0));
}

function flattenTree(
  nodes: TreeNode[],
  expanded: Set<number>
): Array<{ proc: ProcessRow; depth: number; hasChildren: boolean }> {
  const result: Array<{ proc: ProcessRow; depth: number; hasChildren: boolean }> = [];
  function visit(node: TreeNode) {
    result.push({
      proc: node.proc,
      depth: node.depth,
      hasChildren: node.children.length > 0,
    });
    if (expanded.has(node.proc.pid)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }
  for (const root of nodes) {
    visit(root);
  }
  return result;
}

// ── Main component ────────────────────────────────────────────────────────────

export function Processes(props: {
  processes: ProcessRow[];
  onAskAi: (proc: ProcessRow) => void;
  refreshHz: number;
  onManualRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [detail, setDetail] = useState<ProcessDetail | null>(null);
  const [treeMode, setTreeMode] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [connections, setConnections] = useState<NetConnection[]>([]);
  const [netLoading, setNetLoading] = useState(false);

  // ── Flat-list mode (filtered + sorted) ──
  const filteredSorted = useMemo(() => {
    let q = query.trim().toLowerCase();
    let list = props.processes;
    if (q.length > 0) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.pid.toString().includes(q) ||
          (p.exe ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "cpu":
          av = a.cpu; bv = b.cpu; break;
        case "mem_bytes":
          av = a.mem_bytes; bv = b.mem_bytes; break;
        case "name":
          av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
        case "pid":
          av = a.pid; bv = b.pid; break;
        case "disk":
          av = a.disk_read_bps + a.disk_write_bps;
          bv = b.disk_read_bps + b.disk_write_bps;
          break;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [props.processes, query, sortKey, sortAsc]);

  // ── Tree mode ──
  const tree = useMemo(() => buildTree(props.processes), [props.processes]);
  const flatTree = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  const visibleRows = useMemo(() => {
    if (!treeMode) return filteredSorted.slice(0, 800);
    return null;
  }, [treeMode, filteredSorted]);

  // ── Detail loading ──
  useEffect(() => {
    if (selectedPid == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    ipc.processDetail(selectedPid).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => { cancelled = true; };
  }, [selectedPid]);

  // ── Network connections tab ──
  useEffect(() => {
    if (selectedPid == null || detailTab !== "network") {
      setConnections([]);
      return;
    }
    let cancelled = false;
    setNetLoading(true);
    ipc.listConnections(selectedPid).then((conns) => {
      if (!cancelled) {
        setConnections(conns);
        setNetLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setNetLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedPid, detailTab]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const selectedProc = useMemo(
    () => props.processes.find((p) => p.pid === selectedPid) ?? null,
    [props.processes, selectedPid]
  );

  const toggleExpand = (pid: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(props.processes.map((p) => p.pid)));
  const collapseAll = () => setExpanded(new Set());

  // ── Column grid class (shared between header and rows) ──
  const colGrid = "grid-cols-[1fr_72px_92px_104px_104px_84px_72px]";

  return (
    <>
      <PageHeader
        title="Processes"
        subtitle={`${props.processes.length} running · refreshing ${props.refreshHz}× / sec`}
        right={
          <>
            {!treeMode && (
              <div className="relative w-72">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
                <Input
                  placeholder="Search by name, pid, or path"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-7"
                />
              </div>
            )}
            <Button
              onClick={() => {
                setTreeMode(!treeMode);
                if (!treeMode) expandAll();
              }}
              variant={treeMode ? "primary" : "ghost"}
              size="sm"
            >
              <TreePine className="h-3.5 w-3.5" />
              {treeMode ? "Tree Mode" : "Tree Mode"}
            </Button>
            {treeMode && (
              <>
                <Button onClick={expandAll} variant="ghost" size="sm">
                  Expand All
                </Button>
                <Button onClick={collapseAll} variant="ghost" size="sm">
                  Collapse
                </Button>
              </>
            )}
            <Button onClick={props.onManualRefresh} variant="ghost" size="sm">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]">
        <section className="min-h-0 overflow-auto px-6 py-4">
          <Card className="overflow-hidden">
            {/* Table header */}
            <div className={`grid ${colGrid} items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]`}>
              <Header label="Process" active={!treeMode && sortKey === "name"} asc={sortAsc} onClick={() => !treeMode && toggleSort("name")} />
              <Header label="PID" active={!treeMode && sortKey === "pid"} asc={sortAsc} onClick={() => !treeMode && toggleSort("pid")} right />
              <Header label="CPU" active={!treeMode && sortKey === "cpu"} asc={sortAsc} onClick={() => !treeMode && toggleSort("cpu")} right />
              <Header label="Memory" active={!treeMode && sortKey === "mem_bytes"} asc={sortAsc} onClick={() => !treeMode && toggleSort("mem_bytes")} right />
              <Header label="Disk I/O" active={!treeMode && sortKey === "disk"} asc={sortAsc} onClick={() => !treeMode && toggleSort("disk")} right />
              <div className="text-right">Status</div>
              <div className="text-right">Trust</div>
            </div>

            {/* Table rows */}
            <div>
              {treeMode ? (
                // ── Tree mode ──
                flatTree.length === 0 ? (
                  <Empty title="No processes" icon={Search} />
                ) : (
                  flatTree.slice(0, 1000).map(({ proc: p, depth, hasChildren }) => {
                    const isSel = p.pid === selectedPid;
                    const isExp = expanded.has(p.pid);
                    return (
                      <button
                        key={p.pid}
                        onClick={() => setSelectedPid(p.pid)}
                        className={
                          `grid w-full ${colGrid} items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-left text-xs transition-colors ` +
                          (isSel ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-2)]")
                        }
                      >
                        <div className="flex min-w-0 items-center" style={{ paddingLeft: `${depth * 16}px` }}>
                          {hasChildren ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpand(p.pid); }}
                              className="mr-1 shrink-0 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                            >
                              {isExp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          ) : (
                            <span className="mr-1 h-3.5 w-3.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[var(--color-fg-strong)]">{p.name}</div>
                            {p.exe ? <div className="truncate text-[11px] text-[var(--color-muted)]">{p.exe}</div> : null}
                          </div>
                        </div>
                        <ProcessRowCells p={p} />
                      </button>
                    );
                  })
                )
              ) : (
                // ── Flat list mode ──
                (visibleRows ?? []).length === 0 ? (
                  <Empty title="No matching processes" icon={Search} />
                ) : (
                  (visibleRows ?? []).map((p) => {
                    const isSel = p.pid === selectedPid;
                    return (
                      <button
                        key={p.pid}
                        onClick={() => setSelectedPid(p.pid)}
                        className={
                          `grid w-full ${colGrid} items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-left text-xs transition-colors ` +
                          (isSel ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-2)]")
                        }
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[var(--color-fg-strong)]">{p.name}</div>
                          {p.exe ? <div className="truncate text-[11px] text-[var(--color-muted)]">{p.exe}</div> : null}
                        </div>
                        <ProcessRowCells p={p} />
                      </button>
                    );
                  })
                )
              )}
            </div>
          </Card>
        </section>

        {/* Detail panel */}
        <aside className="min-h-0 overflow-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          {selectedProc ? (
            <DetailPanel
              proc={selectedProc}
              detail={detail}
              tab={detailTab}
              onTabChange={(t) => setDetailTab(t)}
              connections={connections}
              netLoading={netLoading}
              onClear={() => setSelectedPid(null)}
              onKill={async () => {
                await ipc.killProcess(selectedProc.pid);
                setSelectedPid(null);
                props.onManualRefresh();
              }}
              onKillTree={async () => {
                await ipc.killProcessTree(selectedProc.pid);
                setSelectedPid(null);
                props.onManualRefresh();
              }}
              onAskAi={() => props.onAskAi(selectedProc)}
            />
          ) : (
            <Empty
              icon={ShieldAlert}
              title="Select a process"
              description="Click any row to see live detail, trust assessment, network connections, and ask the AI for a plain-English explanation."
            />
          )}
        </aside>
      </div>
    </>
  );
}

// ── Row cells (reused in both flat and tree modes) ────────────────────────────

function ProcessRowCells({ p }: { p: ProcessRow }) {
  return (
    <>
      <div className="text-numeric text-right text-[var(--color-muted)]">{p.pid}</div>
      <div className="text-numeric text-right text-[var(--color-fg-strong)]">{formatPercent(p.cpu)}</div>
      <div className="text-numeric text-right text-[var(--color-fg-strong)]">{formatBytes(p.mem_bytes)}</div>
      <div className="text-numeric text-right text-[var(--color-muted)]">{formatRate(p.disk_read_bps + p.disk_write_bps)}</div>
      <div className="text-right text-[var(--color-muted)]">{p.status}</div>
      <div className="flex justify-end">
        <Badge tone={p.threat === "red" ? "red" : p.threat === "yellow" ? "yellow" : "green"}>
          {p.threat}
        </Badge>
      </div>
    </>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ label, active, asc, onClick, right }: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 " +
        (right ? "justify-end" : "") +
        (active ? " text-[var(--color-fg-strong)]" : " text-[var(--color-muted)] hover:text-[var(--color-fg)]")
      }
    >
      <span>{label}</span>
      {active ? (asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
    </button>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel(props: {
  proc: ProcessRow;
  detail: ProcessDetail | null;
  tab: DetailTab;
  onTabChange: (t: DetailTab) => void;
  connections: NetConnection[];
  netLoading: boolean;
  onClear: () => void;
  onKill: () => void;
  onKillTree: () => void;
  onAskAi: () => void;
}) {
  const { proc, detail } = props;
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-[var(--color-fg-strong)]">{proc.name}</div>
          <div className="text-xs text-[var(--color-muted)]">PID {proc.pid}</div>
        </div>
        <Button onClick={props.onClear} variant="ghost" size="sm">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge tone={proc.threat === "red" ? "red" : proc.threat === "yellow" ? "yellow" : "green"}>
          Trust: {proc.threat}
        </Badge>
        <Badge tone="neutral">{proc.status}</Badge>
      </div>

      {/* Security Risk Panel */}
      <RiskPanel
        score={proc.risk_score}
        level={proc.threat as "green" | "yellow" | "red"}
        reasons={proc.risk_reasons}
      />

      {/* Detail tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
        {(["overview", "network"] as DetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => props.onTabChange(t)}
            className={
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium capitalize transition-colors " +
              (props.tab === t
                ? "bg-[var(--color-surface)] text-[var(--color-fg-strong)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg)]")
            }
          >
            {t === "network" ? <Network className="h-3 w-3" /> : null}
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {props.tab === "overview" ? (
        <OverviewTab proc={proc} detail={detail} />
      ) : (
        <NetworkTab connections={props.connections} loading={props.netLoading} />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="primary" size="sm" onClick={props.onAskAi}>
          <Sparkles className="h-3.5 w-3.5" />
          Ask AI
        </Button>
        <Button variant="danger" size="sm" onClick={props.onKill}>
          <ShieldAlert className="h-3.5 w-3.5" />
          End process
        </Button>
        <Button variant="danger" size="sm" onClick={props.onKillTree}>
          <TreePine className="h-3.5 w-3.5" />
          End tree
        </Button>
      </div>
    </div>
  );
}

function OverviewTab({ proc, detail }: { proc: ProcessRow; detail: ProcessDetail | null }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Metric label="CPU" value={formatPercent(proc.cpu)} />
        <Metric label="RAM" value={formatBytes(proc.mem_bytes)} />
        <Metric label="Virtual" value={formatBytes(proc.virt_bytes)} />
        <Metric label="Disk I/O" value={formatRate(proc.disk_read_bps + proc.disk_write_bps)} />
        <Metric label="Parent" value={proc.parent_pid != null ? proc.parent_pid.toString() : "—"} />
        <Metric label="User" value={proc.user ?? "—"} />
      </div>
      {proc.exe ? <Field label="Executable" value={proc.exe} mono /> : null}
      {detail?.cwd ? <Field label="Working directory" value={detail.cwd} mono /> : null}
      {detail?.cmd && detail.cmd.length > 0 ? <Field label="Command line" value={detail.cmd.join(" ")} mono /> : null}
    </>
  );
}

function NetworkTab({ connections, loading }: { connections: NetConnection[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-[var(--color-muted)]">
        Loading connections…
      </div>
    );
  }
  if (connections.length === 0) {
    return (
      <Empty
        icon={Network}
        title="No active connections"
        description="This process has no open TCP or UDP connections."
      />
    );
  }
  return (
    <div className="space-y-1.5">
      {connections.map((c, i) => (
        <div
          key={i}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2 text-[11px]"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge tone={c.protocol.startsWith("TCP") ? "accent" : "neutral"}>{c.protocol}</Badge>
            <Badge
              tone={
                c.state === "ESTABLISHED" ? "green"
                : c.state === "LISTEN" ? "accent"
                : c.state === "TIME_WAIT" ? "yellow"
                : "neutral"
              }
            >
              {c.state}
            </Badge>
          </div>
          <div className="mt-1.5 space-y-0.5">
            <div className="flex justify-between gap-2">
              <span className="text-[var(--color-muted)]">Local</span>
              <span className="font-mono text-[var(--color-fg-strong)]">{c.local_addr}</span>
            </div>
            {c.remote_addr !== "*:*" && (
              <div className="flex justify-between gap-2">
                <span className="text-[var(--color-muted)]">Remote</span>
                <span className="font-mono text-[var(--color-fg-strong)]">{c.remote_addr}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Metric & Field sub-components ─────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div className="text-numeric mt-0.5 text-sm font-medium text-[var(--color-fg-strong)]">{value}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div
        className={
          "mt-1 break-all rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2 text-xs text-[var(--color-fg-strong)] " +
          (mono ? "font-mono" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
