# Spendly — client

React 19 + TypeScript + Vite 8 frontend for Spendly.

## Scripts

```bash
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the production bundle
npm run typecheck  # tsc --noEmit
```

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Base URL for the Express API (proxied to `localhost:4000` in dev) |
| `VITE_DATA_SOURCE` | `mock` | `mock` reads the bundled sample data, `api` reads the server |

### Running against the real API

```bash
npm run dev:server   # from the repository root: the API on :4000
npm run seed         # seed the category taxonomy
# client/.env.local → VITE_DATA_SOURCE=api
npm run dev          # the client on :5173
```

The app then requires an account: an anonymous visitor is sent to the sign-in
screen, and signing in stores a session in an HTTP-only cookie. Nothing is
written to `localStorage`.

## Source map

```
src/
├── components/
│   ├── charts/       Sparkline and chart primitives
│   ├── dashboard/    Dashboard composites (StatCard, SpendingChart, …)
│   ├── layout/       AppShell, Sidebar, Topbar, PageHeader, navigation config
│   ├── transactions/ TransactionForm, TransactionComposer, row actions, delete dialog
│   └── ui/           Button, Card, Input, Select, Modal, Badge, Toggle, Skeleton,
│                     EmptyState, ErrorState, ProgressBar, SegmentedControl, Toast
├── config/           env.ts (build-time config), app-config.tsx (runtime toggles)
├── data/mock/        Sample ledger, categories, budgets + the derivation layer
├── hooks/            useAsyncData, useCategories, useDashboardData, useMediaQuery,
│                     useDataRevision, useDebouncedValue
├── lib/              cn(), formatting helpers, form validation
├── pages/            Dashboard, Transactions, Budgets, Analytics, Settings, NotFound
├── routes/           Router configuration with lazy-loaded pages
├── services/         SpendlyApi contract, mock client, HTTP client
└── types/            Domain model shared by every layer
```

## Conventions

* **One data seam.** Components use `useAsyncData` against the `SpendlyApi` interface.
  Swap `services/index.ts` to change the source; no component changes.
* **One HTTP client.** `services/http.ts` is the only place that talks to the network:
  it unwraps the response envelope, sends the session cookie, repeats the CSRF token on
  writes, retries a request once with a fresh token when the server rejects the old one,
  and turns a `4xx` into an `ApiError` that carries the field-level issues a `422`
  reports.
* **Coherent sample data.** `data/mock/analytics.ts` derives every series from a single
  ledger, so totals match across the dashboard, transactions and budgets screens.
* **Honest states.** Loading uses skeletons, empty states explain what would appear
  there, and error states always offer a retry — a failed request never falls back to
  sample data.
* **Immediate updates.** A successful mutation raises a data revision; every
  `useAsyncData` hook that depends on it refetches, so the dashboard, the transaction
  list and the charts agree without a page reload.
* **Accessible by default.** Labelled controls, focus-trapped modals, semantic landmarks,
  a skip link, and a global `prefers-reduced-motion` override.

## The dashboard's reporting windows

`DashboardPage` holds two pieces of state: the window (`7d` · `30d` · `90d` · `12m` ·
`3y`) and the trend granularity (`day` · `week` · `month` · `year`).

* The window is sent to the API as `range`, the browser's zone as `tz`, and the
  granularity as `interval` — **the server resolves every boundary from those three**,
  so the client never sends a date range for the backend to trust, and no figure is
  computed twice.
* Changing the window resets the granularity only when the current one no longer fits it
  (`INTERVALS_BY_RANGE` / `DEFAULT_INTERVAL`): a three-year window cannot be read per day.
* Because the cards, the cashflow chart, the trend chart, the donut and the transaction
  list all read the **same** resolved window, their totals agree by construction — the
  cashflow buckets sum to the income and expense cards, and the series ends on the
  all-time balance shown by the hero card.
* A caption under the page header spells the window out in words — `Reporting period:
  Last 30 days · Sep 22 – Oct 21, 2026 · 30 days in Asia/Calcutta` — so "for a clearly
  defined date period" is never a guess.
* A successful mutation raises the data revision, and every figure recalculates without a
  reload.

Dates are rendered in the same zone the report was calculated in (`lib/timezone.ts`), and
money goes through `lib/format.ts`, which returns an em dash for a figure that cannot be
rendered instead of a misleading zero. `data/mock/analytics.ts` derives the same window,
buckets, totals and movements from one sample ledger, so the preview build behaves
identically without a database.

## Working with transactions

The same dialog creates and edits a transaction. It is opened through
`useTransactionComposer()`, so the top bar, the dashboard and the transactions list all
share one form:

```tsx
const { open } = useTransactionComposer()

open()            // create
open(transaction) // edit
```

The form validates the amount and the required fields before it sends anything, refuses
to submit twice while a request is in flight, and maps the field errors a `422`
reports back onto the matching inputs. A successful save shows a toast, closes the
dialog and refreshes the data behind it.

Filters on the transactions page live in the URL (`?search=`, `?category=`, `?type=`,
`?range=`), so a filtered view can be shared or reloaded.
