import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { buildMeta } from "../lib/pagination";
import { requireAuth, requireRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../errors";
import {
  createCustomerSchema,
  customerListQuerySchema,
  createFollowUpSchema,
  updateCustomerSchema,
} from "../validators/customer.schema";

const router = Router();

// Every customer endpoint requires a valid token.
router.use(requireAuth);

/**
 * GET /api/customers
 * Query: q|search, status, type, page, limit (default 10)
 * Search is case-insensitive "contains" across name, mobile and businessName.
 * 200 -> { data: [...], meta: { page, limit, total, totalPages } }
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = customerListQuerySchema.parse(req.query);
    const searchTerm = query.search ?? query.q;

    const where: Prisma.CustomerWhereInput = {
      AND: [
        searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { mobile: { contains: searchTerm, mode: "insensitive" } },
                { businessName: { contains: searchTerm, mode: "insensitive" } },
              ],
            }
          : {},
        query.status ? { status: query.status } : {},
        query.type ? { type: query.type } : {},
      ],
    };

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.customer.count({ where }),
    ]);

    res.status(200).json({
      data: customers,
      meta: buildMeta(query.page, query.limit, total),
    });
  })
);

/**
 * POST /api/customers
 * RBAC: ADMIN, SALES
 * 201 -> { success: true, data: { customer } }
 */
router.post(
  "/",
  requireRoles("ADMIN", "SALES"),
  validate(createCustomerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body;
    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        mobile: body.mobile,
        businessName: body.businessName ?? null,
        type: body.type,
        status: body.status,
        address: body.address ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        followUpDate: body.followUpDate ?? null,
      },
    });
    res.status(201).json({ success: true, data: { customer } });
  })
);

/**
 * GET /api/customers/:id
 * Includes the customer's follow-ups and related counts.
 * 404 when the customer does not exist.
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customerId = String(req.params.id);
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        followUps: { orderBy: { date: "desc" } },
        _count: { select: { followUps: true, challans: true } },
      },
    });
    if (!customer) {
      throw new AppError(404, "Customer not found");
    }
    res.status(200).json({ success: true, data: { customer } });
  })
);

/**
 * PUT /api/customers/:id
 * RBAC: ADMIN, SALES
 * Partial update; 404 when the customer does not exist.
 */
router.put(
  "/:id",
  requireRoles("ADMIN", "SALES"),
  validate(updateCustomerSchema),
  asyncHandler(async (req, res) => {
    const customerId = String(req.params.id);
    const existing = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError(404, "Customer not found");
    }

    const body = req.body;
    const data = {} as Parameters<typeof prisma.customer.update>[0]["data"];
    if (body.name !== undefined) data.name = body.name;
    if (body.mobile !== undefined) data.mobile = body.mobile;
    if (body.businessName !== undefined) data.businessName = body.businessName;
    if (body.type !== undefined) data.type = body.type;
    if (body.status !== undefined) data.status = body.status;
    if (body.address !== undefined) data.address = body.address;
    if (body.city !== undefined) data.city = body.city;
    if (body.state !== undefined) data.state = body.state;
    if (body.followUpDate !== undefined) data.followUpDate = body.followUpDate;

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data,
    });
    res.status(200).json({ success: true, data: { customer } });
  })
);

/**
 * POST /api/customers/:id/follow-ups
 * RBAC: ADMIN, SALES
 * Creates a follow-up record for the customer.
 * 404 when the customer does not exist.
 */
router.post(
  "/:id/follow-ups",
  requireRoles("ADMIN", "SALES"),
  validate(createFollowUpSchema),
  asyncHandler(async (req, res) => {
    const customerId = String(req.params.id);
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new AppError(404, "Customer not found");
    }

    const body = req.body;
    const [followUp] = await prisma.$transaction([
      prisma.followUp.create({
        data: {
          customerId,
          date: body.date,
          note: body.note,
          status: body.status,
        },
      }),
      // Keep the customer's quick "next follow-up" date in sync with the
      // earliest still-pending follow-up.
      prisma.customer.update({
        where: { id: customerId },
        data: { followUpDate: body.date },
      }),
    ]);

    res.status(201).json({ success: true, data: { followUp } });
  })
);

export default router;