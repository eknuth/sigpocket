import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { ServiceItem } from "@sigpocket/shared-types";

import { ChartSkeleton, LatencyLineChart } from "@/components/latency-line-chart";
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
  const router = useRouter();
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

        {/* ── RED metrics (Rate, Errors, Duration) */}
        {service && <RedMetrics service={service} />}

        {/* ── Recent traces link ──────────────── */}
        <Pressable
          onPress={() =>
            router.push({ pathname: "/traces/[service]", params: { service: name } })
          }
          style={({ pressed }) => [
            styles.tracesLink,
            {
              borderColor: tint,
              backgroundColor: pressed ? tint + "22" : "transparent",
            },
          ]}
          testID="view-recent-traces"
        >
          <ThemedText style={{ color: tint, fontWeight: "600" }}>
            View recent traces →
          </ThemedText>
        </Pressable>

        {/* ── Recent errors link ──────────────── */}
        <Pressable
          onPress={() =>
            router.push({ pathname: "/logs/[service]", params: { service: name } })
          }
          style={({ pressed }) => [
            styles.tracesLink,
            {
              borderColor: tint,
              backgroundColor: pressed ? tint + "22" : "transparent",
            },
          ]}
          testID="view-recent-errors"
        >
          <ThemedText style={{ color: tint, fontWeight: "600" }}>
            View recent errors →
          </ThemedText>
        </Pressable>

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
          <LatencyLineChart data={chartData ?? []} color={tint} />
        )}

        {/* ── Secondary metrics ──────────────── */}
        {service && <SecondaryMetrics service={service} />}
      </ScrollView>
    </ThemedView>
  );
}

// ── RED metrics (primary) ─────────────────────────────────────

function RedMetrics({ service }: { service: ServiceItem }) {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const tint = useThemeColor({}, "tint");

  const p99Ms = service.p99 / 1_000_000;
  const errRate = service.numCalls > 0 ? (service.numErrors / service.numCalls) * 100 : 0;
  const rpm = service.callRate * 60;

  const durationColor = p99Ms >= P99_CRIT_MS ? Brand.red400 : p99Ms >= P99_WARN_MS ? Brand.amber500 : tint;
  const errorColor = errRate >= ERR_RATE_CRIT * 100 ? Brand.red400 : errRate >= ERR_RATE_WARN * 100 ? Brand.amber500 : tint;

  return (
    <View style={[styles.redSection, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.redCard}>
        <ThemedText type="caption">RATE</ThemedText>
        <ThemedText type="mono" style={[styles.redValue, { color: tint }]}>
          {formatRpm(rpm)}
        </ThemedText>
        <ThemedText style={styles.redUnit}>{formatCount(service.numCalls)} total</ThemedText>
      </View>
      <View style={[styles.redDivider, { backgroundColor: border }]} />
      <View style={styles.redCard}>
        <ThemedText type="caption">ERRORS</ThemedText>
        <ThemedText type="mono" style={[styles.redValue, { color: errorColor }]}>
          {errRate.toFixed(2)}%
        </ThemedText>
        <ThemedText style={styles.redUnit}>{formatCount(service.numErrors)} total</ThemedText>
      </View>
      <View style={[styles.redDivider, { backgroundColor: border }]} />
      <View style={styles.redCard}>
        <ThemedText type="caption">DURATION</ThemedText>
        <ThemedText type="mono" style={[styles.redValue, { color: durationColor }]}>
          {formatLatency(p99Ms)}
        </ThemedText>
        <ThemedText style={styles.redUnit}>p99</ThemedText>
      </View>
    </View>
  );
}

// ── Secondary metrics ─────────────────────────────────────────

function SecondaryMetrics({ service }: { service: ServiceItem }) {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const secondaryText = useThemeColor({}, "textSecondary");

  const avgMs = service.avgDuration / 1_000_000;

  return (
    <View style={[styles.secondaryRow, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.secondaryTile}>
        <ThemedText type="caption">Avg Latency</ThemedText>
        <ThemedText type="mono" style={{ color: secondaryText, fontSize: FontSize.base }}>
          {formatLatency(avgMs)}
        </ThemedText>
      </View>
      <View style={styles.secondaryTile}>
        <ThemedText type="caption">Throughput</ThemedText>
        <ThemedText type="mono" style={{ color: secondaryText, fontSize: FontSize.base }}>
          {formatRpm(service.callRate * 60)}
        </ThemedText>
      </View>
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
  redSection: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  redCard: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  redValue: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    lineHeight: FontSize.xxl + 4,
  },
  redUnit: {
    fontSize: FontSize.xs,
    opacity: 0.5,
  },
  redDivider: {
    width: 1,
    alignSelf: "stretch",
    marginHorizontal: Space.sm,
  },
  secondaryRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.md,
    gap: Space.md,
  },
  secondaryTile: {
    flex: 1,
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
  tracesLink: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    alignItems: "center",
  },
});
