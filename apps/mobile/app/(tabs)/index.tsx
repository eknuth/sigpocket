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

import { Chip } from "@/components/chip";
import { ScreenHeader } from "@/components/screen-header";
import { Shimmer, useShimmerOpacity } from "@/components/shimmer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, FontFamily, FontSize, Radius, Shadow, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSignozClient } from "@/hooks/use-signoz-client";
import { useInstanceStore } from "@/stores/instance-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import {
  ERR_RATE_CRIT,
  ERR_RATE_WARN,
  P99_CRIT_MS,
  P99_WARN_MS,
  STATUS_COLORS,
  serviceStatus,
  type ServiceStatus,
} from "@/lib/service-status";
import { formatLatency, formatRate, relativeTime } from "@/lib/format";

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
      const order: Record<ServiceStatus, number> = { critical: 0, degraded: 1, healthy: 2 };
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


export default function ServicesScreen() {
  const router = useRouter();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);
  const activeName = useInstanceStore((s) => s.getActive()?.name);
  const refreshIntervalMs = usePreferencesStore((s) => s.refreshIntervalMs);
  const [sortKey, setSortKey] = useState<SortKey>("status");

  const tint = useThemeColor({}, "tint");
  const errorColor = useThemeColor({}, "error");

  const {
    data: services,
    isLoading,
    isRefetching,
    error,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["services", activeId],
    queryFn: () => client!.fetchServices(24),
    enabled: !!client,
    refetchInterval: refreshIntervalMs,
  });

  const sorted = useMemo(
    () => (services ? sortServices(services, sortKey) : []),
    [services, sortKey],
  );

  // Header summary line: "X services · 1 critical · refreshed 4s ago"
  const summary = useMemo(() => {
    if (!services || services.length === 0) return undefined;
    const counts = { critical: 0, degraded: 0 };
    for (const s of services) {
      const st = serviceStatus(s);
      if (st === "critical") counts.critical += 1;
      else if (st === "degraded") counts.degraded += 1;
    }
    const total = services.length;
    const tail = relativeTime(dataUpdatedAt);
    const parts = [`${total} ${total === 1 ? "service" : "services"}`];
    if (counts.critical) parts.push(`${counts.critical} critical`);
    if (counts.degraded) parts.push(`${counts.degraded} degraded`);
    if (counts.critical === 0 && counts.degraded === 0) parts.push("all healthy");
    parts.push(`refreshed ${tail}`);
    return parts.join(" · ");
  }, [services, dataUpdatedAt]);

  if (!client) {
    return (
      <ThemedView style={styles.container}>
        <ScreenHeader title="Services" subtitle="No instance configured" />
      </ThemedView>
    );
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ScreenHeader title="Services" eyebrow={activeName} subtitle="Loading…" />
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ScreenHeader title="Services" eyebrow={activeName} />
        <View style={styles.centered}>
          <ThemedText style={{ color: errorColor, textAlign: "center" }}>
            {error instanceof Error ? error.message : "Failed to load services"}
          </ThemedText>
          <Pressable
            style={[styles.retryButton, { borderColor: tint }]}
            onPress={() => refetch()}
          >
            <ThemedText style={{ color: tint, fontFamily: FontFamily.sansSemibold }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
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
          <View>
            <ScreenHeader
              title="Services"
              eyebrow={activeName}
              subtitle={summary}
              paddedTop={true}
              paddedSides={false}
            />
            <View style={styles.sortBarWrap}>
              <SortBar current={sortKey} onSelect={setSortKey} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText type="subtitle" style={{ textAlign: "center" }}>
              No services found
            </ThemedText>
            <ThemedText type="caption" style={{ textAlign: "center" }}>
              No services reported data in the last 24 hours. Check that your applications are
              instrumented and sending traces.
            </ThemedText>
          </View>
        }
        renderItem={({ item, index }) => (
          <StaggeredEntry index={index}>
            <ServiceCard
              item={item}
              onPress={() =>
                router.push({ pathname: "/service/[name]", params: { name: item.serviceName } })
              }
            />
          </StaggeredEntry>
        )}
      />
    </ThemedView>
  );
}


