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
