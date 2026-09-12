import { z } from "zod";

export const USER_ROLES = ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"] as const;

export const createUserSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(120, "Name must be at most 120 characters long"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters long")
    .max(72, "Password must be at most 72 characters long"),
  role: z.enum(USER_ROLES, {
    errorMap: () => ({ message: "Role must be one of ADMIN, SALES, WAREHOUSE or ACCOUNTS" }),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;