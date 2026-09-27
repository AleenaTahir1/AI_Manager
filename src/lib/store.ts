import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("settings.json");

export type AiProvider =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "gemini"
  | "ollama"
  | "lmstudio";

export type StoredSettings = {
  api_key: string;
  model: string;
  base_url: string;
  refresh_hz: number;
  theme: "dark" | "light";
  // Feature: AI Provider Expansion
  ai_provider: AiProvider;
  // Feature: System Tray
  minimize_to_tray: boolean;
  launch_at_startup: boolean;
  // UI State
  sidebar_collapsed: boolean;
  // Feature: System Monitor Bar
  system_monitor_enabled: boolean;
  system_monitor_show_cpu: boolean;
  system_monitor_show_ram: boolean;
  system_monitor_show_network: boolean;
  system_monitor_position: "taskbar_bottom" | "taskbar_top" | "top_left" | "top_right";
  system_monitor_offset_right: number;
  system_monitor_interval_ms: number;
};

const defaults: StoredSettings = {
  api_key: "",
  model: "google/gemini-2.0-flash-001",
  base_url: "https://openrouter.ai/api/v1",
  refresh_hz: 2,
  theme: "dark",
  ai_provider: "openrouter",
  minimize_to_tray: false,
  launch_at_startup: false,
  sidebar_collapsed: false,
  system_monitor_enabled: true,
  system_monitor_show_cpu: true,
  system_monitor_show_ram: true,
  system_monitor_show_network: true,
  system_monitor_position: "taskbar_bottom",
  system_monitor_offset_right: 240,
  system_monitor_interval_ms: 1000,
};

export async function loadSettings(): Promise<StoredSettings> {
  try {
    const partial = (await store.get<Partial<StoredSettings>>("settings")) ?? {};
    return { ...defaults, ...partial };
  } catch {
    return defaults;
  }
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  await store.set("settings", settings);
  await store.save();
}
