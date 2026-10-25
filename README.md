# Spendly

A premium, dark-themed expense tracking web application — a React dashboard on top of a
real Express + MongoDB backend with real-time Socket.IO synchronization.

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
| Real-time | Socket.IO 4 (WebSockets, user-isolated rooms, automatic reconnect recovery) |
| Tests | Node test runner · Supertest · mongodb-memory-server |

## Architecture

```
┌──────────────────────────────────────────────┐
│            Vercel Edge Network               │
│   React 19 SPA (@spendly/client + Vite)      │
└──────────────────────┬───────────────────────┘
                       │ HTTPS REST (/api) & WSS (/socket.io)
                       ▼
┌──────────────────────────────────────────────┐
│     Node.js Host (Render / Railway / Docker) │
│       Express 5 + Socket.IO Server           │
│  - Session Auth & CSRF Protection            │
│  - Rate Limiting & Helmet Headers            │
│  - User-Isolated Private Rooms (user:<id>)   │
└──────────────────────┬───────────────────────┘
                       │ TLS Mongoose Connection
                       ▼
┌──────────────────────────────────────────────┐
│           MongoDB Atlas Cluster              │
│  - Users, Sessions, Transactions, Budgets    │
│  - Compound Unique Indexes                   │
└──────────────────────────────────────────────┘
```

## Repository layout

```
spendly/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/          # Sign-in and sign-up shell
│   │   │   ├── charts/        # Sparkline and other chart primitives
│   │   │   ├── dashboard/     # Dashboard-specific composites
│   │   │   ├── layout/        # App shell, sidebar, top bar, page header
│   │   │   └── ui/            # Reusable primitives (Button, Card, Modal, Input…)
│   │   ├── auth/              # Auth context, provider and route guards
│   │   ├── config/            # Runtime config + app-level toggles
│   │   ├── data/mock/         # Sample data — isolated from the API contract
│   │   ├── hooks/             # useAsyncData, useCategories, useMediaQuery…
│   │   ├── lib/               # cn() and formatting helpers
│   │   ├── pages/             # Route-level screens (Dashboard, Transactions, Budgets, Analytics, Settings)
│   │   ├── realtime/          # Socket.IO client, context, reconnection recovery & status badge
│   │   ├── routes/            # Router configuration
│   │   ├── services/          # Data-source seam (mock ⇄ HTTP)
│   │   └── types/             # Shared domain model
│   ├── .env.example
│   └── vercel.json            # Vercel SPA routing rewrites & security headers
├── server/                    # Express + MongoDB API
│   ├── src/
│   │   ├── config/            # Environment parsing and MongoDB connection
│   │   ├── constants/         # Category taxonomy and shared enumerations
│   │   ├── models/            # Mongoose schemas (User, Session, Transaction, Budget)
│   │   ├── services/          # Data access, reporting window & aggregations
│   │   ├── controllers/       # HTTP handlers
│   │   ├── routes/            # Express route tables
│   │   ├── middleware/        # Validation, database guard, auth, CSRF, rate limiting
│   │   ├── validators/        # Zod request schemas
│   │   ├── utils/             # Response envelope, pagination, ApiError
│   │   ├── socket.ts          # Socket.IO server, session auth & event dispatchers
│   │   ├── test/              # Integration tests
│   │   ├── app.ts             # Express app factory
│   │   └── index.ts           # Server bootstrap & graceful shutdown
│   ├── .env.example
│   └── Procfile               # Process file for hosting providers
├── vercel.json                # Monorepo Vercel configuration
├── render.yaml                # Render Blueprint configuration
├── Dockerfile                 # Multi-stage production container
└── Procfile                   # Root process file
```

## Local Development

```bash
npm install            # Installs client and server workspaces
cp server/.env.example server/.env
# Add your MongoDB Atlas connection string to server/.env

npm run dev            # Starts Vite dev server on http://localhost:5173
npm run dev:server     # Starts Express API on http://localhost:4000
```

Available scripts:

