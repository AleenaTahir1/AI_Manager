# AI Task Manager

A faster, smarter replacement for Windows Task Manager. Live process insight, performance graphs over a rolling 60-second window, startup and service management, and on-demand AI explanations for any process or system state. Built with Rust + Tauri v2 + React.

## Features

- **Processes** — sortable, filterable, searchable list with CPU, memory, disk I/O, status, and a rule-based trust badge. Per-process detail panel with command line, working directory, and parent PID. End process with one click.
- **Performance** — CPU (total + per core), memory, disk and network, sparklines over a rolling 60-second window. 1 Hz sampling in a background Rust thread.
- **Startup** — registry Run keys (HKCU / HKLM, both 64-bit and WOW64) plus the user and system Startup folders. Enable / disable entries via Explorer's StartupApproved keys.
- **Services** — enumerate all Windows services, show display name, status, start type and PID, start / stop services that allow it.
- **AI Insights** — bring your own OpenRouter API key (Gemini Flash by default). Ask "what is this process?" for any selected process, or ask the system to diagnose "why is it slow?" with the top processes as context. Process explanations are cached locally by signature so repeated lookups are instant.
- **Settings** — configure API key, model, base URL, and refresh rate. Everything stored locally via the Tauri store plugin.

## Tech

- **Rust** stable + **Tauri v2**
- **sysinfo** for fast cross-platform process and resource sampling
- **windows-service** and **winreg** for Windows-specific service and startup management
- **React 18** + **TypeScript** + **Tailwind v4** + **lucide-react** icons
- **Bun** as the package manager / dev server

## Develop

```pwsh
bun install
bun run tauri dev
```

## Build

```pwsh
bun run tauri build
```

The release pipeline auto-bumps the patch version, builds installers for Windows (`.msi` + `.exe`), and publishes a GitHub Release on every push to `main`. See `.github/workflows/release.yml`.

## Project layout

```
src/                React frontend (Vite + Tailwind v4)
src-tauri/          Rust backend
  src/commands/     Tauri IPC commands (processes, services, startup, metrics, AI)
  src/state.rs      Shared state + 1 Hz metrics sampler thread
.github/workflows/  CI + Release pipelines
```

## License

MIT.
