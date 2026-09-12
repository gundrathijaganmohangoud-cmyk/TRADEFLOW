import { Router } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { buildMeta } from "../lib/pagination";
import { requireAuth, requireRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../errors";
import {
  createProductSchema,
  productListQuerySchema,
  updateProductSchema,
} from "../validators/product.schema";

const router = Router();

// Every product endpoint requires a valid token.
router.use(requireAuth);

/** A product is "low stock" when currentStock <= minStock. */
function withLowStockFlag<T extends { currentStock: number; minStock: number }>(product: T) {
  return { ...product, isLowStock: product.currentStock <= product.minStock };
}

async function findDuplicateSku(sku: string): Promise<boolean> {
  const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
  return existing !== null;
}

function toConflictIfDuplicateSku(error: unknown, sku: string): never {
  if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError(409, `Product with SKU "${sku}" already exists`);
  }
  throw error;
}

/**
 * GET /api/products
 * Query: q|search (name/sku contains), lowStock=true (currentStock <= minStock), page, limit
 * 200 -> { data: [...{ ..., isLowStock }], meta: { page, limit, total, totalPages } }
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = productListQuerySchema.parse(req.query);
    const searchTerm = query.search ?? query.q;

    const where = searchTerm
      ? {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" as const } },
            { sku: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }
      : {};

    if (query.lowStock) {
      // Prisma cannot compare two columns of the same row in a where filter,
      // so the low-stock predicate (currentStock <= minStock) is applied in
      // memory and pagination is done on the filtered result.
      const matches = await prisma.product.findMany({ where, orderBy: { createdAt: "desc" } });
      const lowStockProducts = matches.filter(
        (product: { currentStock: number; minStock: number }) =>
          product.currentStock <= product.minStock
      );
      const total = lowStockProducts.length;
      const data = lowStockProducts
        .slice((query.page - 1) * query.limit, query.page * query.limit)
        .map(withLowStockFlag);

      res.status(200).json({
        success: true,
        data,
        meta: buildMeta(query.page, query.limit, total),
      });
      return;
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: products.map(withLowStockFlag),
      meta: buildMeta(query.page, query.limit, total),
    });
  })
);

/**
 * POST /api/products
 * RBAC: ADMIN, WAREHOUSE
 * Duplicate SKU -> 409.
 * 201 -> { success: true, data: { product (with isLowStock) } }
 */
router.post(
  "/",
  requireRoles("ADMIN", "WAREHOUSE"),
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      sku: string;
      name: string;
      description?: string;
      unitPrice: number;
      currentStock: number;
      minStock: number;
    };

    if (await findDuplicateSku(body.sku)) {
      throw new AppError(409, `Product with SKU "${body.sku}" already exists`);
    }

    try {
      const product = await prisma.product.create({
        data: {
          sku: body.sku,
          name: body.name,
          description: body.description ?? null,
          unitPrice: body.unitPrice,
          currentStock: body.currentStock,
          minStock: body.minStock,
        },
      });
      res.status(201).json({ success: true, data: { product: withLowStockFlag(product) } });
    } catch (error) {
      toConflictIfDuplicateSku(error, body.sku);
    }
  })
);

/**
 * PUT /api/products/:id
 * RBAC: ADMIN, WAREHOUSE
 * Partial update; duplicate SKU -> 409; unknown id -> 404.
 */
router.put(
  "/:id",
  requireRoles("ADMIN", "WAREHOUSE"),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const productId = String(req.params.id);
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new AppError(404, "Product not found");
    }

    const body = req.body as Partial<{
      sku: string;
      name: string;
      description?: string;
      unitPrice: number;
      currentStock: number;
      minStock: number;
    }>;

    if (body.sku !== undefined && body.sku !== existing.sku && (await findDuplicateSku(body.sku))) {
      throw new AppError(409, `Product with SKU "${body.sku}" already exists`);
    }

    const data: {
      sku?: string;
      name?: string;
      description?: string;
      unitPrice?: number;
      currentStock?: number;
      minStock?: number;
    } = {};
    if (body.sku !== undefined) data.sku = body.sku;
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.unitPrice !== undefined) data.unitPrice = body.unitPrice;
    if (body.currentStock !== undefined) data.currentStock = body.currentStock;
    if (body.minStock !== undefined) data.minStock = body.minStock;

    try {
      const product = await prisma.product.update({
        where: { id: productId },
        data,
      });
      res.status(200).json({ success: true, data: { product: withLowStockFlag(product) } });
    } catch (error) {
      toConflictIfDuplicateSku(error, body.sku ?? existing.sku);
    }
  })
);

export default router;