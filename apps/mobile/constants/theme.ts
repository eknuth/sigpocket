/**
 * SigPocket design tokens — aligned with SigNoz's dark-first design language.
 *
 * SigNoz palette reference:
 *   Robin (brand blue): #4668DC
 *   Sakura (accent pink): #F24769
 *   Ink (backgrounds): 500→100 from darkest to lighter
 *   Vanilla (text): 100 = bright, 400 = muted
 *   Slate (borders/secondary): 200–500
 */

import { Platform } from "react-native";

// ── Brand tokens ──────────────────────────────────────────────

export const Brand = {
  robin500: "#4668DC",
  robin400: "#6B87E5",
  robin300: "#92A8EE",
  sakura500: "#F24769",
  sakura400: "#F56B87",
  amber500: "#F59E0B",
  green500: "#22C55E",
  green400: "#4ADE80",
  red500: "#EF4444",
  red400: "#F87171",
} as const;

// ── Semantic color scales ─────────────────────────────────────

export const Colors = {
  light: {
    text: "#1E293B",
    textSecondary: "#475569",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceRaised: "#F1F5F9",
    border: "#CBD5E1",
    borderSubtle: "#E2E8F0",
    tint: Brand.robin500,
    icon: "#64748B",
    tabIconDefault: "#64748B",
    tabIconSelected: Brand.robin500,
    success: Brand.green500,
    error: Brand.red500,
    warning: Brand.amber500,
  },
  dark: {
    text: "#E2E8F0",
    textSecondary: "#94A3B8",
    background: "#0B0C0E",
    surface: "#121317",
    surfaceRaised: "#1A1C23",
    border: "#2D3039",
    borderSubtle: "#23252D",
    tint: Brand.robin400,
    icon: "#64748B",
    tabIconDefault: "#64748B",
    tabIconSelected: Brand.robin400,
    success: Brand.green400,
    error: Brand.red400,
    warning: Brand.amber500,
  },
} as const;

// ── Spacing (4pt grid) ────────────────────────────────────────

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ── Radii ─────────────────────────────────────────────────────

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// ── Typography ────────────────────────────────────────────────

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "'Fira Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "'Fira Code', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;
