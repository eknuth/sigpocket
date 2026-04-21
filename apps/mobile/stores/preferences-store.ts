import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const THEME_KEY = "sigpocket_pref_theme";
const REFRESH_KEY = "sigpocket_pref_refresh_interval_ms";

export type ThemePref = "system" | "light" | "dark";
export type RefreshIntervalMs = 5000 | 15000 | 30000 | 60000;

const DEFAULT_THEME: ThemePref = "system";
const DEFAULT_REFRESH_MS: RefreshIntervalMs = 15000;

const VALID_THEMES: readonly ThemePref[] = ["system", "light", "dark"];
const VALID_REFRESH_MS: readonly RefreshIntervalMs[] = [5000, 15000, 30000, 60000];

function isThemePref(value: string | null): value is ThemePref {
  return value !== null && (VALID_THEMES as readonly string[]).includes(value);
}

function isRefreshIntervalMs(value: number): value is RefreshIntervalMs {
  return (VALID_REFRESH_MS as readonly number[]).includes(value);
}

export type PreferencesState = {
  theme: ThemePref;
  refreshIntervalMs: RefreshIntervalMs;
  hydrated: boolean;
};

export type PreferencesActions = {
  hydrate: () => Promise<void>;
  setTheme: (t: ThemePref) => void;
  setRefreshIntervalMs: (i: RefreshIntervalMs) => void;
};

type PreferencesStore = PreferencesState & PreferencesActions;

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  theme: DEFAULT_THEME,
  refreshIntervalMs: DEFAULT_REFRESH_MS,
  hydrated: false,

  hydrate: async () => {
    const rawTheme = await SecureStore.getItemAsync(THEME_KEY);
    const rawRefresh = await SecureStore.getItemAsync(REFRESH_KEY);
    const parsedRefresh = rawRefresh !== null ? Number(rawRefresh) : NaN;

    set({
      theme: isThemePref(rawTheme) ? rawTheme : DEFAULT_THEME,
      refreshIntervalMs: isRefreshIntervalMs(parsedRefresh)
        ? parsedRefresh
        : DEFAULT_REFRESH_MS,
      hydrated: true,
    });
  },

  setTheme: (t) => {
    set({ theme: t });
    void SecureStore.setItemAsync(THEME_KEY, t);
  },

  setRefreshIntervalMs: (i) => {
    set({ refreshIntervalMs: i });
    void SecureStore.setItemAsync(REFRESH_KEY, String(i));
  },
}));

// Kick off hydration on first import. Does not block startup; the store
// updates once SecureStore returns.
void usePreferencesStore.getState().hydrate();
