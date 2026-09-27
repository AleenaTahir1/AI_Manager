use std::sync::Arc;

use serde::Serialize;
use sysinfo::Pid;
use tauri::State;

use crate::state::AppState;

// ── Risk scoring ─────────────────────────────────────────────────────────────

/// Rule-based risk assessment result.
#[derive(Debug, Clone, Serialize)]
pub struct RiskScore {
    /// Accumulated score (0–100+). Thresholds: <20 = green, 20-49 = yellow, 50+ = red.
    pub score: u32,
    /// Human-readable reasons for the score.
    pub reasons: Vec<String>,
    /// Final colour tier: "green" | "yellow" | "red"
    pub level: String,
}

fn score_process(name: &str, exe: Option<&str>, user: Option<&str>) -> RiskScore {
    let mut score: u32 = 0;
    let mut reasons: Vec<String> = Vec::new();

    let lower_name = name.to_ascii_lowercase();

    // Rule 0 — Known Windows system processes are always safe
    let known_safe = matches!(
        lower_name.as_str(),
        "explorer.exe"
            | "svchost.exe"
            | "system"
            | "registry"
            | "winlogon.exe"
            | "lsass.exe"
            | "services.exe"
            | "wininit.exe"
            | "csrss.exe"
            | "smss.exe"
            | "dwm.exe"
            | "fontdrvhost.exe"
            | "memory compression"
            | "system idle process"
            | "spoolsv.exe"
            | "rundll32.exe"
            | "conhost.exe"
            | "taskhostw.exe"
            | "sihost.exe"
            | "searchhost.exe"
            | "runtimebroker.exe"
            | "startmenuexperiencehost.exe"
    );
    if known_safe {
        return RiskScore {
            score: 0,
            reasons: vec!["Known Windows system process".to_string()],
            level: "green".to_string(),
        };
    }

    if let Some(path) = exe {
        let p = path.to_ascii_lowercase();

        // Rule 1 — Running from Temp or Downloads directory (+40)
        if p.contains("\\temp\\")
            || p.contains("\\appdata\\local\\temp\\")
            || p.contains("\\downloads\\")
        {
            score += 40;
            reasons.push("Running from a temporary or downloads directory".to_string());
        }

        // Rule 2 — Running from Roaming AppData (unusual for executables) (+20)
        if p.contains("\\appdata\\roaming\\")
            && !p.contains("\\discord\\")
            && !p.contains("\\slack\\")
            && !p.contains("\\teams\\")
            && !p.contains("\\spotify\\")
        {
            score += 20;
            reasons.push("Executable in AppData\\Roaming (uncommon)".to_string());
        }

        // Rule 3 — Windows or Program Files location: trusted path (−10 effective / no addition)
        let trusted_path = p.starts_with("c:\\windows\\")
            || p.starts_with("c:\\program files\\")
            || p.starts_with("c:\\program files (x86)\\");
        if trusted_path {
            // Reward trustworthy path — reduce any accumulated score
            score = score.saturating_sub(5);
            if reasons.is_empty() {
                reasons.push("Installed in trusted system directory".to_string());
            }
        } else if !p.contains("\\temp\\") && !p.contains("\\downloads\\") {
            // Unknown path — mild concern (+10)
            score += 10;
            reasons.push("Executable outside standard installation paths".to_string());
        }

        // Rule 4 — Script or interpreter being used to run something (+15)
        let script_runners = [
            "powershell.exe",
            "cmd.exe",
            "wscript.exe",
            "cscript.exe",
            "mshta.exe",
            "regsvr32.exe",
            "msiexec.exe",
        ];
        if script_runners.iter().any(|&s| lower_name == s) {
            score += 15;
            reasons.push("Script interpreter/executor process".to_string());
        }
    } else {
        // Rule 5 — No executable path at all (+15)
        score += 15;
        reasons.push("No executable path available (hidden or system process)".to_string());
    }

    // Rule 6 — Elevated / SYSTEM account (+25)
    if let Some(u) = user {
        let u_lower = u.to_ascii_lowercase();
        if u_lower.contains("system") || u_lower == "s-1-5-18" {
            score += 25;
            reasons.push("Running under SYSTEM account".to_string());
        }
    }

    // Rule 7 — Suspicious name patterns (+30)
    let suspicious_patterns = [
        "payload", "inject", "keylog", "stealer", "cryptominer", "miner",
        "backdoor", "rootkit", "exploit", "shell32_", "svch0st", "lssas",
    ];
    for pat in suspicious_patterns {
        if lower_name.contains(pat) {
            score += 30;
            reasons.push(format!("Name matches suspicious pattern: '{pat}'"));
            break;
        }
    }

    if reasons.is_empty() {
        reasons.push("No specific concerns identified".to_string());
    }

    let level = if score >= 50 {
        "red"
    } else if score >= 20 {
        "yellow"
    } else {
        "green"
    };

    RiskScore {
        score,
        reasons,
        level: level.to_string(),
    }
}

