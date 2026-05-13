export type ServiceItem = {
  serviceName: string;
  p99: number; // nanoseconds
  avgDuration: number; // nanoseconds
  numCalls: number;
  callRate: number; // per second
  numErrors: number;
  errorRate: number; // per second
};

export type QueryRangeValue = {
  timestamp: number; // milliseconds
  value: string; // numeric string
};

export type QueryRangeSeries = {
  labels: Record<string, string>;
  labelsArray: Array<{ name: string; value: string }>;
  values: QueryRangeValue[];
};

export type QueryRangeResult = {
  queryName: string;
  series: QueryRangeSeries[];
};

export type QueryRangeResponse = {
  status: string;
  data: {
    resultType: string;
    result: QueryRangeResult[];
  };
};

export type ServicesResponse = ServiceItem[];

export type SigNozConfig = {
  baseUrl: string;
  apiKey: string;
  // Optional explicit OTLP ingestion URL. Falls back to `baseUrl` when absent.
  // SigNoz Cloud uses ingest.<region>.signoz.cloud; self-hosted deployments
  // commonly run the OTLP collector on :4318 separate from the query UI.
  otlpUrl?: string;
  // Optional separate key for OTLP ingestion. Many deployments use the same
  // value for query and ingestion; SigNoz Cloud issues a distinct
  // "ingestion key" for /v1/traces. When absent the telemetry layer falls
  // back to `apiKey`.
  ingestionKey?: string;
};

export type SigNozInstance = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  // Optional explicit OTLP ingestion URL. Falls back to `baseUrl` when absent.
  otlpUrl?: string;
  // Optional ingestion key — see SigNozConfig.ingestionKey.
  ingestionKey?: string;
};

export type ChartPoint = {
  timestamp: number;
  p95: number; // milliseconds
};

// A row from /api/v3/query_range with panelType="list" + dataSource="traces".
// SigNoz returns spans, not traces — a "trace" is the set of spans sharing a traceID.
// Field names match SigNoz's JSON; service.name is a literal dotted key.
export type TraceSpan = {
  traceID: string;
  spanID: string;
  parentSpanID: string; // "" for root spans
  name: string;
  durationNano: number;
  timestamp: string; // ISO 8601
  hasError: boolean;
  statusCode: number;
  statusCodeString: string;
  spanKind: string;
  responseStatusCode: string;
  "service.name": string;
};

export type TraceListItem = {
  traceID: string;
  rootOperation: string;
  rootService: string;
  startTime: string; // ISO 8601
  durationMs: number;
  hasError: boolean;
  responseStatusCode: string;
};

export type TraceDetail = {
  traceID: string;
  spans: TraceSpan[];
};

// A log row from /api/v3/query_range with panelType="list" + dataSource="logs".
// Field names follow the contract Agent B's screen consumes — do not rename.
// `attributes` flattens log + resource attributes (and scope/trace ids when not
// already promoted to top-level fields) to a string→string map for display.
export type LogItem = {
  id: string; // SigNoz row id; falls back to `${trace_id}-${span_id}-${timestamp}` when absent
  timestamp: string; // ISO 8601
  severityText: string; // 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'FATAL' | ''
  severityNumber: number;
  body: string;
  serviceName: string;
  attributes: Record<string, string>;
  traceID?: string;
  spanID?: string;
};

// Wrapper shape for /api/v3/query_range with panelType="list".
// Differs from the time-series shape (QueryRangeResponse).
export type QueryRangeListResponse = {
  status: string;
  data: {
    results?: Array<{
      queryName: string;
      nextCursor?: string;
      rows: Array<{ timestamp: string; data: Record<string, unknown> }>;
    }>;
    // Older SigNoz versions used `result` with `list`; tolerate both.
    result?: Array<{
      queryName: string;
      list?: Array<{ timestamp: string; data: Record<string, unknown> }>;
    }>;
  };
};
