/**
 * RED-method service health classification, shared by the services list,
 * service detail screen, and any future surface that needs to color a
 * service by health.
 */

import type { ServiceItem } from "@sigpocket/shared-types";

import { Brand } from "@/constants/theme";

export type ServiceStatus = "healthy" | "degraded" | "critical";

export const P99_WARN_MS = 500;
export const P99_CRIT_MS = 2000;
export const ERR_RATE_WARN = 0.01; // 1%
export const ERR_RATE_CRIT = 0.05; // 5%

export function serviceStatus(item: ServiceItem): ServiceStatus {
  const errRate = item.numCalls > 0 ? item.numErrors / item.numCalls : 0;
  const p99Ms = item.p99 / 1_000_000;
  if (errRate >= ERR_RATE_CRIT || p99Ms >= P99_CRIT_MS) return "critical";
  if (errRate >= ERR_RATE_WARN || p99Ms >= P99_WARN_MS) return "degraded";
  return "healthy";
}

export const STATUS_COLORS: Record<ServiceStatus, string> = {
  healthy: Brand.green400,
  degraded: Brand.amber400,
  critical: Brand.red400,
};

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  critical: "Critical",
};