// ── ProcessRow ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ProcessRow {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub exe: Option<String>,
    pub cpu: f32,
    pub mem_bytes: u64,
    pub virt_bytes: u64,
    pub disk_read_bps: u64,
    pub disk_write_bps: u64,
    pub status: String,
    pub run_time_s: u64,
    pub user: Option<String>,
    /// Backward-compatible simple tier: "green" | "yellow" | "red"
    pub threat: String,
    /// Feature: Security Risk Analysis
    pub risk_score: u32,
    pub risk_reasons: Vec<String>,
}

#[tauri::command]
pub fn list_processes(state: State<'_, Arc<AppState>>) -> Vec<ProcessRow> {
    let sys = state.system.read();
    let mut rows: Vec<ProcessRow> = sys
        .processes()
        .values()
        .map(|p| {
            let exe = p.exe().and_then(|e| e.to_str()).map(|s| s.to_string());
            let name = p.name().to_string_lossy().to_string();
            let status = format!("{:?}", p.status());
            let disk_usage = p.disk_usage();
            let user = p.user_id().map(|u| u.to_string());
            let risk = score_process(&name, exe.as_deref(), user.as_deref());
            ProcessRow {
                pid: p.pid().as_u32(),
                parent_pid: p.parent().map(|pp| pp.as_u32()),
                name: name.clone(),
                exe: exe.clone(),
                cpu: p.cpu_usage(),
                mem_bytes: p.memory(),
                virt_bytes: p.virtual_memory(),
                disk_read_bps: disk_usage.read_bytes,
                disk_write_bps: disk_usage.written_bytes,
                status,
                run_time_s: p.run_time(),
                user: user.clone(),
                threat: risk.level.clone(),
                risk_score: risk.score,
                risk_reasons: risk.reasons,
            }
        })
        .collect();
    rows.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    rows
}

// ── ProcessDetail ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ProcessDetail {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub exe: Option<String>,
    pub cwd: Option<String>,
    pub cmd: Vec<String>,
    pub environ_count: usize,
    pub mem_bytes: u64,
    pub virt_bytes: u64,
    pub cpu: f32,
    pub status: String,
    pub run_time_s: u64,
    pub start_time_s: u64,
    pub user: Option<String>,
    pub threat: String,
    pub risk_score: u32,
    pub risk_reasons: Vec<String>,
}

#[tauri::command]
pub fn process_detail(state: State<'_, Arc<AppState>>, pid: u32) -> Option<ProcessDetail> {
    let sys = state.system.read();
    let p = sys.process(Pid::from_u32(pid))?;
    let exe = p.exe().and_then(|e| e.to_str()).map(|s| s.to_string());
    let cwd = p.cwd().and_then(|e| e.to_str()).map(|s| s.to_string());
    let cmd: Vec<String> = p
        .cmd()
        .iter()
        .map(|c| c.to_string_lossy().to_string())
        .collect();
    let name = p.name().to_string_lossy().to_string();
    let user = p.user_id().map(|u| u.to_string());
    let risk = score_process(&name, exe.as_deref(), user.as_deref());
    Some(ProcessDetail {
        pid,
        parent_pid: p.parent().map(|pp| pp.as_u32()),
        name: name.clone(),
        exe: exe.clone(),
        cwd,
        cmd,
        environ_count: p.environ().len(),
        mem_bytes: p.memory(),
        virt_bytes: p.virtual_memory(),
        cpu: p.cpu_usage(),
        status: format!("{:?}", p.status()),
        run_time_s: p.run_time(),
        start_time_s: p.start_time(),
        user,
        threat: risk.level.clone(),
        risk_score: risk.score,
        risk_reasons: risk.reasons,
    })
}

// ── Kill commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn kill_process(state: State<'_, Arc<AppState>>, pid: u32) -> Result<bool, String> {
    let sys = state.system.read();
    let p = sys
        .process(Pid::from_u32(pid))
        .ok_or_else(|| format!("process {pid} not found"))?;
    Ok(p.kill())
}

/// Kill all children of `pid` recursively, then kill `pid` itself.
/// Returns the number of processes killed.
#[tauri::command]
pub fn kill_process_tree(state: State<'_, Arc<AppState>>, pid: u32) -> Result<u32, String> {
    let sys = state.system.read();

    // Build a parent → children map
    let mut children: std::collections::HashMap<u32, Vec<u32>> = std::collections::HashMap::new();
    for (p_pid, proc) in sys.processes() {
        if let Some(parent) = proc.parent() {
            children
                .entry(parent.as_u32())
                .or_default()
                .push(p_pid.as_u32());
        }
    }

    // Collect PIDs to kill via BFS
    let mut to_kill: Vec<u32> = Vec::new();
    let mut queue = std::collections::VecDeque::new();
    queue.push_back(pid);
    while let Some(current) = queue.pop_front() {
        to_kill.push(current);
        if let Some(kids) = children.get(&current) {
            for &kid in kids {
                queue.push_back(kid);
            }
        }
    }

    let mut killed = 0u32;
    for target_pid in to_kill {
        if let Some(p) = sys.process(Pid::from_u32(target_pid)) {
            if p.kill() {
                killed += 1;
            }
        }
    }
    Ok(killed)
}
