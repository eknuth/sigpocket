import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { Colors, FontFamily, Radius, Shadow, Space } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";

const ICONS: Record<string, IconSymbolName> = {
  index: "chart.bar.fill",
  settings: "gearshape.fill",
};

const BAR_PADDING = 8;

/**
 * Floating glass tab bar.
 *
 * Sits above the safe-area inset, with a soft float shadow and a sliding pill
 * that highlights the active tab. The bar is rendered absolutely on top of
 * screen content, so screens should reserve bottom padding for it.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const surface = useThemeColor({}, "surfaceFloat");
  const border = useThemeColor({}, "border");
  const tint = useThemeColor({}, "tint");
  const tintGlow = useThemeColor({}, "tintGlow");
  const iconInactive = useThemeColor({}, "tabIconDefault");
  const text = useThemeColor({}, "text");

  const tabCount = state.routes.length;
  const [barInnerWidth, setBarInnerWidth] = useState(0);
  const tabWidth = barInnerWidth > 0 ? barInnerWidth / tabCount : 0;
  const slide = useRef(new Animated.Value(state.index)).current;
  useEffect(() => {
    Animated.spring(slide, {
      toValue: state.index,
      useNativeDriver: true,
      stiffness: 220,
      damping: 22,
      mass: 0.9,
    }).start();
  }, [state.index, slide]);

  const baseBg = scheme === "dark" ? Colors.dark.background : Colors.light.background;
  // Transparent → solid base color, so scrolled content visually fades behind
  // the floating pill instead of peeking around the sides.
  const fadeFrom = `${baseBg}00`;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, Space.md) },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[fadeFrom, baseBg]}
        locations={[0, 0.7]}
        style={styles.fade}
      />
      <View
        onLayout={(e) =>
          setBarInnerWidth(e.nativeEvent.layout.width - BAR_PADDING * 2)
        }
        style={[
          styles.bar,
          {
            backgroundColor: surface,
            borderColor: border,
          },
          scheme === "dark" ? Shadow.floatDark : Shadow.tintGlow,
        ]}
      >
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePill,
              {
                backgroundColor: tint + "1F",
                borderColor: tint + "55",
                shadowColor: tint,
                width: tabWidth,
                transform: [
                  {
                    translateX: slide.interpolate({
                      inputRange: state.routes.map((_, i) => i),
                      outputRange: state.routes.map((_, i) => i * tabWidth),
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}

        {state.routes.map((route, idx) => {
          const isFocused = state.index === idx;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : typeof options.title === "string"
                ? options.title
                : route.name;
          const iconName = ICONS[route.name] ?? "chart.bar.fill";

          const onPress = () => {
            if (Platform.OS === "ios") {
              Haptics.selectionAsync();
            }
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              testID={`tab-${route.name}`}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
            >
              <View style={styles.tabInner}>
                <IconSymbol
                  name={iconName}
                  size={22}
                  color={isFocused ? tint : iconInactive}
                />
                <Animated.Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused ? text : iconInactive,
                      fontFamily: isFocused
                        ? FontFamily.sansSemibold
                        : FontFamily.sansMedium,
                    },
                  ]}
                >
                  {label}
                </Animated.Text>
                {isFocused ? (
                  <View
                    style={[
                      styles.activeDot,
                      { backgroundColor: tint, shadowColor: tintGlow },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Space.lg,
    alignItems: "center",
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  bar: {
    flexDirection: "row",
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: BAR_PADDING,
    paddingHorizontal: BAR_PADDING,
    minWidth: 240,
    gap: 4,
    overflow: "hidden",
  },
  activePill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    left: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 0,
  },
  tab: {
    flex: 1,
    minHeight: 44,
  },
  tabInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  activeDot: {
    position: "absolute",
    right: 14,
    top: "50%",
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
});
