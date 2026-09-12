import { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async route handler so that any rejected promise is forwarded to
 * the central Express error handler. This keeps error handling consistent on
 * both Express 4 (which does not catch async errors) and Express 5.
 *
 * Usage: router.get("/", requireAuth, asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}