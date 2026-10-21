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

## Source map

```
src/
├── components/
│   ├── charts/       Sparkline and chart primitives
│   ├── dashboard/    Dashboard composites (StatCard, SpendingChart, …)
│   ├── layout/       AppShell, Sidebar, Topbar, PageHeader, navigation config
│   └── ui/           Button, Card, Input, Select, Modal, Badge, Toggle, Skeleton,
│                     EmptyState, ErrorState, ProgressBar, SegmentedControl
├── config/           env.ts (build-time config), app-config.tsx (runtime toggles)
├── data/mock/        Sample ledger, categories, budgets + the derivation layer
├── hooks/            useAsyncData, useCategories, useDashboardData, useMediaQuery
├── lib/              cn(), formatting helpers
├── pages/            Dashboard, Transactions, Budgets, Analytics, Settings, NotFound
├── routes/           Router configuration with lazy-loaded pages
├── services/         SpendlyApi contract, mock client, HTTP client
└── types/            Domain model shared by every layer
```

## Conventions

* **One data seam.** Components use `useAsyncData` against the `SpendlyApi` interface.
  Swap `services/index.ts` to change the source; no component changes.
* **Coherent sample data.** `data/mock/analytics.ts` derives every series from a single
  ledger, so totals match across the dashboard, transactions and budgets screens.
* **Honest states.** Loading uses skeletons, empty states explain what would appear
  there, and error states always offer a retry. The Settings screen can simulate API
  failures so these paths can be reviewed before the backend exists.
* **Accessible by default.** Labelled controls, focus-trapped modals, semantic landmarks,
  a skip link, and a global `prefers-reduced-motion` override.
