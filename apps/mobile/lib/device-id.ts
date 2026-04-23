import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const DEVICE_ID_KEY = "sigpocket_device_id";

/**
 * Stable per-install identifier used by the push relay to key registrations.
 * Generated once, persisted in SecureStore forever (or until the app is
 * uninstalled). `expo-crypto` gives us a proper UUID; we fall back to a
 * Math.random hex string because `Crypto.randomUUID()` can throw in rare
 * bare/Expo Go edge cases and a best-effort id still keeps the relay flow
 * working.
 */
export async function getDeviceId(): Promise<string> {
  const cached = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (cached) return cached;

  let id: string;
  try {
    id = Crypto.randomUUID();
  } catch {
    id = fallbackUuid();
  }
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

function fallbackUuid(): string {
  const s = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
}
