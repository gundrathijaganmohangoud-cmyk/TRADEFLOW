# TradeFlow

TradeFlow is split into a Vite React frontend and an Express/Prisma backend.

## Run locally

Install dependencies in both packages:

```powershell
npm --prefix client install
npm --prefix server install
```

The backend reads its database and JWT settings from `server/.env`. Validate the
Prisma schema and apply migrations before the first run:

```powershell
npm run prisma:validate
npm run prisma:migrate
npm run seed
```

Start the two development servers in separate terminals:

```powershell
npm run dev:server
npm run dev:client
```

The frontend is available at `http://localhost:5173` and the API health check is
available at `http://localhost:4000/api/health`.

To build both applications:

```powershell
npm run build
```

 