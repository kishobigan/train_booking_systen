# Backend — Train Booking API

Express + PostgreSQL REST API running on port **4050**.

## Setup

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

## Scripts

| Script           | Description                |
|------------------|----------------------------|
| `npm run dev`    | Start with hot reload      |
| `npm start`      | Start production server    |
| `npm run db:migrate` | Run migrations & seed |

## Environment Variables

| Variable       | Default                                              |
|----------------|------------------------------------------------------|
| PORT           | 4050                                                 |
| DATABASE_URL   | postgresql://postgres:postgres@localhost:5432/train_booking |
