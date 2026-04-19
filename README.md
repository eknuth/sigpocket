# SigPocket

A mobile client for [SigNoz](https://signoz.io) — monitor your services, latency, and errors from your phone.

SigPocket connects to your self-hosted or cloud SigNoz instance and gives you a real-time view of service health using the RED method (Rate, Errors, Duration).

## Features

- **BYO SigNoz** — connect to any SigNoz instance with a URL and API key
- **Services overview** — sortable list with status indicators and RED metrics
- **Service detail** — p95 latency line chart (victory-native) with 1h/6h/24h time ranges
- **Multiple instances** — manage and switch between SigNoz environments
- **Dark & light mode** — follows system theme, SigNoz-inspired design tokens
- **Pull-to-refresh** — live data with 30s auto-refresh

## Tech stack

- [Expo](https://expo.dev) (SDK 54) + React Native
- [Victory Native](https://commerce.nearform.com/open-source/victory-native/) + Skia for charts
- [React Query](https://tanstack.com/query) for data fetching
- [Zustand](https://zustand.docs.pmnd.rs/) + Expo SecureStore for state
- pnpm workspaces monorepo

## Project structure

```
apps/
  mobile/              Expo app (tabs: services, settings)
packages/
  shared-types/        TypeScript types shared across packages
  signoz-client/       SigNoz API client (v2/v3 query_range)
  telemetry/           OpenTelemetry instrumentation for the app itself
```

## Getting started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- [Expo Go](https://expo.dev/go) on your phone (iOS or Android)
- A running SigNoz instance with an API key

### Setup

```bash
git clone https://github.com/eknuth/sigpocket.git
cd sigpocket
pnpm install
pnpm --filter mobile start
```

Scan the QR code with Expo Go, then enter your SigNoz URL and API key in the onboarding screen.

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm --filter mobile start` | Start Metro dev server |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm e2e` | Run Maestro E2E tests |

## SigNoz API

SigPocket uses the SigNoz HTTP API:

- `GET /api/v2/services` — service list with RED metrics
- `POST /api/v3/query_range` — time-series data (p95 latency, etc.)

Authentication is via the `SIGNOZ-API-KEY` header. The app stores credentials in the device's secure keychain (Expo SecureStore).

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

```bash
# Development workflow
pnpm install
pnpm --filter mobile start    # start Expo dev server
pnpm lint                     # check before committing
pnpm typecheck                # ensure types pass
```

## License

[Apache 2.0](LICENSE)
