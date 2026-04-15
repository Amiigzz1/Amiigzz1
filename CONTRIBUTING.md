# Contributing to Majlis

Thanks for helping build Majlis. This document covers the conventions the
team enforces in code review.

## Golden rules

1. **Arabic-first.** Every new UI feature must be RTL-tested before merge.
   The default locale is `ar-SA`.
2. **No video, ever.** The product thesis depends on voice-only interaction.
3. **Server-authoritative** game logic and currency. The client is view-only
   for anything that affects a wallet or game state.
4. **Atomic DB transactions** for every operation that touches a wallet.
5. **Idempotency keys** on every payment webhook and currency mutation.
6. **No PII in logs.** Phone numbers are hashed via `PhoneHasher.hash()`
   before they're logged. Raw phones never leave the auth handshake.
7. **Human-reviewed bans only.** The moderation system never auto-bans —
   see `docs/community_guidelines_ar.md`.
8. **Prayer-time quiet hours** are on by default and user-configurable.

## Development workflow

```bash
# First-time setup
cp apps/api/.env.example apps/api/.env
pnpm install
make up
make db-migrate
```

## Commit style

We follow **Conventional Commits**. The subject line ≤ 72 characters,
imperative mood, no trailing period.

Scopes we use: `auth`, `rooms`, `wallet`, `gifts`, `payments`,
`moderation`, `notifications`, `mobile`, `realtime`, `admin`, `infra`,
`docs`, `chore`.

Examples:

```
feat(rooms): add seat-take confirmation sound
fix(wallet): prevent double-credit on idempotency retry
refactor(moderation): extract Arabic normalization into arabic-nlp
```

Reference the phase in the body when it helps reviewers: `Phase 4b polish`.

## PR checklist

Include this as the body of the PR. We'll nudge you in review if it's not
there.

- [ ] Unit tests added or updated (target coverage: 70%).
- [ ] Docs updated: relevant `docs/*.md`, any public API shape change noted in `docs/API.md`.
- [ ] Arabic strings added to `apps/mobile/lib/l10n/app_ar.arb` with the English counterpart.
- [ ] RTL verified in the simulator.
- [ ] No PII in new logs (search for `phone`, `email`, `ip` in the diff).
- [ ] Prisma migration added if schema changed (never edit a merged migration).

## Feature flags

New features should land behind a Redis-backed flag:

```typescript
const enabled = await flags.isEnabled('new-room-ui', userId);
```

## Code style

- TypeScript: strict mode, no `any` in public APIs. Imports alphabetized.
- Go: `gofmt` + `go vet` clean. Error wrapping uses `%w`.
- Dart: `flutter_lints` + always explicit return types. Single quotes.
- Commit messages lowercase except proper nouns.

## Running tests locally

```bash
make api-test       # NestJS Jest
make realtime-test  # Go
make mobile-test    # Flutter
```

CI runs all four plus `terraform fmt -check` on every PR.

## Reviewing PRs

- Look at tests first — are they testing behavior or implementation?
- Is the change reversible? A feature flag + a migration pair is reversible; a schema rename without a backfill is not.
- For moderation + payments, a second reviewer is required (see CODEOWNERS).

## Releases

1. `git tag v0.x.y`
2. `git push --tags`
3. Update `docs/CHANGELOG.md`.

## Questions

Internal Slack: `#majlis-dev`. External: open a GitHub Discussion.
