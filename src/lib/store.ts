import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("settings.json");

export type StoredSettings = {
  api_key: string;
  model: string;
  base_url: string;
  refresh_hz: number;
  theme: "dark" | "light";
};

const defaults: StoredSettings = {
  api_key: "",
  model: "google/gemini-2.0-flash-001",
  base_url: "https://openrouter.ai/api/v1",
  refresh_hz: 2,
  theme: "dark",
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
