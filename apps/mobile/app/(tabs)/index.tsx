import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import type { ServiceItem } from "@sigpocket/shared-types";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSignozClient } from "@/hooks/use-signoz-client";
import { useInstanceStore } from "@/stores/instance-store";



export default function ServicesScreen() {
  const router = useRouter();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);
  const activeName = useInstanceStore((s) => s.getActive()?.name);
  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const successColor = useThemeColor({}, "success");
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

  if (!client) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="caption">No instance configured.</ThemedText>
      </ThemedView>
    );
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={tint} size="large" />
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
        data={services}
        keyExtractor={(item) => item.serviceName}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={tint} />
        }
        ListHeaderComponent={
          activeName ? (
            <ThemedText type="caption" style={styles.instanceLabel}>
              {activeName.toUpperCase()}
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <ThemedText type="caption">No services found in the last 6 hours.</ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <ServiceCard
            item={item}
            surface={surface}
            border={border}
            tint={tint}
            successColor={successColor}
            errorColor={errorColor}
            onPress={() => router.push({ pathname: "/service/[name]", params: { name: item.serviceName } })}
          />
        )}
      />
    </ThemedView>
  );
}

function ServiceCard({
  item,
  surface,
  border,
  tint,
  successColor,
  errorColor,
  onPress,
}: {
  item: ServiceItem;
  surface: string;
  border: string;
  tint: string;
  successColor: string;
  errorColor: string;
  onPress: () => void;
}) {
  const p99Ms = (item.p99 / 1_000_000).toFixed(1);
  const avgMs = (item.avgDuration / 1_000_000).toFixed(1);
  const errRate = item.numCalls > 0 ? ((item.numErrors / item.numCalls) * 100).toFixed(2) : "0.00";
  const hasErrors = item.numErrors > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: surface, borderColor: border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
      testID={`service-card-${item.serviceName}`}
    >
      <View style={styles.cardTop}>
        <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ flex: 1 }}>
          {item.serviceName}
        </ThemedText>
        <View style={[styles.dot, { backgroundColor: hasErrors ? errorColor : successColor }]} />
      </View>

      <View style={styles.metricsRow}>
        <MetricCell label="P99" value={`${p99Ms}ms`} color={tint} />
        <MetricCell label="Avg" value={`${avgMs}ms`} color={tint} />
        <MetricCell label="Rate" value={`${item.callRate.toFixed(1)}/s`} color={tint} />
        <MetricCell
          label="Errors"
          value={`${errRate}%`}
          color={hasErrors ? errorColor : successColor}
        />
      </View>
    </Pressable>
  );
}

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metricCell}>
      <ThemedText type="caption">{label}</ThemedText>
      <ThemedText type="mono" style={{ color, fontSize: FontSize.sm, fontWeight: "600" }}>
        {value}
      </ThemedText>
    </View>
  );
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
    padding: Space.lg,
    gap: Space.md,
  },
  instanceLabel: {
    letterSpacing: 1,
    marginBottom: Space.xs,
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricCell: {
    gap: 2,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
});
