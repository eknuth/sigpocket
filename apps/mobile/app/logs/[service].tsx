import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { LogItem, TraceListItem } from "@sigpocket/shared-types";

import { Chip } from "@/components/chip";
import { ScreenHeader } from "@/components/screen-header";
import { Shimmer, useShimmerOpacity } from "@/components/shimmer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSignozClient } from "@/hooks/use-signoz-client";
import { useInstanceStore } from "@/stores/instance-store";


type TimeRange = { label: string; hours: number };

const TIME_RANGES: TimeRange[] = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
];

type SeverityFilter = "errors" | "warns" | "all";

const SEVERITY_LABELS: Record<SeverityFilter, string> = {
  errors: "ERROR only",
  warns: "WARN only",
  all: "All",
};

const SEVERITY_VALUES: Record<SeverityFilter, string[]> = {
  errors: ["ERROR"],
  warns: ["WARN"],
  all: ["ERROR", "WARN"],
};

// Attribute keys we surface in the expanded view, in this order.
const ATTRIBUTE_KEYS = [
  "service.name",
  "span.kind",
  "http.status_code",
  "http.route",
] as const;


export default function LogsListScreen() {
  const { service } = useLocalSearchParams<{ service: string }>();
  const router = useRouter();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);

  const [rangeIdx, setRangeIdx] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("errors");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const range = TIME_RANGES[rangeIdx];
  const severities = SEVERITY_VALUES[severityFilter];

  const tint = useThemeColor({}, "tint");
  const errorColor = useThemeColor({}, "error");
  const secondaryText = useThemeColor({}, "textSecondary");

  const {
    data: logs,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["logs", activeId, service, range.hours, severityFilter],
    queryFn: () =>
      client!.searchLogs(service, { severities, hours: range.hours, limit: 100 }),
    enabled: !!client && !!service,
  });

  const data = useMemo(() => logs ?? [], [logs]);

  // Some services emit only traces (no OTel log records). When a user filters
  // by ERROR and gets an empty list, fall back to error spans so "View recent
  // errors" still surfaces something actionable.
  const fallbackEnabled =
    !!client &&
    !!service &&
    severityFilter === "errors" &&
    !isLoading &&
    !error &&
    data.length === 0;

  const {
    data: errorTraces,
    isLoading: fallbackLoading,
    refetch: refetchFallback,
  } = useQuery({
    queryKey: ["logs-fallback-traces", activeId, service, range.hours],
    queryFn: async () => {
      const traces = await client!.searchTraces(service, range.hours, 50);
      return traces.filter((t) => t.hasError);
    },
    enabled: fallbackEnabled,
  });

  const showingTraceFallback = fallbackEnabled && (errorTraces?.length ?? 0) > 0;

  if (!client) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="caption">No instance configured.</ThemedText>
      </ThemedView>
    );
  }

  type ListEntry =
    | { kind: "log"; item: LogItem }
    | { kind: "trace"; item: TraceListItem };

  const entries: ListEntry[] = showingTraceFallback
    ? (errorTraces ?? []).map((t) => ({ kind: "trace" as const, item: t }))
    : data.map((l) => ({ kind: "log" as const, item: l }));

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(entry) =>
          entry.kind === "log" ? `log-${entry.item.id}` : `trace-${entry.item.traceID}`
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || fallbackLoading}
            onRefresh={() => {
              refetch();
              if (showingTraceFallback) refetchFallback();
            }}
            tintColor={tint}
          />
        }
        ListHeaderComponent={
          <View>
            <ScreenHeader
              back
              eyebrow="Recent errors"
              title={service}
              subtitle={`Last ${range.label} · ${SEVERITY_LABELS[severityFilter]}`}
              paddedSides={false}
            />
            <View style={styles.header}>
              <View style={styles.filterRow}>
                {TIME_RANGES.map((r, i) => (
                  <Chip
                    key={r.label}
                    value={i}
                    label={r.label}
                    active={i === rangeIdx}
                    onPress={setRangeIdx}
                    testID={`range-${r.label}`}
                  />
                ))}
              </View>
              <View style={styles.filterRow}>
                {(Object.keys(SEVERITY_LABELS) as SeverityFilter[]).map((key) => (
                  <Chip
                    key={key}
                    value={key}
                    label={SEVERITY_LABELS[key]}
                    active={key === severityFilter}
                    onPress={setSeverityFilter}
                    testID={`severity-${key}`}
                  />
                ))}
              </View>

            {showingTraceFallback ? (
              <View
                style={[
                  styles.fallbackBanner,
                  { backgroundColor: tint + "11", borderColor: tint + "44" },
                ]}
              >
                <ThemedText type="caption" style={{ color: secondaryText }}>
                  No log records for this service. Showing error traces from
                  the last {range.label} instead.
                </ThemedText>
              </View>
            ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading || fallbackLoading ? (
            <View style={styles.skeletonList}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <ThemedText style={{ color: errorColor, textAlign: "center" }}>
                {error instanceof Error ? error.message : "Failed to load logs"}
              </ThemedText>
              <Pressable
                style={[styles.retryButton, { borderColor: tint }]}
                onPress={() => refetch()}
              >
                <ThemedText style={{ color: tint }}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle" style={{ textAlign: "center" }}>
                No errors in this window
              </ThemedText>
              <ThemedText type="caption" style={{ textAlign: "center" }}>
                {severityFilter === "errors"
                  ? `No error logs or error traces in the last ${range.label}.`
                  : `Nothing matched ${SEVERITY_LABELS[severityFilter]} in the last ${range.label}.`}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item: entry }) =>
          entry.kind === "log" ? (
            <LogRow
              item={entry.item}
              expanded={expandedId === entry.item.id}
              onPress={() =>
                setExpandedId((cur) => (cur === entry.item.id ? null : entry.item.id))
              }
            />
          ) : (
            <ErrorTraceRow
              item={entry.item}
              onPress={() =>
                router.push({
                  pathname: "/trace/[id]",
                  params: { id: entry.item.traceID },
                })
              }
            />
          )
        }
      />
    </ThemedView>
  );
}

