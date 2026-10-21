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
| Auth | Cookie sessions · bcrypt · double-submit CSRF |
| Tests | Node test runner · Supertest · mongodb-memory-server |

## Repository layout

```
spendly/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/           # Sign-in and sign-up shell
│   │   │   ├── charts/        # Sparkline and other chart primitives
│   │   │   ├── dashboard/     # Dashboard-specific composites
│   │   │   ├── layout/        # App shell, sidebar, top bar, page header
│   │   │   └── ui/            # Reusable primitives (Button, Card, Modal, Input…)
│   │   ├── auth/              # Auth context, provider and route guards
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
    │   ├── middleware/        # Validation, database guard, authentication, CSRF, rate limiting
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

### Running against the real API

The client ships with a sample-data preview build. To use the real thing:

```bash
cp server/.env.example server/.env      # add your MONGODB_URI
cp client/.env.example client/.env.local # set VITE_DATA_SOURCE=api
npm run seed                            # seed the category taxonomy
npm run dev:server &                    # the API on :4000
npm run dev                             # the client on :5173
```

The app then requires an account: an anonymous visitor is sent to the sign-in screen,
and the session lives in an HTTP-only cookie. Transactions and budgets that were created
before authentication existed have no owner and are not reachable through the API —
clear them before switching over.

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
  latency, so loading and error states are real while you work offline. It is a preview
  build: it signs you in as a demo account and never writes anything anywhere.
* **API** is wired up end-to-end. Set `VITE_DATA_SOURCE=api` in `client/.env.local` and
  the same components read from the server: the HTTP adapter unwraps the response
  envelope, translates the client's `range`/`categoryId` vocabulary into the API's
  `from`/`to`/`category` parameters, and maps the server DTOs onto the shapes the UI
  renders.

The server is the source of truth for the live path; the mock layer exists so the
frontend stays usable without a database.

## Working with transactions

The dashboard and the transactions page read the same ledger, and both can change it.

* **One dialog for create and edit.** `useTransactionComposer()` opens the same
  `TransactionForm` from the top bar, the dashboard and the transactions list, so the
  fields, the validation and the error handling are identical everywhere.
* **One HTTP client.** `client/src/services/http.ts` is the only place that talks to the
  network. It sends the session cookie, repeats the CSRF token on every write, retries
  once with a fresh token when the server rejects the old one, and turns a failure into
  an `ApiError` that carries the field-level issues a `422` reports — those land on the
  matching inputs instead of disappearing into a toast.
* **Guarded submissions.** The form refuses to send an empty amount or a missing
  category, and a second submit while a request is in flight is ignored.
* **Immediate updates.** A successful mutation raises a data revision that every
  `useAsyncData` hook depends on, so the list, the dashboard totals and the charts all
  refresh without a page reload. Nothing is written to `localStorage`.
* **Filters live in the URL.** `?search=`, `?category=`, `?type=` and `?range=` describe
  the current view, so it can be shared, bookmarked and reloaded. The search box is
  debounced before it reaches the API.
* **Honest feedback.** Loading uses skeletons, an empty list explains what would appear
  there, a failed request renders an error state with a retry, and a failed request never
  falls back to sample data.

## How the dashboard calculates

Every figure the dashboard shows — the stat cards, both charts, the category donut and
the recent list — is derived from **one reporting window**, resolved on the server.

**The window.** `range` picks a window (`7d` · `30d` · `90d` · `12m` · `3y`) and `tz`
picks the zone it is drawn in: the browser's IANA zone, validated server-side, falling
back to `UTC`. Day-based windows open at **local midnight** `N-1` days ago and close at
the moment of the request; month-based windows open on the **first of the month**
`M-1` months ago. Every window is **half-open** — `[from, to)` — so a transaction can
never be counted twice or slip through the gap between two windows.

| Figure | Rule |
| --- | --- |
| Income | sum of `income` transactions with `from <= date < to` |
| Expenses | sum of `expense` transactions in the same window |
| Total balance | `income - expenses` **for the window** |
| All-time balance | `income - expenses` of every transaction before `to`, window or not |
| Savings rate | `balance / income * 100`, and `0` when there is no income |
| Days in period | local **calendar** days covered, both ends included |

Days are counted off the calendar rather than the clock, so `Last 30 days` always answers
`30 days` even when the closing day is 23 or 25 hours long.

**Movement.** Each figure is compared with the window immediately before it, which is
shifted back by a **calendar step** — `N` whole days or `M` whole months — rather than by
the same number of milliseconds, so the comparison window is itself a whole window and
never begins in the middle of a day. `changes.net` compares the two windows' nets;
`changes.balance` compares the all-time balance against what stood before the window
opened.

**Buckets.** The cashflow and trend charts group that same window into `day`, `week`,
`month` or `year` buckets (`$dateTrunc` on the server). Weeks start on **Sunday**, and
buckets are matched by calendar key rather than by instant, so a transaction always
lands in the bucket whose label it carries. The chart, the donut and the cards are sums
over the identical `[from, to)` interval — the chart totals and the card totals are the
same numbers by construction, not by coincidence.

**Timezone.** Boundaries and bucket edges are computed in the reported zone with
wall-clock helpers that stay correct across DST transitions, and the client renders
dates in that same zone — a transaction, the bucket it appears in and the totals it
contributes to can never disagree.

The window is resolved from the request's `range`, `interval` and `tz` query parameters,
so the browser never sends a date range for the server to trust. An empty account
reports `$0.00` everywhere; no figure is ever invented.

## Accounts and sessions

Spendly signs people in with **cookie sessions** — no bearer token, no `Authorization`
header, and nothing for the browser to keep in `localStorage`.

* The session lives in an **HTTP-only cookie**; only its SHA-256 hash is stored in the
  database, and signing out deletes that row, which revokes the session immediately.
* Passwords are hashed with **bcrypt**. The hash is excluded from queries by default and
  never leaves the server.
* Every write repeats a **CSRF token** in the `X-CSRF-Token` header, and the `Origin`
  header has to be one of the allowed origins.
* Sign-in is **rate limited** per IP, and an account is locked for 15 minutes after 5
  failed attempts.
* An unknown email and a wrong password answer exactly the same way, so the API does not
  leak which addresses are registered.
* Every transaction and budget belongs to an account. All queries are scoped by the
  signed-in user, so changing an id in a request never reaches somebody else's data.

In the client the `AuthProvider` restores the session on load, `ProtectedRoute` keeps
anonymous visitors out of the app, and a `401` from anywhere signs the person out and
brings them back to the sign-in screen with an explanation.

## The API

A JSON REST API under `/api`, documented in detail in [`server/README.md`](server/README.md).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe with the database state and connection error |
| `GET` | `/api/health/ready` | Readiness probe — `503` while MongoDB is unavailable |
| `POST` | `/api/auth/register` | Create an account and sign in |
| `POST` | `/api/auth/login` | Sign in and receive a session cookie |
| `POST` | `/api/auth/logout` | Revoke the session and clear the cookies |
| `GET` | `/api/auth/me` | The account behind the current session |
| `GET` | `/api/auth/csrf` | The CSRF token the client repeats on writes |
| `GET` `POST` | `/api/transactions` | List (filtered, sorted, paginated) and create |
| `GET` `PATCH` `DELETE` | `/api/transactions/:id` | Read, update and remove a transaction |
| `GET` `POST` `PUT` | `/api/budgets` | Monthly budgets, with the amount already spent |
| `GET` `PATCH` `DELETE` | `/api/budgets/:id` | Read, update and remove a budget |
| `GET` | `/api/categories` | The category taxonomy |
| `GET` | `/api/analytics/summary` | Balance, income, expenses, savings rate |
| `GET` | `/api/analytics/cashflow` | Income/expense series over a range |
| `GET` | `/api/analytics/categories` | Spend per category with share of total |
| `GET` | `/api/analytics/merchants` | Merchants ranked by spend |

Everything under `/api/transactions`, `/api/budgets` and `/api/analytics` needs a
session; a request without one is a `401`.

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

1. Recurring transactions and import from bank statements.
2. Budget periods beyond monthly, and per-category rollover.
3. Real-time updates (server-sent events) for the dashboard.
4. Password reset and email verification.
