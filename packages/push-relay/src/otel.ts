import type { Env } from "./types";

type Severity = "INFO" | "WARN" | "ERROR";

const SEVERITY_NUMBER: Record<Severity, number> = {
  INFO: 9,
  WARN: 13,
  ERROR: 17,
};

export class Logger {
  private buffer: Array<{
    time: bigint;
    severity: Severity;
    message: string;
    attrs: Record<string, unknown>;
  }> = [];

  constructor(private env: Env) {}

  info(message: string, attrs: Record<string, unknown> = {}): void {
    this.push("INFO", message, attrs);
  }

  warn(message: string, attrs: Record<string, unknown> = {}): void {
    this.push("WARN", message, attrs);
  }

  error(message: string, attrs: Record<string, unknown> = {}): void {
    this.push("ERROR", message, attrs);
  }

  private push(severity: Severity, message: string, attrs: Record<string, unknown>): void {
    // Also mirror to worker console so `wrangler tail` shows output even when
    // OTLP isn't configured.
    const line = `[${severity}] ${message} ${Object.keys(attrs).length ? JSON.stringify(attrs) : ""}`.trim();
    if (severity === "ERROR") console.error(line);
    else if (severity === "WARN") console.warn(line);
    else console.log(line);

    this.buffer.push({
      time: BigInt(Date.now()) * 1_000_000n,
      severity,
      message,
      attrs,
    });
  }

  async flush(): Promise<void> {
    if (!this.env.OTEL_EXPORTER_OTLP_ENDPOINT || this.buffer.length === 0) {
      this.buffer = [];
      return;
    }

    const payload = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              attr("service.name", "sigpocket-push-relay"),
              attr("service.version", "0.0.1"),
              attr("deployment.environment", "production"),
            ],
          },
          scopeLogs: [
            {
              scope: { name: "@sigpocket/push-relay" },
              logRecords: this.buffer.map((r) => ({
                timeUnixNano: r.time.toString(),
                severityNumber: SEVERITY_NUMBER[r.severity],
                severityText: r.severity,
                body: { stringValue: r.message },
                attributes: Object.entries(r.attrs).map(([k, v]) =>
                  attr(k, v === null || v === undefined ? "" : String(v)),
                ),
              })),
            },
          ],
        },
      ],
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.env.OTEL_SIGNOZ_API_KEY) {
      headers["signoz-ingestion-key"] = this.env.OTEL_SIGNOZ_API_KEY;
    }

    const url = `${this.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, "")}/v1/logs`;
    this.buffer = [];

    try {
      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Don't let OTLP failures break the request.
      console.error("[push-relay] OTLP flush failed", err);
    }
  }
}

function attr(key: string, value: string): { key: string; value: { stringValue: string } } {
  return { key, value: { stringValue: value } };
}
