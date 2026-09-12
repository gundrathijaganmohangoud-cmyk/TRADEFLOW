import { Router } from "express";
import authRouter from "./auth.routes";
import customerRouter from "./customer.routes";
import productRouter from "./product.routes";
import stockRouter from "./stock.routes";
import challanRouter from "./challan.routes";
import userRouter from "./user.routes";

export const apiRouter = Router();

/**
 * GET /api/health
 * Public liveness probe.
 */
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: { status: "ok", timestamp: new Date().toISOString() },
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/stock", stockRouter);
apiRouter.use("/challans", challanRouter);
apiRouter.use("/users", userRouter);