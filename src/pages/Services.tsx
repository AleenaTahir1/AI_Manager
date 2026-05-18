import { useEffect, useMemo, useState } from "react";
import { Cog, Pause, Play, RefreshCw, Search } from "lucide-react";
import { Badge, Button, Card, Empty, Input } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { ipc, type ServiceRow } from "../lib/ipc";

export function Services() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await ipc.listServices();
      setServices(rows);
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
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.display_name.toLowerCase().includes(q)
    );
  }, [services, query]);

  return (
    <>
      <PageHeader
        title="Services"
        subtitle={`${services.length} services on this machine.`}
        right={
          <>
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                placeholder="Search by name or display name"
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
            icon={Cog}
            title={loading ? "Loading services…" : "No services found"}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_110px_110px_130px] items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              <span>Service</span>
              <span>Status</span>
              <span>Startup</span>
              <span className="text-right">Actions</span>
            </div>
            {filtered.map((s) => {
              const running = s.status === "Running";
              return (
                <div
                  key={s.name}
                  className="grid grid-cols-[1fr_110px_110px_130px] items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--color-fg-strong)]">
                      {s.display_name}
                    </div>
                    <div className="truncate font-mono text-[11px] text-[var(--color-muted)]">
                      {s.name}
                      {s.pid != null ? ` · pid ${s.pid}` : ""}
                    </div>
                  </div>
                  <div>
                    <Badge tone={running ? "green" : "neutral"}>{s.status}</Badge>
                  </div>
                  <div>
                    <Badge tone={s.start_type === "Disabled" ? "red" : "neutral"}>
                      {s.start_type}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await ipc.setServiceState(
                            s.name,
                            running ? "stop" : "start"
                          );
                          await load();
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      {running ? (
                        <>
                          <Pause className="h-3.5 w-3.5" /> Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" /> Start
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </>
  );
}
