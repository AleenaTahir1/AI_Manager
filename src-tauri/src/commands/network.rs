/// Network connections panel — Feature 2.
///
/// Uses the Windows IP Helper API to enumerate active TCP and UDP endpoints
/// with their owning PIDs. The `windows` crate is already a project dependency
/// so no new crate is needed.
use serde::Serialize;
use tauri::State;
use std::sync::Arc;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct NetConnection {
    pub pid: u32,
    pub protocol: String,
    pub local_addr: String,
    pub remote_addr: String,
    pub state: String,
}

#[cfg(target_os = "windows")]
mod win_net {
    use super::NetConnection;
    use std::net::{Ipv4Addr, Ipv6Addr};

    use windows::Win32::NetworkManagement::IpHelper::{
        GetExtendedTcpTable, GetExtendedUdpTable,
        MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID,
        MIB_TCPROW_OWNER_PID, MIB_TCPTABLE_OWNER_PID,
        MIB_UDP6ROW_OWNER_PID, MIB_UDP6TABLE_OWNER_PID,
        MIB_UDPROW_OWNER_PID, MIB_UDPTABLE_OWNER_PID,
        TCP_TABLE_OWNER_PID_ALL, UDP_TABLE_OWNER_PID,
    };
    use windows::Win32::Networking::WinSock::AF_INET6;
    use windows::Win32::Foundation::NO_ERROR;

