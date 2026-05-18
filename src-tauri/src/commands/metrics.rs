use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::state::{AppState, MetricSample};

#[derive(Debug, Clone, Serialize)]
pub struct SystemSnapshot {
    pub cpu_total: f32,
    pub per_core: Vec<f32>,
    pub mem_used: u64,
    pub mem_total: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub process_count: usize,
    pub uptime_s: u64,
    pub host_name: Option<String>,
    pub os_name: Option<String>,
    pub kernel: Option<String>,
    pub cpu_brand: Option<String>,
    pub cpu_cores: usize,
}

#[tauri::command]
pub fn system_snapshot(state: State<'_, Arc<AppState>>) -> SystemSnapshot {
    let sys = state.system.read();
    let per_core: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();
    let cpu_total = if per_core.is_empty() {
        0.0
    } else {
        per_core.iter().copied().sum::<f32>() / per_core.len() as f32
    };
    SystemSnapshot {
        cpu_total,
        per_core,
        mem_used: sys.used_memory(),
        mem_total: sys.total_memory(),
        swap_used: sys.used_swap(),
        swap_total: sys.total_swap(),
        process_count: sys.processes().len(),
        uptime_s: sysinfo::System::uptime(),
        host_name: sysinfo::System::host_name(),
        os_name: sysinfo::System::name(),
        kernel: sysinfo::System::kernel_version(),
        cpu_brand: sys.cpus().first().map(|c| c.brand().to_string()),
        cpu_cores: sys.cpus().len(),
    }
}

#[tauri::command]
pub fn metrics_history(state: State<'_, Arc<AppState>>) -> Vec<MetricSample> {
    let h = state.history.read();
    h.samples.iter().cloned().collect()
}
