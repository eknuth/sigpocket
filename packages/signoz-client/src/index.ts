import type {
  SigNozConfig,
  ServiceItem,
  QueryRangeResponse,
  QueryRangeValue,
  QueryRangeListResponse,
  ChartPoint,
  TraceListItem,
  TraceDetail,
  TraceSpan,
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

  private async fetch(path: string, body?: unknown): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "SIGNOZ-API-KEY": this.config.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 200).split(this.config.apiKey).join("[REDACTED]");
      throw new Error(`SigNoz ${res.status}: ${text}`);
    }
    return res.json();
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
    })) as QueryRangeResponse;

    const series = data?.data?.result?.[0]?.series?.[0];
    if (!series?.values?.length) return [];

    return series.values.map((v: QueryRangeValue) => ({
      timestamp: v.timestamp,
      p95: parseFloat(v.value) / 1_000_000, // ns -> ms
    }));
  }

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
    return rows.map((r) => spanToTraceListItem(r.data as Partial<TraceSpan>));
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

  async testConnection(): Promise<{ ok: boolean; error?: string; serviceCount?: number }> {
    try {
      const services = await this.fetchServices(24);
      return { ok: true, serviceCount: services.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
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

function spanToTraceListItem(d: Partial<TraceSpan>): TraceListItem {
  const span = normalizeSpan(d);
  return {
    traceID: span.traceID,
    rootOperation: span.name,
    rootService: span["service.name"],
    startTime: span.timestamp,
    durationMs: span.durationNano / 1_000_000,
    hasError: span.hasError,
    responseStatusCode: span.responseStatusCode,
  };
}
