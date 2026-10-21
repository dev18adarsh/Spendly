# Spendly — API

Express 5 + TypeScript REST API backed by MongoDB (Atlas) through Mongoose.

It owns the real data: transactions, monthly budgets, the category taxonomy and the
aggregations that feed the dashboard. Nothing is faked — every figure the API returns is
computed from documents in the database, and a database that cannot be reached is
reported as a failure instead of an empty result.

## Scripts

```bash
npm run dev              # tsx watch src/index.ts on http://localhost:4000
npm run build            # compile to dist/
npm run start            # node dist/index.js (production)
npm run typecheck        # tsc --noEmit for src and the test suite
npm test                 # node --test against an in-memory MongoDB
npm run seed:categories  # (re)seed the category taxonomy
```

## Configuration

Copy `.env.example` to `.env`. Every value has a safe default, but `MONGODB_URI` is
mandatory in production — the process refuses to start without it.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime environment (`development` · `test` · `production`) |
| `PORT` | `4000` | HTTP port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed browser origins |
| `MAX_PAGE_SIZE` | `100` | Upper bound for `limit` on list endpoints |
| `MONGODB_URI` | _(empty)_ | MongoDB Atlas connection string — never committed, never sent to the browser |
| `MONGODB_DB_NAME` | `spendly` | Database name inside the cluster |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `10000` | How long to wait for MongoDB before failing |

### When MongoDB is unavailable

The API never pretends an operation succeeded:

* `GET /api/health` still answers `200` and reports the connection **state and the
  underlying error** in the body.
* `GET /api/health/ready` answers `503` while the database is down.
* Every data route answers `503 DATABASE_UNAVAILABLE` with the connection error as its
  message, after validating the request (a malformed body is still a `422`).
* In production the process exits with code `1` rather than serving a broken API.

## Response format

Successful responses wrap the payload in an envelope; failures use a matching error
envelope. The shape is identical for every route.

```jsonc
// success
{ "success": true, "data": { /* … */ }, "meta": { "pagination": { /* … */ } } }

// failure
{ "success": false, "error": { "status": 422, "code": "VALIDATION_ERROR", "message": "…", "details": [ /* … */ ] } }
```

`meta.pagination` is present on paginated list endpoints:

