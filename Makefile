# Majlis — local development shortcuts.
# All commands are safe to run repeatedly.

.PHONY: help up down restart logs ps clean \
        api-test api-logs api-shell \
        realtime-test realtime-logs realtime-run \
        mobile-test mobile-run \
        db-shell redis-shell \
        reset

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------- stack ----------
up: ## Start the local stack (postgres, redis, minio, mailhog, api, realtime)
	docker compose up -d
	@echo ""
	@echo "API        → http://localhost:3000/health"
	@echo "Realtime   → http://localhost:8080/health"
	@echo "MinIO UI   → http://localhost:9001  (minioadmin / minioadmin)"
	@echo "Mailhog UI → http://localhost:8025"

down: ## Stop the local stack (keeps volumes)
	docker compose down

restart: ## Restart api + realtime only (code changes usually hot-reload)
	docker compose restart api realtime

logs: ## Tail api + realtime logs
	docker compose logs -f api realtime

ps: ## Show running services
	docker compose ps

reset: ## Wipe all data (Postgres, Redis, MinIO) and restart
	docker compose down -v
	docker compose up -d

clean: ## Remove containers, volumes, and local build artifacts
	docker compose down -v --remove-orphans
	rm -rf apps/api/dist apps/api/node_modules apps/mobile/build apps/realtime/realtime

# ---------- api ----------
api-test: ## Run NestJS unit tests
	cd apps/api && pnpm install && pnpm test

api-logs: ## Tail API logs
	docker compose logs -f api

api-shell: ## Shell into the API container
	docker compose exec api sh

# ---------- realtime ----------
realtime-test: ## Run Go tests
	cd apps/realtime && go test ./...

realtime-logs: ## Tail realtime logs
	docker compose logs -f realtime

realtime-run: ## Run realtime service on host (bypasses docker)
	cd apps/realtime && go run .

# ---------- mobile ----------
mobile-test: ## Run Flutter widget tests
	cd apps/mobile && flutter test

mobile-run: ## Run Flutter in Chrome against the local API
	cd apps/mobile && flutter run -d chrome --web-port 8090

# ---------- data ----------
db-shell: ## psql into the local Postgres
	docker compose exec postgres psql -U majlis -d majlis

db-migrate: ## Apply Prisma migrations (uses migration history)
	docker compose exec api npx prisma migrate deploy

db-push: ## Push Prisma schema to DB without migration history (fast local)
	docker compose exec api npx prisma db push

db-studio: ## Open Prisma Studio on http://localhost:5555
	docker compose exec -e BROWSER=none api npx prisma studio --port 5555 --hostname 0.0.0.0

redis-shell: ## redis-cli into the local Redis
	docker compose exec redis redis-cli
