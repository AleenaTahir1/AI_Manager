mod commands;
mod db;
mod state;

use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── Database setup ────────────────────────────────────────────────────────
    // Use the OS app-data directory; fall back to a temp path if unavailable.
    let db_path = {
        let base = dirs_next::data_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join("com.razee4315.aitaskmanager");
        std::fs::create_dir_all(&base).ok();
        base.join("metrics.db")
    };
    let metrics_db = db::MetricsDb::open(&db_path)
        .expect("Failed to open metrics database");

    // ── App state ─────────────────────────────────────────────────────────────
    let app_state = Arc::new(state::AppState::new(metrics_db));

    // Spawn the background metrics sampler (refreshes system metrics + DB writes).
    {
        let sampler_state = app_state.clone();
        std::thread::Builder::new()
            .name("metrics-sampler".into())
            .spawn(move || state::metrics_sampler_loop(sampler_state))
            .expect("spawn metrics sampler");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Process commands
            commands::process::list_processes,
            commands::process::kill_process,
            commands::process::kill_process_tree,
            commands::process::process_detail,
            // Metrics commands
            commands::metrics::system_snapshot,
            commands::metrics::metrics_history,
            // Historical metrics (SQLite)
            commands::history::query_metric_history,
            // Services & Startup
            commands::services::list_services,
            commands::services::set_service_state,
            commands::startup::list_startup_entries,
            commands::startup::set_startup_enabled,
            // AI
            commands::ai::explain_process,
            commands::ai::explain_system,
            // Network connections
            commands::network::list_connections,
            // Tray / Autostart
            commands::tray::set_autostart,
            commands::tray::get_autostart_state,
            // System Monitor Bar
            commands::monitor::system_monitor_metrics,
            commands::monitor::toggle_system_monitor_window,
            commands::monitor::reposition_system_monitor,
            commands::monitor::focus_main_window,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title("AI Task Manager — dev");
                }
            }

            // ── System tray setup ─────────────────────────────────────────────
            let show_item = MenuItem::with_id(app, "show", "Show AI Task Manager", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .tooltip("AI Task Manager")
                .on_tray_icon_event(|tray, event| {
                    // Double-click or single-click the tray icon to restore the window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Feature: Minimize to tray on close if setting is enabled.
            // System monitor window stays running on the taskbar.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                } else if window.label() == "system_monitor" {
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
