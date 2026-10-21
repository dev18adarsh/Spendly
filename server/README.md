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

## Running the client against this API

```bash
npm run seed             # seed the category taxonomy
npm run dev              # the API on http://localhost:4000
```

Then set `VITE_DATA_SOURCE=api` in `client/.env.local` and start the client — the full
walkthrough is in the [repository README](../README.md).

Transactions and budgets that were created before authentication existed carry no owner
and are not reachable through the API; clear them before switching the client over.

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
| `SESSION_TTL_MS` | `604800000` | How long a session stays valid (7 days) |
| `COOKIE_SAMESITE` | `lax` | `SameSite` policy for the session and CSRF cookies (`lax` · `strict` · `none`) |
| `COOKIE_SECURE` | `true` in production | Whether the cookies are marked `Secure` |
| `COOKIE_DOMAIN` | _(empty)_ | Optional cookie domain, e.g. `.spendly.com` |
| `BCRYPT_ROUNDS` | `12` (`4` in tests) | bcrypt cost factor for password hashing |
| `LOGIN_ATTEMPT_LIMIT` | `5` | Failed sign-ins per account before the account is locked |
| `LOGIN_ATTEMPT_WINDOW_MS` | `900000` | How long an account stays locked (15 minutes) |
| `LOGIN_RATE_LIMIT` | `20` | Sign-in requests per IP per window |
| `REGISTER_RATE_LIMIT` | `5` | Registration requests per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Length of the rate-limit window |

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

### Field-level errors

A `422` describes every problem with the request, one entry per field:

```jsonc
{
  "success": false,
  "error": {
    "status": 422,
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [{ "field": "amount", "message": "Amount must be greater than 0." }]
  }
}
```

The web client maps these entries back onto the matching form inputs, so a rejected
submission points at the field that caused it instead of showing one generic message.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Service banner and endpoint index |
| `GET` | `/api/health` | Liveness probe — status, uptime, database state and last connection error |
| `GET` | `/api/health/ready` | Readiness probe — `503` while MongoDB is unavailable |
| `GET` | `/api/categories` | The category taxonomy |
| `POST` | `/api/auth/register` | Create an account and sign in (`201`) |
| `POST` | `/api/auth/login` | Sign in and receive a session cookie |
| `POST` | `/api/auth/logout` | Revoke the session and clear the cookies (`204`) |
| `GET` | `/api/auth/me` | The account behind the current session |
| `GET` | `/api/auth/csrf` | The CSRF token the client has to repeat on writes |
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

### Public and private routes

| Route | Access |
| --- | --- |
| `GET /api/health`, `GET /api/health/ready`, `GET /api/categories` | Public |
| `POST /api/auth/register`, `POST /api/auth/login` | Public, rate limited, CSRF protected |
| `POST /api/auth/logout`, `GET /api/auth/me` | Public, CSRF protected (logout works without a session) |
| `GET /api/auth/csrf` | Public |
| Everything under `/api/transactions`, `/api/budgets`, `/api/analytics` | **Requires a session** |

A request to a private route without a valid session is a `401 UNAUTHORIZED` (or
`401 SESSION_EXPIRED` when a session cookie was present but is no longer valid).

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
month. `/merchants` also accepts `limit` (1–50, default `6`).

`GET /api/analytics/*`

| Parameter | Type | Description |
| --- | --- | --- |
| `range` | `7d` · `30d` · `90d` · `12m` · `3y` | Reporting window (default `30d`) |
| `tz` | IANA zone | Zone the window and its buckets are drawn in (default `UTC`; an unrecognised zone falls back to `UTC` rather than failing) |
| `interval` | `day` · `week` · `month` · `year` | Bucket size for `/cashflow` only (default depends on the range) |

### Reporting windows and calculation rules

`GET /api/transactions` also accepts `range` and `tz`, plus `to` as an **exclusive**
bound (`to` is written `exclusiveTo` on the wire), so the list, the summary and the
charts are always looking at the same rows.

