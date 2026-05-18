use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ServiceRow {
    pub name: String,
    pub display_name: String,
    pub status: String,
    pub start_type: String,
    pub pid: Option<u32>,
    pub service_type: String,
    pub description: Option<String>,
}

#[cfg(windows)]
mod imp {
    use super::ServiceRow;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::ERROR_MORE_DATA;
    use windows::Win32::System::Services::{
        CloseServiceHandle, EnumServicesStatusExW, OpenSCManagerW, SC_ENUM_PROCESS_INFO,
        SC_HANDLE, SC_MANAGER_CONNECT, SC_MANAGER_ENUMERATE_SERVICE, SERVICE_STATE_ALL,
        SERVICE_WIN32,
    };
    use windows_service::service::{
        ServiceAccess, ServiceErrorControl, ServiceInfo, ServiceStartType,
    };
    use windows_service::service_manager::{ServiceManager, ServiceManagerAccess};

    #[repr(C)]
    struct EnumServiceStatusProcessW {
        lp_service_name: *const u16,
        lp_display_name: *const u16,
        service_status_process: ServiceStatusProcess,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct ServiceStatusProcess {
        dw_service_type: u32,
        dw_current_state: u32,
        dw_controls_accepted: u32,
        dw_win32_exit_code: u32,
        dw_service_specific_exit_code: u32,
        dw_check_point: u32,
        dw_wait_hint: u32,
        dw_process_id: u32,
        dw_service_flags: u32,
    }

    fn pwstr_to_string(ptr: *const u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        unsafe {
            let mut len = 0usize;
            while *ptr.add(len) != 0 {
                len += 1;
            }
            let slice = std::slice::from_raw_parts(ptr, len);
            String::from_utf16_lossy(slice)
        }
    }

    fn state_str(s: u32) -> &'static str {
        match s {
            1 => "Stopped",
            2 => "Start Pending",
            3 => "Stop Pending",
            4 => "Running",
            5 => "Continue Pending",
            6 => "Pause Pending",
            7 => "Paused",
            _ => "Unknown",
        }
    }

