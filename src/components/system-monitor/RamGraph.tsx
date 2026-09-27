import React from "react";

interface RamGraphProps {
  ramPercent: number; // 0 - 100
  history: number[]; // rolling history array of percentages
  height?: number;
}

export const RamGraph: React.FC<RamGraphProps> = ({
  ramPercent,
  history,
  height = 36,
}) => {
  // Take last 14-16 data points for the 48px sparkline
  const points = history.length > 0 ? history.slice(-16) : [ramPercent];

  const svgWidth = 48;
  const sparkHeight = height;

  const polyPoints = points
    .map((val, idx) => {
      const x = (idx / Math.max(1, points.length - 1)) * svgWidth;
      const y = sparkHeight - (Math.max(4, Math.min(100, val)) / 100) * (sparkHeight - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Closed area polygon for subtle under-fill
  const areaPoints = `0,${sparkHeight} ${polyPoints} ${svgWidth},${sparkHeight}`;

  const color =
    ramPercent >= 90
      ? "var(--color-danger, #f06c6c)"
      : ramPercent >= 75
      ? "var(--color-amber, #f59e0b)"
      : "var(--color-accent, #5b8def)";

  return (
    <div
      className="w-[48px] flex items-center justify-center select-none shrink-0 overflow-hidden"
      style={{ height: `${height}px` }}
      title={`RAM: ${ramPercent.toFixed(1)}%`}
    >
      <svg
        width={svgWidth}
        height={sparkHeight}
        className="w-full h-full overflow-hidden"
      >
        <polygon
          points={areaPoints}
          fill={color}
          fillOpacity="0.18"
        />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyPoints}
        />
      </svg>
    </div>
  );
};
