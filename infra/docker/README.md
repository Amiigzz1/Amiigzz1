# infra/docker

Shared Dockerfiles and compose overrides for local and CI environments.

Current per-service Dockerfiles live next to the service code:

- `apps/api/Dockerfile`
- `apps/realtime/Dockerfile`

The root `docker-compose.yml` references them directly. Once we add
supporting containers (e.g. Mailhog, MinIO, a local Agora mock), their
Dockerfiles land here.
