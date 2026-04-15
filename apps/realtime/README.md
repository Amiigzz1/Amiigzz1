# majlis-realtime

Go service responsible for:

- Voice room presence and signaling (Phase 2)
- Matchmaking (Phase 3)
- Authoritative game state for Ludo and future mini-games (Phase 3+)

## Run locally

```bash
cd apps/realtime
go run .
# curl http://localhost:8080/health
```

## Test

```bash
go test ./...
```
