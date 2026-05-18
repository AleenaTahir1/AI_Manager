use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Duration;

use parking_lot::RwLock;
use serde::Serialize;
use sysinfo::{Disks, Networks, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

pub const HISTORY_SECONDS: usize = 60;

#[derive(Debug, Clone, Serialize)]
pub struct MetricSample {
    pub ts_ms: i64,
    pub cpu_total: f32,
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

pub struct MetricsHistory {
    pub samples: VecDeque<MetricSample>,
}

impl MetricsHistory {
    fn new() -> Self {
        Self {
            samples: VecDeque::with_capacity(HISTORY_SECONDS),
        }
    }

    fn push(&mut self, sample: MetricSample) {
        if self.samples.len() == HISTORY_SECONDS {
            self.samples.pop_front();
        }
        self.samples.push_back(sample);
    }
}

pub struct AppState {
    pub system: RwLock<System>,
    pub disks: RwLock<Disks>,
    pub networks: RwLock<Networks>,
    pub history: RwLock<MetricsHistory>,
    pub ai_cache: RwLock<std::collections::HashMap<String, String>>,
}

impl AppState {
    pub fn new() -> Self {
        let sys = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(sysinfo::CpuRefreshKind::everything())
                .with_memory(sysinfo::MemoryRefreshKind::everything())
                .with_processes(ProcessRefreshKind::everything()),
        );
        Self {
            system: RwLock::new(sys),
            disks: RwLock::new(Disks::new_with_refreshed_list()),
            networks: RwLock::new(Networks::new_with_refreshed_list()),
            history: RwLock::new(MetricsHistory::new()),
            ai_cache: RwLock::new(std::collections::HashMap::new()),
        }
    }
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn metrics_sampler_loop(state: Arc<AppState>) {
    let interval = Duration::from_secs(1);
    // Allow a first cycle to settle CPU readings.
    {
        let mut sys = state.system.write();
        sys.refresh_cpu_all();
        sys.refresh_memory();
        sys.refresh_processes(ProcessesToUpdate::All, true);
    }
    std::thread::sleep(Duration::from_millis(500));

    loop {
        let started = std::time::Instant::now();

        // Refresh everything we care about.
        {
            let mut sys = state.system.write();
            sys.refresh_cpu_all();
            sys.refresh_memory();
            sys.refresh_processes(ProcessesToUpdate::All, true);
        }
        let (disk_r, disk_w) = {
            let mut disks = state.disks.write();
            disks.refresh(true);
            let mut r = 0u64;
            let mut w = 0u64;
            for d in disks.iter() {
                let usage = d.usage();
                r = r.saturating_add(usage.read_bytes);
                w = w.saturating_add(usage.written_bytes);
            }
            (r, w)
        };
        let (net_rx, net_tx) = {
            let mut nets = state.networks.write();
            nets.refresh(true);
            let mut rx = 0u64;
            let mut tx = 0u64;
            for (_, n) in nets.iter() {
                rx = rx.saturating_add(n.received());
                tx = tx.saturating_add(n.transmitted());
            }
            (rx, tx)
        };

        let sample = {
            let sys = state.system.read();
            let per_core: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();
            let cpu_total = if per_core.is_empty() {
                0.0
            } else {
                per_core.iter().copied().sum::<f32>() / per_core.len() as f32
            };
            MetricSample {
                ts_ms: now_ms(),
                cpu_total,
                per_core,
                mem_used: sys.used_memory(),
                mem_total: sys.total_memory(),
                swap_used: sys.used_swap(),
                swap_total: sys.total_swap(),
                disk_read_bps: disk_r,
                disk_write_bps: disk_w,
                net_rx_bps: net_rx,
                net_tx_bps: net_tx,
            }
        };

        state.history.write().push(sample);

        let elapsed = started.elapsed();
        if elapsed < interval {
            std::thread::sleep(interval - elapsed);
        }
    }
}
