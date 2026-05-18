export function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const val = n / Math.pow(1024, exp);
  const fixed = val >= 100 ? 0 : val >= 10 ? 1 : 2;
  return `${val.toFixed(fixed)} ${units[exp]}`;
}

export function formatRate(bps: number): string {
  if (bps === 0) return "—";
  return `${formatBytes(bps)}/s`;
}

export function formatPercent(p: number, digits = 1): string {
  if (!Number.isFinite(p)) return "—";
  return `${p.toFixed(digits)}%`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(seconds)}s`;
}
