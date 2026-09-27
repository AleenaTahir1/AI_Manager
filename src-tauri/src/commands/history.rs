/// Historical metrics query commands — Feature 3.
///
/// Reads from the SQLite database (`AppState.db`) and returns
/// downsampled MetricSample vectors for chart rendering.
use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::state::AppState;

/// Wire-compatible version of MetricSample that matches the in-memory
/// sample structure used by the existing `metrics_history` command.
#[derive(Debug, Clone, Serialize)]
pub struct HistorySample {
    pub ts_ms: i64,
    pub cpu_total: f32,
    /// Placeholder — per-core data is not stored in SQLite (too large).
    pub per_core: Vec<f32>,
    pub mem_used: u64,
    pub mem_total: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub disk_read_bps: u64,
    pub disk_write_bps: u64,
    pub net_rx_bps: u64,
    pub net_tx_bps: u64,
}

/// Query historical metrics from SQLite.
/// `range` must be one of: "1h" | "24h" | "7d".
#[tauri::command]
pub fn query_metric_history(
    state: State<'_, Arc<AppState>>,
    range: String,
) -> Result<Vec<HistorySample>, String> {
    let now_ms = chrono::Utc::now().timestamp_millis();
    let duration_ms: i64 = match range.as_str() {
        "1h" => 3_600_000,
        "24h" => 86_400_000,
        "7d" => 604_800_000,
        _ => return Err(format!("Unknown range: {range}. Use '1h', '24h', or '7d'.")),
    };

    // Target roughly 300 points for smooth charts
    let max_points: usize = match range.as_str() {
        "1h" => 300,
        "24h" => 288, // one point per 5 minutes
        "7d" => 336,  // one point per 30 minutes
        _ => 300,
    };

    let from_ms = now_ms - duration_ms;
    let db = &state.db;

    let samples = db
        .query_range(from_ms, now_ms, max_points)
        .map_err(|e| format!("DB query failed: {e}"))?;

    let result = samples
        .into_iter()
        .map(|s| HistorySample {
            ts_ms: s.ts_ms,
            cpu_total: s.cpu,
            per_core: Vec::new(), // Not stored at this resolution
            mem_used: s.mem_used,
            mem_total: s.mem_total,
            swap_used: 0,
            swap_total: 0,
            // Split combined disk_rw into approximate halves for chart display
            disk_read_bps: s.disk_rw / 2,
            disk_write_bps: s.disk_rw / 2,
            net_rx_bps: s.net_rxtx / 2,
            net_tx_bps: s.net_rxtx / 2,
        })
        .collect();

    Ok(result)
}
