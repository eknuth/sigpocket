import { useColorScheme as useRNColorScheme } from "react-native";

import { usePreferencesStore } from "@/stores/preferences-store";

/**
 * Returns the effective color scheme, honoring the user's theme preference
 * when set to an explicit "light" or "dark", and falling back to the OS
 * scheme when the preference is "system".
 */
export function useColorScheme(): ReturnType<typeof useRNColorScheme> {
  const osScheme = useRNColorScheme();
  const themePref = usePreferencesStore((s) => s.theme);

  if (themePref !== "system") {
    return themePref;
  }

  return osScheme;
}
