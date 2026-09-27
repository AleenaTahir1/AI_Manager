import { useEffect, useState } from "react";
import { Check, ExternalLink, Save } from "lucide-react";
import { Button, Card, Input } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AiProvider, StoredSettings } from "../lib/store";
import { saveSettings } from "../lib/store";
import { ipc } from "../lib/ipc";
import { SystemMonitorBar } from "../components/system-monitor/SystemMonitorBar";

// ── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS: Array<{
  id: AiProvider;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyRequired: boolean;
  docsUrl: string;
  docsLabel: string;
}> = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.0-flash-001",
    keyLabel: "API key",
    keyPlaceholder: "sk-or-v1-…",
    keyRequired: true,
    docsUrl: "https://openrouter.ai/keys",
    docsLabel: "Get a key",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    keyLabel: "API key",
    keyPlaceholder: "sk-…",
    keyRequired: true,
    docsUrl: "https://platform.openai.com/api-keys",
    docsLabel: "Get a key",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-haiku-latest",
    keyLabel: "API key",
    keyPlaceholder: "sk-ant-…",
    keyRequired: true,
    docsUrl: "https://console.anthropic.com/settings/keys",
    docsLabel: "Get a key",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    keyLabel: "API key",
    keyPlaceholder: "AIzaSy…",
    keyRequired: true,
    docsUrl: "https://aistudio.google.com/app/apikey",
    docsLabel: "Get a key",
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    keyLabel: "API key (optional)",
    keyPlaceholder: "ollama",
    keyRequired: false,
    docsUrl: "https://ollama.com",
    docsLabel: "Download Ollama",
  },
  {
    id: "lmstudio",
    label: "LM Studio (Local)",
    defaultBaseUrl: "http://localhost:1234/v1",
    defaultModel: "local-model",
    keyLabel: "API key (optional)",
    keyPlaceholder: "lm-studio",
    keyRequired: false,
    docsUrl: "https://lmstudio.ai",
    docsLabel: "Download LM Studio",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function Settings(props: {
  settings: StoredSettings;
  onChange: (s: StoredSettings) => void;
}) {
  const [draft, setDraft] = useState<StoredSettings>(props.settings);
  const [saved, setSaved] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);

  useEffect(() => {
    setDraft(props.settings);
  }, [props.settings]);

  const update = <K extends keyof StoredSettings>(k: K, v: StoredSettings[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const updateAndSave = async <K extends keyof StoredSettings>(
    k: K,
    v: StoredSettings[K]
  ) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    await saveSettings(next);
    props.onChange(next);
  };

  const onSave = async () => {
    await saveSettings(draft);
    props.onChange(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const currentProvider = PROVIDERS.find((p) => p.id === draft.ai_provider) ?? PROVIDERS[0];

  const onProviderChange = (id: AiProvider) => {
    const p = PROVIDERS.find((pr) => pr.id === id) ?? PROVIDERS[0];
    setDraft((d) => ({
      ...d,
      ai_provider: id,
      base_url: p.defaultBaseUrl,
      model: p.defaultModel,
    }));
  };

  const onAutostartToggle = async (enabled: boolean) => {
    setAutostartBusy(true);
    try {
      await ipc.setAutostart(enabled);
      await updateAndSave("launch_at_startup", enabled);
    } catch (e) {
      console.error("autostart toggle failed", e);
    } finally {
      setAutostartBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure the AI provider, sampling, and system tray. All data stays on this device."
      />
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <div className="mx-auto max-w-2xl space-y-4">

          {/* ── AI Provider ── */}
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg-strong)]">
              AI Provider
            </h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Choose where AI queries are sent. Your API key stays local and is never shared.
            </p>

            <div className="space-y-3">
              <Field label="Provider">
                <select
                  value={draft.ai_provider}
                  onChange={(e) => onProviderChange(e.target.value as AiProvider)}
                  className="no-drag h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-fg-strong)] outline-none transition-colors focus:border-[var(--color-accent)]"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>

              {currentProvider.keyRequired ? (
                <Field label={currentProvider.keyLabel}>
                  <Input
                    type="password"
                    placeholder={currentProvider.keyPlaceholder}
                    value={draft.api_key}
                    onChange={(e) => update("api_key", e.target.value)}
                  />
                </Field>
              ) : (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)]">
                  {currentProvider.label} runs locally — no API key required.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Base URL">
                  <Input
                    value={draft.base_url}
                    onChange={(e) => update("base_url", e.target.value)}
                  />
                </Field>
                <Field label="Model">
                  <Input
                    value={draft.model}
                    onChange={(e) => update("model", e.target.value)}
                  />
                </Field>
              </div>

              {currentProvider.docsUrl ? (
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openUrl(currentProvider.docsUrl)}
                  >
                    {currentProvider.docsLabel}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>

          {/* ── Refresh Rate ── */}
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg-strong)]">
              Refresh Rate
            </h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              How often telemetry and process stats are fetched. Higher rates use slightly more CPU.
            </p>

            <Field label={`Frequency: ${draft.refresh_hz} Hz (${(1000 / draft.refresh_hz).toFixed(0)} ms)`}>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={draft.refresh_hz}
                onChange={(e) =>
                  update("refresh_hz", Number(e.target.value) as StoredSettings["refresh_hz"])
                }
                className="w-full"
              />
            </Field>
          </Card>

          {/* ── System Tray ── */}
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg-strong)]">
              System Tray
            </h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Control how the app behaves when the window is closed.
              Minimize to tray keeps monitoring running in the background.
            </p>

            <div className="space-y-3">
              <ToggleField
                label="Minimize to tray on close"
                description="Hide to tray instead of quitting when the window is closed."
                checked={draft.minimize_to_tray}
                onChange={(v) => updateAndSave("minimize_to_tray", v)}
              />
              <ToggleField
                label="Launch at Windows startup"
                description="Add AI Task Manager to the Windows startup registry."
                checked={draft.launch_at_startup}
                disabled={autostartBusy}
                onChange={onAutostartToggle}
              />
            </div>
          </Card>

          {/* ── System Monitor Bar (Kali / Taskbar Companion) ── */}
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg-strong)]">
              System Monitor Bar
            </h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Ultra-compact Kali-style resource monitor bar. Runs as a borderless taskbar companion overlay with per-core CPU, rolling RAM graph, and two-row network telemetry.
            </p>

            <div className="space-y-4">
              <ToggleField
                label="Enable System Monitor Bar"
                description="Show the floating/docked taskbar companion overlay window."
                checked={draft.system_monitor_enabled}
                onChange={async (enabled) => {
                  await updateAndSave("system_monitor_enabled", enabled);
                  try {
                    await ipc.toggleSystemMonitorWindow(
                      enabled,
                      draft.system_monitor_position,
                      draft.system_monitor_offset_right
                    );
                  } catch (e) {
                    console.warn("Failed to toggle system monitor window:", e);
                  }
                }}
              />

              <div className="grid grid-cols-3 gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-[var(--color-fg)] select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.system_monitor_show_cpu}
                    onChange={(e) => updateAndSave("system_monitor_show_cpu", e.target.checked)}
                    className="rounded border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-accent)] cursor-pointer"
                  />
                  <span>CPU Cores</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[var(--color-fg)] select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.system_monitor_show_ram}
                    onChange={(e) => updateAndSave("system_monitor_show_ram", e.target.checked)}
                    className="rounded border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-accent)] cursor-pointer"
                  />
                  <span>RAM Graph</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[var(--color-fg)] select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.system_monitor_show_network}
                    onChange={(e) => updateAndSave("system_monitor_show_network", e.target.checked)}
                    className="rounded border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-accent)] cursor-pointer"
                  />
                  <span>Network</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <Field label="Overlay Position">
                  <select
                    value={draft.system_monitor_position}
                    onChange={async (e) => {
                      const pos = e.target.value as StoredSettings["system_monitor_position"];
                      await updateAndSave("system_monitor_position", pos);
                      if (draft.system_monitor_enabled) {
                        try {
                          await ipc.repositionSystemMonitor(pos, draft.system_monitor_offset_right);
                        } catch (err) {
                          console.warn("Reposition failed:", err);
                        }
                      }
                    }}
                    className="no-drag h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 text-xs text-[var(--color-fg-strong)] outline-none transition-colors focus:border-[var(--color-accent)]"
                  >
                    <option value="taskbar_bottom">Bottom Taskbar</option>
                    <option value="taskbar_top">Top Taskbar</option>
                    <option value="top_left">Screen Top Left</option>
                    <option value="top_right">Screen Top Right</option>
                  </select>
                </Field>

                <Field label="Right Offset (px)">
                  <Input
                    type="number"
                    min={0}
                    max={1200}
                    step={10}
                    value={draft.system_monitor_offset_right}
                    onChange={async (e) => {
                      const val = Math.max(0, Number(e.target.value));
                      await updateAndSave("system_monitor_offset_right", val);
                      if (draft.system_monitor_enabled) {
                        try {
                          await ipc.repositionSystemMonitor(draft.system_monitor_position, val);
                        } catch (err) {
                          console.warn("Reposition failed:", err);
                        }
                      }
                    }}
                    className="text-xs"
                  />
                </Field>

                <Field label="Update Interval">
                  <select
                    value={draft.system_monitor_interval_ms}
                    onChange={(e) => updateAndSave("system_monitor_interval_ms", Number(e.target.value))}
                    className="no-drag h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 text-xs text-[var(--color-fg-strong)] outline-none transition-colors focus:border-[var(--color-accent)]"
                  >
                    <option value={500}>500 ms (Fast)</option>
                    <option value={1000}>1 sec (Standard)</option>
                    <option value={2000}>2 sec (Eco)</option>
                  </select>
                </Field>
              </div>

              {/* Live Preview */}
              <div className="pt-2">
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                  Live Preview
                </div>
                <div className="p-3 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center">
                  <SystemMonitorBar
                    showCpu={draft.system_monitor_show_cpu}
                    showRam={draft.system_monitor_show_ram}
                    showNetwork={draft.system_monitor_show_network}
                    intervalMs={draft.system_monitor_interval_ms}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="primary" size="sm" onClick={onSave}>
                {saved ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Saved
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* ── About ── */}
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg-strong)]">
              About
            </h2>
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              AI Task Manager v0.2 — A faster, smarter Windows Task Manager.
              Built with Rust, Tauri v2, and React. Features: process tree view,
              network connections, historical metrics (SQLite), system tray,
              multi-provider AI, and security risk analysis.
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  openUrl("https://github.com/Razee4315/AI_Manager")
                }
              >
                View source
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      {children}
    </label>
  );
}

function ToggleField(props: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => {
        if (!props.disabled) props.onChange(!props.checked);
      }}
      className={`flex items-center justify-between gap-4 p-2 rounded-lg transition-colors cursor-pointer hover:bg-[var(--color-surface-2)] select-none ${
        props.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="text-xs font-medium text-[var(--color-fg-strong)]">
          {props.label}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
          {props.description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        disabled={props.disabled}
        onClick={(e) => {
          e.stopPropagation();
          props.onChange(!props.checked);
        }}
        className={`no-drag relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
          props.checked
            ? "bg-[var(--color-accent)]"
            : "bg-[var(--color-border-strong)]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            props.checked ? "translate-x-4.5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