    fn start_type_str(t: ServiceStartType) -> &'static str {
        match t {
            ServiceStartType::AutoStart => "Automatic",
            ServiceStartType::OnDemand => "Manual",
            ServiceStartType::Disabled => "Disabled",
            ServiceStartType::BootStart => "Boot",
            ServiceStartType::SystemStart => "System",
        }
    }

    fn enumerate_services_raw() -> Result<Vec<ServiceRow>, String> {
        unsafe {
            let scm: SC_HANDLE = OpenSCManagerW(
                PCWSTR::null(),
                PCWSTR::null(),
                SC_MANAGER_CONNECT | SC_MANAGER_ENUMERATE_SERVICE,
            )
            .map_err(|e| format!("OpenSCManagerW: {e}"))?;

            let mut buffer: Vec<u8> = vec![0u8; 64 * 1024];
            let mut rows: Vec<ServiceRow> = Vec::new();
            let mut resume_handle: u32 = 0;

            loop {
                let mut bytes_needed: u32 = 0;
                let mut services_returned: u32 = 0;
                let res = EnumServicesStatusExW(
                    scm,
                    SC_ENUM_PROCESS_INFO,
                    SERVICE_WIN32,
                    SERVICE_STATE_ALL,
                    Some(&mut buffer),
                    &mut bytes_needed,
                    &mut services_returned,
                    Some(&mut resume_handle),
                    PCWSTR::null(),
                );

                let more = match res {
                    Ok(()) => false,
                    Err(e) => {
                        if e.code().0 as u32 & 0xFFFF == ERROR_MORE_DATA.0 {
                            true
                        } else {
                            let _ = CloseServiceHandle(scm);
                            return Err(format!("EnumServicesStatusExW: {e}"));
                        }
                    }
                };

                if services_returned > 0 {
                    let entries = std::slice::from_raw_parts(
                        buffer.as_ptr() as *const EnumServiceStatusProcessW,
                        services_returned as usize,
                    );
                    for e in entries {
                        let name = pwstr_to_string(e.lp_service_name);
                        let display_name = pwstr_to_string(e.lp_display_name);
                        let status = state_str(e.service_status_process.dw_current_state);
                        let pid = if e.service_status_process.dw_process_id == 0 {
                            None
                        } else {
                            Some(e.service_status_process.dw_process_id)
                        };
                        let service_type =
                            format!("0x{:X}", e.service_status_process.dw_service_type);
                        rows.push(ServiceRow {
                            name,
                            display_name,
                            status: status.to_string(),
                            start_type: String::new(),
                            pid,
                            service_type,
                            description: None,
                        });
                    }
                }

                if !more {
                    break;
                }
                // Grow buffer if needed for the next round.
                if bytes_needed as usize > buffer.len() {
                    buffer = vec![0u8; bytes_needed as usize];
                }
            }

            let _ = CloseServiceHandle(scm);
            Ok(rows)
        }
    }

    pub fn list_services() -> Result<Vec<ServiceRow>, String> {
        let mut rows = enumerate_services_raw()?;

        // Augment with start_type via windows-service for each row.
        if let Ok(manager) =
            ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)
        {
            for row in rows.iter_mut() {
                if let Ok(svc) = manager.open_service(&row.name, ServiceAccess::QUERY_CONFIG) {
                    if let Ok(cfg) = svc.query_config() {
                        row.start_type = start_type_str(cfg.start_type).to_string();
                    }
                }
                if row.start_type.is_empty() {
                    row.start_type = "Unknown".into();
                }
            }
        }

        rows.sort_by(|a, b| {
            a.display_name
                .to_lowercase()
                .cmp(&b.display_name.to_lowercase())
        });
        Ok(rows)
    }

    pub fn set_service_state(name: &str, action: &str) -> Result<(), String> {
        let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)
            .map_err(|e| format!("ServiceManager: {e}"))?;

        match action {
            "start" => {
                let svc = manager
                    .open_service(name, ServiceAccess::START)
                    .map_err(|e| format!("open: {e}"))?;
                svc.start::<&str>(&[]).map_err(|e| format!("start: {e}"))?;
            }
            "stop" => {
                let svc = manager
                    .open_service(name, ServiceAccess::STOP)
                    .map_err(|e| format!("open: {e}"))?;
                svc.stop().map_err(|e| format!("stop: {e}"))?;
            }
            "set-auto" => set_start_type(&manager, name, ServiceStartType::AutoStart)?,
            "set-manual" => set_start_type(&manager, name, ServiceStartType::OnDemand)?,
            "set-disabled" => set_start_type(&manager, name, ServiceStartType::Disabled)?,
            _ => return Err(format!("unknown action {action}")),
        }
        Ok(())
    }

    fn set_start_type(
        manager: &ServiceManager,
        name: &str,
        new_start_type: ServiceStartType,
    ) -> Result<(), String> {
        let svc = manager
            .open_service(name, ServiceAccess::CHANGE_CONFIG | ServiceAccess::QUERY_CONFIG)
            .map_err(|e| format!("open: {e}"))?;
        let cfg = svc.query_config().map_err(|e| format!("query: {e}"))?;
        let info = ServiceInfo {
            name: cfg.display_name.clone(),
            display_name: cfg.display_name.clone(),
            service_type: cfg.service_type,
            start_type: new_start_type,
            error_control: ServiceErrorControl::Normal,
            executable_path: std::path::PathBuf::from(
                &cfg.executable_path.to_string_lossy().to_string(),
            ),
            launch_arguments: Vec::new(),
            dependencies: Vec::new(),
            account_name: cfg.account_name.clone(),
            account_password: None,
        };
        svc.change_config(&info).map_err(|e| format!("change: {e}"))?;
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::ServiceRow;
    pub fn list_services() -> Result<Vec<ServiceRow>, String> {
        Ok(Vec::new())
    }
    pub fn set_service_state(_name: &str, _action: &str) -> Result<(), String> {
        Err("services are only supported on Windows".into())
    }
}

#[tauri::command]
pub fn list_services() -> Result<Vec<ServiceRow>, String> {
    imp::list_services()
}

#[tauri::command]
pub fn set_service_state(name: String, action: String) -> Result<(), String> {
    imp::set_service_state(&name, &action)
}
