import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import type { ServiceItem } from "@sigpocket/shared-types";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSignozClient } from "@/hooks/use-signoz-client";
import { useInstanceStore } from "@/stores/instance-store";

// ── Status thresholds ─────────────────────────────────────────

type Status = "healthy" | "degraded" | "critical";

const P99_WARN_MS = 500;
const P99_CRIT_MS = 2000;
const ERR_RATE_WARN = 0.01; // 1%
const ERR_RATE_CRIT = 0.05; // 5%

function serviceStatus(item: ServiceItem): Status {
  const errRate = item.numCalls > 0 ? item.numErrors / item.numCalls : 0;
  const p99Ms = item.p99 / 1_000_000;

  if (errRate >= ERR_RATE_CRIT || p99Ms >= P99_CRIT_MS) return "critical";
  if (errRate >= ERR_RATE_WARN || p99Ms >= P99_WARN_MS) return "degraded";
  return "healthy";
}

// ── Sort ──────────────────────────────────────────────────────

type SortKey = "status" | "name" | "errors" | "latency";

const SORT_LABELS: Record<SortKey, string> = {
  status: "Status",
  name: "A–Z",
  errors: "Errors",
  latency: "Latency",
};

function sortServices(list: ServiceItem[], key: SortKey): ServiceItem[] {
  const sorted = [...list];
  switch (key) {
    case "status": {
      const order: Record<Status, number> = { critical: 0, degraded: 1, healthy: 2 };
      return sorted.sort((a, b) => order[serviceStatus(a)] - order[serviceStatus(b)]);
    }
    case "name":
      return sorted.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
    case "errors": {
      return sorted.sort((a, b) => {
        const aRate = a.numCalls > 0 ? a.numErrors / a.numCalls : 0;
        const bRate = b.numCalls > 0 ? b.numErrors / b.numCalls : 0;
        return bRate - aRate;
      });
    }
    case "latency":
      return sorted.sort((a, b) => b.p99 - a.p99);
  }
}

// ── Screen ────────────────────────────────────────────────────

export default function ServicesScreen() {
  const router = useRouter();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);
  const activeName = useInstanceStore((s) => s.getActive()?.name);
  const [sortKey, setSortKey] = useState<SortKey>("status");

  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const errorColor = useThemeColor({}, "error");

  const {
    data: services,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["services", activeId],
    queryFn: () => client!.fetchServices(6),
    enabled: !!client,
    refetchInterval: 30_000,
  });

  const sorted = useMemo(
    () => (services ? sortServices(services, sortKey) : []),
    [services, sortKey],
  );

  if (!client) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="caption">No instance configured.</ThemedText>
      </ThemedView>
    );
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.list}>
          <SkeletonCard surface={surface} border={border} />
          <SkeletonCard surface={surface} border={border} />
          <SkeletonCard surface={surface} border={border} />
          <SkeletonCard surface={surface} border={border} />
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={{ color: errorColor, textAlign: "center" }}>
          {error instanceof Error ? error.message : "Failed to load services"}
        </ThemedText>
        <Pressable
          style={[styles.retryButton, { borderColor: tint }]}
          onPress={() => refetch()}
        >
          <ThemedText style={{ color: tint }}>Retry</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.serviceName}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={tint} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {activeName ? (
              <ThemedText type="caption" style={styles.instanceLabel}>
                {activeName.toUpperCase()}
              </ThemedText>
            ) : null}
            <SortBar current={sortKey} onSelect={setSortKey} tint={tint} border={border} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText type="subtitle" style={{ textAlign: "center" }}>
              No services found
            </ThemedText>
            <ThemedText type="caption" style={{ textAlign: "center" }}>
              No services reported data in the last 6 hours. Check that your applications are
              instrumented and sending traces.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <ServiceCard
            item={item}
            surface={surface}
            border={border}
            onPress={() =>
              router.push({ pathname: "/service/[name]", params: { name: item.serviceName } })
            }
          />
        )}
      />
    </ThemedView>
  );
}

// ── Sort bar ──────────────────────────────────────────────────

