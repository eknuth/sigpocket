import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Ambient background painted behind the app shell. Always renders a solid
 * fill of the theme's background color first, then layers a subtle gradient
 * on top — so even if the gradient fails to mount (e.g. transient), the
 * surface still reads correctly in the chosen theme.
 */
export function AtmosphericBg() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const base = isDark ? Colors.dark.background : Colors.light.background;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: base }]}
    >
      {isDark ? (
        <>
          <LinearGradient
            colors={["#0F1424", "#07080B", "#07080B"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["#4668DC22", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.4 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={["#F1F5F9", "#F8FAFC"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["#4668DC10", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.4 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
    </View>
  );
}
