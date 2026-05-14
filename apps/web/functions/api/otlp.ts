// Page-view ingest for sigpocket.com.
//
// Browser POSTs a tiny JSON envelope here. We construct the OTLP span
// server-side (so the browser never sees the SigNoz token and can't
// inject arbitrary attribute keys/values), then forward to the SigNoz
// tenant.

interface Env {
  SIGNOZ_INGESTION_KEY: string;
  SIGNOZ_OTLP_ENDPOINT?: string;
}

interface BrowserPayload {
  url?: unknown;
  referrer?: unknown;
  ua?: unknown;
  lang?: unknown;
  tz?: unknown;
  viewport?: unknown;
  durationMs?: unknown;
}

const ALLOWED_ORIGINS = new Set([
  "https://sigpocket.com",
  "https://www.sigpocket.com",
]);

const SERVICE_NAME = "sigpocket-web";
const SERVICE_VERSION = "0.0.1";
const MAX_BODY_BYTES = 4 * 1024;

function isHttpsSigpocketUrl(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 2048) return false;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return false;
    return parsed.hostname === "sigpocket.com" || parsed.hostname === "www.sigpocket.com";
  } catch {
    return false;
  }
}

function clampString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.slice(0, max);
  return s.length > 0 ? s : null;
}

function clampNumber(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

function randHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let out = "";
  for (const b of buf) out += b.toString(16).padStart(2, "0");
  return out;
}

function attr(key: string, value: string | number | boolean) {
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { key, value: { intValue: String(value) } }
      : { key, value: { doubleValue: value } };
  }
  return { key, value: { boolValue: value } };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response("forbidden", { status: 403 });
  }

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.startsWith("application/json") && !ct.startsWith("text/plain")) {
    return new Response("unsupported media type", { status: 415 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new Response("payload too large", { status: 413 });
  }

  let body: BrowserPayload;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  if (!isHttpsSigpocketUrl(body.url)) {
    return new Response("bad url", { status: 400 });
  }
  const url = body.url;

  const referrer = clampString(body.referrer, 1024) ?? "";
  const ua = clampString(body.ua, 512) ?? "";
  const lang = clampString(body.lang, 32) ?? "";
  const tz = clampString(body.tz, 64) ?? "";
  const viewport = clampString(body.viewport, 16) ?? "";
  const durationMs = clampNumber(body.durationMs, 0, 24 * 60 * 60 * 1000) ?? 0;

  // CF-injected request metadata (server-side, never trust client).
  const cf = (request as unknown as { cf?: Record<string, unknown> }).cf ?? {};
  const country = typeof cf.country === "string" ? cf.country : "XX";
  const colo = typeof cf.colo === "string" ? cf.colo : "";

  const nowMs = Date.now();
  const endNs = BigInt(nowMs) * 1_000_000n;
  const startNs = endNs - BigInt(Math.max(0, Math.round(durationMs))) * 1_000_000n;

  const span = {
    traceId: randHex(16),
    spanId: randHex(8),
    name: "page.view",
    kind: 1,
    startTimeUnixNano: startNs.toString(),
    endTimeUnixNano: endNs.toString(),
    attributes: [
      attr("http.url", url),
      attr("http.referer", referrer),
      attr("browser.user_agent", ua),
      attr("browser.language", lang),
      attr("browser.timezone", tz),
      attr("browser.viewport", viewport),
      attr("page.duration_ms", durationMs),
      attr("geo.country", country),
      attr("cf.colo", colo),
    ].filter((a) =>
      a.value.stringValue === undefined ? true : a.value.stringValue !== "",
    ),
    status: { code: 1 },
  };

  const otlp = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            attr("service.name", SERVICE_NAME),
            attr("service.version", SERVICE_VERSION),
            attr("deployment.environment", "production"),
            attr("telemetry.sdk.name", "sigpocket-web-handrolled"),
            attr("telemetry.sdk.language", "javascript"),
          ],
        },
        scopeSpans: [
          {
            scope: { name: "sigpocket-web/page-view", version: SERVICE_VERSION },
            spans: [span],
          },
        ],
      },
    ],
  };

  const endpoint = env.SIGNOZ_OTLP_ENDPOINT ?? "https://signoz.codetomuscle.com/v1/traces";

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "signoz-access-token": env.SIGNOZ_INGESTION_KEY,
      },
      body: JSON.stringify(otlp),
    });
    if (!resp.ok) {
      return new Response("upstream rejected", { status: 502 });
    }
  } catch {
    return new Response("upstream error", { status: 502 });
  }

  return new Response(null, { status: 204 });
};

export const onRequest: PagesFunction<Env> = () =>
  new Response("method not allowed", { status: 405 });
