import type { JSX } from "react";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import type { TraceDetail, TraceSpan } from "@sigpocket/shared-types";

import { ThemedText } from "@/components/themed-text";
import { Brand, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type Props = {
  trace: TraceDetail;
  onSpanPress?: (span: TraceSpan) => void;
};

type Row = {
  span: TraceSpan;
  depth: number;
  /** 0–100, where 100 spans the full root duration. */
  widthPct: number;
  /** 0–100, offset from the trace start. */
  offsetPct: number;
};

const INDENT_PX = 12;
const BAR_TRACK_HEIGHT = 18;
const MIN_BAR_PCT = 0.5;

export function TraceWaterfall({ trace, onSpanPress }: Props): JSX.Element {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const tint = useThemeColor({}, "tint");
  const secondaryText = useThemeColor({}, "textSecondary");

  const rows = useMemo(() => buildRows(trace.spans), [trace.spans]);

  if (rows.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: border }]}>
        <ThemedText type="caption" style={{ textAlign: "center" }}>
          No spans
        </ThemedText>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.span.spanID}
      windowSize={10}
      initialNumToRender={20}
      removeClippedSubviews
      renderItem={({ item }) => (
        <SpanRow
          row={item}
          surface={surface}
          border={border}
          tint={tint}
          secondaryText={secondaryText}
          onPress={onSpanPress}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: Space.xs }} />}
      contentContainerStyle={styles.list}
    />
  );
}

type SpanRowProps = {
  row: Row;
  surface: string;
  border: string;
  tint: string;
  secondaryText: string;
  onPress?: (span: TraceSpan) => void;
};

function SpanRow({ row, surface, border, tint, secondaryText, onPress }: SpanRowProps) {
  const { span, depth, widthPct, offsetPct } = row;
  const barColor = span.hasError ? Brand.red400 : tint;
  const serviceName = span["service.name"];

  const handlePress = onPress ? () => onPress(span) : undefined;

  return (
    <Pressable
      onPress={handlePress}
      disabled={!handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: surface,
          borderColor: border,
          paddingLeft: Space.sm + depth * INDENT_PX,
          opacity: pressed && handlePress ? 0.7 : 1,
        },
      ]}
      testID={`span-row-${span.spanID}`}
    >
      <View style={styles.barTrack}>
        <View
          style={[
            styles.bar,
            {
              backgroundColor: barColor,
              left: `${offsetPct}%`,
              width: `${Math.max(widthPct, MIN_BAR_PCT)}%`,
            },
          ]}
        />
        <View style={styles.barLabelRow} pointerEvents="none">
          <ThemedText
            numberOfLines={1}
            style={styles.barName}
          >
            {span.name}
          </ThemedText>
          <ThemedText type="mono" style={[styles.barDuration, { color: secondaryText }]}>
            {formatDurationNs(span.durationNano)}
          </ThemedText>
        </View>
      </View>
      <ThemedText
        numberOfLines={1}
        style={[styles.subtitle, { color: secondaryText }]}
      >
        {serviceName}
        {span.spanKind ? ` · ${span.spanKind}` : ""}
      </ThemedText>
    </Pressable>
  );
}

// ── Tree building ─────────────────────────────────────────────

function buildRows(spans: TraceSpan[]): Row[] {
  if (spans.length === 0) return [];

  // Root = parentSpanID === "". Fall back to the earliest span if none match
  // (defensive — SigNoz can return partial traces).
  const childrenByParent = new Map<string, TraceSpan[]>();
  for (const span of spans) {
    const list = childrenByParent.get(span.parentSpanID) ?? [];
    list.push(span);
    childrenByParent.set(span.parentSpanID, list);
  }
  // Sort children by start time so siblings render in temporal order.
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => spanStartNs(a) - spanStartNs(b));
  }

  const roots = childrenByParent.get("") ?? [];
  let effectiveRoots: TraceSpan[];
  if (roots.length > 0) {
    effectiveRoots = roots;
  } else {
    // Pick spans whose parent isn't in the set — orphan-tolerant fallback.
    const ids = new Set(spans.map((s) => s.spanID));
    const orphans = spans.filter((s) => !ids.has(s.parentSpanID));
    effectiveRoots = orphans.length > 0 ? orphans : [spans[0]];
    effectiveRoots.sort((a, b) => spanStartNs(a) - spanStartNs(b));
  }

  // Trace window = earliest start to latest end across all spans (handles
  // clock skew and async children that outlive the root).
  let traceStartNs = Number.POSITIVE_INFINITY;
  let traceEndNs = Number.NEGATIVE_INFINITY;
  for (const span of spans) {
    const start = spanStartNs(span);
    const end = start + span.durationNano;
    if (start < traceStartNs) traceStartNs = start;
    if (end > traceEndNs) traceEndNs = end;
  }
  const traceDurationNs = Math.max(1, traceEndNs - traceStartNs);

  const rows: Row[] = [];
  const visited = new Set<string>();

  function walk(span: TraceSpan, depth: number): void {
    if (visited.has(span.spanID)) return; // cycle guard
    visited.add(span.spanID);

    const startNs = spanStartNs(span);
    const offsetPct = ((startNs - traceStartNs) / traceDurationNs) * 100;
    const widthPct = (span.durationNano / traceDurationNs) * 100;
    rows.push({
      span,
      depth,
      offsetPct: clampPct(offsetPct),
      widthPct: clampPct(widthPct),
    });

    const children = childrenByParent.get(span.spanID);
    if (children) {
      for (const child of children) walk(child, depth + 1);
    }
  }

  for (const root of effectiveRoots) walk(root, 0);

  // Append any spans we didn't reach (disconnected subtrees) at depth 0 so
  // nothing silently disappears.
  for (const span of spans) {
    if (!visited.has(span.spanID)) walk(span, 0);
  }

  return rows;
}

function spanStartNs(span: TraceSpan): number {
  return new Date(span.timestamp).getTime() * 1e6;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

// ── Formatting ────────────────────────────────────────────────

function formatDurationNs(ns: number): string {
  const ms = ns / 1_000_000;
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: {
    paddingVertical: Space.xs,
  },
  empty: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.xl,
  },
  row: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingRight: Space.sm,
    paddingVertical: Space.sm,
    gap: 4,
  },
  barTrack: {
    height: BAR_TRACK_HEIGHT,
    justifyContent: "center",
    position: "relative",
  },
  bar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: Radius.sm,
    opacity: 0.35,
  },
  barLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
    paddingHorizontal: Space.xs,
  },
  barName: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: "600",
    lineHeight: BAR_TRACK_HEIGHT,
  },
  barDuration: {
    fontSize: FontSize.xs,
    lineHeight: BAR_TRACK_HEIGHT,
  },
  subtitle: {
    fontSize: FontSize.xs,
    paddingHorizontal: Space.xs,
  },
});
