import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { ServiceItem } from "@sigpocket/shared-types";

import { ChartSkeleton, SparklineChart } from "@/components/sparkline-chart";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSignozClient } from "@/hooks/use-signoz-client";
import { useInstanceStore } from "@/stores/instance-store";

// ── Status logic (shared with services list) ──────────────────

type Status = "healthy" | "degraded" | "critical";

const P99_WARN_MS = 500;
const P99_CRIT_MS = 2000;
const ERR_RATE_WARN = 0.01;
const ERR_RATE_CRIT = 0.05;

function serviceStatus(item: ServiceItem): Status {
  const errRate = item.numCalls > 0 ? item.numErrors / item.numCalls : 0;
  const p99Ms = item.p99 / 1_000_000;
  if (errRate >= ERR_RATE_CRIT || p99Ms >= P99_CRIT_MS) return "critical";
  if (errRate >= ERR_RATE_WARN || p99Ms >= P99_WARN_MS) return "degraded";
  return "healthy";
}

const STATUS_COLORS: Record<Status, string> = {
  healthy: Brand.green400,
  degraded: Brand.amber500,
  critical: Brand.red400,
};

const STATUS_LABELS: Record<Status, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  critical: "Critical",
};

// ── Time range ────────────────────────────────────────────────

type TimeRange = { label: string; hours: number; step: number };

const TIME_RANGES: TimeRange[] = [
  { label: "1h", hours: 1, step: 60 },
  { label: "6h", hours: 6, step: 300 },
  { label: "24h", hours: 24, step: 900 },
];

// ── Screen ────────────────────────────────────────────────────

export default function ServiceDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = TIME_RANGES[rangeIdx];

  const tint = useThemeColor({}, "tint");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const errorColor = useThemeColor({}, "error");

  // Fetch service RED metrics (reuses the services list cache)
  const { data: services } = useQuery({
    queryKey: ["services", activeId],
    queryFn: () => client!.fetchServices(6),
    enabled: !!client,
  });

  const service = useMemo(
    () => services?.find((s) => s.serviceName === name),
    [services, name],
  );

  // Fetch p95 latency chart data
  const {
    data: chartData,
    isLoading: chartLoading,
    error: chartError,
    refetch: refetchChart,
    isRefetching,
  } = useQuery({
    queryKey: ["p95", name, range.hours],
    queryFn: () => client!.fetchP95Latency(name, range.hours, range.step),
    enabled: !!client && !!name,
  });

  const status = service ? serviceStatus(service) : null;
  const dotColor = status ? STATUS_COLORS[status] : Brand.robin400;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchChart} tintColor={tint} />
        }
      >
        {/* ── Header ──────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle" numberOfLines={2}>
              {name}
            </ThemedText>
            {status && (
              <ThemedText style={{ color: dotColor, fontSize: FontSize.sm, fontWeight: "500" }}>
                {STATUS_LABELS[status]}
              </ThemedText>
            )}
          </View>
        </View>

        {/* ── Summary metrics ─────────────────── */}
        {service && <MetricsSummary service={service} />}

        {/* ── Time range selector ─────────────── */}
        <View style={styles.rangeBar}>
          <ThemedText type="caption">P95 LATENCY</ThemedText>
          <View style={styles.rangePills}>
            {TIME_RANGES.map((r, i) => {
              const active = i === rangeIdx;
              return (
                <Pressable
                  key={r.label}
                  onPress={() => setRangeIdx(i)}
                  style={[
                    styles.rangePill,
                    {
                      backgroundColor: active ? tint + "22" : "transparent",
                      borderColor: active ? tint : borderSubtle,
                    },
                  ]}
                  testID={`range-${r.label}`}
                >
                  <ThemedText
                    style={{
                      fontSize: FontSize.xs,
                      fontWeight: active ? "600" : "400",
                      color: active ? tint : undefined,
                    }}
                  >
                    {r.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Chart ───────────────────────────── */}
        {chartLoading ? (
          <ChartSkeleton />
        ) : chartError ? (
          <View style={[styles.chartError, { borderColor: borderSubtle }]}>
            <ThemedText style={{ color: errorColor, textAlign: "center", fontSize: FontSize.sm }}>
              Failed to load chart
            </ThemedText>
            <Pressable onPress={() => refetchChart()}>
              <ThemedText style={{ color: tint, fontSize: FontSize.sm }}>Retry</ThemedText>
            </Pressable>
          </View>
        ) : (
          <SparklineChart data={chartData ?? []} color={tint} />
        )}
      </ScrollView>
    </ThemedView>
  );
}

// ── Metrics summary ───────────────────────────────────────────

function MetricsSummary({ service }: { service: ServiceItem }) {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");

  const p99Ms = service.p99 / 1_000_000;
  const avgMs = service.avgDuration / 1_000_000;
  const errRate = service.numCalls > 0 ? (service.numErrors / service.numCalls) * 100 : 0;
  const rpm = service.callRate * 60;

  return (
    <View style={[styles.metricsGrid, { backgroundColor: surface, borderColor: border }]}>
      <MetricTile
        label="P99 Latency"
        value={formatLatency(p99Ms)}
        warn={p99Ms >= P99_WARN_MS}
        crit={p99Ms >= P99_CRIT_MS}
      />
      <MetricTile
        label="Avg Latency"
        value={formatLatency(avgMs)}
      />
      <MetricTile
        label="Error Rate"
        value={`${errRate.toFixed(2)}%`}
        warn={errRate >= ERR_RATE_WARN * 100}
        crit={errRate >= ERR_RATE_CRIT * 100}
      />
      <MetricTile
        label="Throughput"
        value={formatRpm(rpm)}
      />
      <MetricTile
        label="Total Calls"
        value={formatCount(service.numCalls)}
      />
      <MetricTile
        label="Total Errors"
        value={formatCount(service.numErrors)}
        crit={service.numErrors > 0}
      />
    </View>
  );
}

function MetricTile({
  label,
  value,
  warn,
  crit,
}: {
  label: string;
  value: string;
  warn?: boolean;
  crit?: boolean;
}) {
  const defaultColor = useThemeColor({}, "tint");
  const color = crit ? Brand.red400 : warn ? Brand.amber500 : defaultColor;

  return (
    <View style={styles.metricTile}>
      <ThemedText type="caption">{label}</ThemedText>
      <ThemedText type="mono" style={{ color, fontSize: FontSize.lg, fontWeight: "700" }}>
        {value}
      </ThemedText>
    </View>
  );
}

// ── Formatters ────────────────────────────────────────────────

function formatLatency(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRpm(rpm: number): string {
  if (rpm < 1) return `${rpm.toFixed(2)}/m`;
  if (rpm < 1000) return `${rpm.toFixed(0)}/m`;
  return `${(rpm / 1000).toFixed(1)}k/m`;
}

function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: Space.lg,
    gap: Space.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.md,
  },
  metricTile: {
    width: "33.33%",
    paddingVertical: Space.sm,
    paddingHorizontal: Space.xs,
    gap: 2,
  },
  rangeBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rangePills: {
    flexDirection: "row",
    gap: Space.sm,
  },
  rangePill: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chartError: {
    padding: Space.xl,
    borderWidth: 1,
    borderRadius: Radius.lg,
    alignItems: "center",
    gap: Space.sm,
  },
});
