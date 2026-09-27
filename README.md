# AI Task Manager

A faster, smarter Windows Task Manager built with **Rust**, **Tauri v2**, and **React**. Replaces the default Windows Task Manager with deep process insight, AI-powered explanations, and advanced monitoring features.

![Version](https://img.shields.io/badge/version-0.2.0-blue) ![Platform](https://img.shields.io/badge/platform-Windows-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

### Core (v0.1)
- **Process List** — live-updating table with CPU, Memory, Disk I/O, and trust classification
- **Performance** — 60-second rolling sparkline charts for CPU, Memory, Disk, and Network
- **Services** — browse and start/stop/restart Windows services
- **Startup** — manage startup programs via the Windows Registry
- **AI Insights** — ask an LLM why a process is running or why the system is slow

### New in v0.2

#### 1. Dashboard Page
The app now opens to a live dashboard showing:
- CPU, Memory, Disk, and Network summary cards with sparklines
- Top 5 CPU processes and Top 5 Memory processes
- Security alerts (red-tier processes)
- System info banner (hostname, OS, kernel, uptime)
- AI health summary with a one-click "Diagnose" button

#### 2. Process Tree View
- Toggle between flat-list mode and **tree mode** on the Processes page
- Visualises parent → child process relationships with indentation and chevron expand/collapse
- Expand All / Collapse All shortcuts
- **"End Process Tree"** button kills a process and all its descendants

#### 3. Network Connections Panel
- Select any process and switch to the **Network** tab in the detail panel
- Shows all active TCP4, TCP6, UDP4, and UDP6 sockets owned by that PID
- Displays: Local Address, Remote Address, Protocol, Connection State
- Uses the Windows IP Helper API (`GetExtendedTcpTable` / `GetExtendedUdpTable`)

#### 4. Historical Metrics Storage
- System metrics are now persisted to **SQLite** every 5 seconds
- Retention: **7 days** (older rows are automatically pruned on each write)
- New **History** page with `recharts` AreaChart panels for three time ranges:
  - Last Hour (up to 300 data points)
  - Last 24 Hours (one point per ~5 minutes)
  - Last 7 Days (one point per ~30 minutes)

#### 5. System Tray Support
- **Minimize to tray** — the app hides to the system tray when the window is closed (toggle in Settings)
- **System tray icon** with context menu: Show / Quit
- **Launch at Windows startup** — writes/removes `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
- Both settings are toggleable independently in the Settings page

#### 6. AI Provider Expansion
Six AI providers are supported, selectable in Settings:

| Provider | Auth | Default model |
|----------|------|---------------|
| **OpenRouter** (default) | API key | `google/gemini-2.0-flash-001` |
| **OpenAI** | API key | `gpt-4o-mini` |
| **Anthropic** | API key | `claude-3-haiku-20240307` |
| **Google Gemini** | API key | `gemini-2.0-flash` |
| **Ollama** (local) | None | `llama3.2` |
| **LM Studio** (local) | None | `local-model` |

Changing providers automatically updates the Base URL and model to sensible defaults. Existing OpenRouter configuration is fully preserved.

#### 7. Security Risk Analysis
- Replaces the simple 3-tier classifier with a **7-rule weighted scoring system**:
  - Running from Temp/Downloads directory (+40 points)
  - Running from AppData\Roaming (+20 points)
  - Executable outside standard paths (+10 points)
  - Known Windows system process (returns Safe immediately)
  - Script interpreter/executor (+15 points)
  - No executable path available (+15 points)
  - Running as SYSTEM account (+25 points)
  - Suspicious name pattern match (+30 points)
- Score thresholds: `< 20` = **Green (Safe)**, `20–49` = **Yellow (Review)**, `≥ 50` = **Red (Suspicious)**
- Displayed as a **RiskPanel** in the process detail sidebar with colour-coded tier and bullet-list explanation

---

## Setup

### Prerequisites
- [Rust](https://rustup.rs/) (stable, ≥ 1.77)
- [Node.js](https://nodejs.org/) ≥ 20 with [Bun](https://bun.sh/)
- Windows 10/11 (x64)

### Development
```powershell
# Install frontend dependencies
bun install

# Start the Tauri dev server (frontend + backend)
bun run tauri dev
```

### Production Build
```powershell
bun run tauri build
```

---

## AI Provider Configuration

Navigate to **Settings → AI Provider** to choose your provider.

### OpenRouter (default)
1. Get a free API key at https://openrouter.ai/keys
2. Enter the key in Settings; the default model (`google/gemini-2.0-flash-001`) is free-tier.

### OpenAI
1. Get an API key at https://platform.openai.com/api-keys
2. Select "OpenAI" in the provider dropdown; enter your `sk-…` key.

### Anthropic
1. Get an API key at https://console.anthropic.com/keys
2. Select "Anthropic (Claude)"; enter your `sk-ant-…` key.

### Google Gemini
1. Get an API key at https://aistudio.google.com/app/apikey
2. Select "Google Gemini"; enter your `AIza…` key.

### Ollama (no key required)
1. Install Ollama: https://ollama.com/download
2. Pull a model: `ollama pull llama3.2`
3. Select "Ollama (local)" in Settings — no API key needed.

### LM Studio (no key required)
1. Install LM Studio: https://lmstudio.ai/
2. Load any model and start the local server (default: `http://localhost:1234`)
3. Select "LM Studio (local)" — no API key needed.

---

## SQLite Schema

Database location: `%APPDATA%\com.razee4315.aitaskmanager\metrics.db`

```sql
CREATE TABLE metric_samples (
    ts_ms      INTEGER NOT NULL,   -- Unix timestamp in milliseconds
    cpu        REAL    NOT NULL,   -- CPU total usage (0–100%)
    mem_used   INTEGER NOT NULL,   -- Memory used (bytes)
    mem_total  INTEGER NOT NULL,   -- Total memory (bytes)
    disk_rw    INTEGER NOT NULL,   -- Combined disk read + write (bytes/s)
    net_rxtx   INTEGER NOT NULL    -- Combined network rx + tx (bytes/s)
);

CREATE INDEX idx_ts ON metric_samples (ts_ms);
```

**Retention policy:** Rows older than 7 days (`ts_ms < now - 604800000`) are pruned on every insert.

**Sample interval:** One sample every 5 seconds.

---

## New Dependencies (v0.2)

### Rust
| Crate | Version | Purpose |
|-------|---------|---------|
| `rusqlite` | 0.31 (bundled) | SQLite storage for historical metrics |
| `dirs-next` | 2 | Platform-appropriate `%APPDATA%` path resolution |

> **Note:** `rusqlite` with `features = ["bundled"]` statically links SQLite (~3 MB binary size increase). No external SQLite installation is required.

### Windows crate — new features enabled
```toml
windows = { version = "0.58", features = [
  "Win32_Foundation",
  "Win32_System_Services",
  "Win32_NetworkManagement_IpHelper",  # new: GetExtendedTcpTable/UdpTable
  "Win32_Networking_WinSock",          # new: AF_INET, AF_INET6
] }
```

### Frontend — no new npm dependencies
All new charts use the existing `recharts` package. All new icons use the existing `lucide-react` package.

---

## Architecture Overview

```
src/
├── App.tsx                 # Route state + data refresh loop
├── pages/
│   ├── Dashboard.tsx       # NEW: 8-widget live overview
│   ├── Processes.tsx       # UPDATED: tree view, network tab, risk panel
│   ├── Performance.tsx     # 60s rolling sparklines (unchanged)
│   ├── History.tsx         # NEW: SQLite-backed historical charts
│   ├── AiInsights.tsx      # AI explanations (unchanged)
│   ├── Services.tsx        # Windows Services (unchanged)
│   ├── Startup.tsx         # Startup manager (unchanged)
│   └── Settings.tsx        # UPDATED: provider picker, tray toggles
├── components/
│   ├── Shell.tsx           # UPDATED: 8 nav items
│   ├── RiskPanel.tsx       # NEW: security risk display
│   └── ui.tsx              # Shared primitives (unchanged)
└── lib/
    ├── ipc.ts              # UPDATED: new command wrappers
    └── store.ts            # UPDATED: new settings fields

src-tauri/src/
├── lib.rs                  # UPDATED: tray, DB init, all new commands
├── state.rs                # UPDATED: AppState includes MetricsDb
├── db.rs                   # NEW: SQLite wrapper (MetricsDb)
└── commands/
    ├── process.rs          # UPDATED: risk scoring, kill_process_tree
    ├── network.rs          # NEW: list_connections (Windows IP Helper)
    ├── history.rs          # NEW: query_metric_history
    ├── tray.rs             # NEW: set_autostart, get_autostart_state
    ├── ai.rs               # UPDATED: 6-provider dispatcher
    ├── metrics.rs          # system_snapshot, metrics_history (unchanged)
    ├── services.rs         # Windows Services commands (unchanged)
    └── startup.rs          # Startup registry commands (unchanged)
```

---

## Migration Notes (v0.1 → v0.2)

| Item | Action required |
|------|----------------|
| Settings store | **None** — new fields (`ai_provider`, `minimize_to_tray`, `launch_at_startup`) default automatically via the `{ ...defaults, ...partial }` merge. |
| SQLite database | **Auto-created** on first launch at `%APPDATA%\com.razee4315.aitaskmanager\metrics.db`. |
| `kill_process` API | **Unchanged** — existing calls still work. `kill_process_tree` is additive. |
| `ProcessRow` JSON | **Extended** with `risk_score: u32` and `risk_reasons: string[]`. Existing consumers that don't read these fields are unaffected. |
| `AiConfig` JSON | **Extended** with optional `provider?: string`. Omitting it defaults to `"openrouter"`. |
| Tray behaviour | **Windows close button now hides to tray by default.** Use the tray icon → Quit, or Settings → uncheck "Minimize to tray" to change this. |

---

## Contributing

Pull requests follow the contributor guidelines in `.github/`. Keep modules isolated, avoid large refactors, and match the existing code style (Rust `clippy`, TypeScript strict mode).
