import { StyleSheet, Text, type TextProps } from "react-native";

import { Brand, FontFamily, FontSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | "default"
    | "title"
    | "defaultSemiBold"
    | "subtitle"
    | "link"
    | "caption"
    | "mono"
    | "monoSemibold";
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
        type === "monoSemibold" ? styles.monoSemibold : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.base,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontFamily: FontFamily.sansSemibold,
    fontSize: FontSize.base,
    lineHeight: 24,
  },
  title: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.display,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl + 6,
    letterSpacing: -0.3,
  },
  link: {
    fontFamily: FontFamily.sansMedium,
    lineHeight: 24,
    fontSize: FontSize.base,
  },
  caption: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  mono: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  monoSemibold: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
