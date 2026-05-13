/**
 * Formatters shared across screens. Single source so the services list,
 * service detail, traces, logs, and charts can't drift in how they round.
 */

export function formatLatency(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatLatencyParts(ms: number): { value: string; unit: string } {
  if (ms < 1) return { value: (ms * 1000).toFixed(0), unit: "µs" };
  if (ms < 1000) return { value: ms.toFixed(0), unit: "ms" };
  return { value: (ms / 1000).toFixed(2), unit: "s" };
}

/** rpm = calls per minute. */
export function formatRpm(rpm: number): string {
  if (rpm < 1) return `${rpm.toFixed(2)}/m`;
  if (rpm < 1000) return `${rpm.toFixed(0)}/m`;
  return `${(rpm / 1000).toFixed(1)}k/m`;
}

export function formatRpmParts(rpm: number): { value: string; unit: string } {
  if (rpm < 1) return { value: rpm.toFixed(2), unit: "/m" };
  if (rpm < 1000) return { value: rpm.toFixed(0), unit: "/m" };
  return { value: (rpm / 1000).toFixed(1), unit: "k/m" };
}

/** Takes a per-second rate and renders as rpm. */
export function formatRate(perSec: number): string {
  return formatRpm(perSec * 60);
}

export function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function relativeTime(ts: number | undefined): string {
  if (!ts) return "—";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
