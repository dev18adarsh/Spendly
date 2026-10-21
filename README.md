# Spendly

A premium, dark-themed expense tracking web application.

This repository is the **foundation stage**: a production-quality frontend shell with a
clean backend scaffold, running on realistic sample data.

> **Nothing is persisted yet.** The UI reads from a bundled sample ledger, and the API
> exposes a health probe only. No data is written to MongoDB Atlas, and no transactions
> or budgets are saved anywhere.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite 8 |
| Styling | Tailwind CSS 4 (CSS-first `@theme` tokens) |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Backend | Node.js · Express 5 · TypeScript |
| Database | MongoDB Atlas (via Mongoose — connection scaffold only) |

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
└── server/                    # Express API scaffold
    ├── src/
    │   ├── config/            # Environment parsing
    │   ├── db/                # MongoDB Atlas connection helper
    │   ├── middleware/        # Error + not-found handlers
    │   ├── routes/            # Health probe (transaction routes planned)
    │   ├── app.ts             # Express app factory
    │   └── index.ts           # Server bootstrap
    └── .env.example
```

## Getting started

```bash
npm install          # installs the client and server workspaces
npm run dev          # starts the Vite dev server on http://localhost:5173
npm run dev:server   # starts the Express API on http://localhost:4000
```

Other scripts:

```bash
npm run typecheck    # tsc for both workspaces
npm run build        # production build for both workspaces
npm run preview      # preview the built client
npm run start:server # run the compiled API (after npm run build)
```

## How data flows

The UI never talks to a data source directly — it depends on the `SpendlyApi` interface
in `client/src/services/types.ts`:

```
components ─▶ useAsyncData ─▶ services/index.ts ─┬─▶ services/mock/client.ts   (today)
                                                 └─▶ services/http.ts          (next)
                                                        │
                                                        ▼
                                                  Express API → MongoDB Atlas
```

* **Today** the default source is the mock client, which serves the sample ledger in
  `client/src/data/mock/` with simulated latency so loading and error states are real.
* **Next** set `VITE_DATA_SOURCE=api` in `client/.env.local`. The HTTP client already
  speaks the final contract; the server routes listed in `server/src/routes/index.ts`
  are the remaining work.

Sample data is derived, not hand-tuned per screen: `client/src/data/mock/analytics.ts`
turns one ledger into every series, breakdown, summary and budget, so the dashboard,
transactions list and budgets page always agree with each other.

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

1. MongoDB Atlas connection + transaction/budget models.
2. The planned API routes (`/api/transactions`, `/api/summary`, `/api/analytics/*`, …).
3. Authentication, account linking and real transaction sync.
4. Editing, categorisation and budget CRUD against the API.
