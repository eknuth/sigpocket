import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { LogItem } from "@sigpocket/shared-types";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSignozClient } from "@/hooks/use-signoz-client";
import { useInstanceStore } from "@/stores/instance-store";

// ── Filters ───────────────────────────────────────────────────

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

// ── Screen ────────────────────────────────────────────────────

export default function LogsListScreen() {
  const { service } = useLocalSearchParams<{ service: string }>();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);

  const [rangeIdx, setRangeIdx] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("errors");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const range = TIME_RANGES[rangeIdx];
  const severities = SEVERITY_VALUES[severityFilter];

  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
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

  if (!client) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="caption">No instance configured.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={tint} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle" numberOfLines={2}>
              {service}
            </ThemedText>
            <ThemedText type="caption" style={{ color: secondaryText }}>
              Recent errors
            </ThemedText>

            <View style={styles.filterRow}>
              {TIME_RANGES.map((r, i) => {
                const active = i === rangeIdx;
                return (
                  <Pressable
                    key={r.label}
                    onPress={() => setRangeIdx(i)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? tint + "22" : "transparent",
                        borderColor: active ? tint : border,
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

            <View style={styles.filterRow}>
              {(Object.keys(SEVERITY_LABELS) as SeverityFilter[]).map((key) => {
                const active = key === severityFilter;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSeverityFilter(key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? tint + "22" : "transparent",
                        borderColor: active ? tint : border,
                      },
                    ]}
                    testID={`severity-${key}`}
                  >
                    <ThemedText
                      style={{
                        fontSize: FontSize.xs,
                        fontWeight: active ? "600" : "400",
                        color: active ? tint : undefined,
                      }}
                    >
                      {SEVERITY_LABELS[key]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletonList}>
              <SkeletonRow surface={surface} border={border} />
              <SkeletonRow surface={surface} border={border} />
              <SkeletonRow surface={surface} border={border} />
              <SkeletonRow surface={surface} border={border} />
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
                No logs in this window
              </ThemedText>
              <ThemedText type="caption" style={{ textAlign: "center" }}>
                {`Nothing matched ${SEVERITY_LABELS[severityFilter]} in the last ${range.label}.`}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <LogRow
            item={item}
            expanded={expandedId === item.id}
            surface={surface}
            border={border}
            secondary={secondaryText}
            onPress={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
          />
        )}
      />
    </ThemedView>
  );
}

// ── Log row ───────────────────────────────────────────────────

function LogRow({
  item,
  expanded,
  surface,
  border,
  secondary,
  onPress,
}: {
  item: LogItem;
  expanded: boolean;
  surface: string;
  border: string;
  secondary: string;
  onPress: () => void;
}) {
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

// ── Skeleton ──────────────────────────────────────────────────

function SkeletonRow({ surface, border }: { surface: string; border: string }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.rowInner}>
        <Animated.View style={[styles.bar, { backgroundColor: "#4668DC55", opacity }]} />
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Animated.View style={[styles.skeletonBar, { width: 50, opacity }]} />
            <Animated.View style={[styles.skeletonBar, { width: 60, opacity }]} />
          </View>
          <Animated.View style={[styles.skeletonBar, { width: "100%", opacity }]} />
          <Animated.View style={[styles.skeletonBar, { width: "70%", opacity }]} />
        </View>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────

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
    padding: Space.lg,
    gap: Space.md,
  },
  header: {
    gap: Space.sm,
    marginBottom: Space.sm,
  },
  filterRow: {
    flexDirection: "row",
    gap: Space.sm,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
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
  skeletonBar: {
    height: 12,
    borderRadius: Radius.sm,
    backgroundColor: "#4668DC33",
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
});
