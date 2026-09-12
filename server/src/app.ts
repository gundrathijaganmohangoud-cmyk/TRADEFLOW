import "dotenv/config";
import express from "express";
import cors from "cors";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./errors";

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// CORS - restricts browser clients to the configured frontend origin(s).
// CORS_ORIGIN may contain a single origin or multiple origins separated by
// commas (e.g. production + Vercel preview URLs).
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// JSON body parsing.
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api", apiRouter);

// 404 for anything that did not match a route (mounted after all routers).
app.use(notFoundHandler);

// Central error handler (must be registered last).
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Export + bootstrap
// ---------------------------------------------------------------------------

export { app };
export default app;

// Only start listening when this file is executed directly
// (not when the app is imported by tests or tooling).
if (require.main === module) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.log(`TradeFlow API listening on http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
  });
}