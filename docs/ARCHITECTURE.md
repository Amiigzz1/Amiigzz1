# Majlis — Architecture

## Services

```
                               ┌─────────────────┐
                               │   Flutter app   │
                               │ (iOS, Android,  │
                               │      Web)       │
                               └───────┬─────────┘
                                       │ HTTPS / WSS
                                       ▼
                              ┌──────────────────┐
                              │   API (NestJS)   │◄──────── Admin (Next.js)
                              │  REST + WS GW    │
                              └──┬────────┬──────┘
                                 │        │ HTTP/gRPC
                   Postgres ◄────┘        └────► Realtime (Go)
                   (primary)                      │
                        ▲                         │ pub/sub
                        │                         ▼
                        └───────── Redis ◄────────┘
                                    │
                                    ▼
                              Agora Voice SDK
                           (token-gated channels)
```

## Service boundaries

| Service             | Language / Framework | Responsibility                                                      |
|---------------------|----------------------|---------------------------------------------------------------------|
| `apps/api`          | Node 20 + NestJS     | REST endpoints, auth, wallet, payments, moderation intake, WS GW    |
| `apps/realtime`     | Go 1.22              | Voice-room presence, seats, matchmaking, authoritative game state   |
| `apps/mobile`       | Flutter 3.x          | UX for players; talks to both services; embeds Phaser games in WebView |
| `apps/admin`        | Next.js              | Internal moderation and withdrawal review                           |
| `apps/games/*`      | Phaser 3             | View-only game clients loaded via WebView                           |

## Data flow

1. **Auth (Phase 1).** Flutter → `POST /v1/auth/request-otp` → Firebase sends OTP → `POST /v1/auth/verify-otp` returns JWT. JWT is sent as `Authorization: Bearer …` on every subsequent call.
2. **Voice rooms (Phase 2).** Flutter opens WS to `realtime`, receives current seats + listeners. When joining, `api` issues an Agora channel token. All presence events flow via Redis pub/sub.
3. **Games (Phase 3).** `realtime` runs authoritative state. Dice rolls are server-generated; each move is validated. On game end, `realtime` calls `api` to settle the wallet inside a single Postgres transaction.
4. **Payments (Phase 4).** Tap / Fawry / IAP webhooks hit `api`. Each webhook is idempotent (keyed by provider tx id). Wallet credit and `transactions` insert happen in one DB transaction.
5. **Moderation (Phase 5).** Messages flow through the Arabic-NLP + OpenAI pipeline before broadcast. Voice is sampled (5% of open seats for 10s every 5 min), transcribed via Whisper, and piped through the same pipeline. Flagged items land in the admin queue — **no automatic bans**.

## State ownership

| Data                    | Store    | Notes                                                      |
|-------------------------|----------|------------------------------------------------------------|
| users, wallets, txns    | Postgres | Source of truth; atomic transactions for currency ops.     |
| sessions, rate limits   | Redis    | TTL-based.                                                 |
| live room state         | Redis    | `room:{id}` hash + pub/sub. Mirrored to Postgres at close. |
| game state              | Go heap + Redis | In-memory for active matches; Redis for crash recovery. |
| voice clips (flagged)   | S3       | 30-day retention (PDPL).                                   |

## Idempotency

- Payment webhooks: idempotency key = provider tx id.
- Internal wallet mutations: idempotency key = `{game_id}:{user_id}:{round}` or `{gift_id}:{sender}:{recipient}:{ts}`.

## Observability

- **Sentry** — errors + Flutter crash reports.
- **Prometheus** — `api` and `realtime` export `/metrics`.
- **Grafana** — dashboards: API latency, WS connections, Agora minutes, revenue/day.
- **Structured logs** — JSON, no PII (phone numbers are hashed).

## Local vs. cloud

All development happens **locally** with no cloud accounts required. Cloud
dependencies are replaced by local equivalents:

| Prod                    | Local                                |
|-------------------------|--------------------------------------|
| AWS S3                  | MinIO                                |
| Firebase OTP            | API logs (`LOCAL_OTP_MODE=true`)     |
| Agora                   | Mock tokens (`AGORA_MODE=mock`)      |
| Tap / Fawry             | Mock webhooks (`PAYMENTS_MODE=mock`) |
| OpenAI moderation       | `@majlis/arabic-nlp` only            |
| SES / SMTP              | Mailhog                              |

See `docs/LOCAL_DEV.md` for the developer workflow. The `infra/terraform/`
skeleton describes future cloud topology only — it is not part of the
local loop and will not be applied until the team explicitly says so.
