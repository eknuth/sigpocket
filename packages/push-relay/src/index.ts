import { buildMessage, sendBatch } from "./expo";
import { signDevice, timingSafeEqual } from "./hmac";
import { Logger } from "./otel";
import type {
  AlertmanagerWebhook,
  DeviceRegistration,
  Env,
  RegisterRequest,
  UnregisterRequest,
} from "./types";

// Expo push tokens always take this shape. Reject anything else so a caller
// can't plant arbitrary URLs in our KV namespace.
const EXPO_TOKEN_RE = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const log = new Logger(env);
    const url = new URL(request.url);

    try {
      const response = await route(request, env, url, log);
      ctx.waitUntil(log.flush());
      return response;
    } catch (err) {
      log.error("unhandled exception", { error: err instanceof Error ? err.message : String(err) });
      ctx.waitUntil(log.flush());
      return json({ error: "internal error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, url: URL, log: Logger): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/") {
    return json({ service: "sigpocket-push-relay", ok: true });
  }
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  if (url.pathname === "/register") return handleRegister(request, env, log);
  if (url.pathname === "/unregister") return handleUnregister(request, env, log);
  const webhookMatch = url.pathname.match(/^\/webhook\/([^/]+)$/);
  if (webhookMatch) return handleWebhook(request, env, log, decodeURIComponent(webhookMatch[1]));

  return json({ error: "not found" }, 404);
}

async function handleRegister(request: Request, env: Env, log: Logger): Promise<Response> {
  const body = await parseJson<RegisterRequest>(request);
  if (!body || !body.instanceId || !body.deviceId || !body.expoPushToken) {
    return json({ error: "instanceId, deviceId, expoPushToken required" }, 400);
  }
  if (!EXPO_TOKEN_RE.test(body.expoPushToken)) {
    return json({ error: "invalid expoPushToken format" }, 400);
  }

  const secret = await signDevice(env.HMAC_SECRET, body.instanceId, body.deviceId, body.expoPushToken);
  const devices = await readDevices(env, body.instanceId);
  const filtered = devices.filter((d) => d.deviceId !== body.deviceId);
  filtered.push({
    deviceId: body.deviceId,
    expoPushToken: body.expoPushToken,
    secret,
    registeredAt: new Date().toISOString(),
  });
  await writeDevices(env, body.instanceId, filtered);

  log.info("device registered", { instanceId: body.instanceId, deviceId: body.deviceId });
  return json({ ok: true, secret });
}

async function handleUnregister(request: Request, env: Env, log: Logger): Promise<Response> {
  const body = await parseJson<UnregisterRequest>(request);
  if (!body || !body.instanceId || !body.deviceId || !body.secret) {
    return json({ error: "instanceId, deviceId, secret required" }, 400);
  }

  const devices = await readDevices(env, body.instanceId);
  const match = devices.find((d) => d.deviceId === body.deviceId);
  if (!match || !timingSafeEqual(match.secret, body.secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  const remaining = devices.filter((d) => d.deviceId !== body.deviceId);
  await writeDevices(env, body.instanceId, remaining);
  log.info("device unregistered", { instanceId: body.instanceId, deviceId: body.deviceId });
  return json({ ok: true });
}

async function handleWebhook(
  request: Request,
  env: Env,
  log: Logger,
  instanceId: string,
): Promise<Response> {
  if (!(await checkRateLimit(env, instanceId))) {
    log.warn("rate limit exceeded", { instanceId });
    return json({ error: "rate limit exceeded" }, 429);
  }

  const body = await parseJson<AlertmanagerWebhook>(request);
  if (!body || !Array.isArray(body.alerts)) {
    return json({ error: "alertmanager payload required" }, 400);
  }

  const devices = await readDevices(env, instanceId);
  if (devices.length === 0) {
    log.info("no devices registered", { instanceId });
    return json({ ok: true, delivered: 0 });
  }

  const messages = body.alerts.flatMap((alert) =>
    devices.map((d) => buildMessage(alert, instanceId, d.expoPushToken)),
  );
  const result = await sendBatch(messages);

  if (!result.ok) {
    log.error("expo push failed", { instanceId, status: result.status, body: result.body.slice(0, 400) });
    return json({ error: "push delivery failed", status: result.status }, 502);
  }

  log.info("alerts fanned out", {
    instanceId,
    alerts: body.alerts.length,
    devices: devices.length,
    messages: messages.length,
  });
  return json({ ok: true, delivered: messages.length });
}

async function readDevices(env: Env, instanceId: string): Promise<DeviceRegistration[]> {
  const raw = await env.INSTANCE_TOKENS.get(instanceId, "json");
  return Array.isArray(raw) ? (raw as DeviceRegistration[]) : [];
}

async function writeDevices(env: Env, instanceId: string, devices: DeviceRegistration[]): Promise<void> {
  if (devices.length === 0) {
    await env.INSTANCE_TOKENS.delete(instanceId);
    return;
  }
  await env.INSTANCE_TOKENS.put(instanceId, JSON.stringify(devices));
}

async function checkRateLimit(env: Env, instanceId: string): Promise<boolean> {
  const limit = Number(env.RATE_LIMIT_PER_MINUTE) || 60;
  const window = Math.floor(Date.now() / 60_000);
  const key = `rl:${instanceId}:${window}`;
  const current = Number((await env.RATE_LIMITS.get(key)) ?? "0");
  if (current >= limit) return false;
  await env.RATE_LIMITS.put(key, String(current + 1), { expirationTtl: 120 });
  return true;
}

async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