**The window.** Day-based ranges open at local midnight `N-1` days ago and close at the
moment of the request; month-based ranges open on the first of the month `M-1` months
ago. Every window is **half-open** — `[from, to)` — so a transaction is counted exactly
once.

| Figure | Rule |
| --- | --- |
| `income` | sum of `income` transactions with `from <= date < to` |
| `expenses` | sum of `expense` transactions in the same window |
| `balance` | `income - expenses` for the window |
| `allTimeBalance` | `income - expenses` of every transaction before `to`, window or not |
| `savingsRate` | `balance / income * 100`, `0` when there is no income |
| `period.days` | local **calendar** days covered, both ends included |

**Movement.** The window before this one is shifted back by a **calendar step** — `N`
whole days or `M` whole months — not by the same number of milliseconds, so the
comparison window is itself a whole window that starts at local midnight. `changes.net`
compares the two windows' nets; `changes.balance` compares `allTimeBalance` with the
balance that stood before the window opened; `changes.income`, `changes.expenses` and
`changes.savingsRate` compare the same window pair. A change against a zero baseline is
`100` when the current figure is non-zero and `0` when both are.

**Buckets.** `/cashflow` truncates the same `[from, to)` interval into `interval` buckets
with `$dateTrunc` in the reported zone. Weeks start on **Sunday**. Bucket keys are
calendar strings (a day key, an ISO week key, a `YYYY-MM` month key, a `YYYY` year key)
matched by key rather than by instant, so a transaction always lands in the bucket whose
label it carries, and the running balance in each bucket is that bucket's own cumulative
net. The last point reports the **all-time** balance so the series ends where the hero
figure sits.

Because the summary and the series are built from one resolved window, the sums across
the chart equal the summary's `income` and `expenses` — `src/test/analytics.test.ts`
asserts exactly that.

All of it is computed from `range`, `interval` and `tz` on the server; the client never
submits totals, and an empty account reports zeros rather than plausible-looking
numbers. `src/test/reporting.test.ts` works several of these cases out by hand.

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

## Authentication

Spendly uses **cookie sessions**. There is no bearer token, no `Authorization` header and
nothing for the browser to store — the credential lives in an HTTP-only cookie that the
browser attaches on its own.

### Signing in

```bash
# 1. Ask for a CSRF token (the API also sets it as a cookie).
curl -c cookies.txt http://localhost:4000/api/auth/csrf

# 2. Sign in, repeating the token in the header.
curl -b cookies.txt -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-CSRF-Token: <token>' \
  -d '{"email":"alex@example.com","password":"Str0ngPassw0rd"}'
```

The response sets two cookies:

| Cookie | HTTP-only | Purpose |
| --- | --- | --- |
| `spendly_session` | yes | The opaque session token. Not readable by scripts. |
| `spendly_csrf` | no | The CSRF token, which the client copies into the `X-CSRF-Token` header. |

Only the SHA-256 hash of the session token is stored in the database, so a leaked
database does not hand out usable sessions. Signing out deletes the session row, which
revokes the session immediately — replaying the old cookie afterwards fails.

### Passwords

Passwords are hashed with **bcrypt** (`BCRYPT_ROUNDS`, 12 by default). The plaintext is
never stored, never logged and never returned: the hash is excluded from queries by
default (`select: false`) and stripped by the serialiser as well.

### CSRF protection

Every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) has to repeat the CSRF
token in the `X-CSRF-Token` header. The value has to match the `spendly_csrf` cookie, and
the `Origin` header has to be one of the configured `CORS_ORIGINS`. A request that fails
either check is a `403` (`CSRF_TOKEN_MISSING`, `CSRF_TOKEN_INVALID` or
`ORIGIN_NOT_ALLOWED`).

The token is *not* rotated when you sign in — a client that fetched one before signing in
keeps working. The session itself is new on every sign-in, which is the part that has to
change.

### Rate limiting

