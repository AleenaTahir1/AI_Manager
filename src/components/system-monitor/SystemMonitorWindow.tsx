import React, { useEffect, useState } from "react";
import { SystemMonitorBar } from "./SystemMonitorBar";
import { loadSettings, type StoredSettings } from "../../lib/store";

export const SystemMonitorWindow: React.FC = () => {
  const [settings, setSettings] = useState<StoredSettings | null>(null);

  useEffect(() => {
    // Ensure transparent body for companion window
    document.body.style.backgroundColor = "transparent";
    document.documentElement.style.backgroundColor = "transparent";

    loadSettings().then((s) => {
      setSettings(s);
      document.documentElement.dataset.theme = s.theme;
    });
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-end bg-transparent overflow-hidden select-none m-0 p-0 pointer-events-none">
      <SystemMonitorBar
        showCpu={settings?.system_monitor_show_cpu ?? true}
        showRam={settings?.system_monitor_show_ram ?? true}
        showNetwork={settings?.system_monitor_show_network ?? true}
        intervalMs={settings?.system_monitor_interval_ms ?? 1000}
        isOverlay={true}
      />
    </div>
  );
};