```jsonc
{ "page": 1, "limit": 20, "total": 137, "totalPages": 7, "hasNextPage": true, "hasPreviousPage": false }
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Service banner and endpoint index |
| `GET` | `/api/health` | Liveness probe — status, uptime, database state and last connection error |
| `GET` | `/api/health/ready` | Readiness probe — `503` while MongoDB is unavailable |
| `GET` | `/api/categories` | The category taxonomy |
| `GET` | `/api/transactions` | List transactions — filtered, sorted, paginated |
| `POST` | `/api/transactions` | Create a transaction |
| `GET` | `/api/transactions/:id` | Fetch a single transaction |
| `PATCH` | `/api/transactions/:id` | Update a transaction (partial) |
| `DELETE` | `/api/transactions/:id` | Delete a transaction (`204`) |
| `GET` | `/api/budgets` | Monthly budgets with the amount already spent |
| `POST` | `/api/budgets` | Create a budget (or update it if it exists) |
| `PUT` | `/api/budgets` | Upsert a budget by category, month and year |
| `GET` | `/api/budgets/:id` | Fetch a single budget |
| `PATCH` | `/api/budgets/:id` | Update a budget's limit |
| `DELETE` | `/api/budgets/:id` | Delete a budget (`204`) |
| `GET` | `/api/analytics/summary` | Balance, income, expenses, savings rate and period-over-period change |
| `GET` | `/api/analytics/cashflow` | Income/expense series — daily, weekly or monthly buckets |
| `GET` | `/api/analytics/categories` | Spend per category with share of total |
| `GET` | `/api/analytics/merchants` | Merchants ranked by spend |

### Query parameters

`GET /api/transactions`

| Parameter | Type | Description |
| --- | --- | --- |
| `from`, `to` | ISO date | Inclusive bounds on the transaction date |
| `type` | `income` \| `expense` | Direction filter |
| `category` | category slug | Category filter (`housing`, `food`, `transport`, …) |
| `search` | string | Case-insensitive match on description and merchant |
| `page` | integer ≥ 1 | Page number (default `1`) |
| `limit` | integer ≥ 1 | Page size (default `20`, capped by `MAX_PAGE_SIZE`) |
| `sort` | `date`, `-date`, `amount`, `-amount`, `createdAt`, `-createdAt` | Sort field (default `-date`) |

`GET /api/budgets` accepts `month` (1–12) and `year`; both default to the current UTC
month. `GET /api/analytics/*` accept `range` (`7d`, `30d`, `90d`, `12m`, default `30d`);
`/merchants` also accepts `limit` (1–50, default `6`).

### Example

```bash
curl -X POST http://localhost:4000/api/transactions \
  -H 'Content-Type: application/json' \
  -d '{"amount":18.99,"type":"expense","category":"food","description":"Lunch","merchant":"Blue Bottle Coffee","paymentMethod":"card"}'
```

```jsonc
{
  "success": true,
  "data": {
    "id": "6a0f…",
    "amount": 18.99,
    "type": "expense",
    "category": "food",
    "categoryName": "Food & Dining",
    "categoryColor": "#f2b544",
    "categoryIcon": "UtensilsCrossed",
    "description": "Lunch",
    "merchant": "Blue Bottle Coffee",
    "notes": null,
    "date": "2026-10-21T12:00:00.000Z",
    "paymentMethod": "card",
    "status": "cleared",
    "createdAt": "2026-10-21T12:00:00.000Z",
    "updatedAt": "2026-10-21T12:00:00.000Z"
  }
}
```

## Data model

**Transaction** — `amount` (positive), `type` (`income` · `expense`), `category`,
`description`, `date`, optional `paymentMethod`, optional `merchant` / `notes`, `status`
(`cleared` · `pending`), plus `createdAt` / `updatedAt`. Indexed on `date`, and on
`category` and `type` combined with `date`.

**Budget** — `category`, `limit` (monthly limit), `month`, `year`, plus timestamps. One
budget per category per calendar month, enforced by a unique compound index.

**Category** — `slug`, `name`, `color`, `icon`, `order`. Reference data seeded from
`src/constants/categories.ts`; the same slugs are mirrored by the web client.

Money is stored with two decimal places, and budget periods use UTC month boundaries so
a month means the same thing regardless of where the request came from.

## Layout

```
src/
├── app.ts                   Express app factory (helmet, CORS, JSON, routes, error pipeline)
├── index.ts                 Bootstrap: validate env → connect → seed → listen → shutdown
├── config/
│   ├── env.ts               Environment parsing, redaction, production assertions
│   └── database.ts          Mongoose connection state, errors and reconnection
├── constants/               Category taxonomy, payment methods, transaction types
├── models/                  Mongoose schemas with explicit document interfaces
├── services/                Data access and aggregations (transactions, budgets, analytics)
├── controllers/             HTTP handlers — request in, response out
├── routes/                  Route tables that wire middleware to controllers
├── middleware/              Validation, database guard, error handler, not-found
├── validators/              Zod schemas for bodies, queries and params
├── utils/                   Envelope, pagination, ApiError, async handler
├── types/                   API DTOs and Express request augmentation
├── scripts/                 Operational scripts (category seeding)
└── test/                    Integration tests against an in-memory MongoDB
```

The layering is strict: routes declare middleware, controllers orchestrate services,
services own the database, and models describe the documents. Nothing in `models/` or
`services/` knows about HTTP.

## Tests

```bash
npm test
```

The suite runs against a real MongoDB (an in-memory instance started per test file) and
covers transaction CRUD, filtering, pagination, budgets, analytics, the health probes,
CORS, validation failures and — importantly — the behaviour of the API when MongoDB is
unreachable.
