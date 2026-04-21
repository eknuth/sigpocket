import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { usePreferencesStore } from '@/stores/preferences-store';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Honors the user's theme preference when set to an explicit "light" or "dark", and falls back
 * to the OS scheme when the preference is "system".
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const osScheme = useRNColorScheme();
  const themePref = usePreferencesStore((s) => s.theme);

  if (!hasHydrated) {
    return 'light';
  }

  if (themePref !== 'system') {
    return themePref;
  }

  return osScheme;
}
