# Spendly

A premium, dark-themed expense tracking web application — a React dashboard on top of a
real Express + MongoDB backend.

Transactions, monthly budgets and the dashboard analytics live in MongoDB. The API
computes every figure from actual documents; there is no sample data hiding behind a
successful-looking response.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite 8 |
| Styling | Tailwind CSS 4 (CSS-first `@theme` tokens) |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Backend | Node.js · Express 5 · TypeScript · Zod |
| Database | MongoDB Atlas (via Mongoose 9) |
| Tests | Node test runner · Supertest · mongodb-memory-server |

## Repository layout

```
spendly/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/        # Sparkline and other chart primitives
│   │   │   ├── dashboard/     # Dashboard-specific composites
│   │   │   ├── layout/        # App shell, sidebar, top bar, page header
│   │   │   └── ui/            # Reusable primitives (Button, Card, Modal, Input…)
│   │   ├── config/            # Runtime config + app-level toggles
│   │   ├── data/mock/         # Sample data — isolated from the API contract
│   │   ├── hooks/             # useAsyncData, useCategories, useMediaQuery…
│   │   ├── lib/               # cn() and formatting helpers
│   │   ├── pages/             # Route-level screens
│   │   ├── routes/            # Router configuration
│   │   ├── services/          # Data-source seam (mock ⇄ HTTP)
│   │   └── types/             # Shared domain model
│   └── .env.example
└── server/                    # Express + MongoDB API
    ├── src/
    │   ├── config/            # Environment parsing and the MongoDB connection
    │   ├── constants/         # Category taxonomy and shared enumerations
    │   ├── models/            # Mongoose schemas
    │   ├── services/          # Data access and aggregations
    │   ├── controllers/       # HTTP handlers
    │   ├── routes/            # Route tables
    │   ├── middleware/        # Validation, database guard, error handling
    │   ├── validators/        # Zod request schemas
    │   ├── utils/             # Response envelope, pagination, ApiError
    │   ├── types/             # API DTOs
    │   ├── scripts/           # Operational scripts
    │   ├── test/              # Integration tests
    │   ├── app.ts             # Express app factory
    │   └── index.ts           # Server bootstrap
    └── .env.example
```

## Getting started

```bash
npm install            # installs the client and server workspaces
cp server/.env.example server/.env
# …then add your MongoDB Atlas connection string to server/.env

npm run dev            # starts the Vite dev server on http://localhost:5173
npm run dev:server     # starts the Express API on http://localhost:4000
```

Other scripts:

```bash
npm run typecheck    # tsc for both workspaces
npm run test         # server integration tests (in-memory MongoDB)
npm run build        # production build for both workspaces
npm run preview      # preview the built client
npm run start:server # run the compiled API (after npm run build)
npm run seed         # seed the category taxonomy
```

## How data flows

The UI never talks to a data source directly — it depends on the `SpendlyApi` interface
in `client/src/services/types.ts`:

```
components ─▶ useAsyncData ─▶ services/index.ts ─┬─▶ services/mock/client.ts   (sample data)
                                                  └─▶ services/http.ts          (live API)
                                                         │
                                                         ▼
                                                   Express API → MongoDB Atlas
```

* **Mock** (default) serves the sample ledger in `client/src/data/mock/` with simulated
  latency, so loading and error states are real while you work offline.
* **API** is wired up end-to-end. Set `VITE_DATA_SOURCE=api` in `client/.env.local` and
  the same components read from the server: the HTTP adapter unwraps the response
  envelope, translates the client's `range`/`categoryId` vocabulary into the API's
  `from`/`to`/`category` parameters, and maps the server DTOs onto the shapes the UI
  renders.

The server is the source of truth for the live path; the mock layer exists so the
frontend stays usable without a database.

## The API

A JSON REST API under `/api`, documented in detail in [`server/README.md`](server/README.md).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe with the database state and connection error |
| `GET` | `/api/health/ready` | Readiness probe — `503` while MongoDB is unavailable |
| `GET` `POST` | `/api/transactions` | List (filtered, sorted, paginated) and create |
| `GET` `PATCH` `DELETE` | `/api/transactions/:id` | Read, update and remove a transaction |
| `GET` `POST` `PUT` | `/api/budgets` | Monthly budgets, with the amount already spent |
| `GET` `PATCH` `DELETE` | `/api/budgets/:id` | Read, update and remove a budget |
| `GET` | `/api/categories` | The category taxonomy |
| `GET` | `/api/analytics/summary` | Balance, income, expenses, savings rate |
| `GET` | `/api/analytics/cashflow` | Income/expense series over a range |
| `GET` | `/api/analytics/categories` | Spend per category with share of total |
| `GET` | `/api/analytics/merchants` | Merchants ranked by spend |

Every response uses the same envelope — `{ success, data, meta }` or
`{ success, false, error }` — and every failure carries a status, a stable code and a
human-readable message. Credentials never leave the server: the MongoDB URI is read
from the environment, redacted in logs, and never exposed to the browser.

If MongoDB cannot be reached, the API says so plainly — `503 DATABASE_UNAVAILABLE`
with the connection error — instead of returning an empty result that looks like a
successful query.

## Design system

Tokens live in `client/src/index.css` under `@theme` — charcoal canvas, layered surfaces,
hairline borders, and a single mint accent:

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#090a0c` | Page background |
| `surface` / `surface-2` / `surface-3` | `#0e1013` → `#191d21` | Cards and controls |
| `line` / `line-strong` | `#212529` / `#2c3238` | Hairline borders |
| `ink` / `ink-muted` / `ink-faint` | `#f3f5f7` → `#6a737e` | Text hierarchy |
| `brand` | `#35d6a4` | Accent, positive movement |
| `negative` | `#fb7185` | Expenses, negative movement |
| `warning` | `#f2b544` | Limits and pending states |

## Accessibility

* Semantic landmarks, a skip link, and `aria-current` on the active nav item.
* The modal traps focus, closes on `Escape`/backdrop, and restores focus on unmount.
* Icon-only controls carry accessible names; charts have text summaries.
* `prefers-reduced-motion` disables animation and transitions globally.

## Roadmap

1. Authentication and per-account data isolation.
2. Recurring transactions and import from bank statements.
3. Budget periods beyond monthly, and per-category rollover.
4. Real-time updates (server-sent events) for the dashboard.
