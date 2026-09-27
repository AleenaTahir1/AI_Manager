/// System Tray support — Feature 4.
///
/// Provides a Tauri command to set/remove the Windows Registry autostart key.
/// The `winreg` crate is already a project dependency.
use tauri::State;
use std::sync::Arc;
use crate::state::AppState;

const APP_NAME: &str = "AI Task Manager";
const REG_RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";

/// Enable or disable launching the app at Windows startup via the Registry.
/// Writes/removes: HKCU\Software\Microsoft\Windows\CurrentVersion\Run\AI Task Manager
#[tauri::command]
pub fn set_autostart(
    _state: State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags(REG_RUN_KEY, KEY_SET_VALUE)
            .map_err(|e| format!("Failed to open Run registry key: {e}"))?;

        if enabled {
            // Get the current executable path
            let exe_path = std::env::current_exe()
                .map_err(|e| format!("Cannot determine exe path: {e}"))?;
            let exe_str = format!("\"{}\"", exe_path.to_string_lossy());
            run_key
                .set_value(APP_NAME, &exe_str)
                .map_err(|e| format!("Failed to set autostart registry value: {e}"))?;
        } else {
            // Remove the value — ignore error if it doesn't exist
            let _ = run_key.delete_value(APP_NAME);
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
        Ok(())
    }
}

/// Check whether the autostart key currently exists.
#[tauri::command]
pub fn get_autostart_state(
    _state: State<'_, Arc<AppState>>,
) -> bool {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(run_key) = hkcu.open_subkey_with_flags(REG_RUN_KEY, winreg::enums::KEY_READ) {
            return run_key.get_value::<String, _>(APP_NAME).is_ok();
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}
