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

## Deploy

### Backend on Render

Create a Render PostgreSQL database and a Blueprint/Web Service from this
repository. The included `render.yaml` uses `server` as the service root,
builds Prisma and TypeScript, applies committed migrations on startup, and
exposes `/api/health` as the health check.

Set these Render environment variables:

```text
DATABASE_URL=<Render PostgreSQL connection string>
DIRECT_URL=<direct PostgreSQL connection string; use DATABASE_URL if no separate URL is provided>
JWT_SECRET=<long random secret>
CORS_ORIGIN=https://<your-vercel-project>.vercel.app
```

After the service is live, verify:
`https://<your-render-service>.onrender.com/api/health`

### Frontend on Vercel

Import the repository into Vercel and set the project root directory to
`client`. Vercel will use the client build script and the included
`client/vercel.json` will preserve client-side routes after refresh.

Set this Vercel environment variable for Production:

```text
VITE_API_URL=https://<your-render-service>.onrender.com/api
```

Redeploy the frontend after setting the variable. Then update Render's
`CORS_ORIGIN` with the final Vercel URL if it changed from the preview URL.

 