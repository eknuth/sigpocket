import type { SigNozInstance } from "@sigpocket/shared-types";

import { getDeviceId } from "./device-id";
import {
  ensureAndroidChannels,
  fetchExpoPushToken,
  requestNotificationPermission,
} from "./notifications";
import {
  registerWithRelay,
  resolveRelayUrl,
  unregisterWithRelay,
} from "./push-relay";
import { usePushStore, type PushRegistration } from "@/stores/push-store";

export type EnableResult =
  | { ok: true; registration: PushRegistration }
  | { ok: false; error: string };

/**
 * End-to-end push enable for an instance: permission -> token -> relay
 * registration -> persist. Safe to call multiple times (idempotent on the
 * relay side — it re-derives the same secret for the same triple).
 */
export async function enablePushForInstance(
  instance: SigNozInstance,
): Promise<EnableResult> {
  const relayUrl = resolveRelayUrl(instance.pushRelayUrl);
  if (!relayUrl) {
    return {
      ok: false,
      error: "No push relay configured. Set it in Advanced settings or via expo.extra.pushRelayUrl.",
    };
  }

  const perm = await requestNotificationPermission();
  if (!perm.granted) {
    return {
      ok: false,
      error:
        perm.reason === "not-a-device"
          ? "Push notifications require a physical device."
          : "Notification permission denied. Enable it in system settings.",
    };
  }

  await ensureAndroidChannels();

  const tokenResult = await fetchExpoPushToken();
  if (!tokenResult.ok) return { ok: false, error: tokenResult.error };

  const deviceId = await getDeviceId();
  const registration = await registerWithRelay(relayUrl, {
    instanceId: instance.id,
    deviceId,
    expoPushToken: tokenResult.token,
  });

  if (!registration.ok) return { ok: false, error: registration.error };

  const entry: PushRegistration = {
    instanceId: instance.id,
    expoPushToken: tokenResult.token,
    secret: registration.secret,
    registeredAt: new Date().toISOString(),
  };
  await usePushStore.getState().setRegistration(entry);
  return { ok: true, registration: entry };
}

/**
 * Best-effort unregister. Always clears local state, even if the network
 * call fails — we can't leave the UI claiming "registered" after the user
 * opted out. Orphaned KV entries on the relay are harmless.
 */
export async function disablePushForInstance(
  instance: SigNozInstance,
): Promise<void> {
  const existing = usePushStore.getState().getRegistration(instance.id);
  const relayUrl = resolveRelayUrl(instance.pushRelayUrl);

  if (existing && relayUrl) {
    const deviceId = await getDeviceId();
    // Fire-and-forget — any failure is logged locally but never blocks UI.
    try {
      await unregisterWithRelay(relayUrl, {
        instanceId: instance.id,
        deviceId,
        secret: existing.secret,
      });
    } catch {
      // Swallow; we still clear local state below.
    }
  }

  await usePushStore.getState().clearRegistration(instance.id);
}
