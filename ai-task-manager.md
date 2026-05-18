# RFP — Windows AI Task Manager (Tauri v2)

**Wave:** 5 · **Stack:** Rust + Tauri v2 + Windows APIs + local LLM optional · **Pace:** AI-accelerated — **target 7 days**

---

## A. PUBLIC UPWORK POST

**Title:**
`AI-Native Rust/Tauri Dev — Ship AI Task Manager for Windows (Process Insights + Fast UI)`

**Skills tags:**
`Rust, Tauri, Claude Code, Cursor, Windows API, process management, performance monitoring, LLM, system tray`

**Scope:**
- Level: Expert
- Size: Small (target 7 days)
- Could become full-time: Yes
- Location: Worldwide

**Description (paste verbatim):**

> AI-native Rust + Tauri dev needed to ship a replacement for Windows Task Manager. Faster UI, better information density, AI-powered process explanations ("what is svchost.exe doing? why is RAM at 80%?"), one-click optimisation suggestions.
>
> The existing Task Manager hasn't meaningfully improved since Windows 10. Power users want more.
>
> **Must-haves:**
> - **AI agentic coding expert** — Claude Code / Cursor / Aider daily
> - **Speed obsession** — target 7 days
> - Rust fluency
> - Tauri v2 shipped before
> - Windows API process / performance monitoring experience
> - **LLM integration** (OpenRouter, Anthropic, or local Ollama)
>
> **Core scope:**
> - Tauri v2 desktop app
> - Process list with: PID, name, CPU%, RAM, disk I/O, network I/O, GPU%
> - Live sortable / filterable / searchable
> - Per-process detail panel: parent, command line, services, file handles, threads, suspicious score
> - AI explanation: "What is this process? Is it safe to end?"
> - AI optimisation suggestions on demand ("Why is my RAM at 80%?")
> - Startup app manager
> - Service manager (start / stop / disable)
> - Resource history graphs (CPU, RAM, disk, network) — last 60 sec
> - Sub-10MB install, sub-50MB RAM
>
> **Nice to have:**
> - Local LLM via Ollama for offline mode
> - Process tree visualisation
> - Network connection inspector
>
> **Apply with:**
> 1. AI agentic tool + example
> 2. Day-by-day plan
> 3. Fixed bid
> 4. Which API you'd use to enumerate processes + their network connections (and why not `tasklist`)
>
> **Disqualifiers:** plans involving WMI for hot paths, no AI tooling, > 2 week timeline. Faster + concrete = priority.

**Advanced filters:** JSS ≥ 90%, Earned ≥ $2,500

---

## B. PRIVATE PRD (send after NDA)

### B.1. Project context

Windows Task Manager has 3 things people want: process list, performance graphs, startup manager. It has 30 things they don't. The UI is slow on Windows 11 specifically (the redesign made it worse).

Alternative tools exist (Process Explorer, Process Hacker, System Informer) — but they're built for engineers, with 1990s UIs. Gap = a tool that gives a power user **clear, fast, intelligent** insight into their system.

The "AI" angle is the differentiator: any process can be selected → ask "what is this?" → LLM explains with cached lookups + live web search. Trust signals: known-good, known-malware, unknown. Practical: "your RAM is high, here's why: Chrome has 12 tabs eating 4GB."

Revenue: $19 one-time, $29 Pro tier with offline LLM via Ollama.

### B.2. Architecture

```
┌─────────────────────────────────────────────────┐
│  Tauri v2 app                                   │
│                                                 │
│  ┌──────────────────┐    ┌──────────────────┐  │
│  │  Rust backend    │◀──▶│  WebView2 UI     │  │
│  │  - PDH counters  │    │  (process list,  │  │
│  │  - Toolhelp32    │    │   detail panel,  │  │
│  │  - PSAPI         │    │   AI chat panel) │  │
│  │  - LLM client    │    │                  │  │
│  └──────────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────┘
        │                            │
        ▼                            ▼
   Windows APIs                 LLM provider
   - PDH (perf counters)        - OpenRouter (default)
   - PSAPI (memory info)        - Ollama (offline tier)
   - Toolhelp32 (snapshots)     - Anthropic / OpenAI direct
   - WTSAPI (sessions)
   - NetStat / iphlpapi
```

### B.3. Process list — required columns

- PID
- Name
- CPU% (live, EWMA-smoothed over 2s)
- RAM (working set + private bytes)
- Disk I/O (read + write per sec)
- Network I/O (bytes in + out per sec)
- GPU% (DXGI)
- Status (running / suspended / not responding)
- Threat score (badge: green / yellow / red, derived from heuristics + LLM)

Sortable by any column. Filterable by:
- Name regex
- User session
- "Only top 10 by CPU"
- "Only top 10 by RAM"
- "Show services"

### B.4. AI explanations

**Per-process explain:**
- Click process → "Ask AI"
- Prompt includes: process name, path, parent, command line, file metadata
- LLM responds: what this process is, normal context, when to worry
- Result cached locally (process name + hash → explanation) — repeated lookups are instant

