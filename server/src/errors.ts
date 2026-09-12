import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

/**
 * Application-level error carrying an HTTP status code.
 * Thrown anywhere in the codebase and converted to a JSON response
 * by the central error handler.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    // Hide this constructor frame from stack traces (Node only).
    Error.captureStackTrace?.(this, AppError);
  }
}

/**
 * 404 handler for requests that did not match any route.
 * Mounted after all routers, before the error handler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Central Express error handler.
 * - ZodError  -> 400 { success, message: "Validation failed", errors: [{field, message}] }
 * - AppError  -> its own status code { success: false, message }
 * - anything else -> 500 { success: false, message: "Internal server error" } (no stack leaked)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "body",
      message: issue.message,
    }));
    res.status(400).json({ success: false, message: "Validation failed", errors });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  console.error("[Unhandled error]", err);
  res.status(500).json({ success: false, message: "Internal server error" });
}