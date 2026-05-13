/**
 * SigPocket design tokens.
 *
 * Concept: pocket telemetry — an instrument panel for SREs.
 * Dark-first, data-dense, with one decisive brand accent and tabular
 * monospace numerics everywhere data lives.
 *
 * Typography:
 *   - Geist (sans) for UI, titles, body
 *   - Geist Mono for all data: latencies, error rates, IDs, timestamps
 *
 * Palette draws from SigNoz (Robin / Sakura) but pushes the dark surfaces
 * deeper so cards and the floating tab bar separate visually.
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
  amber400: "#FBBF24",
  green500: "#22C55E",
  green400: "#4ADE80",
  red500: "#EF4444",
  red400: "#F87171",
} as const;

// ── Semantic color scales ─────────────────────────────────────

export const Colors = {
  light: {
    text: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    background: "#F8FAFC",
    backgroundElevated: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceRaised: "#F1F5F9",
    surfaceFloat: "#FFFFFFEE",
    border: "#CBD5E1",
    borderSubtle: "#E2E8F0",
    tint: Brand.robin500,
    tintGlow: "#4668DC33",
    icon: "#64748B",
    tabIconDefault: "#94A3B8",
    tabIconSelected: Brand.robin500,
    success: Brand.green500,
    error: Brand.red500,
    warning: Brand.amber500,
  },
  dark: {
    // Deepest layer — the void behind everything
    text: "#E6EAF2",
    textSecondary: "#9BA3B4",
    textMuted: "#5F6776",
    background: "#07080B",
    backgroundElevated: "#0E1014",
    surface: "#13151B",
    surfaceRaised: "#191C24",
    surfaceFloat: "#1A1D26E6", // translucent for the floating tab bar
    border: "#262A35",
    borderSubtle: "#1E2129",
    tint: "#7691EB",
    tintGlow: "#7691EB40",
    icon: "#6B7383",
    tabIconDefault: "#5F6776",
    tabIconSelected: "#7691EB",
    success: Brand.green400,
    error: Brand.red400,
    warning: Brand.amber400,
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
  xxl: 28,
  full: 9999,
} as const;

// ── Elevation / glow shadows ──────────────────────────────────
// Use sparingly. The tab bar gets one. Critical service cards
// get a faint red one. Everything else stays flat.

export const Shadow = {
  floatDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  tintGlow: {
    shadowColor: "#4668DC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  criticalGlow: {
    shadowColor: "#F87171",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;

// ── Typography ────────────────────────────────────────────────
// Geist (sans) and Geist Mono are loaded via @expo-google-fonts
// in app/_layout.tsx. Weight is encoded in the family name, per
// React Native's font-handling on Android.

export const FontFamily = {
  sans: "Geist_400Regular",
  sansMedium: "Geist_500Medium",
  sansSemibold: "Geist_600SemiBold",
  sansBold: "Geist_700Bold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
  monoSemibold: "GeistMono_600SemiBold",
} as const;

// Kept for any consumers still reading Fonts — same values, expressed
// as the canonical Android-style family names so weights resolve.
export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.sans,
    rounded: FontFamily.sans,
    mono: FontFamily.mono,
    serif: "ui-serif",
  },
  default: {
    sans: FontFamily.sans,
    rounded: FontFamily.sans,
    mono: FontFamily.mono,
    serif: "serif",
  },
  web: {
    sans: "Geist, system-ui, -apple-system, sans-serif",
    rounded: "Geist, system-ui, sans-serif",
    mono: "'Geist Mono', SFMono-Regular, Menlo, monospace",
    serif: "Georgia, serif",
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
  hero: 44,
} as const;
