/**
 * Formats raw bytes/sec into compact, smart Kali-style rate strings.
 * Units: B/s, KB/s, MB/s, GB/s.
 * Examples: 0 B/s, 842 B/s, 12.4 KB/s, 842 KB/s, 1.24 MB/s, 8.42 MB/s, 1.12 GB/s
 */
export function formatNetworkSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return "0 B/s";
  }

  const B = bytesPerSec;
  const KB = 1024;
  const MB = 1024 * 1024;
  const GB = 1024 * 1024 * 1024;

  if (B < KB) {
    return `${Math.round(B)} B/s`;
  }

  if (B < MB) {
    const val = B / KB;
    if (val < 10) {
      return `${cleanDecimals(val.toFixed(2))} KB/s`;
    }
    if (val < 100) {
      return `${cleanDecimals(val.toFixed(1))} KB/s`;
    }
    return `${Math.round(val)} KB/s`;
  }

  if (B < GB) {
    const val = B / MB;
    if (val < 10) {
      return `${cleanDecimals(val.toFixed(2))} MB/s`;
    }
    return `${cleanDecimals(val.toFixed(1))} MB/s`;
  }

  const val = B / GB;
  return `${cleanDecimals(val.toFixed(2))} GB/s`;
}

function cleanDecimals(numStr: string): string {
  return numStr.replace(/\.00$/, "").replace(/(\.[1-9])0$/, "$1");
}
