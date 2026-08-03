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

Compose waits for PostgreSQL, runs pending migrations, directly creates only the initial Super Admin, starts the API, and then provisions all remaining demonstration records through authenticated Super Admin APIs. The worker and frontend start only after bootstrap succeeds, followed by one-shot smoke verification.

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

## Interview Demonstration

Credentials are configured with `SEED_SUPER_ADMIN_*`, `SEED_ADMIN_*`, and `SEED_STAFF_*` environment variables. Startup logs never print passwords or access tokens.

The bootstrap creates 79 ordered Colombo Fort–Badulla stations, direction-correct outbound and return routes, one configurable train with three reserved and five unreserved coaches, 120 reserved seats, two outbound journeys, one return journey, fare rules, and role assignments. Journey dates are calculated relative to startup and stable service numbers prevent duplicate records.

Demonstration flow:

1. Search Colombo Fort to Badulla on the public landing page and open a seeded journey.
2. Inspect segment-specific availability, choose reserved seats, request a distance-based fare, and create a guest booking.
3. Sign in as Super Admin to inspect the complete network, users, audit trail, revenue, and occupancy.
4. Sign in as Admin to inspect the three assigned journeys.
5. Sign in as Staff to inspect the Colombo Fort station scope.

Seat allocations use half-open station intervals: `[originSequence, destinationSequence)`. Adjacent bookings may therefore reuse one physical seat at their shared station, while PostgreSQL overlap protection rejects intersecting allocations. Journey station, coach, and seat snapshots preserve historical configuration. Availability changes are published through Socket.IO, and expired holds and waitlist offers are processed by the worker.
