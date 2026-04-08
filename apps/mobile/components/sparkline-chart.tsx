import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { ChartPoint } from "@sigpocket/shared-types";

import { ThemedText } from "@/components/themed-text";
import { FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type Props = {
  data: ChartPoint[];
  height?: number;
  color?: string;
};

/**
 * Lightweight line chart using pure RN Views (no Skia/SVG needed).
 * Renders vertical bars at each data point — works in Expo Go.
 */
export function SparklineChart({ data, height = 160, color }: Props) {
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const defaultTint = useThemeColor({}, "tint");
  const secondaryText = useThemeColor({}, "textSecondary");
  const tint = color ?? defaultTint;

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height, backgroundColor: surface, borderColor: border }]}>
        <ThemedText type="caption" style={{ textAlign: "center" }}>
          No data points
        </ThemedText>
      </View>
    );
  }

  const values = data.map((d) => d.p95);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Y-axis labels
  const yTop = formatMs(max);
  const yMid = formatMs((max + min) / 2);
  const yBot = formatMs(min);

  // X-axis labels (first and last timestamp)
  const xStart = formatTime(data[0].timestamp);
  const xEnd = formatTime(data[data.length - 1].timestamp);

  return (
    <View style={[styles.container, { borderColor: border }]}>
      <View style={styles.yAxis}>
        <ThemedText style={[styles.axisLabel, { color: secondaryText }]}>{yTop}</ThemedText>
        <ThemedText style={[styles.axisLabel, { color: secondaryText }]}>{yMid}</ThemedText>
        <ThemedText style={[styles.axisLabel, { color: secondaryText }]}>{yBot}</ThemedText>
      </View>
      <View style={styles.chartArea}>
        <View style={[styles.gridLine, { top: 0, borderColor: border }]} />
        <View style={[styles.gridLine, { top: "50%", borderColor: border }]} />
        <View style={[styles.gridLine, { bottom: 0, borderColor: border }]} />
        <View style={[styles.bars, { height }]}>
          {data.map((point, i) => {
            const normalized = (point.p95 - min) / range;
            const barHeight = Math.max(2, normalized * height);
            return (
              <View
                key={point.timestamp}
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: tint,
                    opacity: 0.7 + normalized * 0.3,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.xAxis}>
          <ThemedText style={[styles.axisLabel, { color: secondaryText }]}>{xStart}</ThemedText>
          <ThemedText style={[styles.axisLabel, { color: secondaryText }]}>{xEnd}</ThemedText>
        </View>
      </View>
    </View>
  );
}

export function ChartSkeleton({ height = 160 }: { height?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");

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
    <View style={[styles.container, { borderColor: border }]}>
      <Animated.View
        style={[
          styles.skeletonArea,
          { height, backgroundColor: surface, opacity },
        ]}
      />
    </View>
  );
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.md,
    gap: Space.sm,
  },
  yAxis: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    width: 44,
    paddingBottom: 20, // space for x-axis labels
  },
  axisLabel: {
    fontSize: FontSize.xs - 1,
    fontFamily: "monospace",
  },
  chartArea: {
    flex: 1,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
  },
  bar: {
    flex: 1,
    borderRadius: 1,
    minWidth: 1,
  },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Space.xs,
  },
  skeletonArea: {
    flex: 1,
    borderRadius: Radius.md,
  },
});
