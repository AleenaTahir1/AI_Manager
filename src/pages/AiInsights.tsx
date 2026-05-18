import { useState } from "react";
import { Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { Badge, Button, Card, Empty } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { ipc, type ProcessRow } from "../lib/ipc";
import { formatBytes, formatPercent } from "../lib/format";
import type { StoredSettings } from "../lib/store";

export function AiInsights(props: {
  settings: StoredSettings;
  selectedProcess: ProcessRow | null;
  processes: ProcessRow[];
  cpuTotal: number;
  memUsed: number;
  memTotal: number;
}) {
  const [procAnswer, setProcAnswer] = useState<string | null>(null);
  const [sysAnswer, setSysAnswer] = useState<string | null>(null);
  const [procLoading, setProcLoading] = useState(false);
  const [sysLoading, setSysLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const hasKey = (props.settings.api_key ?? "").length > 0;

  const explainProcess = async () => {
    if (!props.selectedProcess) return;
    setProcLoading(true);
    setError(null);
    try {
      const proc = props.selectedProcess;
      const reply = await ipc.explainProcess(
        {
          api_key: props.settings.api_key,
          model: props.settings.model,
          base_url: props.settings.base_url,
        },
        {
          name: proc.name,
          exe: proc.exe,
          cmd: proc.exe,
          parent_name: null,
          mem_bytes: proc.mem_bytes,
          cpu: proc.cpu,
          threat: proc.threat,
        }
      );
      setProcAnswer(reply.answer);
      setCached(reply.cached);
    } catch (e) {
      setError(String(e));
    } finally {
      setProcLoading(false);
    }
  };

  const explainSystem = async () => {
    setSysLoading(true);
    setError(null);
    try {
      const top = [...props.processes]
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 8)
        .map((p) => ({ name: p.name, cpu: p.cpu, mem_bytes: p.mem_bytes }));
      const reply = await ipc.explainSystem(
        {
          api_key: props.settings.api_key,
          model: props.settings.model,
          base_url: props.settings.base_url,
        },
        {
          cpu_total: props.cpuTotal,
          mem_used: props.memUsed,
          mem_total: props.memTotal,
          top_processes: top,
        }
      );
      setSysAnswer(reply.answer);
    } catch (e) {
      setError(String(e));
    } finally {
      setSysLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI Insights"
        subtitle="Ask why something is happening on your machine. Uses OpenRouter — your API key stays local."
      />
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-auto px-6 py-4">
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-medium text-[var(--color-fg-strong)]">
                Why is this process running?
              </h2>
            </div>
            {cached ? <Badge tone="accent">cached</Badge> : null}
          </div>
          {props.selectedProcess ? (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs">
              <div className="font-medium text-[var(--color-fg-strong)]">
                {props.selectedProcess.name}
              </div>
              <div className="text-[11px] text-[var(--color-muted)]">
                PID {props.selectedProcess.pid} ·{" "}
                {formatPercent(props.selectedProcess.cpu)} CPU ·{" "}
                {formatBytes(props.selectedProcess.mem_bytes)}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-3 text-xs text-[var(--color-muted)]">
              Select a process from the Processes tab and click "Ask AI" to
              prefill it here.
            </div>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={explainProcess}
            disabled={!hasKey || !props.selectedProcess || procLoading}
          >
            {procLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Explain
          </Button>
          <AnswerBox text={procAnswer} placeholder="The answer will appear here." />
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[var(--color-warn)]" />
            <h2 className="text-sm font-medium text-[var(--color-fg-strong)]">
              Why is my system slow?
            </h2>
          </div>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)]">
            We send your top processes and current CPU / RAM totals — no
            personal data leaves the device.
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={explainSystem}
            disabled={!hasKey || sysLoading}
          >
            {sysLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Diagnose
          </Button>
          <AnswerBox text={sysAnswer} placeholder="Suggestions will appear here." />
        </Card>

        {!hasKey ? (
          <Card className="col-span-2 border-[var(--color-warn)] p-4">
            <div className="text-sm text-[var(--color-warn)]">
              Add your OpenRouter API key in Settings to enable AI features.
            </div>
          </Card>
        ) : null}

        {error ? (
          <Card className="col-span-2 border-[var(--color-danger)] p-4">
            <div className="text-sm text-[var(--color-danger)]">{error}</div>
          </Card>
        ) : null}

        {!procAnswer && !sysAnswer && !error ? (
          <div className="col-span-2">
            <Empty
              icon={Sparkles}
              title="Privacy by default"
              description="Requests use OpenRouter with your own key. Responses are cached locally by process signature."
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

function AnswerBox({
  text,
  placeholder,
}: {
  text: string | null;
  placeholder: string;
}) {
  return (
    <div className="min-h-[140px] flex-1 whitespace-pre-wrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm leading-relaxed text-[var(--color-fg)]">
      {text ?? <span className="text-[var(--color-muted)]">{placeholder}</span>}
    </div>
  );
}