```bash
npm run typecheck      # tsc typecheck for both client and server
npm run test           # Server integration tests (in-memory MongoDB, 163 tests)
npm run build          # Production build for both client and server
npm run build:client   # Build frontend only (client/dist)
npm run build:server   # Build backend only (server/dist)
npm run preview        # Preview the built frontend locally
npm run start:server   # Run the compiled backend (node server/dist/index.js)
npm run seed           # Seed default category taxonomy into MongoDB
```

---

## Production Deployment Guide

Spendly is architected for a modern two-tier deployment:
* **Frontend**: Hosted on **Vercel** as a high-performance Edge-cached static Single Page Application.
* **Backend**: Hosted on a persistent Node.js runtime such as **Render**, **Railway**, **Fly.io**, or **Docker** (AWS/GCP/DigitalOcean).

> [!IMPORTANT]
> **Why the Backend Requires a Persistent Node Service**
> Spendly provides real-time state synchronization via **Socket.IO**. Vercel Serverless / Edge Functions are ephemeral and terminate after each request; they do **not** support persistent bidirectional WebSocket connections. Therefore, the backend must run as a long-running Node.js process.

### Step 1: MongoDB Atlas Setup

1. Create a free or dedicated cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Security → Database Access**, create a user with `Read and write to any database` privileges.
3. Under **Security → Network Access**, add an IP access entry:
   - To allow connections from hosted platforms (Render/Railway), add `0.0.0.0/0` (Allow access from anywhere).
4. Click **Connect → Drivers → Node.js** to copy your connection string:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=Spendly
   ```

### Step 2: Deploy Backend to Render (or Railway / Fly.io / Docker)

#### Option A: Using Render
1. Create an account on [Render](https://render.com) and click **New → Web Service**.
2. Connect your GitHub repository (`Spendly`).
3. Configure the service settings:
   - **Name**: `spendly-api`
   - **Language**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build:server`
   - **Start Command**: `npm run start:server`
   - **Health Check Path**: `/api/health`
4. Add the **Environment Variables** (see table below).
5. Click **Create Web Service**. Once deployed, note your service URL (e.g. `https://spendly-api.onrender.com`).
6. In the Render Shell (or locally with the production URI), run the one-time taxonomy seed:
   ```bash
   npm run seed:categories --workspace server
   ```

#### Option B: Using Docker
Build and run the included multi-stage `Dockerfile`:
```bash
docker build -t spendly-api .
docker run -p 4000:4000 -e MONGODB_URI="mongodb+srv://..." -e CORS_ORIGINS="https://spendly.vercel.app" spendly-api
```

### Step 3: Deploy Frontend to Vercel

