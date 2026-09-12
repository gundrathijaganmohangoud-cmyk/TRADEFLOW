import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../errors";
import { loginSchema } from "../validators/auth.schema";

const router = Router();

/**
 * Public shape of a user as returned by the API - the password hash
 * is never included.
 */
export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * 200 -> { success: true, data: { token, user } }
 * 401 -> { success: false, message: "Invalid credentials" }
 */
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new AppError(401, "Invalid credentials");
    }

    const token = signToken({ id: user.id, role: user.role });
    res.status(200).json({
      success: true,
      data: { token, user: toPublicUser(user) },
    });
  })
);

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new AppError(401, "User no longer exists");
    }
    res.status(200).json({ success: true, data: { user } });
  })
);

export default router;