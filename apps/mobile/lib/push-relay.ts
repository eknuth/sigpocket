import Constants from "expo-constants";

/**
 * Push relay endpoint. Prefer a per-instance override; fall back to the
 * build-time `expo.extra.pushRelayUrl` placeholder. Returns `null` when no
 * relay is configured anywhere — callers should treat that as "push is
 * disabled for this instance."
 */
export function resolveRelayUrl(instanceRelayUrl?: string): string | null {
  const override = normalize(instanceRelayUrl);
  if (override) return override;

  const fromConfig = normalize(
    (Constants.expoConfig?.extra as { pushRelayUrl?: string } | undefined)?.pushRelayUrl,
  );
  return fromConfig ?? null;
}

function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export type RegisterResult =
  | { ok: true; secret: string }
  | { ok: false; error: string };

export type UnregisterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerWithRelay(
  relayUrl: string,
  body: { instanceId: string; deviceId: string; expoPushToken: string },
): Promise<RegisterResult> {
  try {
    const res = await fetch(`${relayUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; secret?: string; error?: string }
      | null;
    if (!res.ok || !json?.ok || typeof json.secret !== "string") {
      return { ok: false, error: json?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, secret: json.secret };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function unregisterWithRelay(
  relayUrl: string,
  body: { instanceId: string; deviceId: string; secret: string },
): Promise<UnregisterResult> {
  try {
    const res = await fetch(`${relayUrl}/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: json?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
