# Majlis (مجلس)

> تطبيق ألعاب اجتماعية صوتي للسوق العربي — Voice-first social gaming platform for the MENA market.

**Tagline:** قهوتك الرقمية — العب، اتكلم، اتعرّف
**Markets:** SA, AE, EG, KW, OM, BH, QA, JO
**Status:** MVP scaffold — Phase 0 (foundations)

---

## Why Majlis

Majlis is a voice-first social gaming app designed to address the pain points of incumbents in the MENA social-gaming market:

1. Fair, transparent moderation with human appeals (no silent bans).
2. Native local payment rails (STC Pay, Mada, Fawry) alongside IAP.
3. Creator-friendly economics — **50/50 gift split** instead of the 70–80% commissions that dominate the category.
4. Reliability and performance (voice latency <400ms, small app size, low crash rate).
5. Authentic Arab cultural identity (RTL-first, prayer-time quiet hours, modesty-aligned UX).

---

## Monorepo layout

```
majlis/
├── apps/
│   ├── mobile/       # Flutter (iOS, Android, Web)
│   ├── api/          # NestJS REST + WebSocket gateway
│   ├── realtime/     # Go service: rooms, matchmaking, game state
│   ├── games/        # Phaser 3 HTML5 mini-games
│   └── admin/        # Next.js moderation dashboard
├── packages/
│   ├── shared-types/ # Cross-app TypeScript types
│   ├── proto/        # Protocol buffers (if/when needed)
│   └── arabic-nlp/   # Arabic moderation / profanity library
├── infra/
│   ├── terraform/    # AWS (me-south-1 + me-central-1)
│   └── docker/       # Dockerfiles + compose for local dev
└── docs/             # ARCHITECTURE / API / CULTURAL_GUIDE / COMPLIANCE
```

JS/TS is managed with **pnpm workspaces**; Go services with **Go workspaces**.

---

## Tech stack (locked)

| Layer         | Choice                                            |
|---------------|---------------------------------------------------|
| Frontend      | Flutter 3.x + Riverpod 2.x                        |
| Backend API   | Node.js 20 + NestJS + TypeScript                  |
| Realtime      | Go 1.22                                           |
| Database      | PostgreSQL 16                                     |
| Cache / PubSub| Redis 7                                           |
| Voice         | Agora.io (abstracted so LiveKit can replace it)   |
| Game engine   | Phaser 3 (HTML5 inside Flutter WebView)           |
| Storage / CDN | AWS S3 (me-south-1) + CloudFront                  |
| Auth          | Firebase Auth (OTP) + JWT                         |
| Payments      | Tap (GCC) + Fawry (EG) + Apple/Google IAP         |
| Moderation    | OpenAI moderation + Arabic NLP + human review     |
| Observability | Sentry + Grafana + Prometheus                     |
| CI/CD         | GitHub Actions                                    |
| Infra         | AWS me-south-1 (Bahrain) + me-central-1 (UAE)     |

---

## Local development

**Local-first.** Zero cloud accounts required. S3 → MinIO, Firebase OTP →
console log, Agora / Tap / Fawry / OpenAI → mock modes, SMTP → Mailhog.

Prereqs: Docker 24+, Node 20+, pnpm 9+, Go 1.22+, Flutter 3.x.

```bash
cp apps/api/.env.example apps/api/.env
make up            # docker compose up -d
```

| Service        | URL                                  |
|----------------|--------------------------------------|
| API            | http://localhost:3000/health         |
| Realtime       | http://localhost:8080/health         |
| MinIO console  | http://localhost:9001 (minioadmin)   |
| Mailhog UI     | http://localhost:8025                |
| Flutter web    | http://localhost:8090 (`flutter run -d chrome --web-port 8090`) |

Full setup + OTP in local mode + reset instructions: **`docs/LOCAL_DEV.md`**.
Service boundaries + data flow: **`docs/ARCHITECTURE.md`**.

---

## Roadmap

- **Phase 0** — Scaffold, infra skeleton, CI (weeks 1–2) ← *current*
- **Phase 1** — Auth & profiles (weeks 3–4)
- **Phase 2** — Voice rooms (weeks 5–8)
- **Phase 3** — Ludo (weeks 9–12)
- **Phase 4** — Economy & gifts (weeks 13–15)
- **Phase 5** — Moderation & safety (weeks 16–17)
- **Phase 6** — Polish, load test, closed beta, launch prep (weeks 18–22)

---

## Non-negotiables

- **Arabic-first.** Every feature is RTL-tested before merge; default locale is `ar-SA`.
- **Voice only.** No video. Ever.
- **Server-authoritative** game state and wallet operations.
- **Atomic** DB transactions for anything touching currency.
- **Idempotency keys** on all payment and currency webhooks.
- **No PII in logs.** Phone numbers are hashed before logging.
- **Human-reviewed bans** with a 48-hour appeal path.
- **Prayer-time quiet hours** enabled by default, user-configurable.