// ── Error trace fallback row ─────────────────────────────────
// Rendered when the logs query has no rows but error traces exist for the
// service. Visually matches LogRow's red severity bar so the list reads as a
// continuous "errors" stream regardless of source.

function ErrorTraceRow({
  item,
  onPress,
}: {
  item: TraceListItem;
  onPress: () => void;
}) {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const secondary = useThemeColor({}, "textSecondary");
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: surface, borderColor: border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
      testID={`trace-fallback-${item.traceID}`}
    >
      <View style={styles.rowInner}>
        <View style={[styles.bar, { backgroundColor: Brand.red400 }]} />
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <ThemedText
              type="defaultSemiBold"
              style={{ color: Brand.red400, fontSize: FontSize.xs, letterSpacing: 0.5 }}
            >
              ERROR TRACE
            </ThemedText>
            <ThemedText type="caption" style={{ color: secondary }}>
              {formatTimestamp(item.startTime)}
            </ThemedText>
          </View>
          <ThemedText
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ fontSize: FontSize.sm, lineHeight: 20 }}
          >
            {item.rootOperation || "(unnamed)"}
          </ThemedText>
          <View style={styles.rowTop}>
            <ThemedText type="caption" style={{ color: secondary }}>
              {item.durationMs.toFixed(0)} ms
              {item.responseStatusCode ? `  ·  HTTP ${item.responseStatusCode}` : ""}
            </ThemedText>
            <ThemedText type="caption" style={{ color: secondary }}>
              View trace →
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}


