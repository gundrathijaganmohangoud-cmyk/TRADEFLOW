import { z } from "zod";

export const createProductSchema = z.object({
  sku: z
    .string({ required_error: "SKU is required" })
    .trim()
    .min(1, "SKU is required")
    .max(60, "SKU must be at most 60 characters long"),
  name: z
    .string({ required_error: "Product name is required" })
    .trim()
    .min(1, "Product name is required")
    .max(160, "Product name must be at most 160 characters long"),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be at most 1000 characters long")
    .optional(),
  unitPrice: z.coerce
    .number({
      required_error: "Unit price is required",
      invalid_type_error: "Unit price must be a number",
    })
    .positive("Unit price must be greater than 0"),
  currentStock: z.coerce
    .number({ invalid_type_error: "Current stock must be a number" })
    .int("Current stock must be a whole number")
    .min(0, "Current stock cannot be negative")
    .default(0),
  minStock: z.coerce
    .number({ invalid_type_error: "Minimum stock must be a number" })
    .int("Minimum stock must be a whole number")
    .min(0, "Minimum stock cannot be negative")
    .default(0),
});

export const updateProductSchema = createProductSchema.partial();

export const productListQuerySchema = z.object({
  q: z.string().trim().optional(),
  search: z.string().trim().optional(),
  lowStock: z
    .string()
    .optional()
    .transform((value) => value === "true"),
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

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;