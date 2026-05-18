import type { ReactNode } from "react";

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--color-fg-strong)]">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            {props.subtitle}
          </p>
        ) : null}
      </div>
      {props.right ? <div className="flex items-center gap-2">{props.right}</div> : null}
    </header>
  );
}
