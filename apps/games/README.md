# Majlis games

Phaser 3 HTML5 mini-games embedded in the Flutter client via WebView.

Each game is its own pnpm workspace under `apps/games/<name>`. Games receive a
JWT and `room_id` from the Flutter host and stream authoritative state from
the Go realtime service over WebSocket.

## Scope

| Phase | Game             | Status      |
|-------|------------------|-------------|
| 3     | `ludo`           | planned     |
| post-MVP | `domino`, `baloot`, `jackaroo` | backlog |

## Rules

- Client is **view-only**. Dice rolls, move validation, and payouts happen on
  the server (see `apps/realtime`).
- Bundle size budget: <2 MB gzipped per game.
- 60 FPS on mid-range Android (e.g., Galaxy A32).
