# Spendly — server

Express 5 + TypeScript API scaffold.

> **This server stores nothing yet.** It exposes a health probe and a connection helper
> for MongoDB Atlas. The transaction, budget and analytics routes are planned but not
> implemented, so there is no persistence behind the sample data the UI displays.

## Scripts

```bash
npm run dev        # tsx watch src/index.ts on http://localhost:4000
npm run build      # compile to dist/
npm run start      # node dist/index.js
npm run typecheck  # tsc --noEmit
```

## Configuration

Copy `.env.example` to `.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `4000` | HTTP port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `MONGODB_URI` | _(empty)_ | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | `spendly` | Database name |

When `MONGODB_URI` is empty the server still boots and reports `database: "disconnected"`
on the health probe.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Service banner |
| `GET` | `/api/health` | Liveness probe — status, uptime, database state |

## Planned routes

Listed as a contract in `src/routes/index.ts`; the matching client implementation lives
in `client/src/services/http.ts`.

```
GET /api/summary?range=30d
GET /api/analytics/cashflow?range=12m
GET /api/analytics/categories?range=30d
GET /api/analytics/merchants?range=30d
GET /api/transactions?search=&categoryId=&type=&range=&limit=
GET /api/budgets
GET /api/categories
```

## Layout

```
src/
├── app.ts              Express app factory (CORS, JSON, routes, error handling)
├── index.ts            Server bootstrap and graceful shutdown
├── config/env.ts       Environment parsing with safe defaults
├── db/mongo.ts         Optional MongoDB Atlas connection
├── middleware/         notFoundHandler, errorHandler
└── routes/             health.routes.ts, index.ts (route registry)
```