function LogRow({
  item,
  expanded,
  onPress,
}: {
  item: LogItem;
  expanded: boolean;
  onPress: () => void;
}) {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const secondary = useThemeColor({}, "textSecondary");
  const sev = (item.severityText || "").toUpperCase();
  const barColor =
    sev === "ERROR" || sev === "FATAL"
      ? Brand.red400
      : sev === "WARN"
        ? Brand.amber500
        : border;
  const badgeColor =
    sev === "ERROR" || sev === "FATAL"
      ? Brand.red400
      : sev === "WARN"
        ? Brand.amber500
        : secondary;

  const presentAttrs = ATTRIBUTE_KEYS.filter((k) => {
    const v = item.attributes?.[k];
    return typeof v === "string" && v.length > 0;
  });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: surface,
          borderColor: border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={onPress}
      testID={`log-row-${item.id}`}
    >
      <View style={styles.rowInner}>
        <View style={[styles.bar, { backgroundColor: barColor }]} />
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <ThemedText
              type="defaultSemiBold"
              style={{
                color: badgeColor,
                fontSize: FontSize.xs,
                letterSpacing: 0.5,
              }}
            >
              {sev || "LOG"}
            </ThemedText>
            <ThemedText type="caption" style={{ color: secondary }}>
              {formatTimestamp(item.timestamp)}
            </ThemedText>
          </View>
          {expanded ? (
            <ScrollView style={styles.expandedBody} nestedScrollEnabled>
              <ThemedText type="mono" style={{ fontSize: FontSize.sm }}>
                {item.body}
              </ThemedText>
            </ScrollView>
          ) : (
            <ThemedText
              numberOfLines={2}
              ellipsizeMode="tail"
              style={{ fontSize: FontSize.sm, lineHeight: 20 }}
            >
              {truncate(item.body, 150)}
            </ThemedText>
          )}
          {expanded && (
            <View style={styles.expandedMeta}>
              <ThemedText type="caption" style={{ color: secondary }}>
                {new Date(item.timestamp).toLocaleString()}
              </ThemedText>
              {presentAttrs.length > 0 && (
                <View style={styles.attrList}>
                  {presentAttrs.map((k) => (
                    <View key={k} style={styles.attrRow}>
                      <ThemedText
                        type="mono"
                        style={{ color: secondary, fontSize: FontSize.xs }}
                      >
                        {k}
                      </ThemedText>
                      <ThemedText
                        type="mono"
                        style={{ fontSize: FontSize.xs, flex: 1, textAlign: "right" }}
                        numberOfLines={1}
                      >
                        {item.attributes[k]}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}


function SkeletonRow() {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const opacity = useShimmerOpacity();
  return (
    <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.rowInner}>
        <Shimmer width={3} height={40} radius={0} opacity={opacity} style={styles.bar} />
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Shimmer width={50} opacity={opacity} />
            <Shimmer width={60} opacity={opacity} />
          </View>
          <Shimmer width="100%" opacity={opacity} />
          <Shimmer width="70%" opacity={opacity} />
        </View>
      </View>
    </View>
  );
}


function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Space.xl,
    gap: Space.lg,
  },
  list: {
    paddingHorizontal: Space.lg,
    paddingBottom: 160,
    gap: Space.md,
  },
  header: {
    gap: Space.sm,
    marginBottom: Space.md,
  },
  filterRow: {
    flexDirection: "row",
    gap: Space.sm,
    flexWrap: "wrap",
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  bar: {
    width: 4,
  },
  rowContent: {
    flex: 1,
    padding: Space.md,
    gap: Space.xs,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expandedBody: {
    maxHeight: 280,
    marginTop: Space.xs,
  },
  expandedMeta: {
    marginTop: Space.sm,
    gap: Space.sm,
  },
  attrList: {
    gap: Space.xs,
  },
  attrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Space.md,
  },
  skeletonList: {
    gap: Space.md,
  },
  emptyState: {
    paddingVertical: Space.xxxl,
    gap: Space.md,
    alignItems: "center",
  },
  errorState: {
    paddingVertical: Space.xxl,
    gap: Space.md,
    alignItems: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
  fallbackBanner: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    marginTop: Space.xs,
  },
});
