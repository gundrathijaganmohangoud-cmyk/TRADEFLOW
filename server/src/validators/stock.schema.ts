import { z } from "zod";

export const MOVEMENT_TYPES = ["IN", "OUT"] as const;

export const createMovementSchema = z.object({
  productId: z
    .string({ required_error: "Product ID is required" })
    .trim()
    .min(1, "Product ID is required"),
  type: z.enum(MOVEMENT_TYPES, {
    errorMap: () => ({ message: "Movement type must be either IN or OUT" }),
  }),
  quantity: z.coerce
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  reason: z
    .string({ required_error: "Reason is required" })
    .trim()
    .min(1, "Reason is required")
    .max(200, "Reason must be at most 200 characters long"),
});

export const movementListQuerySchema = z.object({
  productId: z.string().trim().optional(),
  type: z
    .enum(MOVEMENT_TYPES, {
      errorMap: () => ({ message: "Movement type must be either IN or OUT" }),
    })
    .optional(),
  page: z.coerce
    .number({ invalid_type_error: "Page must be a number" })
    .int("Page must be a whole number")
    .min(1, "Page must be at least 1")
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: "Limit must be a number" })
    .int("Limit must be a whole number")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be at most 100")
    .default(10),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type MovementListQuery = z.infer<typeof movementListQuerySchema>;