import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { buildMeta } from "../lib/pagination";
import { requireAuth, requireRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../errors";
import { createMovementSchema, movementListQuerySchema } from "../validators/stock.schema";

const router = Router();

// Every stock endpoint requires a valid token.
router.use(requireAuth);

const movementInclude = {
  product: { select: { id: true, sku: true, name: true, currentStock: true } },
  createdBy: { select: { id: true, name: true, email: true } },
};

/**
 * GET /api/stock/movements
 * Query: productId, type (IN|OUT), page, limit
 * 200 -> { data: [...], meta: { page, limit, total, totalPages } }
 */
router.get(
  "/movements",
  asyncHandler(async (req, res) => {
    const query = movementListQuerySchema.parse(req.query);

    const where = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [movements, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: movementInclude,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: movements,
      meta: buildMeta(query.page, query.limit, total),
    });
  })
);

/**
 * POST /api/stock/movements
 * RBAC: ADMIN, WAREHOUSE
 * Body: { productId, type: "IN" | "OUT", quantity, reason }
 *
 * Runs in ONE Prisma transaction:
 * 1. verify the product exists                -> 404 "Product not found"
 * 2. OUT: verify currentStock >= quantity     -> 409 "Insufficient stock for {sku} (requested X, available Y)"
 * 3. update the product's stock (IN +, OUT -)
 * 4. create the movement row (createdById from the JWT)
 */
router.post(
  "/movements",
  requireRoles("ADMIN", "WAREHOUSE"),
  validate(createMovementSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      productId: string;
      type: "IN" | "OUT";
      quantity: number;
      reason: string;
    };
    const createdById = req.user!.id;

    const movement = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const product = await tx.product.findUnique({ where: { id: body.productId } });
      if (!product) {
        throw new AppError(404, "Product not found");
      }

      if (body.type === "OUT" && product.currentStock < body.quantity) {
        throw new AppError(
          409,
          `Insufficient stock for ${product.sku} (requested ${body.quantity}, available ${product.currentStock})`
        );
      }

      await tx.product.update({
        where: { id: product.id },
        data: {
          currentStock:
            body.type === "IN"
              ? { increment: body.quantity }
              : { decrement: body.quantity },
        },
      });

      return tx.stockMovement.create({
        data: {
          productId: body.productId,
          type: body.type,
          quantity: body.quantity,
          reason: body.reason,
          createdById,
        },
        include: movementInclude,
      });
    });

    res.status(201).json({
      success: true,
      data: { movement, product: movement.product },
    });
  })
);

export default router;