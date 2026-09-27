use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMonitorMetrics {
    pub cpu_cores: Vec<f32>,
    pub ram_percent: f32,
    pub ram_history: Vec<f32>,
    pub net_rx_bps: u64,
    pub net_tx_bps: u64,
}

#[tauri::command]
pub fn system_monitor_metrics(state: State<'_, Arc<AppState>>) -> SystemMonitorMetrics {
    let h = state.history.read();
    let latest = h.samples.back();

    let (cpu_cores, ram_percent, net_rx_bps, net_tx_bps) = match latest {
        Some(s) => {
            let ram_pct = if s.mem_total > 0 {
                (s.mem_used as f32 / s.mem_total as f32) * 100.0
            } else {
                0.0
            };
            (s.per_core.clone(), ram_pct, s.net_rx_bps, s.net_tx_bps)
        }
        None => (Vec::new(), 0.0, 0, 0),
    };

    let ram_history: Vec<f32> = h
        .samples
        .iter()
        .map(|s| {
            if s.mem_total > 0 {
                (s.mem_used as f32 / s.mem_total as f32) * 100.0
            } else {
                0.0
            }
        })
        .collect();

    SystemMonitorMetrics {
        cpu_cores,
        ram_percent,
        ram_history,
        net_rx_bps,
        net_tx_bps,
    }
}

fn reposition_window(window: &WebviewWindow, position_mode: &str, offset_right: f64) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let scale = monitor.scale_factor();
        let monitor_size = monitor.size();
        let monitor_pos = monitor.position();

        // 260px width x 40px height (full taskbar thickness)
        let bar_width = (260.0 * scale) as i32;
        let bar_height = (40.0 * scale) as i32;
        let offset_px = (offset_right * scale) as i32;

        let (x, y) = match position_mode {
            "taskbar_top" => {
                let x = monitor_pos.x + monitor_size.width as i32 - bar_width - offset_px;
                let y = monitor_pos.y;
                (x, y)
            }
            "top_left" => {
                let x = monitor_pos.x + (16.0 * scale) as i32;
                let y = monitor_pos.y + (16.0 * scale) as i32;
                (x, y)
            }
            "top_right" => {
                let x = monitor_pos.x + monitor_size.width as i32 - bar_width - offset_px;
                let y = monitor_pos.y + (16.0 * scale) as i32;
                (x, y)
            }
            _ => {
                // "taskbar_bottom" (default: docked on taskbar with customizable right offset)
                let x = monitor_pos.x + monitor_size.width as i32 - bar_width - offset_px;
                let y = monitor_pos.y + monitor_size.height as i32 - bar_height;
                (x, y)
            }
        };

        let _ = window.set_position(PhysicalPosition::new(x, y));
        enforce_taskbar_topmost(window);
    }
}

#[cfg(windows)]
pub fn enforce_taskbar_topmost(window: &WebviewWindow) {
    use windows::core::w;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowW, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWLP_HWNDPARENT,
        GWL_EXSTYLE, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
        WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
    };

    if let Ok(raw_hwnd) = window.hwnd() {
        let hwnd = HWND(raw_hwnd.0 as _);
        unsafe {
            if let Ok(tray_hwnd) = FindWindowW(w!("Shell_TrayWnd"), None) {
                if !tray_hwnd.0.is_null() {
                    // Set the Taskbar as the owner window of our overlay.
                    // In Win32, an owned window ALWAYS sits above its owner in Z-order,
                    // preventing the taskbar from covering it when the user clicks the taskbar.
                    SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, tray_hwnd.0 as isize);
                }
            }

            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let target_ex_style = ex_style
                | (WS_EX_TOOLWINDOW.0 as isize)
                | (WS_EX_TOPMOST.0 as isize)
                | (WS_EX_NOACTIVATE.0 as isize);
            if ex_style != target_ex_style {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, target_ex_style);
            }

            let _ = SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }
}

#[cfg(not(windows))]
pub fn enforce_taskbar_topmost(_window: &WebviewWindow) {}

#[tauri::command]
pub async fn toggle_system_monitor_window(
    app: AppHandle,
    enable: bool,
    position_mode: Option<String>,
    offset_right: Option<f64>,
) -> Result<(), String> {
    const WINDOW_LABEL: &str = "system_monitor";

    if !enable {
        if let Some(w) = app.get_webview_window(WINDOW_LABEL) {
            let _ = w.hide();
        }
        return Ok(());
    }

    let pos_mode = position_mode.unwrap_or_else(|| "taskbar_bottom".into());
    let offset = offset_right.unwrap_or(240.0);

    if let Some(w) = app.get_webview_window(WINDOW_LABEL) {
        let _ = w.show();
        let _ = w.set_always_on_top(true);
        let _ = w.set_ignore_cursor_events(true);
        reposition_window(&w, &pos_mode, offset);
        enforce_taskbar_topmost(&w);
        return Ok(());
    }

    // Create the companion overlay window (always-on-top, click-through, non-focusable)
    let builder = WebviewWindowBuilder::new(
        &app,
        WINDOW_LABEL,
        WebviewUrl::App("/?window=monitor".into()),
    )
    .title("System Monitor")
    .inner_size(260.0, 40.0)
    .min_inner_size(200.0, 32.0)
    .decorations(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .focusable(false)
    .accept_first_mouse(false);

    #[cfg(not(target_os = "macos"))]
    let builder = builder.transparent(true);

    let window = builder.build().map_err(|e| e.to_string())?;
    reposition_window(&window, &pos_mode, offset);
    let _ = window.show();
    let _ = window.set_always_on_top(true);
    let _ = window.set_ignore_cursor_events(true);
    enforce_taskbar_topmost(&window);

    Ok(())
}

#[tauri::command]
pub fn reposition_system_monitor(
    app: AppHandle,
    position_mode: String,
    offset_right: Option<f64>,
) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("system_monitor") {
        reposition_window(&w, &position_mode, offset_right.unwrap_or(240.0));
    }
    Ok(())
}

#[tauri::command]
pub fn focus_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    Ok(())
}
