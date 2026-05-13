import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { FontFamily, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type Size = "sm" | "md";

type ChipProps<T extends string | number> = {
  label: string;
  value: T;
  active: boolean;
  onPress: (value: T) => void;
  size?: Size;
  testID?: string;
};

/** Selected-vs-unselected pill, used by sort bars, filters and preference pickers. */
export function Chip<T extends string | number>({
  label,
  value,
  active,
  onPress,
  size = "md",
  testID,
}: ChipProps<T>) {
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "border");
  const muted = useThemeColor({}, "textMuted");

  const sz = size === "sm" ? styles.sm : styles.md;

  return (
    <Pressable
      hitSlop={8}
      onPress={() => onPress(value)}
      style={[
        styles.base,
        sz,
        {
          backgroundColor: active ? tint + "1A" : "transparent",
          borderColor: active ? tint + "88" : border,
        },
      ]}
      testID={testID}
    >
      <ThemedText
        style={{
          fontFamily: active ? FontFamily.sansSemibold : FontFamily.sansMedium,
          fontSize: size === "sm" ? FontSize.xs : FontSize.sm,
          color: active ? tint : muted,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    borderWidth: 1,
    justifyContent: "center",
  },
  md: {
    paddingHorizontal: Space.lg,
    paddingVertical: 10,
    minHeight: 36,
  },
  sm: {
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    minHeight: 28,
  },
});
