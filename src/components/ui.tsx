import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...rest}
      className={clsx(
        "no-drag inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
        variant === "primary" &&
          "border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-strong)]",
        variant === "secondary" &&
          "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-strong)] hover:border-[var(--color-border-strong)] hover:bg-[#1c2027]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg-strong)]",
        variant === "danger" &&
          "border-[var(--color-danger)] bg-transparent text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_18%,transparent)]",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={clsx(
        "no-drag h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-fg-strong)] outline-none transition-colors placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]",
        className
      )}
    />
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "yellow" | "red" | "accent";
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tone === "neutral" &&
          "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)]",
        tone === "green" &&
          "border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]",
        tone === "yellow" &&
          "border-[color-mix(in_srgb,var(--color-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_15%,transparent)] text-[var(--color-warn)]",
        tone === "red" &&
          "border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]",
        tone === "accent" &&
          "border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)]"
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "accent",
}: {
  value: number;
  tone?: "accent" | "warn" | "danger" | "success";
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    tone === "warn"
      ? "var(--color-warn)"
      : tone === "danger"
      ? "var(--color-danger)"
      : tone === "success"
      ? "var(--color-success)"
      : "var(--color-accent)";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function Empty({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {Icon ? (
        <Icon className="h-7 w-7 text-[var(--color-muted)]" />
      ) : null}
      <div className="text-sm font-medium text-[var(--color-fg-strong)]">
        {title}
      </div>
      {description ? (
        <div className="max-w-md text-xs text-[var(--color-muted)]">
          {description}
        </div>
      ) : null}
    </div>
  );
}
