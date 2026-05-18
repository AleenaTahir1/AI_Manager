import { useState } from "react";
import { Check, ExternalLink, Save } from "lucide-react";
import { Button, Card, Input } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { StoredSettings } from "../lib/store";
import { saveSettings } from "../lib/store";

export function Settings(props: {
  settings: StoredSettings;
  onChange: (s: StoredSettings) => void;
}) {
  const [draft, setDraft] = useState<StoredSettings>(props.settings);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof StoredSettings>(k: K, v: StoredSettings[K]) =>
    setDraft({ ...draft, [k]: v });

  const onSave = async () => {
    await saveSettings(draft);
    props.onChange(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure the AI provider and refresh behaviour. All data stays on this device."
      />
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg-strong)]">
              OpenRouter
            </h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              We use your OpenRouter key directly from the desktop. Default model
              is Gemini Flash — cheap and fast for short explanations.
            </p>

            <div className="space-y-3">
              <Field label="API key">
                <Input
                  type="password"
                  placeholder="sk-or-v1-…"
                  value={draft.api_key}
                  onChange={(e) => update("api_key", e.target.value)}
                />
              </Field>
              <Field label="Model">
                <Input
                  value={draft.model}
                  onChange={(e) => update("model", e.target.value)}
                />
              </Field>
              <Field label="Base URL">
                <Input
                  value={draft.base_url}
                  onChange={(e) => update("base_url", e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openUrl("https://openrouter.ai/keys")}
              >
                Get a key
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
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

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg-strong)]">
              Sampling
            </h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              How often the UI refreshes its process and system view.
            </p>
            <Field label={`UI refresh rate · ${draft.refresh_hz}× per second`}>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={draft.refresh_hz}
                onChange={(e) =>
                  update("refresh_hz", Number(e.target.value) as StoredSettings["refresh_hz"])
                }
                className="w-full"
              />
            </Field>
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg-strong)]">
              About
            </h2>
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              AI Task Manager replaces Windows Task Manager with a faster UI,
              deeper insight, and LLM explanations of what's running. Built with
              Rust, Tauri v2, and React.
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
