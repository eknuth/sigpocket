import type {
  SigNozConfig,
  ServiceItem,
  QueryRangeResponse,
  QueryRangeValue,
  ChartPoint,
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
    });
    if (!res.ok) {
      const text = await res.text();
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

  async testConnection(): Promise<{ ok: boolean; error?: string; serviceCount?: number }> {
    try {
      const services = await this.fetchServices(24);
      return { ok: true, serviceCount: services.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
