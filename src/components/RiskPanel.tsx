import { AlertTriangle, ShieldCheck, ShieldAlert, Shield } from "lucide-react";

export function RiskPanel(props: {
  score: number;
  level: "green" | "yellow" | "red" | string;
  reasons: string[];
}) {
  const { score, level, reasons } = props;

  const config = {
    green: {
      icon: ShieldCheck,
      label: "Safe",
      bg: "bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]",
      border: "border-[color-mix(in_srgb,var(--color-success)_35%,transparent)]",
      text: "text-[var(--color-success)]",
      iconColor: "var(--color-success)",
    },
    yellow: {
      icon: Shield,
      label: "Review",
      bg: "bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)]",
      border: "border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)]",
      text: "text-[var(--color-warn)]",
      iconColor: "var(--color-warn)",
    },
    red: {
      icon: ShieldAlert,
      label: "Suspicious",
      bg: "bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]",
      border: "border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]",
      text: "text-[var(--color-danger)]",
      iconColor: "var(--color-danger)",
    },
  }[level] ?? {
    icon: Shield,
    label: "Unknown",
    bg: "bg-[var(--color-surface-2)]",
    border: "border-[var(--color-border)]",
    text: "text-[var(--color-muted)]",
    iconColor: "var(--color-muted)",
  };

  const Icon = config.icon;

  return (
    <div
      className={`rounded-md border px-3 py-2.5 ${config.bg} ${config.border}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon
            className="h-3.5 w-3.5"
            style={{ color: config.iconColor }}
          />
          <span className={`text-xs font-semibold ${config.text}`}>
            Security: {config.label}
          </span>
        </div>
        <span className={`text-numeric text-[10px] font-medium ${config.text}`}>
          Score {score}
        </span>
      </div>

      <ul className="space-y-0.5">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--color-muted)]">
            <AlertTriangle
              className="mt-px h-3 w-3 shrink-0"
              style={{ color: config.iconColor, opacity: 0.7 }}
            />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