Two independent limits protect the sign-in endpoints:

* **Per IP** — 20 sign-in and 5 registration requests per 15 minutes (`LOGIN_RATE_LIMIT`,
  `REGISTER_RATE_LIMIT`).
* **Per account** — 5 failed sign-ins lock the account for 15 minutes
  (`LOGIN_ATTEMPT_LIMIT`, `LOGIN_ATTEMPT_WINDOW_MS`). Only failures count, and a
  successful sign-in clears the counter.

Both answer `429` with a `LOGIN_RATE_LIMITED` / `REGISTER_RATE_LIMITED` code.

### Enumeration safety

An unknown email address and a wrong password produce the exact same answer — `401` with
the code `INVALID_CREDENTIALS` and the message "The email address and password do not
match." — and an unknown address still pays the cost of a bcrypt comparison, so the
response time does not give the game away either.

### Data ownership

Every transaction and budget carries a `userId`. All queries are scoped by the signed-in
account, so changing an id in a request never reaches another account's data: reading
somebody else's document answers `404` (not `403` — the API does not confirm that it
exists) and writing to it changes nothing.

## Data model

**Transaction** — `userId` (the owner), `amount` (positive), `type` (`income` · `expense`),
`category`, `description`, `date`, optional `paymentMethod`, optional `merchant` / `notes`,
`status` (`cleared` · `pending`), plus `createdAt` / `updatedAt`. Indexed on `date`, on
`category` and `type` combined with `date`, and on `userId` combined with `date`.

**Budget** — `userId` (the owner), `category`, `limit` (monthly limit), `month`, `year`,
plus timestamps. One budget per category per calendar month *per account*, enforced by a
unique compound index on `userId`, `category`, `month` and `year`.

**User** — `email` (unique, normalised to lower case), `name`, `passwordHash` (bcrypt,
`select: false`), plus `createdAt` / `updatedAt`. The API only ever exposes `id`, `email`,
`name` and `createdAt`.

**Session** — `tokenHash` (SHA-256 of the session token, unique), `userId`, `expiresAt`,
`createdAt`. A TTL index removes expired sessions; signing out deletes the row right
away.

**Category** — `slug`, `name`, `color`, `icon`, `order`. Reference data seeded from
`src/constants/categories.ts`; the same slugs are mirrored by the web client.

Money is stored with two decimal places, and budget periods use UTC month boundaries so
a month means the same thing regardless of where the request came from.

### Existing data

Transactions and budgets created before authentication existed have no `userId`. The
models require it, so those documents are no longer reachable through the API — clear
them or backfill them with the id of an account before switching the client over to
`VITE_DATA_SOURCE=api`.

## Layout

```
src/
├── app.ts                   Express app factory (helmet, CORS, cookies, routes, error pipeline)
├── index.ts                 Bootstrap: validate env → connect → seed → listen → shutdown
├── config/
│   ├── env.ts               Environment parsing, redaction, production assertions
│   ├── cookies.ts           Cookie names and the security flags for them
│   └── database.ts          Mongoose connection state, errors and reconnection
├── constants/               Category taxonomy, payment methods, transaction types
├── models/                  Mongoose schemas with explicit document interfaces
├── services/                Data access and aggregations (transactions, budgets, analytics, auth)
├── controllers/             HTTP handlers — request in, response out
├── routes/                  Route tables that wire middleware to controllers
├── middleware/              Validation, database guard, authentication, CSRF, rate limiting
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

Two files cover authentication specifically:

* `src/test/auth.test.ts` — registration, bcrypt storage, email normalisation, duplicate
  addresses, validation, sign-in, cookie flags, the enumeration-safe error, the account
  lockout, signing out, `/me`, the `401`s on private routes and the CSRF checks.
* `src/test/isolation.test.ts` — two accounts working side by side: neither can list,
  read, change or delete the other's transactions and budgets, budget spend is counted
  per account, analytics never mix the two, and signing out locks everything down.
