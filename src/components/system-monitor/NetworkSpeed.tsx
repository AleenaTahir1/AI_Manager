import React from "react";
import { formatNetworkSpeed } from "./formatNetworkSpeed";

interface NetworkSpeedProps {
  uploadBps: number;
  downloadBps: number;
  height?: number;
}

export const NetworkSpeed: React.FC<NetworkSpeedProps> = ({
  uploadBps,
  downloadBps,
  height = 36,
}) => {
  const upFormatted = formatNetworkSpeed(uploadBps);
  const downFormatted = formatNetworkSpeed(downloadBps);

  return (
    <div
      className="flex flex-col justify-center gap-0.5 font-mono text-[13px] leading-tight select-none min-w-[76px] text-white"
      style={{ height: `${height}px` }}
      title={`Network: ↑ ${upFormatted} (Upload) | ↓ ${downFormatted} (Download)`}
    >
      {/* Top Row: Upload */}
      <div className="flex items-center gap-1 text-white">
        <span className="font-semibold text-[13px] text-[var(--color-amber-soft, #fbbf24)] leading-none">↑</span>
        <span className="text-numeric font-medium tracking-tight text-white leading-none">
          {upFormatted}
        </span>
      </div>

      {/* Bottom Row: Download */}
      <div className="flex items-center gap-1 text-white">
        <span className="font-semibold text-[13px] text-[var(--color-accent, #5b8def)] leading-none">↓</span>
        <span className="text-numeric font-medium tracking-tight text-white leading-none">
          {downFormatted}
        </span>
      </div>
    </div>
  );
};
