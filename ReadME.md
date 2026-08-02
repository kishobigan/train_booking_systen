# Train Booking System

Full-stack railway booking application with an Express/Socket.IO backend, Next.js frontend, PostgreSQL database, and background worker.

## Docker quick start

Requirements:

- Docker Engine or Docker Desktop
- Docker Compose v2

Build, initialize, verify, and start the complete application:

```bash
docker compose up --build
```

Compose waits for PostgreSQL, runs pending migrations and the idempotent development seed, starts the API and worker, starts the frontend after API readiness, and finally runs a one-shot smoke verification. Migration or seed failures prevent dependent services from starting.

Open the frontend using the configured frontend URL. The backend API and WebSocket URLs are defined by the existing frontend environment configuration. Seed credentials are defined by the `SEED_*` variables in [backend/.env.example](backend/.env.example); passwords are never printed by startup or verification.

## Operations

Stop the stack while retaining local data:

```bash
docker compose down
```

Follow logs:

```bash
docker compose logs -f
```

Inspect service and health status:

```bash
docker compose ps
```

Re-run the one-shot verification:

```bash
docker compose run --rm smoke-test
```

## Clean local reset

The following command permanently removes the Compose-managed local database and uploaded bank-slip volumes:

```bash
docker compose down --volumes
docker compose up --build
```

Only use `--volumes` when deleting all local application data is intentional. Volume deletion is never performed during normal startup.

## Configuration

- Backend, database, authentication, provider, worker, and seed settings: `backend/.env.example`
- Browser-facing API and WebSocket settings: `frontend/.env.example`
- Service ports, builds, dependencies, health checks, and persistent volumes: `docker-compose.yml`

Optional Stripe, email, SMS, Redis-backed WebSocket, and bank-payment integrations retain their existing disabled or configured fallback behavior. No optional provider is required for core local startup.

## Local development without full Compose

Install the Node.js version selected by the Dockerfiles, copy the relevant environment examples to local environment files, and use the existing package scripts in `backend/package.json` and `frontend/package.json`.
