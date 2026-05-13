import { traceAsync } from "@sigpocket/telemetry";
import type {
  SigNozConfig,
  ServiceItem,
  QueryRangeListResponse,
  ChartPoint,
  TraceListItem,
  TraceDetail,
  TraceSpan,
  LogItem,
} from "@sigpocket/shared-types";

export class SigNozClient {
  constructor(private config: SigNozConfig) {}

  // Timestamp helpers — SigNoz v2 uses nanosecond strings, v3 uses epoch seconds

  static nowNano(): string {
    return (Date.now() * 1_000_000).toString();
  }

  static hoursAgoNano(hours: number): string {
    return ((Date.now() - hours * 3600_000) * 1_000_000).toString();
  }

  static nowEpochSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  static hoursAgoEpochSeconds(hours: number): number {
    return Math.floor((Date.now() - hours * 3600_000) / 1000);
  }

  // Wraps every backend call in a span so the app itself shows up in SigNoz
  // as a real service. Span name reads as `signoz.GET /api/v2/services` etc.
  private async fetch(path: string, body?: unknown): Promise<unknown> {
    const method = body ? "POST" : "GET";
    return traceAsync(`signoz.${method} ${path}`, async (span) => {
      span.setAttribute("http.method", method);
      span.setAttribute("http.url", `${this.config.baseUrl}${path}`);
      span.setAttribute("signoz.path", path);

      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "SIGNOZ-API-KEY": this.config.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
      });

      span.setAttribute("http.status_code", res.status);

      if (!res.ok) {
        const text = (await res.text())
          .slice(0, 200)
          .split(this.config.apiKey)
          .join("[REDACTED]");
        throw new Error(`SigNoz ${res.status}: ${text}`);
      }
      return res.json();
    });
  }

  async fetchServices(hours = 6): Promise<ServiceItem[]> {
    const resp = await this.fetch("/api/v2/services", {
      start: SigNozClient.hoursAgoNano(hours),
      end: SigNozClient.nowNano(),
      tags: [],
    });
    const { data } = resp as { status: string; data: ServiceItem[] };
    return data ?? [];
  }

  async fetchP95Latency(
    serviceName: string,
    hours = 1,
    stepSeconds = 60,
  ): Promise<ChartPoint[]> {
    const start = SigNozClient.hoursAgoEpochSeconds(hours);
    const end = SigNozClient.nowEpochSeconds();

    const data = (await this.fetch("/api/v3/query_range", {
      start,
      end,
      step: stepSeconds,
      compositeQuery: {
        queryType: "builder",
        panelType: "graph",
        builderQueries: {
          A: {
            dataSource: "traces",
            queryName: "A",
            aggregateOperator: "p95",
            aggregateAttribute: {
              key: "duration_nano",
              type: "tag",
              dataType: "float64",
            },
            filters: {
              op: "AND",
              items: [
                {
                  key: { key: "service.name", type: "resource", dataType: "string" },
                  op: "=",
                  value: serviceName,
                },
              ],
            },
            groupBy: [],
            expression: "A",
            disabled: false,
          },
        },
      },
    })) as unknown;

    const values = extractTimeSeriesValues(data);
    if (!values.length) return [];

    return values.map((v) => ({
      timestamp: v.timestamp,
      p95: parseFloat(v.value) / 1_000_000, // ns -> ms
    }));
  }

  // SigNoz v3 /api/v3/query_range with panelType="list" requires selectColumns;
  // omitting them returns HTTP 500 "select columns cannot be empty for panelType list".
  // These are the fields the UI consumes via TraceSpan / TraceListItem.

  async searchTraces(
    serviceName: string,
    hours = 1,
    limit = 50,
  ): Promise<TraceListItem[]> {
    const start = SigNozClient.hoursAgoEpochSeconds(hours);
    const end = SigNozClient.nowEpochSeconds();

    const resp = (await this.fetch("/api/v3/query_range", {
      start,
      end,
      step: 60,
      compositeQuery: {
        queryType: "builder",
        panelType: "list",
        builderQueries: {
          A: {
            dataSource: "traces",
            queryName: "A",
            aggregateOperator: "noop",
            expression: "A",
            disabled: false,
            limit,
            orderBy: [{ columnName: "timestamp", order: "desc" }],
            selectColumns: TRACE_LIST_COLUMNS,
            // parentSpanID = "" gives root spans only — one row per trace.
            filters: {
              op: "AND",
              items: [
                {
                  key: { key: "service.name", type: "resource", dataType: "string" },
                  op: "=",
                  value: serviceName,
                },
                {
                  key: { key: "parentSpanID", type: "tag", dataType: "string" },
                  op: "=",
                  value: "",
                },
              ],
            },
          },
        },
      },
    })) as QueryRangeListResponse;

    const rows = extractListRows(resp);
    return rows.map((r) => spanToTraceListItem(r.data as Partial<TraceSpan>, r.timestamp));
  }

  async getTraceDetail(traceId: string): Promise<TraceDetail> {
    // Trace detail is the set of all spans sharing a traceID. Window of 24h is
    // generous — long-running traces still complete inside this.
    const start = SigNozClient.hoursAgoEpochSeconds(24);
    const end = SigNozClient.nowEpochSeconds();

    const resp = (await this.fetch("/api/v3/query_range", {
      start,
      end,
      step: 60,
      compositeQuery: {
        queryType: "builder",
        panelType: "list",
        builderQueries: {
          A: {
            dataSource: "traces",
            queryName: "A",
            aggregateOperator: "noop",
            expression: "A",
            disabled: false,
            limit: 1000,
            orderBy: [{ columnName: "timestamp", order: "asc" }],
            selectColumns: TRACE_LIST_COLUMNS,
            filters: {
              op: "AND",
              items: [
                {
                  key: { key: "traceID", type: "tag", dataType: "string" },
                  op: "=",
                  value: traceId,
                },
              ],
            },
          },
        },
      },
    })) as QueryRangeListResponse;

    const rows = extractListRows(resp);
    return {
      traceID: traceId,
      spans: rows.map((r) => normalizeSpan(r.data as Partial<TraceSpan>)),
    };
  }

  async searchLogs(
    serviceName: string,
    opts: { severities?: string[]; hours?: number; limit?: number } = {},
  ): Promise<LogItem[]> {
    const { severities = ["ERROR", "WARN"], hours = 1, limit = 100 } = opts;
    const start = SigNozClient.hoursAgoEpochSeconds(hours);
    const end = SigNozClient.nowEpochSeconds();

    const resp = (await this.fetch("/api/v3/query_range", {
      start,
      end,
      step: 60,
      compositeQuery: {
        queryType: "builder",
        panelType: "list",
        builderQueries: {
          A: {
            dataSource: "logs",
            queryName: "A",
            aggregateOperator: "noop",
            expression: "A",
            disabled: false,
            limit,
            orderBy: [{ columnName: "timestamp", order: "desc" }],
            selectColumns: LOG_LIST_COLUMNS,
            // service.name is a resource attribute; severity_text is a log
            // attribute (fieldContext="log") per signoz_get_field_keys.
            filters: {
              op: "AND",
              items: [
                {
                  key: { key: "service.name", type: "resource", dataType: "string" },
                  op: "=",
                  value: serviceName,
                },
                {
                  key: { key: "severity_text", type: "log", dataType: "string" },
                  op: "in",
                  value: severities,
                },
              ],
            },
          },
        },
      },
    })) as QueryRangeListResponse;

    const rows = extractListRows(resp);
    return rows.map((r) => normalizeLogRow(r.timestamp, r.data));
  }

  async testConnection(): Promise<{ ok: boolean; error?: string; serviceCount?: number }> {
    try {
      const services = await this.fetchServices(24);
      return { ok: true, serviceCount: services.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

const TRACE_LIST_COLUMNS = [
  { key: "traceID", type: "tag", dataType: "string" },
  { key: "spanID", type: "tag", dataType: "string" },
  { key: "parentSpanID", type: "tag", dataType: "string" },
  { key: "name", type: "tag", dataType: "string" },
  { key: "durationNano", type: "tag", dataType: "float64" },
  { key: "timestamp", type: "tag", dataType: "string" },
  { key: "hasError", type: "tag", dataType: "bool" },
  { key: "statusCode", type: "tag", dataType: "int64" },
  { key: "statusCodeString", type: "tag", dataType: "string" },
  { key: "spanKind", type: "tag", dataType: "string" },
  { key: "responseStatusCode", type: "tag", dataType: "string" },
  { key: "service.name", type: "resource", dataType: "string" },
];

const LOG_LIST_COLUMNS = [
  { key: "id", type: "tag", dataType: "string" },
  { key: "timestamp", type: "tag", dataType: "string" },
  { key: "body", type: "tag", dataType: "string" },
  { key: "severity_text", type: "log", dataType: "string" },
  { key: "severity_number", type: "log", dataType: "int64" },
  { key: "trace_id", type: "tag", dataType: "string" },
  { key: "span_id", type: "tag", dataType: "string" },
  { key: "service.name", type: "resource", dataType: "string" },
  { key: "attributes_string", type: "tag", dataType: "string" },
  { key: "resources_string", type: "tag", dataType: "string" },
];

// `panelType: "graph"` responses come in two shapes depending on backend
// version: older deployments return `data.result[].series[].values[]`; newer
// (v5) returns `data.results[].aggregations[].series[].values[]`. Tolerate
// both, plus the rarer `data.result[].series[]` with v5 nesting we've seen
// when the gateway proxies a mixed version.
function extractTimeSeriesValues(
  resp: unknown,
): Array<{ timestamp: number; value: string }> {
  const r = resp as {
    data?: {
      result?: Array<{
        series?: Array<{ values?: Array<{ timestamp: number; value: string }> }>;
      }>;
      results?: Array<{
        series?: Array<{ values?: Array<{ timestamp: number; value: string }> }>;
        aggregations?: Array<{
          series?: Array<{ values?: Array<{ timestamp: number; value: string }> }>;
        }>;
      }>;
    };
  };

  const candidates = [
    r.data?.result?.[0]?.series?.[0]?.values,
    r.data?.results?.[0]?.aggregations?.[0]?.series?.[0]?.values,
    r.data?.results?.[0]?.series?.[0]?.values,
  ];
  for (const c of candidates) if (c?.length) return c;
  return [];
}

// SigNoz returned `data.results[].rows[]` in the v5 wire shape we observed,
// but older deployments may still return `data.result[].list[]`. Tolerate both.
function extractListRows(
  resp: QueryRangeListResponse,
): Array<{ timestamp: string; data: Record<string, unknown> }> {
  const r1 = resp.data.results?.[0]?.rows;
  if (r1?.length) return r1;
  const r2 = resp.data.result?.[0]?.list;
  if (r2?.length) return r2;
  return [];
}

function normalizeSpan(d: Partial<TraceSpan>): TraceSpan {
  return {
    traceID: String(d.traceID ?? ""),
    spanID: String(d.spanID ?? ""),
    parentSpanID: String(d.parentSpanID ?? ""),
    name: String(d.name ?? ""),
    durationNano: Number(d.durationNano ?? 0),
    timestamp: String(d.timestamp ?? ""),
    hasError: Boolean(d.hasError),
    statusCode: Number(d.statusCode ?? 0),
    statusCodeString: String(d.statusCodeString ?? ""),
    spanKind: String(d.spanKind ?? ""),
    responseStatusCode: String(d.responseStatusCode ?? ""),
    "service.name": String(d["service.name"] ?? ""),
  };
}

// Log rows from /api/v3/query_range with dataSource="logs" carry attributes
// in three typed buckets (`attributes_string|number|bool`) plus a separate
// `resources_string` map for resource attributes. Flatten everything to a
// single string→string map so the screen can render it generically.
function normalizeLogRow(
  outerTimestamp: string,
  d: Record<string, unknown>,
): LogItem {
  const attributes: Record<string, string> = {};
  const merge = (raw: unknown): void => {
    if (!raw || typeof raw !== "object") return;
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      attributes[k] = typeof v === "string" ? v : String(v);
    }
  };
  merge(d.attributes_string);
  merge(d.attributes_number);
  merge(d.attributes_bool);
  merge(d.resources_string);

  const resources =
    d.resources_string && typeof d.resources_string === "object"
      ? (d.resources_string as Record<string, unknown>)
      : {};
  const serviceName = String(resources["service.name"] ?? "");

  const traceID = typeof d.trace_id === "string" ? d.trace_id : "";
  const spanID = typeof d.span_id === "string" ? d.span_id : "";
  const rawId = typeof d.id === "string" ? d.id : "";
  const id = rawId || `${traceID}-${spanID}-${outerTimestamp}`;

  return {
    id,
    timestamp: outerTimestamp,
    severityText: typeof d.severity_text === "string" ? d.severity_text : "",
    severityNumber: typeof d.severity_number === "number" ? d.severity_number : 0,
    body: typeof d.body === "string" ? d.body : "",
    serviceName,
    attributes,
    traceID: traceID || undefined,
    spanID: spanID || undefined,
  };
}

// `selectColumns` strips fields not explicitly requested, and `timestamp`
// often lives only on the row wrapper rather than inside `data`. Accept a
// fallback so the row's outer timestamp is used when the data field is empty.
function spanToTraceListItem(d: Partial<TraceSpan>, fallbackTimestamp = ""): TraceListItem {
  const span = normalizeSpan(d);
  return {
    traceID: span.traceID,
    rootOperation: span.name,
    rootService: span["service.name"],
    startTime: span.timestamp || fallbackTimestamp,
    durationMs: span.durationNano / 1_000_000,
    hasError: span.hasError,
    responseStatusCode: span.responseStatusCode,
  };
}