function SortBar({
  current,
  onSelect,
  tint,
  border,
}: {
  current: SortKey;
  onSelect: (key: SortKey) => void;
  tint: string;
  border: string;
}) {
  return (
    <View style={styles.sortBar}>
      {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
        const active = key === current;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={[
              styles.sortChip,
              {
                backgroundColor: active ? tint + "22" : "transparent",
                borderColor: active ? tint : border,
              },
            ]}
            testID={`sort-${key}`}
          >
            <ThemedText
              style={{
                fontSize: FontSize.xs,
                fontWeight: active ? "600" : "400",
                color: active ? tint : undefined,
              }}
            >
              {SORT_LABELS[key]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Service card ──────────────────────────────────────────────

const STATUS_COLORS: Record<Status, string> = {
  healthy: Brand.green400,
  degraded: Brand.amber500,
  critical: Brand.red400,
};

function ServiceCard({
  item,
  surface,
  border,
  onPress,
}: {
  item: ServiceItem;
  surface: string;
  border: string;
  onPress: () => void;
}) {
  const status = serviceStatus(item);
  const dotColor = STATUS_COLORS[status];
  const p99Ms = item.p99 / 1_000_000;
  const errRate = item.numCalls > 0 ? (item.numErrors / item.numCalls) * 100 : 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: surface,
          borderColor: status === "critical" ? Brand.red400 + "44" : border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={onPress}
      testID={`service-card-${item.serviceName}`}
    >
      <View style={styles.cardTop}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ flex: 1 }}>
          {item.serviceName}
        </ThemedText>
      </View>

      <View style={styles.metricsRow}>
        <MetricCell
          label="P99"
          value={formatLatency(p99Ms)}
          warn={p99Ms >= P99_WARN_MS}
          crit={p99Ms >= P99_CRIT_MS}
        />
        <MetricCell
          label="Err%"
          value={`${errRate.toFixed(2)}%`}
          warn={errRate >= ERR_RATE_WARN * 100}
          crit={errRate >= ERR_RATE_CRIT * 100}
        />
        <MetricCell label="RPM" value={formatRate(item.callRate)} />
        <MetricCell label="Avg" value={formatLatency(item.avgDuration / 1_000_000)} />
      </View>
    </Pressable>
  );
}

// ── Metric cell ───────────────────────────────────────────────

function MetricCell({
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
  const tint = useThemeColor({}, "tint");
  const color = crit ? Brand.red400 : warn ? Brand.amber500 : tint;

  return (
    <View style={styles.metricCell}>
      <ThemedText type="caption">{label}</ThemedText>
      <ThemedText type="mono" style={{ color, fontSize: FontSize.sm, fontWeight: "600" }}>
        {value}
      </ThemedText>
    </View>
  );
}

// ── Skeleton card ─────────────────────────────────────────────

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
        <Animated.View style={[styles.skeletonBar, { width: "60%", opacity }]} />
      </View>
      <View style={styles.metricsRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.metricCell}>
            <Animated.View style={[styles.skeletonBar, { width: 28, height: 10, opacity }]} />
            <Animated.View style={[styles.skeletonBar, { width: 48, opacity }]} />
          </View>
        ))}
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

function formatRate(perSec: number): string {
  const rpm = perSec * 60;
  if (rpm < 1) return `${(perSec * 60).toFixed(2)}/m`;
  if (rpm < 1000) return `${rpm.toFixed(0)}/m`;
  return `${(rpm / 1000).toFixed(1)}k/m`;
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
    marginBottom: Space.xs,
  },
  instanceLabel: {
    letterSpacing: 1,
  },
  sortBar: {
    flexDirection: "row",
    gap: Space.sm,
  },
  sortChip: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.md,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricCell: {
    gap: 2,
  },
  emptyState: {
    paddingVertical: Space.xxxl,
    gap: Space.md,
    alignItems: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
  skeletonBar: {
    height: 14,
    borderRadius: Radius.sm,
    backgroundColor: "#4668DC33",
  },
});
