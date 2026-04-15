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

Implemented (Phase 1b): user endpoints.

### `GET /v1/users/me`

Auth: required. Returns the authenticated user with profile joined.

```jsonc
{
  "id": "uuid",
  "displayName": "ماجد",
  "avatarUrl": "http://localhost:9000/majlis-uploads/avatars/uuid/abc123/medium.webp",
  "country": "SA",
  "language": "ar",
  "birthdate": "1998-03-12",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "profile": {
    "bio": "قهوة ولودو وبس",
    "favoriteGames": ["ludo"],
    "badges": [],
    "frameId": null,
    "nameplateId": null
  }
}
```

### `PATCH /v1/users/me`

Auth: required. Partial update. Any subset of the fields below:

```jsonc
{
  "displayName": "ماجد",         // 2..48 chars
  "bio": "…",                    // 0..240 chars
  "language": "ar" | "en",
  "country": "SA" | "AE" | "EG" | "KW" | "OM" | "BH" | "QA" | "JO",
  "birthdate": "1998-03-12",     // ISO date
  "favoriteGames": ["ludo"]      // max 8 entries
}
```

Returns the updated user in the same shape as `GET /users/me`.

### `POST /v1/users/me/avatar`

Auth: required. `multipart/form-data` with a `file` field.

Constraints:
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`
- Max size: 5 MB
- Dimensions: 128..4096 px per side

The server strips EXIF, re-encodes as WebP, and produces 3 variants:
`small` (96px), `medium` (256px), `large` (512px). `users.avatar_url` is
set to the medium URL. Returns the full user object.

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
