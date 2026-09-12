import { NextFunction, Request, Response } from "express";
import { JwtUserPayload, verifyToken } from "../lib/jwt";

// Augment the Express Request type so every handler can read `req.user`
// after the auth middleware has run.
declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth after a valid Bearer token is verified. */
      user?: JwtUserPayload;
    }
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Requires a valid `Authorization: Bearer <token>` header.
 * - missing/invalid/expired token -> 401 { success: false, message }
 * - success -> attaches the decoded payload to req.user and calls next()
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ success: false, message: "Authentication token is missing" });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * Role-based access control middleware factory.
 * Must run after requireAuth. Allows the request only when the authenticated
 * user's role is one of the given roles, otherwise responds 403.
 *
 * Usage: router.post("/", requireAuth, requireRoles("ADMIN", "SALES"), handler)
 */
export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
      return;
    }
    next();
  };
}