import React from "react";

interface CpuCoreGraphProps {
  cores: number[]; // 0 - 100% per logical core
  height?: number;
}

export const CpuCoreGraph: React.FC<CpuCoreGraphProps> = ({
  cores,
  height = 36,
}) => {
  const coreCount = cores.length;
  // Slightly wider bars for better visibility
  const barWidth = coreCount > 32 ? 3 : coreCount > 16 ? 4 : coreCount > 8 ? 5 : 6;

  const getBarColor = (pct: number) => {
    if (pct >= 90) return "var(--color-danger, #f06c6c)";
    if (pct >= 70) return "var(--color-amber, #f59e0b)";
    if (pct >= 40) return "var(--color-accent, #5b8def)";
    return "var(--color-success, #4ade80)";
  };

  return (
    <div
      className="flex items-end gap-[1.5px] select-none h-full"
      style={{ height: `${height}px` }}
      title={`CPU Cores (${coreCount}): ${cores.map((c, i) => `#${i}: ${Math.round(c)}%`).join(", ")}`}
    >
      {cores.map((usage, idx) => {
        const clamped = Math.max(4, Math.min(100, usage));
        const barColor = getBarColor(usage);

        return (
          <div
            key={idx}
            className="flex flex-col justify-end h-full bg-[var(--color-surface-2)]/60 rounded-[0.5px] overflow-hidden"
            style={{ width: `${barWidth}px` }}
          >
            <div
              className="w-full transition-all duration-300 ease-out"
              style={{
                height: `${clamped}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
