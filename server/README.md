# TradeFlow API — ERP/CRM Portal Backend

Node.js + TypeScript + Express 5 + Prisma (PostgreSQL) backend implementing
authentication, customers/CRM follow-ups, inventory products, stock movements,
draft/confirm/cancel challans with row locking, and admin user management.

## Project layout

```
server/
├── prisma/
│   ├── schema.prisma          # Postgres schema (users, customers, products, stock, challans)
│   └── seed.ts                # Demo users, customers, products (idempotent)
├── src/
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── jwt.ts             # JWT sign/verify (24h, payload { id, role })
│   │   ├── asyncHandler.ts    # Forward async errors to the central handler
│   │   └── pagination.ts      # buildMeta({ page, limit, total, totalPages })
│   ├── middleware/
│   │   ├── auth.ts            # requireAuth (401) + requireRoles (403)
│   │   └── validate.ts        # Zod body validation (400 + errors[])
│   ├── validators/            # Zod schemas with human-readable messages
│   ├── services/
│   │   └── challan.service.ts # create/confirm/cancel challan logic
│   ├── routes/                # auth, customers, products, stock, challans, users, index
│   ├── errors.ts              # AppError + 404 + central error handler
│   └── app.ts                 # CORS, JSON, routes, 404, error handler
├── .env                       # local config (never commit real secrets)
└── .env.example
```

## Getting started

1. **Configure the database** — the stack targets PostgreSQL (required for
   `SELECT ... FOR UPDATE` and enum support). Edit `DATABASE_URL` in `server/.env`:

   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tradeflow?schema=public"
   ```

   If you have Docker, one-liner for a matching local database:

   ```
   docker run -d --name tradeflow-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tradeflow -p 5432:5432 postgres:16
   ```

2. **Install, migrate, seed** (from `server/`):

   ```
   npm install
   npx prisma migrate dev --name init
   npm run seed          # alias: npm run prisma:seed
   ```

3. **Run**:

   ```
   npm run dev           # ts-node-dev hot reload -> http://localhost:4000
   npm run build && npm start   # production build
   ```

Health check: `GET http://localhost:4000/api/health`

## Scripts

| Script | Command |
| --- | --- |
| `npm run dev` | `ts-node-dev --respawn --transpile-only src/app.ts` |
| `npm run build` | `tsc` |
| `npm start` | `node dist/src/app.js` |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run seed` / `npm run prisma:seed` | `prisma db seed` (`ts-node prisma/seed.ts`) |

## Seeded accounts

| Email | Password | Role |
| --- | --- | --- |
| admin@erp.com | Admin@123 | ADMIN |
| sales@erp.com | Sales@123 | SALES |
| warehouse@erp.com | Warehouse@123 | WAREHOUSE |
| accounts@erp.com | Accounts@123 | ACCOUNTS |

Seed also creates 5 customers (mixed type/status, one with a follow-up date
tomorrow) and 8 products — `RICE-50KG` and `WHEAT-50KG` are intentionally below
their minimum stock. No challans are seeded, so the first challan becomes
`CH-YYYYMMDD-0001`.

## RBAC matrix

All endpoints (except login/health) require `Authorization: Bearer <token>`.

| Endpoint | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
| --- | :-: | :-: | :-: | :-: |
| `POST /api/auth/login` | public | public | public | public |
| `GET /api/auth/me` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/customers`, `GET /api/customers/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/customers`, `PUT /api/customers/:id`, `POST /api/customers/:id/follow-ups` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/products` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/products`, `PUT /api/products/:id` | ✅ | ❌ | ✅ | ❌ |
| `GET /api/stock/movements` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/stock/movements` | ✅ | ❌ | ✅ | ❌ |
| `GET /api/challans`, `GET /api/challans/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/challans`, `PUT /api/challans/:id`, `POST /api/challans/:id/cancel` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/challans/:id/confirm` | ✅ | ✅ | ✅ | ❌ |
| `GET /api/users`, `POST /api/users` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/health` | public | public | public | public |

## API summary

- **Auth** — `POST /api/auth/login` → `200 {success:true, data:{token, user}}`
  or `401 {"success":false,"message":"Invalid credentials"}`; `GET /api/auth/me`.
- **Customers** — list (`?q|search`, `?status`, `?type`, `?page`, `?limit`,
  case-insensitive contains on name/mobile/businessName, response
  `{data, meta:{page,limit,total,totalPages}}`), create, get by id (includes
  `followUps` + `_count`), update, `POST /:id/follow-ups`.
- **Products** — list (`?q|search` on name/sku, `?lowStock=true` →
  `currentStock <= minStock`, every row carries `isLowStock`), create, update.
  Duplicate SKU → `409 {"success":false,"message":"Product with SKU \"X\" already exists"}`.
- **Stock** — `GET /api/stock/movements?productId=&type=&page=&limit=`;
  `POST /api/stock/movements` runs ONE transaction: product 404 check →
  OUT-stock guard `409 Insufficient stock for {sku} (requested X, available Y)`
  → stock update → movement row with `createdById` from the JWT.
- **Challans** — list (`?status`), create (`{customerId, items:[{productId,
  quantity}], status:"DRAFT"|"CONFIRMED"}`; server loads products, snapshots
  name/sku/unitPrice/lineTotal, computes totals, generates `CH-YYYYMMDD-####`
  from today's count + 1 with unique-violation retry; `CONFIRMED` runs the
  confirm flow inline), get by id (includes items), update (DRAFT only → else
  409), confirm (`prisma.$transaction` with `SELECT ... FOR UPDATE` on the
  challan and all product rows; first insufficient item → 409; decrements
  stock; OUT movements `"Challan {number} confirmed"`; sets `CONFIRMED` +
  `confirmedAt`), cancel (CONFIRMED → restores stock + IN movements
  `"Challan {number} cancelled"`; DRAFT → marked CANCELLED; already
  CANCELLED → 409).
- **Users** — ADMIN-only list + create (bcrypt-hashed, role required).

## Error format

Validation: `400 {"success":false,"message":"Validation failed","errors":[{"field":"email","message":"Email is required"}]}`
Business rules: `401/403/404/409 {"success":false,"message":"..."}`
Unexpected: `500 {"success":false,"message":"Internal server error"}` (no stack leaked)

## Quick test (after migrate + seed)

```
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@erp.com\",\"password\":\"Admin@123\"}"
```
