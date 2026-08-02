# Train Booking System

Full-stack train booking application with Node.js/Express backend, Next.js frontend, and PostgreSQL.

## Architecture

| Service    | Port | URL                      |
|------------|------|--------------------------|
| Frontend   | 3050 | http://localhost:3050    |
| Backend    | 4050 | http://localhost:4050    |
| PostgreSQL | 5433 | localhost:5433 (Docker host mapping) |

## Quick Start (Docker)

Run everything with one command:

```bash
docker compose up --build
```

- Frontend: http://localhost:3050
- Backend API: http://localhost:4050/api/health
- PostgreSQL: `postgresql://postgres:postgres@localhost:5433/train_booking`

Stop services:

```bash
docker compose down
```

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use Docker for DB only)

### Database

```bash
docker compose up postgres -d
```

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint          | Description          |
|--------|-------------------|----------------------|
| GET    | /api/health       | Health check         |
| GET    | /api/trains       | List all trains      |
| GET    | /api/trains/:id   | Get train by ID      |
| GET    | /api/bookings     | List all bookings    |
| POST   | /api/bookings     | Create a booking     |

### Create Booking Example

```bash
curl -X POST http://localhost:4050/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "train_id": 1,
    "passenger_name": "John Doe",
    "passenger_email": "john@example.com",
    "seats_booked": 2
  }'
```

## Project Structure

```
├── backend/          # Express + PostgreSQL API
│   └── src/
│       ├── config/   # Database connection
│       ├── db/       # Migrations & seed data
│       └── routes/   # API routes
├── frontend/         # Next.js app
│   └── src/
│       ├── app/      # Pages & layout
│       ├── components/
│       └── lib/      # API client
└── docker-compose.yml
```
