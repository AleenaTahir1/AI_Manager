import { useEffect, useMemo, useState } from "react";
import { Power, RefreshCw, Search } from "lucide-react";
import { Badge, Button, Card, Empty, Input } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { ipc, type StartupEntry } from "../lib/ipc";

export function Startup() {
  const [entries, setEntries] = useState<StartupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await ipc.listStartupEntries();
      setEntries(rows);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.command.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q)
    );
  }, [entries, query]);

  return (
    <>
      <PageHeader
        title="Startup"
        subtitle={`${entries.length} programs configured to launch at sign-in.`}
        right={
          <>
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                placeholder="Search startup entries"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-7"
              />
            </div>
            <Button onClick={load} variant="ghost" size="sm">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {error ? (
          <Card className="border-[var(--color-danger)] p-4 text-sm text-[var(--color-danger)]">
            {error}
          </Card>
        ) : filtered.length === 0 ? (
          <Empty
            icon={Power}
            title={loading ? "Loading…" : "No startup entries found"}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_84px_88px_120px] items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              <span>Name / Command</span>
              <span>Scope</span>
              <span>State</span>
              <span className="text-right">Actions</span>
            </div>
            {filtered.map((e, idx) => (
              <div
                key={`${e.scope}-${e.name}-${idx}`}
                className="grid grid-cols-[1fr_84px_88px_120px] items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--color-fg-strong)]">
                    {e.name}
                  </div>
                  <div className="truncate font-mono text-[11px] text-[var(--color-muted)]">
                    {e.command}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]">
                    {e.source}
                  </div>
                </div>
                <div>
                  <Badge tone="neutral">{e.scope}</Badge>
                </div>
                <div>
                  <Badge tone={e.enabled ? "green" : "neutral"}>
                    {e.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant={e.enabled ? "secondary" : "primary"}
                    onClick={async () => {
                      try {
                        await ipc.setStartupEnabled(e.name, e.scope, !e.enabled);
                        await load();
                      } catch (err) {
                        setError(String(err));
                      }
                    }}
                  >
                    {e.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
