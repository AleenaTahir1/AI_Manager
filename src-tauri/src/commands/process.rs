use std::sync::Arc;

use serde::Serialize;
use sysinfo::Pid;
use tauri::State;

use crate::state::AppState;

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
    pub threat: String,
}

fn classify_threat(name: &str, exe: Option<&str>) -> &'static str {
    let lower_name = name.to_ascii_lowercase();
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
    );
    if known_safe {
        return "green";
    }
    if let Some(path) = exe {
        let p = path.to_ascii_lowercase();
        let suspicious_dir =
            p.contains("\\temp\\") || p.contains("\\appdata\\local\\temp\\") || p.contains("\\downloads\\");
        if suspicious_dir {
            return "red";
        }
        if p.starts_with("c:\\windows\\") || p.starts_with("c:\\program files") {
            return "green";
        }
    }
    "yellow"
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
                user: p.user_id().map(|u| u.to_string()),
                threat: classify_threat(&name, exe.as_deref()).to_string(),
            }
        })
        .collect();
    rows.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    rows
}

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
        user: p.user_id().map(|u| u.to_string()),
        threat: classify_threat(&name, exe.as_deref()).to_string(),
    })
}

#[tauri::command]
pub fn kill_process(state: State<'_, Arc<AppState>>, pid: u32) -> Result<bool, String> {
    let sys = state.system.read();
    let p = sys
        .process(Pid::from_u32(pid))
        .ok_or_else(|| format!("process {pid} not found"))?;
    Ok(p.kill())
}
