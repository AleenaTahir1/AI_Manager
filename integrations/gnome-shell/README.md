# AI Task Manager — GNOME Shell Panel Integration

This directory contains the GNOME Shell extension integration boundary for Linux systems (Ubuntu, Debian, Kali Linux, Fedora).

## Architecture

```text
┌──────────────────────────────────────┐
│       GNOME Shell Top Bar Panel      │
│  [ CPU Cores | RAM 48px | ↑ Net ↓ ]  │
└───────────────────▲──────────────────┘
                    │ IPC / Local Socket
┌───────────────────┴──────────────────┐
│      AI Task Manager Rust Engine     │
│   (Metrics Sampler & System State)   │
└──────────────────────────────────────┘
```

The extension connects to the AI Task Manager metrics endpoint or reads `/tmp/ai_task_manager_metrics.json` / local IPC to render the live Kali-style monitor bar directly within the GNOME panel.

## Installation & Setup

1. Copy the `extension` folder to your local GNOME extensions directory:
   ```bash
   cp -r integrations/gnome-shell/extension ~/.local/share/gnome-shell/extensions/ai-task-manager-monitor@razee4315.github.com
   ```
2. Enable the extension using `gnome-extensions`:
   ```bash
   gnome-extensions enable ai-task-manager-monitor@razee4315.github.com
   ```
3. Restart GNOME Shell (under X11, press `Alt+F2`, type `r`, and press Enter; under Wayland, log out and log back in).
