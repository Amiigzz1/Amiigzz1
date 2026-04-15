# Majlis — Local development

> **Zero cloud accounts required.** Everything runs on your machine.

## What gets replaced

| Production service       | Local replacement                     |
|--------------------------|---------------------------------------|
| AWS S3 (Bahrain)         | MinIO (`localhost:9000`, UI `:9001`)  |
| Firebase Auth OTP        | OTP printed to API logs (`LOCAL_OTP_MODE=true`) |
| Agora voice SDK          | Mock tokens (`AGORA_MODE=mock`)       |
| Tap / Fawry payments     | Mock webhooks (`PAYMENTS_MODE=mock`)  |
| OpenAI moderation        | Offline Arabic-NLP only (`MODERATION_MODE=local`) |
| SMTP (SES)               | Mailhog (`localhost:1025`, UI `:8025`) |
| Sentry                   | Disabled (empty DSN)                  |
| AWS CloudWatch           | `docker compose logs`                 |

## Prerequisites

- Docker Desktop 24+ (or Docker Engine + Compose v2)
- Node.js 20 + pnpm 9 — `corepack enable`
- Go 1.22+
- Flutter 3.19+

All four are free. No API keys, no sign-ups.

## One-time setup

```bash
# From the repo root
cp apps/api/.env.example apps/api/.env
```

The default `.env` already points at the docker-compose services. You can
edit it, but you don't have to.

## Everyday workflow

```bash
# Bring everything up
make up              # or: docker compose up -d

# Tail the interesting logs
make logs            # or: docker compose logs -f api realtime

# Run the Flutter app against the local API
cd apps/mobile
flutter run -d chrome --web-port 8090
# → http://localhost:8090

# Stop
make down            # or: docker compose down
```

## Service URLs

| Service             | URL                             |
|---------------------|---------------------------------|
| API (NestJS)        | http://localhost:3000/health    |
| Realtime (Go)       | http://localhost:8080/health    |
| Postgres            | `localhost:5432` (majlis/majlis_dev) |
| Redis               | `localhost:6379`                |
| MinIO S3            | http://localhost:9000           |
| MinIO console       | http://localhost:9001 (minioadmin / minioadmin) |
| Mailhog UI          | http://localhost:8025           |
| Flutter web         | http://localhost:8090 (after `flutter run`) |

## Getting an OTP in local mode

`LOCAL_OTP_MODE=true` is the default. When the Flutter app calls
`POST /v1/auth/request-otp`, the API generates a 6-digit code and prints it:

```
[OTP] phone=+9665XXXXXXXX code=482913  (expires in 5m)
```

Grab the code from the logs (`docker compose logs -f api | grep OTP`) and
paste it into the OTP screen. No SMS leaves your machine.

## Triggering a mock payment

When `PAYMENTS_MODE=mock`, you can simulate a successful Tap purchase with:

```bash
curl -X POST http://localhost:3000/v1/payments/webhooks/tap \
  -H 'content-type: application/json' \
  -H 'x-mock-signature: mock' \
  -d '{"user_id": "...", "amount": 9.99, "currency": "USD", "package": "coins_1000"}'
```

(Endpoint lands in Phase 4. For now this is a reference.)

## Flutter on a physical device

When you run the Flutter app on a physical phone over USB/Wi-Fi, it cannot
reach `localhost`. Use your machine's LAN IP:

```bash
# macOS / Linux
ipconfig getifaddr en0        # or: hostname -I | awk '{print $1}'

# Pass to flutter
flutter run --dart-define=API_BASE_URL=http://192.168.1.42:3000
```

Android emulator: use `http://10.0.2.2:3000` (special loopback).
iOS simulator: `http://localhost:3000` works directly.

## Resetting state

```bash
# Wipe databases, S3 buckets, everything
docker compose down -v
docker compose up -d
```

## Running tests locally

```bash
# API (Jest)
cd apps/api && pnpm test

# Realtime (Go)
cd apps/realtime && go test ./...

# Mobile (Flutter)
cd apps/mobile && flutter test
```

## Troubleshooting

**Port 5432 already in use.** You probably have a local Postgres running.
Either stop it (`brew services stop postgresql`) or change the host port
in `docker-compose.yml` to e.g. `5433:5432` and update `DATABASE_URL`.

**MinIO console won't load.** Make sure port 9001 is free. The API talks to
port 9000, the browser uses 9001.

**Mobile can't reach API on Android emulator.** Use `http://10.0.2.2:3000`
instead of `http://localhost:3000`. This is Android emulator convention.