1. Create an account on [Vercel](https://vercel.com) and click **Add New → Project**.
2. Import your GitHub repository (`Spendly`).
3. Configure project build settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Leave as `./` (or select `client` if deploying client only)
   - **Build Command**: `npm run build:client` (or `npm run build` if root is `client`)
   - **Output Directory**: `client/dist` (or `dist` if root is `client`)
4. Set the **Environment Variables**:
   - `VITE_DATA_SOURCE`: `api`
   - `VITE_API_BASE_URL`: `https://spendly-api.onrender.com/api` (your backend URL + `/api`)
   - `VITE_SOCKET_URL`: `https://spendly-api.onrender.com` (your backend URL)
5. Click **Deploy**. Vercel will build the frontend with the included `vercel.json` rewrites and deploy it (e.g. `https://spendly.vercel.app`).

### Step 4: Configure Production CORS & Cookies

Because the frontend (`https://spendly.vercel.app`) and backend (`https://spendly-api.onrender.com`) are on different domains:
1. In your backend environment settings, set:
   - `CORS_ORIGINS`: `https://spendly.vercel.app` (include your custom domain if applicable)
   - `COOKIE_SAMESITE`: `none` (required by browsers for cross-site authenticated cookies)
   - `COOKIE_SECURE`: `true` (enforces HTTPS delivery required by `SameSite=None`)
2. Save and redeploy the backend service.

---

## Environment Variables Reference

### Frontend (`client`)

| Variable | Required in Prod | Description | Example |
| --- | :---: | --- | --- |
| `VITE_DATA_SOURCE` | **Yes** | Data source mode (`api` for production, `mock` for local preview) | `api` |
| `VITE_API_BASE_URL` | **Yes** | Base endpoint for the Express API | `https://spendly-api.onrender.com/api` |
| `VITE_SOCKET_URL` | Optional | Socket.IO endpoint (defaults to origin of `VITE_API_BASE_URL`) | `https://spendly-api.onrender.com` |

### Backend (`server`)

| Variable | Required in Prod | Default | Description |
| --- | :---: | --- | --- |
| `NODE_ENV` | **Yes** | `development` | Set to `production` |
| `PORT` | Optional | `4000` | Port assigned by hosting environment |
| `MONGODB_URI` | **Yes** | _none_ | MongoDB Atlas connection string (MANDATORY in production) |
| `MONGODB_DB_NAME` | Optional | `spendly` | MongoDB database name |
| `CORS_ORIGINS` | **Yes** | `http://localhost:5173` | Comma-separated allowed frontend origins |
| `COOKIE_SAMESITE` | **Yes** | `lax` | Set to `none` for cross-domain production deployment |
| `COOKIE_SECURE` | **Yes** | `true` in prod | Set to `true` (mandatory for HTTPS / `SameSite=none`) |
| `COOKIE_DOMAIN` | Optional | _none_ | Domain for cookie scoping (e.g. `.spendly.com`) |
| `SESSION_TTL_MS` | Optional | `604800000` | Session lifetime (7 days) |
| `BCRYPT_ROUNDS` | Optional | `12` | Password hashing complexity factor |
| `MAX_PAGE_SIZE` | Optional | `100` | Max page size limit on paginated queries |
| `LOGIN_RATE_LIMIT`| Optional | `20` | Max sign-in attempts per IP per window |
| `RATE_LIMIT_WINDOW_MS` | Optional | `900000` | Rate limit window (15 minutes) |

---

## Real-time Synchronization (Socket.IO)

Spendly provides instantaneous real-time synchronization between browser tabs and devices via Socket.IO:

* **Authenticated private rooms:** When a user signs in, their socket joins a private room (`user:<userId>`). Only transactions belonging to that user are dispatched to that room.
* **Database as source of truth:** Mutations (creates, updates, deletes) are persisted to MongoDB first. Successful writes emit `transaction-created`, `transaction-updated`, or `transaction-deleted` events. Failed database writes never emit mutation events.
* **Automatic client recovery:** When receiving mutation events, connected clients invalidate their local cache revision and refresh transactions, dashboard summary cards, spending charts, and budget progress without a full-page reload.
* **Deduplication & reconnect resilience:** Unique event IDs prevent duplicate execution, and reconnection listeners automatically re-sync state against the REST API.
* **Live status indicator:** The top navigation bar displays real-time connection status (`Live`, `Syncing…`, or `Offline`).
* **Clustered deployments:** In production clusters running multiple backend instances behind a load balancer, a distributed adapter such as `@socket.io/redis-adapter` (with Redis Pub/Sub or Streams) or `@socket.io/mongo-adapter` is required to share events across nodes.

## Security & Reliability Controls

* **HTTP Security Headers:** Protected with `helmet` on the backend and strict security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`) on the frontend.
* **Cookie-Based Authentication:** HTTP-only, hardened session cookies. Passwords are salted and hashed with `bcrypt`.
* **CSRF Defense:** Double-submit CSRF cookie token verified on all mutation endpoints (`POST`, `PUT`, `PATCH`, `DELETE`).
* **Input Validation:** Strict Zod schema validation for all request bodies, queries, and parameters.
* **Safe Error Responses:** Centralized error handler masks internal database connection strings using `redactUri` and never exposes driver stack traces to clients.
* **Graceful Degradation:** `/api/health` probes report service and database readiness. Degraded database states respond with structured `503 DATABASE_UNAVAILABLE` rather than crashes or fabricated numbers.

## Accessibility & Responsive Design

* Full responsiveness across mobile, tablet, and desktop viewports.
* Accessible drawer navigation on mobile and fixed navigation rail on desktop.
* Semantic landmarks, skip-to-content links, and full keyboard navigation.
* Color tokens engineered for high contrast and readability on dark surfaces.
* `prefers-reduced-motion` respected across animated progress bars and transitions.
