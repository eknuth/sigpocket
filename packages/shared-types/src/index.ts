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

export type ChartPoint = {
  timestamp: number;
  p95: number; // milliseconds
};
