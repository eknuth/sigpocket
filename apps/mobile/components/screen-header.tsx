import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FontFamily, FontSize, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  back?: boolean;
  right?: React.ReactNode;
  /** When false, falls back to a tighter spacing — used inside scroll views. */
  paddedTop?: boolean;
  /**
   * Pass `false` when rendering inside a container that already provides
   * horizontal padding (e.g. a FlatList contentContainerStyle), to avoid
   * doubling up.
   */
  paddedSides?: boolean;
};

/**
 * Custom screen header — replaces the default expo-router/react-navigation
 * header chrome. Large display title, optional eyebrow (instance/category),
 * optional subtitle line, optional right-aligned slot for live indicators.
 *
 * Used both at the top of tab screens (paddedTop) and stack screens (back=true).
 */
export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  back,
  right,
  paddedTop = true,
  paddedSides = true,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const tint = useThemeColor({}, "tint");

  return (
    <View
      style={[
        styles.container,
        paddedTop && { paddingTop: insets.top + Space.md },
        !paddedSides && { paddingHorizontal: 0 },
      ]}
    >
      <View style={styles.topRow}>
        {back ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backBtn}
            testID="screen-header-back"
          >
            <IconSymbol name="chevron.left" size={20} color={tint} />
            <ThemedText
              style={{
                color: tint,
                fontFamily: FontFamily.sansMedium,
                fontSize: FontSize.sm,
                letterSpacing: 0.2,
              }}
            >
              Back
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        {right ? <View>{right}</View> : null}
      </View>

      {eyebrow ? (
        <ThemedText
          style={{
            color: muted,
            fontFamily: FontFamily.monoMedium,
            fontSize: 11,
            letterSpacing: 1.6,
            marginBottom: Space.xs,
          }}
        >
          {eyebrow.toUpperCase()}
        </ThemedText>
      ) : null}

      <ThemedText
        style={{
          color: text,
          fontFamily: FontFamily.sansBold,
          fontSize: FontSize.display,
          lineHeight: FontSize.display + 4,
          letterSpacing: -0.6,
        }}
        numberOfLines={2}
      >
        {title}
      </ThemedText>

      {subtitle ? (
        <ThemedText
          style={{
            color: muted,
            fontFamily: FontFamily.sans,
            fontSize: FontSize.sm,
            marginTop: Space.xs,
          }}
        >
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.lg,
    gap: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 32,
    marginBottom: Space.md,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: -4,
  },
});
