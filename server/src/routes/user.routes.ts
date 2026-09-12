import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../errors";
import { createUserSchema } from "../validators/user.schema";

const router = Router();

// The entire users module is ADMIN-only.
router.use(requireAuth, requireRoles("ADMIN"));

/**
 * GET /api/users
 * RBAC: ADMIN
 * Lists all users (password hashes are never returned).
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(200).json({ success: true, data: users });
  })
);

/**
 * POST /api/users
 * RBAC: ADMIN
 * Body: { name, email, password, role }
 * Duplicate email -> 409.
 * 201 -> { success: true, data: { user } }
 */
router.post(
  "/",
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      name: string;
      email: string;
      password: string;
      role: "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";
    };

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, "A user with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    try {
      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          password: hashedPassword,
          role: body.role,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      res.status(201).json({ success: true, data: { user } });
    } catch (error) {
      if (
        error instanceof Object &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new AppError(409, "A user with this email already exists");
      }
      throw error;
    }
  })
);

export default router;