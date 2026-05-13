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
import { Chip } from "@/components/chip";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  Brand,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Space,
} from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSignozClient } from "@/hooks/use-signoz-client";
import { useInstanceStore } from "@/stores/instance-store";
import {
  ERR_RATE_CRIT,
  ERR_RATE_WARN,
  P99_CRIT_MS,
  P99_WARN_MS,
  STATUS_COLORS,
  STATUS_LABELS,
  serviceStatus,
} from "@/lib/service-status";
import {
  formatCount,
  formatLatency,
  formatLatencyParts,
  formatRpm,
  formatRpmParts,
} from "@/lib/format";


type TimeRange = { label: string; hours: number; step: number };

// Step sizes widen with the range so that sparse services (e.g. < 1 rpm)
// still show data in shorter windows — every bucket needs at least one
// sample for SigNoz to return a point. 5-min buckets at 1h means 12 points
// instead of 60, but a service doing 6 calls/hour will land in most of them.
const TIME_RANGES: TimeRange[] = [
  { label: "1h", hours: 1, step: 300 },
  { label: "6h", hours: 6, step: 900 },
  { label: "24h", hours: 24, step: 1800 },
];


export default function ServiceDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = TIME_RANGES[rangeIdx];

  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surface");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const muted = useThemeColor({}, "textMuted");
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
  const statusColor = status ? STATUS_COLORS[status] : tint;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchChart} tintColor={tint} />
        }
      >
        <ScreenHeader
          back
          eyebrow="Service"
          title={name}
          subtitle={status ? STATUS_LABELS[status] : undefined}
          right={
            status ? (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: statusColor + "1A",
                    borderColor: statusColor + "66",
                  },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <ThemedText
                  style={{
                    fontFamily: FontFamily.monoSemibold,
                    fontSize: 11,
                    color: statusColor,
                    letterSpacing: 1.2,
                  }}
                >
                  {STATUS_LABELS[status].toUpperCase()}
                </ThemedText>
              </View>
            ) : undefined
          }
        />

        <View style={styles.body}>
          {service && <RedMetrics service={service} />}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/traces/[service]", params: { service: name } })
              }
              style={({ pressed }) => [
                styles.actionLink,
                {
                  borderColor: borderSubtle,
                  backgroundColor: pressed ? tint + "14" : surface,
                },
              ]}
              testID="view-recent-traces"
            >
              <ThemedText
                style={{
                  color: tint,
                  fontFamily: FontFamily.sansSemibold,
                  fontSize: FontSize.sm,
                }}
              >
                Recent traces
              </ThemedText>
              <ThemedText
                style={{ color: muted, fontFamily: FontFamily.sansMedium, fontSize: 16 }}
              >
                →
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/logs/[service]", params: { service: name } })
              }
              style={({ pressed }) => [
                styles.actionLink,
                {
                  borderColor: borderSubtle,
                  backgroundColor: pressed ? tint + "14" : surface,
                },
              ]}
              testID="view-recent-errors"
            >
              <ThemedText
                style={{
                  color: tint,
                  fontFamily: FontFamily.sansSemibold,
                  fontSize: FontSize.sm,
                }}
              >
                Recent errors
              </ThemedText>
              <ThemedText
                style={{ color: muted, fontFamily: FontFamily.sansMedium, fontSize: 16 }}
              >
                →
              </ThemedText>
            </Pressable>
          </View>

          {/* ── Chart section card ──────────── */}
          <View
            style={[
              styles.chartCard,
              { backgroundColor: surface, borderColor: borderSubtle },
            ]}
          >
            <View style={styles.chartHeader}>
              <View>
                <ThemedText
                  style={{
                    fontFamily: FontFamily.monoMedium,
                    fontSize: 10,
                    color: muted,
                    letterSpacing: 1.4,
                  }}
                >
                  P95 LATENCY
                </ThemedText>
                <ThemedText
                  style={{
                    fontFamily: FontFamily.sansSemibold,
                    fontSize: FontSize.lg,
                    marginTop: 2,
                  }}
                >
                  Last {range.label}
                </ThemedText>
              </View>
              <View style={styles.rangePills}>
                {TIME_RANGES.map((r, i) => (
                  <Chip
                    key={r.label}
                    value={i}
                    label={r.label}
                    active={i === rangeIdx}
                    onPress={setRangeIdx}
                    size="sm"
                    testID={`range-${r.label}`}
                  />
                ))}
              </View>
            </View>

            {chartLoading ? (
              <ChartSkeleton />
            ) : chartError ? (
              <View style={styles.chartError}>
                <ThemedText
                  style={{
                    color: errorColor,
                    textAlign: "center",
                    fontSize: FontSize.sm,
                  }}
                >
                  Failed to load chart
                </ThemedText>
                <Pressable onPress={() => refetchChart()}>
                  <ThemedText
                    style={{
                      color: tint,
                      fontSize: FontSize.sm,
                      fontFamily: FontFamily.sansSemibold,
                    }}
                  >
                    Retry
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <LatencyLineChart data={chartData ?? []} color={tint} />
            )}
          </View>

          {service && <SecondaryMetrics service={service} />}
        </View>
      </ScrollView>
    </ThemedView>
  );
}


