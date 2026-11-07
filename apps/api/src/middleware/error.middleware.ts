import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || (err instanceof ZodError ? 400 : 500);

  console.error(`❌ [Error ${statusCode}] ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    details: err.details || (err instanceof ZodError ? err.flatten() : undefined),
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || "Internal Server Error",
      statusCode,
      details: err.details || (err instanceof ZodError ? err.flatten() : undefined),
      ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    },
  });
}

