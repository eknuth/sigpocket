import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

/**
 * Route notification taps into the app. The push relay puts a `deepLink`
 * of the form `sigpocket://alerts/:instanceId/:fingerprint` in each
 * message's data payload (see packages/push-relay/src/expo.ts); we parse
 * out the path + params and hand them to expo-router.
 *
 * Handles both the cold-start case (app launched by tapping the push)
 * and the warm case (already-running app, user taps a banner).
 */
export function useNotificationDeepLink(enabled: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    // Warm path — user taps a notification while the app is running (or
    // backgrounded but alive).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response, router);
    });

    // Cold path — app launched from a tap. getLastNotificationResponseAsync
    // returns the notification that kicked us off, if any.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response, router);
    });

    return () => sub.remove();
  }, [enabled, router]);
}

function handleResponse(
  response: Notifications.NotificationResponse,
  router: ReturnType<typeof useRouter>,
): void {
  const data = response.notification.request.content.data as
    | { deepLink?: string; instanceId?: string; fingerprint?: string }
    | null
    | undefined;
  if (!data) return;

  const parsed = parseDeepLink(data.deepLink);
  const instanceId = parsed?.instanceId ?? data.instanceId;
  const fingerprint = parsed?.fingerprint ?? data.fingerprint;
  if (!instanceId || !fingerprint) return;

  router.push({
    pathname: "/alerts/[instanceId]/[fingerprint]",
    params: { instanceId, fingerprint },
  });
}

/** Parse `sigpocket://alerts/:instanceId/:fingerprint` safely. */
function parseDeepLink(
  link: string | undefined,
): { instanceId: string; fingerprint: string } | null {
  if (!link) return null;
  const match = link.match(/^sigpocket:\/\/alerts\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  try {
    return {
      instanceId: decodeURIComponent(match[1]),
      fingerprint: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}
