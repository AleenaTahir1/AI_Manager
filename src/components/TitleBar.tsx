import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Activity,
  PanelLeft,
  Sun,
  Moon,
  Minus,
  Square,
  Copy,
  X,
} from "lucide-react";

interface TitleBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  sidebarCollapsed,
  onToggleSidebar,
  theme,
  onToggleTheme,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const checkMaximized = async () => {
      try {
        const appWindow = getCurrentWindow();
        setIsMaximized(await appWindow.isMaximized());
        unlisten = await appWindow.onResized(async () => {
          setIsMaximized(await appWindow.isMaximized());
        });
      } catch (err) {
        console.warn("TitleBar window check error:", err);
      }
    };
    checkMaximized();
    return () => {
      unlisten?.();
    };
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.warn("Minimize error:", e);
    }
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const appWindow = getCurrentWindow();
      const maximized = await appWindow.isMaximized();
      if (maximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
    } catch (err) {
      console.warn("Maximize toggle error:", err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.warn("Close error:", e);
    }
  };

  return (
    <header className="h-8 w-full bg-[var(--color-surface)] border-b border-[var(--color-border)] select-none flex items-center justify-between text-xs z-50 shrink-0">
      {/* Left: App Brand & Sidebar Toggle */}
      <div className="flex items-center gap-2 px-3 no-drag z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSidebar();
          }}
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-fg-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-strong)] flex items-center justify-center text-white shadow-sm pointer-events-none">
            <Activity className="w-2.5 h-2.5" />
          </div>
          <span className="font-semibold tracking-tight text-[11px] text-[var(--color-fg-strong)] pointer-events-none">
            AI Task Manager
          </span>
        </div>
      </div>

      {/* Center: Draggable Titlebar Region with Double-Click to Maximize */}
      <div
        data-tauri-drag-region
        onDoubleClick={() => handleToggleMaximize()}
        className="flex-1 h-full drag-region cursor-default flex items-center justify-center"
      />

      {/* Right: Theme Toggle & Window Controls */}
      <div className="flex items-center h-full no-drag z-10">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTheme();
          }}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="h-8 px-2.5 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-3.5 h-3.5 text-[var(--color-amber)]" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          )}
        </button>

        <div className="w-[1px] h-3.5 bg-[var(--color-border)] my-auto mx-1 pointer-events-none" />

        {/* Window Controls */}
        <button
          type="button"
          onClick={handleMinimize}
          title="Minimize"
          className="h-8 w-11 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
          className="h-8 w-11 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
        >
          {isMaximized ? (
            <Copy className="w-3 h-3" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          title="Close"
          className="h-8 w-11 flex items-center justify-center text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-danger)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
