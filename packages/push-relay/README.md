# @sigpocket/push-relay

Cloudflare Worker that bridges **SigNoz Alertmanager webhooks** to **Expo Push** notifications on SigPocket mobile clients.

```
SigNoz Alertmanager
    │  webhook: POST /webhook/:instanceId
    ▼
Cloudflare Worker (this package)
    │  lookup registered Expo tokens in KV
    │  POST to Expo Push API
    ▼
Expo → APNs / FCM → Phone
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/register` | App registers a device for a SigNoz instance. Returns a per-device `secret` the client stores for `/unregister`. |
| `POST` | `/unregister` | App removes a device from an instance. Requires the `secret` returned by `/register`. |
| `POST` | `/webhook/:instanceId` | Alertmanager hits this. Fans out one Expo push per alert × per registered device. |
| `GET`  | `/` | Health probe. |

### `POST /register`
```json
{ "instanceId": "prod-signoz", "deviceId": "ios-8af…", "expoPushToken": "ExponentPushToken[xxxx]" }
```
→ `200 { "ok": true, "secret": "<hex>" }`

### `POST /unregister`
```json
{ "instanceId": "prod-signoz", "deviceId": "ios-8af…", "secret": "<hex from register>" }
```

### `POST /webhook/:instanceId`
Accepts the standard Alertmanager v4 webhook body — `{ status, alerts: [{ status, labels, annotations, … }] }`.

## Self-hosted deploy

```bash
# 1. Install once at the monorepo root
pnpm install

cd packages/push-relay

# 2. Create KV namespaces
wrangler kv:namespace create INSTANCE_TOKENS
wrangler kv:namespace create RATE_LIMITS
# Paste the returned IDs into wrangler.toml

# 3. Set secrets
openssl rand -hex 32 | wrangler secret put HMAC_SECRET
# Optional: forward relay logs to SigNoz
wrangler secret put OTEL_SIGNOZ_API_KEY

# 4. Optional: edit [vars] in wrangler.toml
#    RATE_LIMIT_PER_MINUTE        default: 60
#    OTEL_EXPORTER_OTLP_ENDPOINT  e.g. https://ingest.signoz.yourdomain.com

# 5. Deploy
wrangler deploy
```

Point your SigNoz Alertmanager receiver at `https://<your-worker>.workers.dev/webhook/<instanceId>`.

## Local dev

```bash
pnpm dev
```

Create `.dev.vars` for local-only secrets (git-ignored):

```
HMAC_SECRET=dev-hmac-secret-change-me
OTEL_SIGNOZ_API_KEY=
```

## Security notes

- `HMAC_SECRET` signs `${instanceId}:${deviceId}:${expoPushToken}`. The resulting `secret` is what the client must present on `/unregister`, so only the device that registered can remove itself.
- `/register` validates Expo token shape (`Expo{,nent}PushToken[...]`) to prevent KV from being used as a generic URL store.
- `/webhook/:instanceId` is rate-limited per instance (default 60 alerts/min) to cap damage from a misconfigured Alertmanager.
- There is no auth on `/webhook/:instanceId` itself — treat the URL as the secret. If you need hard auth, put the worker behind a Cloudflare Access policy or require a shared secret header and extend `handleWebhook`.

## Telemetry

If `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the worker batches per-request logs and POSTs them to `<endpoint>/v1/logs` with `signoz-ingestion-key: $OTEL_SIGNOZ_API_KEY`. Leave the env var empty to disable — the worker still logs to `wrangler tail` either way.