function RedMetrics({ service }: { service: ServiceItem }) {
  const tint = useThemeColor({}, "tint");
  const text = useThemeColor({}, "text");
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "borderSubtle");

  const p99Ms = service.p99 / 1_000_000;
  const errRate =
    service.numCalls > 0 ? (service.numErrors / service.numCalls) * 100 : 0;
  const rpm = service.callRate * 60;

  const durationColor =
    p99Ms >= P99_CRIT_MS ? Brand.red400 : p99Ms >= P99_WARN_MS ? Brand.amber400 : text;
  const errorColor =
    errRate >= ERR_RATE_CRIT * 100
      ? Brand.red400
      : errRate >= ERR_RATE_WARN * 100
        ? Brand.amber400
        : text;

  const rate = formatRpmParts(rpm);
  const dur = formatLatencyParts(p99Ms);

  return (
    <View
      style={[
        styles.redSection,
        { backgroundColor: surface, borderColor: border },
        Shadow.tintGlow,
      ]}
    >
      <RedCell
        label="RATE"
        value={rate.value}
        unit={rate.unit}
        color={tint}
        sub={`${formatCount(service.numCalls)} total`}
      />
      <View style={[styles.redDivider, { backgroundColor: border }]} />
      <RedCell
        label="ERRORS"
        value={errRate.toFixed(2)}
        unit="%"
        color={errorColor}
        sub={`${formatCount(service.numErrors)} total`}
      />
      <View style={[styles.redDivider, { backgroundColor: border }]} />
      <RedCell
        label="DURATION"
        value={dur.value}
        unit={dur.unit}
        color={durationColor}
        sub="p99"
      />
    </View>
  );
}

function RedCell({
  label,
  value,
  unit,
  color,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  sub: string;
}) {
  const muted = useThemeColor({}, "textMuted");
  return (
    <View style={styles.redCard}>
      <ThemedText
        style={{
          fontFamily: FontFamily.monoMedium,
          fontSize: 10,
          color: muted,
          letterSpacing: 1.4,
        }}
      >
        {label}
      </ThemedText>
      <View style={styles.redValueRow}>
        <ThemedText
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: FontFamily.monoSemibold,
            fontSize: FontSize.xxl,
            color,
            letterSpacing: -1,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </ThemedText>
        <ThemedText
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: FontSize.sm,
            color,
            marginLeft: 2,
            opacity: 0.75,
          }}
        >
          {unit}
        </ThemedText>
      </View>
      <ThemedText
        style={{
          fontFamily: FontFamily.mono,
          fontSize: 11,
          color: muted,
          letterSpacing: 0.3,
        }}
      >
        {sub}
      </ThemedText>
    </View>
  );
}


function SecondaryMetrics({ service }: { service: ServiceItem }) {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const muted = useThemeColor({}, "textMuted");
  const text = useThemeColor({}, "text");
  const avgMs = service.avgDuration / 1_000_000;

  return (
    <View style={[styles.secondaryRow, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.secondaryTile}>
        <ThemedText
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 10,
            color: muted,
            letterSpacing: 1.4,
          }}
        >
          AVG LATENCY
        </ThemedText>
        <ThemedText
          style={{
            fontFamily: FontFamily.monoSemibold,
            color: text,
            fontSize: FontSize.lg,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatLatency(avgMs)}
        </ThemedText>
      </View>
      <View style={[styles.redDivider, { backgroundColor: border }]} />
      <View style={styles.secondaryTile}>
        <ThemedText
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 10,
            color: muted,
            letterSpacing: 1.4,
          }}
        >
          THROUGHPUT
        </ThemedText>
        <ThemedText
          style={{
            fontFamily: FontFamily.monoSemibold,
            color: text,
            fontSize: FontSize.lg,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatRpm(service.callRate * 60)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    paddingBottom: 160,
  },
  body: {
    paddingHorizontal: Space.lg,
    gap: Space.lg,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  redSection: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  redCard: {
    flex: 1,
    alignItems: "flex-start",
    gap: 4,
  },
  redValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
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
    padding: Space.lg,
    alignItems: "stretch",
  },
  secondaryTile: {
    flex: 1,
    gap: 6,
  },
  actionRow: {
    flexDirection: "row",
    gap: Space.sm,
  },
  actionLink: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
  },
  chartCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.lg,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  rangePills: {
    flexDirection: "row",
    gap: 6,
  },
  chartError: {
    paddingVertical: Space.xl,
    alignItems: "center",
    gap: Space.sm,
  },
});
