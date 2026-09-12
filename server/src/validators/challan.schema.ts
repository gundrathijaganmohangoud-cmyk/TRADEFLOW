import { z } from "zod";

export const CHALLAN_STATUSES = ["DRAFT", "CONFIRMED"] as const;

const challanItemSchema = z.object({
  productId: z
    .string({ required_error: "Product ID is required in every item" })
    .trim()
    .min(1, "Product ID is required in every item"),
  quantity: z.coerce
    .number({
      required_error: "Quantity is required in every item",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
});

export const createChallanSchema = z.object({
  customerId: z
    .string({ required_error: "Customer ID is required" })
    .trim()
    .min(1, "Customer ID is required"),
  items: z
    .array(challanItemSchema, {
      required_error: "At least one item is required",
      invalid_type_error: "Items must be an array",
    })
    .min(1, "At least one item is required"),
  status: z
    .enum(CHALLAN_STATUSES, {
      errorMap: () => ({ message: "Status must be either DRAFT or CONFIRMED" }),
    })
    .default("DRAFT"),
});

export const challanListQuerySchema = z.object({
  status: z
    .enum(["DRAFT", "CONFIRMED", "CANCELLED"], {
      errorMap: () => ({ message: "Status must be DRAFT, CONFIRMED or CANCELLED" }),
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

export type ChallanItemInput = z.infer<typeof challanItemSchema>;
export type CreateChallanInput = z.infer<typeof createChallanSchema>;
export type ChallanListQuery = z.infer<typeof challanListQuerySchema>;