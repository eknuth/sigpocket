import { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

import { Brand, Radius } from "@/constants/theme";

/**
 * Pulsing-opacity Animated.Value driving skeleton placeholders.
 * Loops 0.3 → 0.7 → 0.3 over 1.6s. Native driver for cheap UI-thread animation.
 */
export function useShimmerOpacity() {
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

  return opacity;
}

type ShimmerProps = {
  width: number | `${number}%`;
  height?: number;
  radius?: number;
  opacity: Animated.Value;
  style?: StyleProp<ViewStyle>;
};

/** Rectangular shimmer block fed by an Animated.Value (typically from useShimmerOpacity). */
export function Shimmer({ width, height = 14, radius = Radius.sm, opacity, style }: ShimmerProps) {
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: SHIMMER_BG,
          opacity,
        },
        style,
      ]}
    />
  );
}

const SHIMMER_BG = Brand.robin500 + "22";
