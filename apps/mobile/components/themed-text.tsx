import { StyleSheet, Text, type TextProps } from "react-native";

import { Brand, FontSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link" | "caption" | "mono";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  const secondaryColor = useThemeColor({}, "textSecondary");

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? [styles.link, { color: Brand.robin400 }] : undefined,
        type === "caption" ? [styles.caption, { color: secondaryColor }] : undefined,
        type === "mono" ? styles.mono : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: FontSize.base,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: FontSize.base,
    lineHeight: 24,
    fontWeight: "600",
  },
  title: {
    fontSize: FontSize.display,
    fontWeight: "bold",
    lineHeight: 40,
  },
  subtitle: {
    fontSize: FontSize.xl,
    fontWeight: "bold",
  },
  link: {
    lineHeight: 24,
    fontSize: FontSize.base,
  },
  caption: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  mono: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: "monospace",
  },
});
