import type { AlertmanagerAlert } from "./types";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority: "default" | "high";
  sound?: "default" | null;
  channelId?: string;
}

export function buildMessage(
  alert: AlertmanagerAlert,
  instanceId: string,
  expoPushToken: string,
): ExpoPushMessage {
  const severity = (alert.labels.severity ?? "info").toUpperCase();
  const alertname = alert.labels.alertname ?? "Alert";
  const firing = alert.status === "firing";
  const prefix = firing ? severity : "RESOLVED";
  const summary =
    alert.annotations.summary ??
    alert.annotations.description ??
    alertname;

  return {
    to: expoPushToken,
    title: `[${prefix}] ${alertname}`,
    body: summary,
    data: {
      instanceId,
      alertname,
      fingerprint: alert.fingerprint,
      status: alert.status,
      generatorURL: alert.generatorURL,
      // Deep link consumed by the Expo app's URL handler.
      deepLink: `sigpocket://alerts/${encodeURIComponent(instanceId)}/${encodeURIComponent(alert.fingerprint ?? alertname)}`,
    },
    priority: firing && (severity === "CRITICAL" || severity === "ERROR") ? "high" : "default",
    sound: firing ? "default" : null,
    channelId: firing ? "alerts" : "resolved",
  };
}

// Expo's push API rejects batches larger than 100 messages.
const EXPO_MAX_BATCH = 100;

export async function sendBatch(messages: ExpoPushMessage[]): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  if (messages.length === 0) return { ok: true, status: 200, body: "" };

  let lastStatus = 200;
  let lastBody = "";

  for (let i = 0; i < messages.length; i += EXPO_MAX_BATCH) {
    const chunk = messages.slice(i, i + EXPO_MAX_BATCH);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(chunk),
    });
    lastStatus = res.status;
    lastBody = await res.text();
    if (!res.ok) return { ok: false, status: lastStatus, body: lastBody };
  }

  return { ok: true, status: lastStatus, body: lastBody };
}
