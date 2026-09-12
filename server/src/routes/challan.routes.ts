import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { buildMeta } from "../lib/pagination";
import { requireAuth, requireRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../errors";
import { challanListQuerySchema, createChallanSchema, ChallanItemInput } from "../validators/challan.schema";
import {
  cancelChallan,
  challanDetailInclude,
  confirmChallan,
  createChallan,
  updateDraftChallan,
} from "../services/challan.service";

const router = Router();

// Every challan endpoint requires a valid token.
router.use(requireAuth);

/**
 * GET /api/challans
 * Query: status (DRAFT|CONFIRMED|CANCELLED), page, limit
 * Includes customer summary + item snapshots.
 * 200 -> { data: [...], meta: { page, limit, total, totalPages } }
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = challanListQuerySchema.parse(req.query);

    const where = query.status ? { status: query.status } : {};

    const [challans, total] = await prisma.$transaction([
      prisma.challan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: challanDetailInclude,
      }),
      prisma.challan.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: challans,
      meta: buildMeta(query.page, query.limit, total),
    });
  })
);

/**
 * GET /api/challans/:id
 * Full detail including items and customer.
 * 404 when the challan does not exist.
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const challanId = String(req.params.id);
    const challan = await prisma.challan.findUnique({
      where: { id: challanId },
      include: challanDetailInclude,
    });
    if (!challan) {
      throw new AppError(404, "Challan not found");
    }
    res.status(200).json({ success: true, data: { challan } });
  })
);

/**
 * POST /api/challans
 * RBAC: ADMIN, SALES
 * Body: { customerId, items: [{ productId, quantity }], status: "DRAFT" | "CONFIRMED" (default DRAFT) }
 *
 * - validates quantity >= 1 (Zod)
 * - loads products server-side and stores immutable item snapshots
 * - computes total_quantity and total_amount
 * - generates challan_number CH-YYYYMMDD-#### (count of challans created today + 1,
 *   retried on unique violation)
 * - when status = CONFIRMED the confirm flow runs inline
 */
router.post(
  "/",
  requireRoles("ADMIN", "SALES"),
  validate(createChallanSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      customerId: string;
      items: ChallanItemInput[];
      status: "DRAFT" | "CONFIRMED";
    };

    const challan = await createChallan(
      { customerId: body.customerId, items: body.items, status: body.status },
      req.user!.id
    );

    res.status(201).json({ success: true, data: { challan } });
  })
);

/**
 * PUT /api/challans/:id
 * RBAC: ADMIN, SALES
 * Only DRAFT challans can be edited -> otherwise 409.
 * Body: { customerId?, items?: [{ productId, quantity }] }
 */
router.put(
  "/:id",
  requireRoles("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const challanId = String(req.params.id);
    const body = req.body as { customerId?: string; items?: ChallanItemInput[] };

    if (body.customerId === undefined && body.items === undefined) {
      throw new AppError(400, "Provide at least one of customerId or items to update");
    }

    const challan = await updateDraftChallan(challanId, body);
    res.status(200).json({ success: true, data: { challan } });
  })
);

/**
 * POST /api/challans/:id/confirm
 * RBAC: ADMIN, SALES, WAREHOUSE
 *
 * Uses a prisma.$transaction with SELECT ... FOR UPDATE on the challan row and
 * all product rows; verifies stock, decrements it, writes OUT movements
 * (reason "Challan {number} confirmed") and sets status CONFIRMED + confirmedAt.
 */
router.post(
  "/:id/confirm",
  requireRoles("ADMIN", "SALES", "WAREHOUSE"),
  asyncHandler(async (req, res) => {
    const challanId = String(req.params.id);
    const challan = await confirmChallan(challanId, req.user!.id);
    res.status(200).json({ success: true, data: { challan } });
  })
);

/**
 * POST /api/challans/:id/cancel
 * RBAC: ADMIN, SALES
 * - CONFIRMED -> restores stock, writes IN movements
 *               (reason "Challan {number} cancelled"), sets CANCELLED
 * - DRAFT     -> sets CANCELLED directly
 * - CANCELLED -> 409
 */
router.post(
  "/:id/cancel",
  requireRoles("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const challanId = String(req.params.id);
    const challan = await cancelChallan(challanId, req.user!.id);
    res.status(200).json({ success: true, data: { challan } });
  })
);

export default router;