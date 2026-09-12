import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

/**
 * Zod validation middleware factory.
 *
 * Validates req.body against the given schema:
 * - invalid -> 400 { success: false, message: "Validation failed",
 *                    errors: [{ field, message }, ...] }
 * - valid   -> replaces req.body with the parsed (and coerced/defaulted) value
 *              and calls next()
 *
 * Usage: router.post("/", validate(createCustomerSchema), handler)
 */
export const validate =
  (schema: ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join(".") : "body",
        message: issue.message,
      }));
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }
    req.body = result.data;
    next();
  };