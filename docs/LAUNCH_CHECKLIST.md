# Majlis — Launch checklist

A phase-by-phase gate for taking Majlis from local to production. Tick
items as they land; link the PR next to the `[x]`.

## Phase 0–5 sign-off (done)

- [x] Monorepo scaffold + CI (Phase 0)
- [x] OTP auth + JWT access/refresh + profile + avatar upload (Phase 1)
- [x] Voice rooms: schema, Agora token, Go realtime, Flutter UI (Phase 2)
- [x] Wallet + authoritative Ludo + quick-match (Phase 3)
- [x] Gifts (50/50 economics), payments, withdrawals (Phase 4)
- [x] Moderation pipeline, Arabic NLP, community guidelines, appeals (Phase 5)

## Phase 6 — polish (in progress)

- [x] FCM token registration + prayer-time quiet hours
- [x] Onboarding flow (Arabic)
- [x] PR template + CONTRIBUTING
- [x] OPERATIONS runbook
- [x] Privacy policy + Terms (Arabic draft)
- [ ] Avatar picker (image_picker) + camera permission copy
- [ ] Language toggle in Settings (persist via PATCH /users/me)
- [ ] Agora Flutter SDK wired (currently mock tokens)
- [ ] Phaser Ludo embedded in WebView on mobile
- [ ] Crash reporting wired (Sentry)

## Security

- [ ] JWT_SECRET + PHONE_HASH_SECRET rotated to KMS-sourced values in prod
- [ ] REALTIME_INTERNAL_TOKEN rotated
- [ ] Rate limiting on `/auth/*` + `/reports` + `/gifts/send` via Redis
- [ ] WAF rules for SQL injection + credential stuffing
- [ ] Signed cookies + CSRF on admin dashboard
- [ ] Penetration test — external vendor

## Performance

- [ ] App bundle <60 MB (Android AAB, iOS IPA)
- [ ] Cold start <2s on Galaxy A32-class device
- [ ] Voice latency <400ms end-to-end
- [ ] 10k concurrent users on staging without Agora minute budget breach
- [ ] Postgres: all frequent queries use the indexes in the migrations
- [ ] Redis: max memory + eviction policy (allkeys-lru) configured

## Compliance

- [ ] PDPL DPO appointed for KSA; contact published in-app
- [ ] UAE VoIP counsel memo on file
- [ ] Data-processor agreements executed: Agora, Firebase, Tap, Fawry, OpenAI, Sentry
- [ ] App Store + Play Store policy review: IAP only for virtual coins
- [ ] KYC tier-2 flow reviewed by AML counsel
- [ ] Age gate: 13+ signup, 18+ cashout, 18+ gift-send caps

## Product

- [ ] 200-user closed beta (SA + EG)
- [ ] Listing copy + screenshots in Arabic and English
- [ ] Onboarding tutorial tested with 5 non-technical users
- [ ] Support runbook + `help@majlis.app` staffed 7 days/week initially
- [ ] Moderation team sized for ≤ 48h appeal SLA at 10k DAU

## Go / no-go

Launch requires:

1. All "Security" items checked.
2. All "Compliance" items checked or explicitly waived by counsel.
3. ≥ 4 weeks stable staging with >95% of crash-free sessions.
4. Sentry error budget <0.5% of requests.
5. Payments: at least one real-provider end-to-end test per provider.
6. Moderation queue SLA verified on closed beta.