**System-level explain:**
- "Why is my system slow?" button
- Backend gathers: top 5 CPU, top 5 RAM, services consuming resources, recent system events
- LLM returns prioritised recommendations
- Example output: "Chrome is using 4GB with 12 tabs. Spotify background updater is consuming 8% CPU intermittently. Windows Search is reindexing — wait 10 min."

**Threat heuristics (rule-based, before LLM):**
- Unsigned binary in `%TEMP%` = yellow
- Unsigned binary in `%TEMP%` with network activity = red
- Known good (signed by Microsoft / common vendors) = green
- LLM gets called for ambiguous cases

### B.5. Performance graphs (last 60s)

- CPU total + per-core
- RAM committed + cached
- Disk per physical disk
- Network per adapter
- GPU per device

Sample rate: 1 Hz. Ring buffer of 60 samples. Sparkline-style rendering in WebView2 via lightweight Canvas / SVG.

### B.6. Startup manager

- Lists everything that auto-starts: Registry Run keys, Startup folder, Scheduled Tasks, Services set to Auto
- Per-entry: enabled / disabled toggle, last run, impact estimate
- "Why is this on?" AI explain per entry
- Source attribution (which install added this)

### B.7. Service manager

- List Windows services
- Start / stop / restart / set startup type
- Search + filter
- Dependencies visualisation

### B.8. Deliverables (milestones — days)

| # | Milestone | Deliverable | Target | % |
|---|---|---|---|---|
| 1 | Tauri scaffold + process enumeration | Live process list with all required columns | Day 1–2 | 25% |
| 2 | Performance graphs + history | Live graphs for CPU / RAM / disk / network / GPU | Day 3 | 15% |
| 3 | AI explanations + threat heuristics | Per-process explain panel, system-level explain, threat badges | Day 4–5 | 25% |
| 4 | Startup + service managers | Both managers with full CRUD where applicable | Day 6 | 20% |
| 5 | Polish + installer + handoff | Settings UI, MSIX installer, README + ops runbook | Day 7 | 15% |

### B.9. Tech stack (non-negotiable)

- **Rust** stable
- **Tauri v2**
- **windows-rs** for Win32 calls
- **PDH** (Performance Data Helper) for live counters — NOT WMI (too slow)
- **NtQuerySystemInformation** for fast process info (faster than Toolhelp32 for many use cases)
- **WebView2** UI: Vite + TypeScript + Tailwind v4 + Recharts for graphs
- **OpenRouter** for LLM (Gemini Flash for explanations — never Sonnet for cost)
- **Ollama HTTP client** (optional, Pro tier)
- **Installer**: MSIX + NSIS

### B.10. Quality gates

- [ ] Process list refresh rate ≥ 2 Hz without UI lag
- [ ] App handles > 500 processes without slowdown
- [ ] AI explanation latency < 3s (cached) or < 6s (fresh)
- [ ] Threat score has < 1% false positive on a clean system
- [ ] Startup manager modifies the right scope (HKCU vs HKLM correctly)
- [ ] Service stop / start works with proper permission handling (UAC elevation prompt when needed)
- [ ] Installer < 10 MB
- [ ] RAM usage stays < 80 MB with 200 processes shown
- [ ] No telemetry, no logging beyond local debug logs

### B.11. Reference

- WhisperFlow Tauri v2 app for reference
- Process Explorer / Process Hacker / System Informer for feature reference (don't copy their UIs)
- Windows Performance Counter docs: [https://learn.microsoft.com/en-us/windows/win32/perfctrs/](https://learn.microsoft.com/en-us/windows/win32/perfctrs/)

### B.12. Risks / failure modes

- **WMI is slow.** Don't use it on hot paths. PDH + NtQuerySystemInformation for live data.
- **Per-process network I/O is hard.** Use ETW (Event Tracing for Windows) sessions for accurate per-PID network attribution. PowerShell `Get-NetTCPConnection` is too coarse.
- **GPU% per-process needs PerformanceCounters.GPUEngine** — Windows 10 1803+. Document Windows version requirement.
- **UAC elevation needed for some operations** (start/stop certain services, modify HKLM). Build a separate elevated helper exe — don't run the whole app as admin.
- **LLM explanations of malware are sensitive.** Add disclaimer + "report as malware" affordance.

### B.13. Hiring profile

- Rust dev with shipped Tauri product
- Has worked with Windows perf counters or process inspection at the API level
- Bonus: cybersecurity / DFIR background
- Filter call: ask them why `Toolhelp32` snapshots aren't enough on their own. Right answer: incomplete data (missing CPU%, no live updates, slow). Wrong answer: "they're fine".

### B.14. What's NOT in scope

- Anti-malware functionality
- File system browser
- Registry editor
- Kernel-mode driver work
- Cross-machine remote process management
- Forensics / memory dump capture
