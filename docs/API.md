# Majlis — API reference

All endpoints are prefixed with `/v1` except `/health`. Authentication is a
JWT Bearer token unless noted.

Content-type: `application/json; charset=utf-8`.

## Phase 0 — available now

### `GET /health`

```json
{
  "status": "ok",
  "service": "majlis-api",
  "uptimeSeconds": 42,
  "timestamp": "2026-04-15T00:00:00.000Z"
}
```

The realtime service exposes the same shape at `http://realtime:8080/health`
with `service: "majlis-realtime"`.

## Phase 1 — auth & profiles

Implemented (Phase 1a):

### `POST /v1/auth/request-otp`

```jsonc
// request
{ "phone": "+966512345678", "country": "SA" /* optional hint */ }

// response (200)
{ "status": "sent" }
// response in local mode (LOCAL_OTP_MODE=true) also includes:
// { "status": "sent", "devCode": "482913" }
```

Rate limits: 5 requests / phone / hour.

### `POST /v1/auth/verify-otp`

```jsonc
// request
{ "phone": "+966512345678", "code": "482913", "deviceId": "optional" }

// response (200)
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "accessTokenExpiresIn": 900,        // seconds
  "refreshToken": "opaque-base64url",
  "userId": "uuid",
  "isNewUser": true
}
```

- Access token TTL: 15 minutes (`JWT_ACCESS_TTL`).
- Refresh token TTL: 30 days (`JWT_REFRESH_TTL`).
- Max 3 verify attempts per issued OTP.

### `POST /v1/auth/refresh`

```jsonc
// request
{ "refreshToken": "..." , "deviceId": "optional" }

// response (200)
{ "accessToken": "...", "accessTokenExpiresIn": 900, "refreshToken": "..." }
```

Tokens are rotated on every refresh. Presenting a revoked refresh token
triggers immediate revocation of **all** sessions for the user (replay
defense).

### `POST /v1/auth/logout`

Auth: **required** (Bearer). Body: `{ "refreshToken": "..." }`.
Returns 204. Revokes the presented refresh token only.

Planned (Phase 1b):

| Method | Path                      | Auth | Purpose                              |
|--------|---------------------------|------|--------------------------------------|
| GET    | `/v1/users/me`            | ✅    | Current user profile.                |
| PATCH  | `/v1/users/me`            | ✅    | Update display name, bio, etc.       |
| POST   | `/v1/users/me/avatar`     | ✅    | Multipart upload → MinIO/S3.         |

## Phase 2 — voice rooms (planned)

| Method | Path                      | Auth | Purpose                              |
|--------|---------------------------|------|--------------------------------------|
| GET    | `/v1/rooms`               | ✅    | List (filter: `category`, `country`). |
| POST   | `/v1/rooms`               | ✅    | Create a room.                       |
| GET    | `/v1/rooms/:id`           | ✅    | Room details + Agora token.          |
| WS     | `ws://realtime/ws`        | ✅    | Presence + seat events.              |

## Phase 3 — games (planned)

| Method | Path                           | Auth | Purpose                   |
|--------|--------------------------------|------|---------------------------|
| POST   | `/v1/games/ludo/quick-match`   | ✅    | Returns `room_id`.        |

## Phase 4 — economy (planned)

| Method | Path                           | Auth | Purpose                   |
|--------|--------------------------------|------|---------------------------|
| GET    | `/v1/wallet`                   | ✅    | Coins + diamonds.         |
| POST   | `/v1/gifts/send`               | ✅    | Send a gift in a room.    |
| POST   | `/v1/payments/webhooks/tap`    | —    | Tap webhook (HMAC-signed).|
| POST   | `/v1/payments/webhooks/fawry`  | —    | Fawry webhook.            |
| POST   | `/v1/withdrawals`              | ✅    | Cashout request (KYC-gated). |

## Error envelope

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token expired",
    "requestId": "req_01J0ABC..."
  }
}
```

Error codes are `SCREAMING_SNAKE_CASE` and stable across versions.
