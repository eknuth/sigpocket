import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Configure how notifications behave while the app is foregrounded.
 * Keep this simple: show a banner + play sound so users see alerts that
 * fire while they're already in the app.
 */
export function configureForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Create the Android notification channels used by the push relay.
 * `alerts` is the firing channel (sound, heads-up); `resolved` is quieter
 * because these messages are "good news" and shouldn't interrupt.
 * No-op on iOS.
 */
export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("alerts", {
    name: "Alerts",
    description: "Firing alerts from your SigNoz instances",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF453A",
  });

  await Notifications.setNotificationChannelAsync("resolved", {
    name: "Resolved alerts",
    description: "Previously firing alerts that have now resolved",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

export type PermissionResult =
  | { granted: true }
  | { granted: false; reason: "denied" | "not-a-device" };

/**
 * Ask for notification permission. Safe to call repeatedly — if already
 * granted/denied, the system returns the cached status without re-prompting.
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (!Device.isDevice) {
    return { granted: false, reason: "not-a-device" };
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return { granted: true };
  if (!existing.canAskAgain) return { granted: false, reason: "denied" };

  const next = await Notifications.requestPermissionsAsync();
  return next.granted ? { granted: true } : { granted: false, reason: "denied" };
}

export type PushTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Fetch the ExponentPushToken for this install. Must run on a real device —
 * simulators/emulators can't register with APNs/FCM.
 *
 * projectId comes from Expo Application Services; we read it from
 * `expo.extra.eas.projectId` first, then fall back to `expoConfig.projectId`,
 * then to EAS runtime config. Undefined is acceptable for Expo Go.
 */
export async function fetchExpoPushToken(): Promise<PushTokenResult> {
  if (!Device.isDevice) {
    return { ok: false, error: "push tokens require a physical device" };
  }

  try {
    const projectId = resolveEasProjectId();
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return { ok: true, token: result.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function resolveEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  if (extra?.eas?.projectId) return extra.eas.projectId;

  const easConfig = (Constants.easConfig as { projectId?: string } | null) ?? null;
  if (easConfig?.projectId) return easConfig.projectId;

  return undefined;
}
