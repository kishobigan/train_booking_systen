# Backend — Train Booking API

Express + PostgreSQL REST API running on port **4050**. All application endpoints are
versioned under `/api/v1`.

## Database

The schema supports segment-based seat booking with PostgreSQL-level overlap prevention via `btree_gist` exclusion constraints.

### Models (27 tables)

| Module          | Tables                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Users & Auth    | `users`, `refresh_tokens`                                                                              |
| Railway Network | `stations`, `routes`, `route_stations`                                                                 |
| Trains          | `trains`, `coaches`, `seats`                                                                           |
| Journeys        | `journeys`, `journey_stations`, `journey_coaches`, `journey_seats`                                     |
| Fares           | `fare_rules`, `fare_rule_classes`, `passenger_fare_rules`                                              |
| Bookings        | `bookings`, `booking_passengers`, `booking_seats`, `active_seat_allocations`, `booking_status_history` |
| Payments        | `payments`, `refunds`, `payment_webhook_events`                                                        |
| Waitlist        | `waitlist_entries`                                                                                     |
| Notifications   | `notifications`                                                                                        |
| Admin           | `audit_logs`, `journey_disruptions`                                                                    |

SQL migrations: `src/db/migrations/`
Sequelize connection: `src/lib/sequelize.js`

## Setup

```bash
cp .env.example .env
npm install
npm run db:setup     # migrate + seed
npm run dev
```

## Scripts

| Script                 | Description                    |
| ---------------------- | ------------------------------ |
| `npm run dev`          | Start with hot reload          |
| `npm start`            | Start production server        |
| `npm run db:migrate`   | Run SQL migrations             |
| `npm run db:seed`      | Insert seed data               |
| `npm run db:setup`     | Migrate then seed              |
| `npm run lint`         | Check JavaScript with ESLint   |
| `npm run lint:fix`     | Fix auto-fixable ESLint issues |
| `npm run format`       | Format files with Prettier     |
| `npm run format:check` | Check Prettier formatting      |

## Environment Variables

| Variable       | Default                                                     |
| -------------- | ----------------------------------------------------------- |
| PORT           | 4050                                                        |
| DATABASE_URL   | postgresql://postgres:postgres@localhost:5433/train_booking |
| LOG_LEVEL      | info                                                        |
| ADMIN_EMAIL    | admin@trainbooking.local                                    |
| ADMIN_PASSWORD | admin123                                                    |

## API and logging

- API discovery: `GET /api`
- Version metadata: `GET /api/v1`
- Health check: `GET /api/v1/health`
- Logs are structured JSON and redact authorization, cookie, and password fields.

## Key Design

- **`booking_seats`** — historical segment reservations with generated `INT4RANGE`
- **`active_seat_allocations`** — current HELD/CONFIRMED occupancy only
- **Exclusion constraint** — prevents overlapping segments on the same seat/journey
