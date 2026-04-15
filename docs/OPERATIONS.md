# Majlis — Operations runbook

Day-to-day operational reference. Scope: local dev + early production.

## Services

| Service         | Language | Port (local) | Health             |
|-----------------|----------|--------------|--------------------|
| api (NestJS)    | Node 20  | 3000         | `GET /health`      |
| realtime (Go)   | Go 1.22  | 8080         | `GET /health`      |
| postgres        | —        | 5432         | via compose        |
| redis           | —        | 6379         | `redis-cli ping`   |
| minio           | —        | 9000 / 9001  | via compose        |
| mailhog         | —        | 1025 / 8025  | via compose        |
| mobile (web)    | Flutter  | 8090         | browser            |

## Common tasks

### Bring up the stack

```bash
make up
make logs      # tail api + realtime
make db-migrate
```

### Reset local data

```bash
make reset     # wipes postgres + redis + minio
```

### Shell into a service

```bash
make api-shell
make db-shell    # psql
make redis-shell
```

### Trigger an OTP in local mode

```bash
curl -X POST http://localhost:3000/v1/auth/request-otp \
  -H 'content-type: application/json' \
  -d '{"phone":"+966512345678"}'
# Response contains devCode; also printed to the API log.
```

### Mock a payment

```bash
curl -X POST http://localhost:3000/v1/payments/checkout \
  -H 'authorization: Bearer <jwt>' \
  -H 'content-type: application/json' \
  -d '{"packageId":"small","provider":"mock"}'
# Returns paymentId; confirm with:
curl -X POST http://localhost:3000/v1/payments/mock-confirm/<paymentId> \
  -H 'authorization: Bearer <jwt>'
```

## Incident response

| Symptom                              | Likely cause                  | First check                        |
|--------------------------------------|-------------------------------|-------------------------------------|
| `/health` returns 503                | Postgres or Redis down        | `make db-shell` + `redis-shell`    |
| Rooms list is empty after restart    | Live state in Redis only; Postgres `rooms` rows missing | `SELECT count(*) FROM rooms WHERE closed_at IS NULL` |
| Gift send rejected with 409          | Insufficient coins            | Check wallet: `SELECT * FROM wallets WHERE user_id=…` |
| Websockets closing immediately       | JWT_SECRET mismatch api ↔ realtime | compare env `JWT_SECRET` on both   |
| Push not arriving                    | Prayer quiet hours OR disabled | Check user `prayer_quiet_hours` + `notifications_enabled` |

## Deploys (production, future)

1. Merge to `main`.
2. CI runs build + test + terraform validate.
3. Tag the release (`git tag v0.x.y && git push --tags`).
4. GitHub Actions image build → pushes to ECR.
5. ECS service update via Terraform with `terraform apply`.
6. Post-deploy smoke: `curl https://api.majlis.app/health` + create/join room round-trip.

## On-call checklist

- [ ] Sentry dashboard open + Slack #majlis-alerts
- [ ] `psql` + `redis-cli` access to prod from bastion
- [ ] Moderation queue length < 50 at start of shift
- [ ] Withdrawal queue — any > 48h old gets an SLA ping
- [ ] Sampling-ratio on voice moderation = 5% (Redis key `mod:voice:sample:ratio`)

## Data retention

| Data                  | Retention          |
|-----------------------|---------------------|
| Auth logs             | 90 days             |
| Chat text             | 30 days live + 90 days cold |
| Flagged voice clips   | 30 days             |
| Payment records       | 7 years             |
| Deleted-account data  | 30-day soft-delete, then purge |

See `docs/COMPLIANCE.md` for the legal framing.
