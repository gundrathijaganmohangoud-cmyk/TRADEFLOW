# TradeFlow

TradeFlow is an ERP/CRM portal for managing customers, inventory, stock
movements, and delivery challans, with role-based access for **ADMIN**,
**SALES**, **WAREHOUSE**, and **ACCOUNTS** users.

- **Frontend (`client/`)** — React 18 + Vite + TypeScript + React Router
- **Backend (`server/`)** — Node.js + Express 5 + TypeScript + Prisma (PostgreSQL)
- **Auth** — JWT bearer tokens (24 h), bcrypt-hashed passwords, role guards on
  the API and in the UI

## Features

| Area | Highlights |
| --- | --- |
| Customers | Searchable/paginated CRM list, create/update, follow-up notes and dates |
| Products | SKU catalog with unit price, current/min stock, low-stock flagging, duplicate-SKU protection (409) |
| Stock | IN/OUT movement ledger; OUT movements guarded by available stock |
| Challans | Draft → confirm → cancel lifecycle; confirm decrements stock atomically with row locking (`SELECT ... FOR UPDATE`); cancel restores it |
| Users | ADMIN-only user management (create with roles) |
| Auth | Login + `/api/auth/me`; field-level validation errors from Zod |

### Who can do what (RBAC)

| Area | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
| --- | :-: | :-: | :-: | :-: |
| Customers read | ✅ | ✅ | ✅ | ✅ |
| Customers write + follow-ups | ✅ | ✅ | ❌ | ❌ |
| Products / Stock read | ✅ | ✅ | ✅ | ✅ |
| Products / Stock write | ✅ | ❌ | ✅ | ❌ |
| Challans read | ✅ | ✅ | ✅ | ✅ |
| Challans create/update/cancel | ✅ | ✅ | ❌ | ❌ |
| Challan confirm | ✅ | ✅ | ✅ | ❌ |
| Users | ✅ | ❌ | ❌ | ❌ |

## Project structure

```
├── client/                 # Vite + React frontend
│   ├── src/api.ts          # Fetch wrapper + typed API functions
│   ├── src/auth.tsx        # Auth context + role-guarded routes
│   ├── src/pages/          # Login, Customers, Challans, Products, Stock, Users
│   └── vercel.json         # SPA rewrites for client-side routing
├── server/                 # Express + Prisma API
│   ├── prisma/             # schema.prisma, migrations, seed.ts
│   └── src/                # routes, services, validators, middleware
└── render.yaml             # Render Blueprint for the backend
```

## Run locally

### 1. Prerequisites

- Node.js 18+
- A PostgreSQL database (local Docker or Neon)

### 2. Install dependencies

```powershell
npm --prefix client install
npm --prefix server install
```

### 3. Configure environment

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

`server/.env` (full reference in `server/.env.example`):

```text
DATABASE_URL=<PostgreSQL connection string used at runtime>
DIRECT_URL=<non-pooled string used by Prisma Migrate>
JWT_SECRET=<long random secret>
PORT=4000
CORS_ORIGIN=http://localhost:5173
```

`client/.env`:

```text
VITE_API_URL=http://localhost:4000/api
```

Docker one-liner for a local database:

```powershell
docker run -d --name tradeflow-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tradeflow -p 5432:5432 postgres:16
```

### 4. Validate, migrate and seed

```powershell
npm run prisma:validate
npm run prisma:migrate
npm run seed
```

### 5. Start the dev servers (separate terminals)

```powershell
npm run dev:server   # API -> http://localhost:4000
npm run dev:client   # UI  -> http://localhost:5173
```

API health check: `http://localhost:4000/api/health`

### Seeded demo accounts

| Email | Password | Role |
| --- | --- | --- |
| admin@erp.com | Admin@123 | ADMIN |
| sales@erp.com | Sales@123 | SALES |
| warehouse@erp.com | Warehouse@123 | WAREHOUSE |
| accounts@erp.com | Accounts@123 | ACCOUNTS |

Seed also creates 5 customers and 8 products (`RICE-50KG` and `WHEAT-50KG` are
intentionally below their minimum stock). No challans are seeded, so the first
challan becomes `CH-YYYYMMDD-0001`.

### Production build

```powershell
npm run build
```

## Deploy

Stack: **Neon** (PostgreSQL) + **Render** (API) + **Vercel** (frontend).

### 1. Database on Neon

1. Create a project at [neon.tech](https://neon.tech) and open its connection details.
2. Copy the **pooled** connection string (host contains `-pooler`) — this becomes `DATABASE_URL`.
3. Copy the same string and **remove `-pooler`** from the host — this becomes `DIRECT_URL`
   (Prisma Migrate needs a non-pooled connection for the shadow database).

Optional pre-check before touching Render — paste both strings at the top of
`server/deploy-check.ps1` and run it to verify the connection and apply migrations:

```powershell
powershell -ExecutionPolicy Bypass -File server\deploy-check.ps1
```

### 2. Backend on Render

Create a Blueprint/Web Service from this repository. The included `render.yaml`
uses `server` as the service root, builds Prisma + TypeScript, applies committed
migrations on startup (`npx prisma migrate deploy`), and exposes `/api/health`
as the health check.

Set these Render environment variables:

```text
DATABASE_URL=<Neon pooled connection string>
DIRECT_URL=<Neon direct connection string (no -pooler)>
JWT_SECRET=<long random secret>
CORS_ORIGIN=https://<your-vercel-project>.vercel.app
```

`CORS_ORIGIN` accepts several origins separated by commas (production URL plus
Vercel preview URLs).

After the service is live, verify:
`https://<your-render-service>.onrender.com/api/health`

### 3. Frontend on Vercel

1. Import the repository into Vercel and set the **Root Directory** to `client`.
2. Add the Production environment variable:

   ```text
   VITE_API_URL=https://<your-render-service>.onrender.com/api
   ```

3. Redeploy after setting the variable so it is baked into the build.

`client/vercel.json` rewrites all routes to `index.html`, so deep links survive
a page refresh.

### 4. Wire up CORS

Update Render's `CORS_ORIGIN` with the final Vercel URL (if it differs from the
preview URL used in step 2) and save — Render restarts the service automatically.

### Post-deploy checklist

- `https://<render-service>.onrender.com/api/health` returns `{"success":true,...}`
- Login at the Vercel URL works with `admin@erp.com` / `Admin@123`
- Confirming a challan decrements stock; cancelling restores it