function SortBar({
  current,
  onSelect,
}: {
  current: SortKey;
  onSelect: (key: SortKey) => void;
}) {
  return (
    <View style={styles.sortBar}>
      {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
        <Chip
          key={key}
          value={key}
          label={SORT_LABELS[key]}
          active={key === current}
          onPress={onSelect}
          size="sm"
          testID={`sort-${key}`}
        />
      ))}
    </View>
  );
}


function StaggeredEntry({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  // FlatList recycles cells; without this guard a scrolled-into-view row
  // re-runs the entry animation every time it gets a new item.
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: Math.min(index, 8) * 40,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay: Math.min(index, 8) * 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function ServiceCard({
  item,
  onPress,
}: {
  item: ServiceItem;
  onPress: () => void;
}) {
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "borderSubtle");
  const status = serviceStatus(item);
  const statusColor = STATUS_COLORS[status];
  const p99Ms = item.p99 / 1_000_000;
  const errRate = item.numCalls > 0 ? (item.numErrors / item.numCalls) * 100 : 0;
  const isCritical = status === "critical";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: surface,
          borderColor: isCritical ? statusColor + "55" : border,
          opacity: pressed ? 0.88 : 1,
        },
        isCritical && Shadow.criticalGlow,
      ]}
      onPress={onPress}
      testID={`service-card-${item.serviceName}`}
    >
      <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <ThemedText
            numberOfLines={1}
            style={{
              fontFamily: FontFamily.sansSemibold,
              fontSize: FontSize.base,
              flex: 1,
              letterSpacing: -0.2,
            }}
          >
            {item.serviceName}
          </ThemedText>
          <ThemedText
            style={{
              fontFamily: FontFamily.monoSemibold,
              fontSize: 10,
              color: statusColor,
              letterSpacing: 1.4,
            }}
          >
            {status.toUpperCase()}
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
            label="ERR"
            value={`${errRate.toFixed(2)}%`}
            warn={errRate >= ERR_RATE_WARN * 100}
            crit={errRate >= ERR_RATE_CRIT * 100}
          />
          <MetricCell label="RPM" value={formatRate(item.callRate)} />
          <MetricCell label="AVG" value={formatLatency(item.avgDuration / 1_000_000)} />
        </View>
      </View>
    </Pressable>
  );
}


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
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const color = crit ? Brand.red400 : warn ? Brand.amber400 : text;

  return (
    <View style={styles.metricCell}>
      <ThemedText
        style={{
          fontFamily: FontFamily.monoMedium,
          fontSize: 10,
          color: muted,
          letterSpacing: 1.2,
        }}
      >
        {label}
      </ThemedText>
      <ThemedText
        style={{
          fontFamily: FontFamily.monoSemibold,
          color,
          fontSize: FontSize.sm,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </ThemedText>
    </View>
  );
}


function SkeletonCard() {
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "borderSubtle");
  const opacity = useShimmerOpacity();

  return (
    <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
      <View style={[styles.statusBar, { backgroundColor: Brand.robin500 + "44" }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Shimmer width="60%" opacity={opacity} />
          <Shimmer width={48} height={10} opacity={opacity} />
        </View>
        <View style={styles.metricsRow}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.metricCell}>
              <Shimmer width={24} height={8} opacity={opacity} />
              <Shimmer width={44} opacity={opacity} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
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
    paddingBottom: 160, // reserve space for floating tab bar
    gap: Space.md,
  },
  sortBarWrap: {
    marginBottom: Space.md,
  },
  sortBar: {
    flexDirection: "row",
    gap: Space.xs,
    paddingHorizontal: Space.xs,
  },
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
    minHeight: 84,
  },
  statusBar: {
    width: 3,
  },
  cardBody: {
    flex: 1,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    gap: Space.md,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricCell: {
    gap: 4,
  },
  emptyState: {
    paddingVertical: Space.xxxl,
    paddingHorizontal: Space.lg,
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
