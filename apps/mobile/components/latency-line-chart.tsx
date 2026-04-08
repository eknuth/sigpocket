import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { CartesianChart, Line } from "victory-native";
import type { ChartPoint } from "@sigpocket/shared-types";

import { ThemedText } from "@/components/themed-text";
import { FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type Props = {
  data: ChartPoint[];
  height?: number;
  color?: string;
};

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LatencyLineChart({ data, height = 200, color }: Props) {
  const border = useThemeColor({}, "borderSubtle");
  const defaultTint = useThemeColor({}, "tint");
  const secondaryText = useThemeColor({}, "textSecondary");
  const tint = color ?? defaultTint;

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height, borderColor: border }]}>
        <ThemedText type="caption" style={{ textAlign: "center" }}>
          No data points
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height, borderColor: border }]}>
      <CartesianChart
        data={data}
        xKey="timestamp"
        yKeys={["p95"]}
        axisOptions={{
          labelColor: secondaryText,
          lineColor: border,
          formatXLabel: (val) => formatTime(val as number),
          formatYLabel: (val) => formatMs(val as number),
          tickCount: { x: 4, y: 4 },
        }}
        padding={{ left: 8, right: 16, top: 12, bottom: 4 }}
      >
        {({ points }) => (
          <Line
            points={points.p95}
            color={tint}
            strokeWidth={2}
            curveType="natural"
            animate={{ type: "timing", duration: 300 }}
          />
        )}
      </CartesianChart>
    </View>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
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
    <View style={[styles.container, { height, borderColor: border }]}>
      <Animated.View
        style={[
          styles.skeletonArea,
          { height: height - Space.md * 2, backgroundColor: surface, opacity },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.md,
    overflow: "hidden",
  },
  skeletonArea: {
    flex: 1,
    borderRadius: Radius.md,
  },
});
