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
};

export type SigNozInstance = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
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