    fn tcp_state_str(state: u32) -> &'static str {
        match state {
            1 => "CLOSED",
            2 => "LISTEN",
            3 => "SYN_SENT",
            4 => "SYN_RCVD",
            5 => "ESTABLISHED",
            6 => "FIN_WAIT1",
            7 => "FIN_WAIT2",
            8 => "CLOSE_WAIT",
            9 => "CLOSING",
            10 => "LAST_ACK",
            11 => "TIME_WAIT",
            12 => "DELETE_TCB",
            _ => "UNKNOWN",
        }
    }

    fn fmt_ipv4_port(addr: u32, port: u32) -> String {
        let ip = Ipv4Addr::from(addr.to_ne_bytes());
        let p = u16::from_be(port as u16);
        format!("{}:{}", ip, p)
    }

    fn fmt_ipv6_port(addr: &[u8; 16], port: u32) -> String {
        let ip = Ipv6Addr::from(*addr);
        let p = u16::from_be(port as u16);
        format!("[{}]:{}", ip, p)
    }

    pub fn list_tcp4(filter_pid: Option<u32>) -> Vec<NetConnection> {
        let mut buf_len: u32 = 0;
        unsafe {
            let _ = GetExtendedTcpTable(
                None, &mut buf_len, false,
                windows::Win32::Networking::WinSock::AF_INET.0 as u32,
                TCP_TABLE_OWNER_PID_ALL, 0,
            );
        }
        if buf_len == 0 { return Vec::new(); }

        let mut buf: Vec<u8> = vec![0u8; buf_len as usize];
        let result = unsafe {
            GetExtendedTcpTable(
                Some(buf.as_mut_ptr() as *mut _), &mut buf_len, false,
                windows::Win32::Networking::WinSock::AF_INET.0 as u32,
                TCP_TABLE_OWNER_PID_ALL, 0,
            )
        };
        if result != NO_ERROR.0 { return Vec::new(); }

        let table = unsafe { &*(buf.as_ptr() as *const MIB_TCPTABLE_OWNER_PID) };
        let count = table.dwNumEntries as usize;
        let rows = unsafe {
            std::slice::from_raw_parts(
                table.table.as_ptr() as *const MIB_TCPROW_OWNER_PID,
                count,
            )
        };

        rows.iter()
            .filter(|r| filter_pid.map_or(true, |p| r.dwOwningPid == p))
            .map(|r| NetConnection {
                pid: r.dwOwningPid,
                protocol: "TCP".into(),
                local_addr: fmt_ipv4_port(r.dwLocalAddr, r.dwLocalPort),
                remote_addr: fmt_ipv4_port(r.dwRemoteAddr, r.dwRemotePort),
                state: tcp_state_str(r.dwState).to_string(),
            })
            .collect()
    }

    pub fn list_tcp6(filter_pid: Option<u32>) -> Vec<NetConnection> {
        let mut buf_len: u32 = 0;
        unsafe {
            let _ = GetExtendedTcpTable(
                None, &mut buf_len, false,
                AF_INET6.0 as u32,
                TCP_TABLE_OWNER_PID_ALL, 0,
            );
        }
        if buf_len == 0 { return Vec::new(); }

        let mut buf: Vec<u8> = vec![0u8; buf_len as usize];
        let result = unsafe {
            GetExtendedTcpTable(
                Some(buf.as_mut_ptr() as *mut _), &mut buf_len, false,
                AF_INET6.0 as u32,
                TCP_TABLE_OWNER_PID_ALL, 0,
            )
        };
        if result != NO_ERROR.0 { return Vec::new(); }

        let table = unsafe { &*(buf.as_ptr() as *const MIB_TCP6TABLE_OWNER_PID) };
        let count = table.dwNumEntries as usize;
        let rows = unsafe {
            std::slice::from_raw_parts(
                table.table.as_ptr() as *const MIB_TCP6ROW_OWNER_PID,
                count,
            )
        };

        rows.iter()
            .filter(|r| filter_pid.map_or(true, |p| r.dwOwningPid == p))
            .map(|r| NetConnection {
                pid: r.dwOwningPid,
                protocol: "TCP6".into(),
                local_addr: fmt_ipv6_port(&r.ucLocalAddr, r.dwLocalPort),
                remote_addr: fmt_ipv6_port(&r.ucRemoteAddr, r.dwRemotePort),
                state: tcp_state_str(r.dwState).to_string(),
            })
            .collect()
    }

    pub fn list_udp4(filter_pid: Option<u32>) -> Vec<NetConnection> {
        let mut buf_len: u32 = 0;
        unsafe {
            let _ = GetExtendedUdpTable(
                None, &mut buf_len, false,
                windows::Win32::Networking::WinSock::AF_INET.0 as u32,
                UDP_TABLE_OWNER_PID, 0,
            );
        }
        if buf_len == 0 { return Vec::new(); }

        let mut buf: Vec<u8> = vec![0u8; buf_len as usize];
        let result = unsafe {
            GetExtendedUdpTable(
                Some(buf.as_mut_ptr() as *mut _), &mut buf_len, false,
                windows::Win32::Networking::WinSock::AF_INET.0 as u32,
                UDP_TABLE_OWNER_PID, 0,
            )
        };
        if result != NO_ERROR.0 { return Vec::new(); }

        let table = unsafe { &*(buf.as_ptr() as *const MIB_UDPTABLE_OWNER_PID) };
        let count = table.dwNumEntries as usize;
        let rows = unsafe {
            std::slice::from_raw_parts(
                table.table.as_ptr() as *const MIB_UDPROW_OWNER_PID,
                count,
            )
        };

        rows.iter()
            .filter(|r| filter_pid.map_or(true, |p| r.dwOwningPid == p))
            .map(|r| NetConnection {
                pid: r.dwOwningPid,
                protocol: "UDP".into(),
                local_addr: fmt_ipv4_port(r.dwLocalAddr, r.dwLocalPort),
                remote_addr: "*:*".into(),
                state: "—".into(),
            })
            .collect()
    }

    pub fn list_udp6(filter_pid: Option<u32>) -> Vec<NetConnection> {
        let mut buf_len: u32 = 0;
        unsafe {
            let _ = GetExtendedUdpTable(
                None, &mut buf_len, false,
                AF_INET6.0 as u32,
                UDP_TABLE_OWNER_PID, 0,
            );
        }
        if buf_len == 0 { return Vec::new(); }

        let mut buf: Vec<u8> = vec![0u8; buf_len as usize];
        let result = unsafe {
            GetExtendedUdpTable(
                Some(buf.as_mut_ptr() as *mut _), &mut buf_len, false,
                AF_INET6.0 as u32,
                UDP_TABLE_OWNER_PID, 0,
            )
        };
        if result != NO_ERROR.0 { return Vec::new(); }

        let table = unsafe { &*(buf.as_ptr() as *const MIB_UDP6TABLE_OWNER_PID) };
        let count = table.dwNumEntries as usize;
        let rows = unsafe {
            std::slice::from_raw_parts(
                table.table.as_ptr() as *const MIB_UDP6ROW_OWNER_PID,
                count,
            )
        };

        rows.iter()
            .filter(|r| filter_pid.map_or(true, |p| r.dwOwningPid == p))
            .map(|r| NetConnection {
                pid: r.dwOwningPid,
                protocol: "UDP6".into(),
                local_addr: fmt_ipv6_port(&r.ucLocalAddr, r.dwLocalPort),
                remote_addr: "*:*".into(),
                state: "—".into(),
            })
            .collect()
    }
}

/// List active network connections. Optionally filter by PID.
#[tauri::command]
pub fn list_connections(
    _state: State<'_, Arc<AppState>>,
    pid: Option<u32>,
) -> Vec<NetConnection> {
    #[cfg(target_os = "windows")]
    {
        let mut all = Vec::new();
        all.extend(win_net::list_tcp4(pid));
        all.extend(win_net::list_tcp6(pid));
        all.extend(win_net::list_udp4(pid));
        all.extend(win_net::list_udp6(pid));
        // Sort: TCP first, then by PID
        all.sort_by(|a, b| a.protocol.cmp(&b.protocol).then(a.pid.cmp(&b.pid)));
        all
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = pid;
        Vec::new()
    }
}
