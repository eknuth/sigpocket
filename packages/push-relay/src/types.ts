export interface Env {
  INSTANCE_TOKENS: KVNamespace;
  RATE_LIMITS: KVNamespace;
  HMAC_SECRET: string;
  RATE_LIMIT_PER_MINUTE: string;
  OTEL_EXPORTER_OTLP_ENDPOINT: string;
  OTEL_SIGNOZ_API_KEY?: string;
}

export interface DeviceRegistration {
  deviceId: string;
  expoPushToken: string;
  secret: string;
  registeredAt: string;
}

export interface RegisterRequest {
  instanceId: string;
  deviceId: string;
  expoPushToken: string;
}

export interface UnregisterRequest {
  instanceId: string;
  deviceId: string;
  secret: string;
}

export interface AlertmanagerAlert {
  status: "firing" | "resolved";
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL?: string;
  fingerprint?: string;
}

export interface AlertmanagerWebhook {
  version: string;
  groupKey?: string;
  status: "firing" | "resolved";
  receiver?: string;
  alerts: AlertmanagerAlert[];
  externalURL?: string;
}
