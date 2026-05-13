import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { TraceSpan } from "@sigpocket/shared-types";

import { ScreenHeader } from "@/components/screen-header";
import { Shimmer, useShimmerOpacity } from "@/components/shimmer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TraceWaterfall } from "@/components/trace-waterfall";
import { Brand, FontFamily, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSignozClient } from "@/hooks/use-signoz-client";
import { useInstanceStore } from "@/stores/instance-store";


export default function TraceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useSignozClient();
  const activeId = useInstanceStore((s) => s.activeInstanceId);

  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);

  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const errorColor = useThemeColor({}, "error");

  const {
    data: detail,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["trace", activeId, id],
    queryFn: () => client!.getTraceDetail(id),
    enabled: !!client && !!id,
  });

  const root = useMemo<TraceSpan | undefined>(() => {
    if (!detail?.spans?.length) return undefined;
    return detail.spans.find((s) => s.parentSpanID === "") ?? detail.spans[0];
  }, [detail]);

  const totalDurationMs = useMemo(() => {
    if (!detail?.spans?.length) return 0;
    if (root) return root.durationNano / 1_000_000;
    return Math.max(...detail.spans.map((s) => s.durationNano)) / 1_000_000;
  }, [detail, root]);

  if (!client) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="caption">No instance configured.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={tint} />
        }
      >
        <ScreenHeader
          back
          paddedSides={false}
          eyebrow={`Trace · ${truncateTraceId(id)}`}
          title={root?.name || "Trace"}
          subtitle={root ? root["service.name"] : undefined}
          right={
            root ? (
              <View
                style={[
                  styles.durationPill,
                  { backgroundColor: tint + "1A", borderColor: tint + "55" },
                ]}
              >
                <ThemedText
                  style={{
                    color: tint,
                    fontFamily: FontFamily.monoSemibold,
                    fontSize: FontSize.sm,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {totalDurationMs.toFixed(0)} ms
                </ThemedText>
              </View>
            ) : undefined
          }
        />

        {/* ── Waterfall ───────────────────────── */}
        {isLoading ? (
          <WaterfallSkeleton />
        ) : error ? (
          <View style={[styles.errorCard, { borderColor: border }]}>
            <ThemedText style={{ color: errorColor, textAlign: "center", fontSize: FontSize.sm }}>
              {error instanceof Error ? error.message : "Failed to load trace"}
            </ThemedText>
            <Pressable
              style={[styles.retryButton, { borderColor: tint }]}
              onPress={() => refetch()}
            >
              <ThemedText style={{ color: tint }}>Retry</ThemedText>
            </Pressable>
          </View>
        ) : detail && detail.spans.length > 0 ? (
          <TraceWaterfall trace={detail} onSpanPress={(span) => setSelectedSpan(span)} />
        ) : (
          <View style={[styles.errorCard, { borderColor: border }]}>
            <ThemedText type="caption" style={{ textAlign: "center" }}>
              No spans for this trace.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* ── Span detail modal ───────────────── */}
      <Modal
        visible={!!selectedSpan}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedSpan(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: surface, borderColor: border }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" numberOfLines={2} style={{ flex: 1 }}>
                {selectedSpan?.name || "Span"}
              </ThemedText>
              <Pressable onPress={() => setSelectedSpan(null)} hitSlop={8}>
                <ThemedText style={{ color: tint, fontSize: FontSize.base }}>Close</ThemedText>
              </Pressable>
            </View>
            {selectedSpan ? (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <SpanDetailRow label="Service" value={selectedSpan["service.name"]} />
                <SpanDetailRow
                  label="Duration"
                  value={`${(selectedSpan.durationNano / 1_000_000).toFixed(2)} ms`}
                />
                <SpanDetailRow label="Span ID" value={selectedSpan.spanID} mono />
                {selectedSpan.parentSpanID ? (
                  <SpanDetailRow label="Parent" value={selectedSpan.parentSpanID} mono />
                ) : (
                  <SpanDetailRow label="Parent" value="(root)" />
                )}
                {selectedSpan.spanKind ? (
                  <SpanDetailRow label="Kind" value={selectedSpan.spanKind} />
                ) : null}
                {selectedSpan.statusCodeString ? (
                  <SpanDetailRow label="Status" value={selectedSpan.statusCodeString} />
                ) : null}
                {selectedSpan.responseStatusCode ? (
                  <SpanDetailRow label="HTTP" value={selectedSpan.responseStatusCode} />
                ) : null}
                <SpanDetailRow
                  label="Error"
                  value={selectedSpan.hasError ? "yes" : "no"}
                  valueColor={selectedSpan.hasError ? Brand.red400 : undefined}
                />
                <SpanDetailRow label="Started" value={selectedSpan.timestamp} mono />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}


function SpanDetailRow({
  label,
  value,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  const border = useThemeColor({}, "borderSubtle");
  return (
    <View style={[styles.detailRow, { borderColor: border }]}>
      <ThemedText type="caption" style={{ width: 80 }}>
        {label}
      </ThemedText>
      <ThemedText
        type={mono ? "mono" : "default"}
        style={{ flex: 1, fontSize: FontSize.sm, color: valueColor }}
        selectable
      >
        {value}
      </ThemedText>
    </View>
  );
}


function WaterfallSkeleton() {
  const opacity = useShimmerOpacity();
  const border = useThemeColor({}, "borderSubtle");
  return (
    <View style={[styles.skeletonContainer, { borderColor: border }]}>
      {[0.95, 0.7, 0.55, 0.4, 0.45, 0.3].map((w, i) => (
        <Shimmer
          key={i}
          width={`${Math.round(w * 100)}%`}
          opacity={opacity}
          style={{ marginLeft: `${(1 - w) * 30}%` }}
        />
      ))}
    </View>
  );
}


function truncateTraceId(id: string): string {
  if (!id) return "";
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
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
  scroll: {
    paddingHorizontal: Space.lg,
    paddingBottom: 160,
    gap: Space.lg,
  },
  durationPill: {
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: 4,
  },
  headerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Space.xs,
  },
  errorCard: {
    padding: Space.xl,
    borderWidth: 1,
    borderRadius: Radius.lg,
    alignItems: "center",
    gap: Space.sm,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
  skeletonContainer: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Space.lg,
    maxHeight: "75%",
    gap: Space.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  modalBody: {
    gap: Space.sm,
    paddingBottom: Space.xl,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.md,
    paddingVertical: Space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
