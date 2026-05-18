import { invoke } from "@tauri-apps/api/core";

export type ProcessRow = {
  pid: number;
  parent_pid: number | null;
  name: string;
  exe: string | null;
  cpu: number;
  mem_bytes: number;
  virt_bytes: number;
  disk_read_bps: number;
  disk_write_bps: number;
  status: string;
  run_time_s: number;
  user: string | null;
  threat: "green" | "yellow" | "red" | string;
};

export type ProcessDetail = {
  pid: number;
  parent_pid: number | null;
  name: string;
  exe: string | null;
  cwd: string | null;
  cmd: string[];
  environ_count: number;
  mem_bytes: number;
  virt_bytes: number;
  cpu: number;
  status: string;
  run_time_s: number;
  start_time_s: number;
  user: string | null;
  threat: string;
};

export type MetricSample = {
  ts_ms: number;
  cpu_total: number;
  per_core: number[];
  mem_used: number;
  mem_total: number;
  swap_used: number;
  swap_total: number;
  disk_read_bps: number;
  disk_write_bps: number;
  net_rx_bps: number;
  net_tx_bps: number;
};

export type SystemSnapshot = {
  cpu_total: number;
  per_core: number[];
  mem_used: number;
  mem_total: number;
  swap_used: number;
  swap_total: number;
  process_count: number;
  uptime_s: number;
  host_name: string | null;
  os_name: string | null;
  kernel: string | null;
  cpu_brand: string | null;
  cpu_cores: number;
};

export type ServiceRow = {
  name: string;
  display_name: string;
  status: string;
  start_type: string;
  pid: number | null;
  service_type: string;
  description: string | null;
};

export type StartupEntry = {
  source: string;
  scope: string;
  name: string;
  command: string;
  enabled: boolean;
};

export type AiConfig = {
  api_key: string;
  model?: string;
  base_url?: string;
};

export type AiReply = {
  answer: string;
  cached: boolean;
};

export const ipc = {
  listProcesses: () => invoke<ProcessRow[]>("list_processes"),
  killProcess: (pid: number) => invoke<boolean>("kill_process", { pid }),
  processDetail: (pid: number) =>
    invoke<ProcessDetail | null>("process_detail", { pid }),

  systemSnapshot: () => invoke<SystemSnapshot>("system_snapshot"),
  metricsHistory: () => invoke<MetricSample[]>("metrics_history"),

  listServices: () => invoke<ServiceRow[]>("list_services"),
  setServiceState: (name: string, action: string) =>
    invoke<void>("set_service_state", { name, action }),

  listStartupEntries: () => invoke<StartupEntry[]>("list_startup_entries"),
  setStartupEnabled: (name: string, scope: string, enabled: boolean) =>
    invoke<void>("set_startup_enabled", { name, scope, enabled }),

  explainProcess: (config: AiConfig, input: Record<string, unknown>) =>
    invoke<AiReply>("explain_process", { config, input }),
  explainSystem: (config: AiConfig, input: Record<string, unknown>) =>
    invoke<AiReply>("explain_system", { config, input }),
};
