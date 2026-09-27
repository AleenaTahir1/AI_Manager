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
  // Feature: Security Risk Analysis
  risk_score: number;
  risk_reasons: string[];
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
  risk_score: number;
  risk_reasons: string[];
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

// Feature: AI Provider Expansion
export type AiConfig = {
  api_key: string;
  model?: string;
  base_url?: string;
  provider?: string;
};

export type AiReply = {
  answer: string;
  cached: boolean;
};

// Feature: Network Connections Panel
export type NetConnection = {
  pid: number;
  local_addr: string;
  remote_addr: string;
  protocol: string;
  state: string;
};

// Feature: Historical Metrics Storage
export type MetricRange = "1h" | "24h" | "7d";

// Feature: System Monitor Bar
export type SystemMonitorMetrics = {
  cpu_cores: number[];
  ram_percent: number;
  ram_history: number[];
  net_rx_bps: number;
  net_tx_bps: number;
};

export const ipc = {
  listProcesses: () => invoke<ProcessRow[]>("list_processes"),
  killProcess: (pid: number) => invoke<boolean>("kill_process", { pid }),
  killProcessTree: (pid: number) => invoke<number>("kill_process_tree", { pid }),
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

  // Feature: Network Connections
  listConnections: (pid?: number) =>
    invoke<NetConnection[]>("list_connections", { pid: pid ?? null }),

  // Feature: Historical Metrics Storage
  queryMetricHistory: (range: MetricRange) =>
    invoke<MetricSample[]>("query_metric_history", { range }),

  // Feature: System Tray
  setAutostart: (enabled: boolean) =>
    invoke<void>("set_autostart", { enabled }),

  // Feature: System Monitor Bar
  systemMonitorMetrics: () =>
    invoke<SystemMonitorMetrics>("system_monitor_metrics"),
  toggleSystemMonitorWindow: (
    enable: boolean,
    positionMode?: string,
    offsetRight?: number
  ) =>
    invoke<void>("toggle_system_monitor_window", {
      enable,
      positionMode: positionMode ?? null,
      offsetRight: offsetRight ?? null,
    }),
  repositionSystemMonitor: (positionMode: string, offsetRight?: number) =>
    invoke<void>("reposition_system_monitor", {
      positionMode,
      offsetRight: offsetRight ?? null,
    }),
  focusMainWindow: () => invoke<void>("focus_main_window"),
};
