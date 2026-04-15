# Majlis (مجلس)

> Voice-first social gaming platform for the MENA market.
> قهوتك الرقمية — العب، اتكلم، اتعرّف.

**Markets:** SA, AE, EG, KW, OM, BH, QA, JO
**Status:** MVP complete — Phase 6 (polish & launch prep)

---

## Why Majlis

Majlis addresses the top pain points of incumbents in the MENA voice-social
category:

1. **Fair, transparent moderation.** Every ban is human-reviewed; every
   user has a 48-hour, single-shot appeal path. No silent bans.
2. **Local payment rails.** STC Pay, Mada, Fawry, plus Apple/Google IAP.
3. **50/50 creator economics** instead of the 70–80% platform rake in the
   category — `packages/arabic-nlp/..` has the documented split.
4. **Reliability first.** Server-authoritative game state, atomic wallet
   mutations, idempotent payment webhooks.
5. **Authentic cultural identity.** Arabic-first (RTL default), prayer-time
   quiet hours on by default, 20-gift catalog with regional staples
   (dallah, oud, bakhoor, khaima, falcon).

---

## Monorepo layout

```
majlis/
├── apps/
│   ├── mobile/       # Flutter (iOS, Android, Web)
│   ├── api/          # NestJS REST + WebSocket gateway
│   ├── realtime/     # Go 1.22 (rooms, matchmaking, Ludo engine)
│   ├── games/
│   │   └── ludo/     # Phaser 3 HTML5 client (view-only)
│   └── admin/        # Next.js 14 moderation dashboard
├── packages/
│   ├── shared-types/ # Cross-app TypeScript
│   ├── proto/        # Protocol buffers (future)
│   └── arabic-nlp/   # Arabic normalization + profanity classifier
├── infra/
│   ├── terraform/    # AWS me-south-1 (Bahrain) + me-central-1 (UAE)
│   └── docker/       # Shared Dockerfiles / compose overrides
└── docs/             # ARCHITECTURE / API / COMPLIANCE / LAUNCH_CHECKLIST …
```

JS/TS via **pnpm workspaces**, Go via **Go workspaces**.

---

## Tech stack

| Layer         | Choice                                            |
|---------------|---------------------------------------------------|
| Frontend      | Flutter 3.x + Riverpod + go_router                |
| Backend API   | Node 20 + NestJS + Prisma                         |
| Realtime      | Go 1.22 (gorilla/websocket + go-redis)            |
| Database      | PostgreSQL 16                                     |
| Cache / PubSub| Redis 7                                           |
| Voice         | Agora.io (mock mode for local)                    |
| Game engine   | Phaser 3                                          |
| Storage / CDN | AWS S3 (me-south-1) → CloudFront (MinIO locally)  |
| Auth          | Firebase Auth (OTP) — console-only in local dev   |
| Payments      | Tap (GCC) + Fawry (EG) + Apple/Google IAP         |
| Moderation    | `@majlis/arabic-nlp` + OpenAI (optional)          |
| Push          | FCM (console-only in local dev)                   |
| Observability | Sentry + Prometheus + Grafana                     |
| CI/CD         | GitHub Actions                                    |

---

## Local development

**Zero cloud accounts required.** Cloud services are mocked locally —
MinIO for S3, Mailhog for SMTP, mock Agora tokens, OTPs printed to logs.

```bash
cp apps/api/.env.example apps/api/.env
make up            # docker compose up -d
make db-migrate    # one-off, applies Prisma migrations
```

| Service        | URL                                  |
|----------------|--------------------------------------|
| API            | http://localhost:3000/health         |
| Realtime       | http://localhost:8080/health         |
| Admin          | http://localhost:3001 (`pnpm --filter @majlis/admin dev`) |
| MinIO console  | http://localhost:9001 (minioadmin)   |
| Mailhog UI     | http://localhost:8025                |
| Flutter web    | http://localhost:8090 (`make mobile-run`) |

Full setup: **`docs/LOCAL_DEV.md`** · architecture: **`docs/ARCHITECTURE.md`**
API shapes: **`docs/API.md`** · operations: **`docs/OPERATIONS.md`**.

---

## Non-negotiables

1. **Arabic-first, RTL-first.** Every new feature is RTL-tested before merge. Default locale is `ar-SA`.
2. **Voice only.** No video, ever.
3. **Server-authoritative** game state and wallet operations.
4. **Atomic** DB transactions for anything touching currency; **idempotent** on every payment/gift mutation.
5. **No PII in logs.** Phone numbers are HMAC-SHA256'd before any log write.
6. **Human-reviewed bans** with a 48-hour appeal path.
7. **Prayer-time quiet hours** enabled by default, user-configurable.

See `CONTRIBUTING.md` for the full set of golden rules.

---

## Phase status

- **Phase 0** ✅ Scaffold, infra skeleton, CI
- **Phase 1** ✅ Auth, profiles, avatar pipeline
- **Phase 2** ✅ Voice rooms (schema, Agora tokens, Go realtime, Flutter UI)
- **Phase 3** ✅ Wallet, authoritative Ludo, quick-match
- **Phase 4** ✅ Gifts, payments, withdrawals (50/50)
- **Phase 5** ✅ Moderation pipeline, Arabic NLP, appeals, community guidelines
- **Phase 6** 🚧 Polish — notifications, onboarding, docs, launch prep

Test suite: **75 API specs + 22 Go tests + 4 Flutter widget tests, all passing**.

See `docs/LAUNCH_CHECKLIST.md` for the go/no-go gate.

---

## Compliance highlights

- **PDPL** (Saudi) data localization in AWS me-south-1.
- **UAE VoIP** — group voice rooms only, no 1:1 calling.
- **Anti-gambling** — virtual currency only; cashout framed as creator compensation, not prize redemption.
- **KYC tiers** — phone-only for gift senders, full ID + selfie for withdrawals.
- **13+** signup, **18+** cashout.

Full breakdown: `docs/COMPLIANCE.md`, `docs/PRIVACY_POLICY_AR.md`, `docs/TERMS_AR.md`.

---

## Contributing

See **`CONTRIBUTING.md`**. TL;DR: Conventional Commits, Arabic-first,
tests with the code not after, feature flags for new behavior.

PRs welcome. Review typically happens within 24 hours.
