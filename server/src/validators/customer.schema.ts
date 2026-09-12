import { z } from "zod";

export const CUSTOMER_TYPES = ["RETAIL", "WHOLESALE", "DISTRIBUTOR"] as const;
export const CUSTOMER_STATUSES = ["ACTIVE", "INACTIVE", "LEAD"] as const;

/**
 * Accepts an ISO date string (or Date) and produces a Date. Unparseable input
 * falls through to z.date()'s built-in "Invalid date" error message.
 */
const dateStringToDate = () =>
  z.preprocess((value) => {
    if (value instanceof Date) return value;
    if (typeof value === "string" && value.trim() !== "") {
      return new Date(value);
    }
    return value;
  }, z.date());

export const followUpDateSchema = dateStringToDate();

export const createCustomerSchema = z.object({
  name: z
    .string({ required_error: "Customer name is required" })
    .trim()
    .min(1, "Customer name is required")
    .max(120, "Customer name must be at most 120 characters long"),
  mobile: z
    .string({ required_error: "Mobile number is required" })
    .trim()
    .regex(
      /^[0-9+\-\s()]{7,15}$/,
      "Mobile number must be 7-15 characters and may contain digits, spaces, +, - or parentheses"
    ),
  businessName: z
    .string()
    .trim()
    .max(160, "Business name must be at most 160 characters long")
    .optional(),
  type: z
    .enum(CUSTOMER_TYPES, {
      errorMap: () => ({ message: "Customer type must be one of RETAIL, WHOLESALE or DISTRIBUTOR" }),
    })
    .default("RETAIL"),
  status: z
    .enum(CUSTOMER_STATUSES, {
      errorMap: () => ({ message: "Customer status must be one of ACTIVE, INACTIVE or LEAD" }),
    })
    .default("ACTIVE"),
  address: z
    .string()
    .trim()
    .max(300, "Address must be at most 300 characters long")
    .optional(),
  city: z.string().trim().max(100, "City must be at most 100 characters long").optional(),
  state: z.string().trim().max(100, "State must be at most 100 characters long").optional(),
  followUpDate: followUpDateSchema.optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerListQuerySchema = z.object({
  q: z.string().trim().optional(),
  search: z.string().trim().optional(),
  status: z
    .enum(CUSTOMER_STATUSES, {
      errorMap: () => ({ message: "Status must be one of ACTIVE, INACTIVE or LEAD" }),
    })
    .optional(),
  type: z
    .enum(CUSTOMER_TYPES, {
      errorMap: () => ({ message: "Type must be one of RETAIL, WHOLESALE or DISTRIBUTOR" }),
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

export const createFollowUpSchema = z.object({
  date: dateStringToDate(),
  note: z
    .string({ required_error: "Follow-up note is required" })
    .trim()
    .min(1, "Follow-up note is required")
    .max(500, "Follow-up note must be at most 500 characters long"),
  status: z
    .enum(["PENDING", "DONE"], {
      errorMap: () => ({ message: "Follow-up status must be PENDING or DONE" }),
    })
    .default("PENDING"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;