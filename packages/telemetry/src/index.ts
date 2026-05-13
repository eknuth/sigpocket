/**
 * Lightweight app telemetry for SigPocket.
 *
 * Sends OTLP-compatible trace spans to the active SigNoz instance so the app's
 * own performance (connection tests, screen loads, API calls) appears alongside
 * the services it monitors.
 *
 * Uses plain fetch — no Node.js OTel SDK dependency — to stay React Native safe.
 */

import type { SigNozConfig } from "@sigpocket/shared-types";

// ── Types ─────────────────────────────────────────────────────

type SpanStatus = "OK" | "ERROR" | "UNSET";

type SpanAttribute = {
  key: string;
  value: { stringValue?: string; intValue?: number; boolValue?: boolean };
};

type FinishedSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number; // 1=INTERNAL, 2=SERVER, 3=CLIENT
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: SpanAttribute[];
  status: { code: number; message?: string }; // 0=UNSET, 1=OK, 2=ERROR
};

// ── Helpers ───────────────────────────────────────────────────

function randomHex(bytes: number): string {
  // Math.random fallback — safe for trace IDs (not crypto)
  let out = "";
  for (let i = 0; i < bytes; i++) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return out;
}

function nowNano(): string {
  return (Date.now() * 1_000_000).toString();
}

function attr(key: string, value: string | number | boolean): SpanAttribute {
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "number") return { key, value: { intValue: value } };
  return { key, value: { boolValue: value } };
}

// ── Span builder ──────────────────────────────────────────────

export type Span = {
  setAttribute: (key: string, value: string | number | boolean) => Span;
  setStatus: (status: SpanStatus, message?: string) => Span;
  end: () => void;
};

// ── Telemetry client ──────────────────────────────────────────

const SERVICE_NAME = "sigpocket-mobile";
const BATCH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 50;

let config: SigNozConfig | null = null;
let spanBuffer: FinishedSpan[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function configureTelemetry(cfg: SigNozConfig | null) {
  config = cfg;
  if (cfg && !flushTimer) {
    flushTimer = setInterval(flush, BATCH_INTERVAL_MS);
  }
  if (!cfg && flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
    spanBuffer = [];
  }
}

export function startSpan(name: string, parentSpanId?: string): Span {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  const startTime = nowNano();
  const attributes: SpanAttribute[] = [
    attr("service.name", SERVICE_NAME),
  ];
  let statusCode = 0;
  let statusMessage: string | undefined;

  const span: Span = {
    setAttribute(key, value) {
      attributes.push(attr(key, value));
      return span;
    },
    setStatus(status, message) {
      statusCode = status === "OK" ? 1 : status === "ERROR" ? 2 : 0;
      statusMessage = message?.slice(0, 256);
      return span;
    },
    end() {
      const finished: FinishedSpan = {
        traceId,
        spanId,
        parentSpanId,
        name,
        kind: 1,
        startTimeUnixNano: startTime,
        endTimeUnixNano: nowNano(),
        attributes,
        status: { code: statusCode, message: statusMessage },
      };
      spanBuffer.push(finished);
      if (spanBuffer.length >= MAX_BATCH_SIZE) {
        flush();
      }
    },
  };

  return span;
}

// ── Convenience: measure an async operation ───────────────────

export async function traceAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = startSpan(name);
  try {
    const result = await fn(span);
    span.setStatus("OK");
    return result;
  } catch (e) {
    span.setStatus("ERROR", e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    span.end();
  }
}

// ── Flush to SigNoz OTLP endpoint ────────────────────────────

async function flush() {
  if (!config || spanBuffer.length === 0) return;

  const spans = spanBuffer.splice(0, MAX_BATCH_SIZE);
  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            attr("service.name", SERVICE_NAME),
            attr("telemetry.sdk.name", "sigpocket-telemetry"),
            attr("telemetry.sdk.language", "typescript"),
          ],
        },
        scopeSpans: [
          {
            scope: { name: SERVICE_NAME, version: "0.0.1" },
            spans,
          },
        ],
      },
    ],
  };

  // Prefer an explicit OTLP URL when set — SigNoz Cloud and many self-hosted
  // deployments expose ingestion on a different host/port than the query UI.
  // Fall back to `baseUrl` to preserve behavior for existing configs.
  const ingestBase = (config.otlpUrl ?? config.baseUrl).replace(/\/+$/, "");

  // If a dedicated ingestion key was set, use it on /v1/traces; otherwise
  // fall back to the query API key. Send under both header names so it
  // works on Cloud and self-hosted without further config.
  const ingestKey = config.ingestionKey ?? config.apiKey;

  try {
    await fetch(`${ingestBase}/v1/traces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "signoz-ingestion-key": ingestKey,
        "SIGNOZ-API-KEY": ingestKey,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Telemetry must never crash the app. Push spans back for retry, then
    // cap by keeping the NEWEST — a permanently-down endpoint shouldn't
    // pin the buffer on stale data while dropping fresh spans.
    spanBuffer.unshift(...spans);
    if (spanBuffer.length > MAX_BATCH_SIZE * 2) {
      spanBuffer = spanBuffer.slice(-MAX_BATCH_SIZE);
    }
  }
}

export { flush as flushTelemetry };
