use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct StartupEntry {
    pub source: String,
    pub scope: String,
    pub name: String,
    pub command: String,
    pub enabled: bool,
}

#[cfg(windows)]
mod imp {
    use super::StartupEntry;
    use std::path::PathBuf;
    use winreg::enums::*;
    use winreg::types::FromRegValue;
    use winreg::{RegKey, HKEY};

    fn read_run_key(hive: HKEY, hive_label: &str, path: &str) -> Vec<StartupEntry> {
        let root = RegKey::predef(hive);
        let mut entries = Vec::new();
        if let Ok(key) = root.open_subkey_with_flags(path, KEY_READ) {
            for value in key.enum_values().flatten() {
                let (name, data) = value;
                if let Ok(cmd) = String::from_reg_value(&data) {
                    entries.push(StartupEntry {
                        source: format!("Registry: {hive_label}\\{path}"),
                        scope: hive_label.to_string(),
                        name,
                        command: cmd,
                        enabled: true,
                    });
                }
            }
        }
        // Also read disabled approvals if available.
        let approved_path = format!("{}\\StartupApproved\\Run", "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer");
        if let Ok(approved) = root.open_subkey_with_flags(approved_path, KEY_READ) {
            for entry in &mut entries {
                if let Ok(value) = approved.get_raw_value(&entry.name) {
                    // First byte non-zero typically indicates disabled.
                    let first = value.bytes.first().copied().unwrap_or(0);
                    if first != 0 && first != 2 && first != 6 {
                        entry.enabled = false;
                    }
                }
            }
        }
        entries
    }

    fn read_startup_folder(scope: &str, folder: PathBuf) -> Vec<StartupEntry> {
        let mut entries = Vec::new();
        if let Ok(rd) = std::fs::read_dir(&folder) {
            for entry in rd.flatten() {
                let path = entry.path();
                let name = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "(unknown)".to_string());
                entries.push(StartupEntry {
                    source: format!("Folder: {}", folder.display()),
                    scope: scope.to_string(),
                    name,
                    command: path.display().to_string(),
                    enabled: true,
                });
            }
        }
        entries
    }

    pub fn list_startup_entries() -> Result<Vec<StartupEntry>, String> {
        let mut all = Vec::new();
        all.extend(read_run_key(
            HKEY_CURRENT_USER,
            "HKCU",
            "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        ));
        all.extend(read_run_key(
            HKEY_LOCAL_MACHINE,
            "HKLM",
            "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        ));
        all.extend(read_run_key(
            HKEY_LOCAL_MACHINE,
            "HKLM",
            "Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run",
        ));

        if let Some(appdata) = std::env::var_os("APPDATA") {
            let p = PathBuf::from(appdata)
                .join("Microsoft\\Windows\\Start Menu\\Programs\\Startup");
            all.extend(read_startup_folder("HKCU", p));
        }
        if let Some(programdata) = std::env::var_os("PROGRAMDATA") {
            let p = PathBuf::from(programdata)
                .join("Microsoft\\Windows\\Start Menu\\Programs\\Startup");
            all.extend(read_startup_folder("HKLM", p));
        }

        all.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(all)
    }

    pub fn set_startup_enabled(name: &str, scope: &str, enabled: bool) -> Result<(), String> {
        let hive = match scope {
            "HKCU" => HKEY_CURRENT_USER,
            "HKLM" => HKEY_LOCAL_MACHINE,
            _ => return Err(format!("unknown scope {scope}")),
        };
        let root = RegKey::predef(hive);
        let path = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";
        let key = root
            .open_subkey_with_flags(path, KEY_WRITE)
            .or_else(|_| root.create_subkey(path).map(|(k, _)| k))
            .map_err(|e| format!("open approved key: {e}"))?;
        // Standard format: first 12 bytes — first byte 0x02 = enabled, 0x03 = disabled, rest timestamp.
        let bytes: Vec<u8> = if enabled {
            vec![0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        } else {
            vec![0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        };
        let raw = winreg::RegValue {
            bytes,
            vtype: REG_BINARY,
        };
        key.set_raw_value(name, &raw)
            .map_err(|e| format!("write approved value: {e}"))
    }
}

#[cfg(not(windows))]
mod imp {
    use super::StartupEntry;
    pub fn list_startup_entries() -> Result<Vec<StartupEntry>, String> {
        Ok(Vec::new())
    }
    pub fn set_startup_enabled(_name: &str, _scope: &str, _enabled: bool) -> Result<(), String> {
        Err("startup management is Windows-only".into())
    }
}

#[tauri::command]
pub fn list_startup_entries() -> Result<Vec<StartupEntry>, String> {
    imp::list_startup_entries()
}

#[tauri::command]
pub fn set_startup_enabled(name: String, scope: String, enabled: bool) -> Result<(), String> {
    imp::set_startup_enabled(&name, &scope, enabled)
}
