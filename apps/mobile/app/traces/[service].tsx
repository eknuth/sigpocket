import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import type { TraceListItem } from "@sigpocket/shared-types";

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

type StatusFilter = "all" | "errors";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  errors: "Errors only",
};

// ── Screen ────────────────────────────────────────────────────

export default function TracesListScreen() {
  const { service } = useLocalSearchParams<{ service: string }>();
  const router = useRouter();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);

  const [rangeIdx, setRangeIdx] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const range = TIME_RANGES[rangeIdx];

  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const errorColor = useThemeColor({}, "error");
  const secondaryText = useThemeColor({}, "textSecondary");

  const {
    data: traces,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["traces", activeId, service, range.hours],
    queryFn: () => client!.searchTraces(service, range.hours, 50),
    enabled: !!client && !!service,
  });

  const filtered = useMemo(() => {
    if (!traces) return [];
    if (statusFilter === "errors") return traces.filter((t) => t.hasError);
    return traces;
  }, [traces, statusFilter]);

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
        data={filtered}
        keyExtractor={(item) => item.traceID}
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
              Recent traces
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
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => {
                const active = key === statusFilter;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setStatusFilter(key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? tint + "22" : "transparent",
                        borderColor: active ? tint : border,
                      },
                    ]}
                    testID={`status-${key}`}
                  >
                    <ThemedText
                      style={{
                        fontSize: FontSize.xs,
                        fontWeight: active ? "600" : "400",
                        color: active ? tint : undefined,
                      }}
                    >
                      {STATUS_LABELS[key]}
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
              <SkeletonCard surface={surface} border={border} />
              <SkeletonCard surface={surface} border={border} />
              <SkeletonCard surface={surface} border={border} />
              <SkeletonCard surface={surface} border={border} />
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <ThemedText style={{ color: errorColor, textAlign: "center" }}>
                {error instanceof Error ? error.message : "Failed to load traces"}
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
                No recent traces
              </ThemedText>
              <ThemedText type="caption" style={{ textAlign: "center" }}>
                {statusFilter === "errors"
                  ? `No error traces in the last ${range.label}.`
                  : `No traces reported in the last ${range.label}.`}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TraceCard
            item={item}
            surface={surface}
            border={border}
            tint={tint}
            onPress={() =>
              router.push({ pathname: "/trace/[id]", params: { id: item.traceID } })
            }
          />
        )}
      />
    </ThemedView>
  );
}

// ── Trace card ────────────────────────────────────────────────

function TraceCard({
  item,
  surface,
  border,
  tint,
  onPress,
}: {
  item: TraceListItem;
  surface: string;
  border: string;
  tint: string;
  onPress: () => void;
}) {
  const dotColor = item.hasError ? Brand.red400 : tint;
  const secondary = useThemeColor({}, "textSecondary");

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: surface,
          borderColor: item.hasError ? Brand.red400 + "44" : border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={onPress}
      testID={`trace-card-${item.traceID}`}
    >
      <View style={styles.cardTop}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ flex: 1 }}>
          {item.rootOperation || "(unnamed)"}
        </ThemedText>
        <ThemedText type="mono" style={{ color: tint, fontSize: FontSize.sm, fontWeight: "600" }}>
          {item.durationMs.toFixed(0)} ms
        </ThemedText>
      </View>
      <View style={styles.cardBottom}>
        <ThemedText type="caption" style={{ color: secondary }}>
          {formatTimestamp(item.startTime)}
        </ThemedText>
        {item.responseStatusCode ? (
          <ThemedText type="caption" style={{ color: secondary }}>
            HTTP {item.responseStatusCode}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Skeleton ──────────────────────────────────────────────────

function SkeletonCard({ surface, border }: { surface: string; border: string }) {
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
      <View style={styles.cardTop}>
        <Animated.View
          style={[styles.skeletonBar, { width: 10, height: 10, borderRadius: 5, opacity }]}
        />
        <Animated.View style={[styles.skeletonBar, { flex: 1, opacity }]} />
        <Animated.View style={[styles.skeletonBar, { width: 56, opacity }]} />
      </View>
      <Animated.View style={[styles.skeletonBar, { width: "40%", height: 10, opacity }]} />
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
    padding: Space.lg,
    gap: Space.sm,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  skeletonList: {
    gap: Space.md,
  },
  skeletonBar: {
    height: 14,
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
