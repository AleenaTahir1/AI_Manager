mod commands;
mod state;

use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(state::AppState::new());

    // Spawn a background sampler that refreshes system metrics once per second.
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
            commands::process::list_processes,
            commands::process::kill_process,
            commands::process::process_detail,
            commands::metrics::system_snapshot,
            commands::metrics::metrics_history,
            commands::services::list_services,
            commands::services::set_service_state,
            commands::startup::list_startup_entries,
            commands::startup::set_startup_enabled,
            commands::ai::explain_process,
            commands::ai::explain_system,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title("AI Task Manager — dev");
                }
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
