import { useMemo } from "react";

export function Sparkline({
  data,
  max,
  color = "var(--color-accent)",
  height = 60,
  fill = true,
}: {
  data: number[];
  max?: number;
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const { d, area } = useMemo(() => {
    if (data.length === 0) return { d: "", area: "" };
    const w = 100;
    const h = 100;
    const m = max ?? Math.max(...data, 1);
    const step = w / Math.max(data.length - 1, 1);
    let pathD = "";
    let areaD = "";
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - (v / m) * h;
      pathD += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
      areaD += `${i === 0 ? `M ${x.toFixed(2)} ${h}` : ""} L ${x.toFixed(2)} ${y.toFixed(2)} `;
    });
    if (fill) areaD += `L ${w} ${h} L 0 ${h} Z`;
    return { d: pathD, area: areaD };
  }, [data, max, fill]);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
    >
      {fill ? (
        <path
          d={area}
          fill={color}
          opacity={0.18}
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
