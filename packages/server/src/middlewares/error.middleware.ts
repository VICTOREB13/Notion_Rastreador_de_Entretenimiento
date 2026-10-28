import type { ErrorHandler } from "hono";
import { ZodError } from "zod";

/**
 * Global error handler returning RFC 7807 compatible or standard JSON errors.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: "Validation Error",
        details: err.flatten(),
      },
      400
    );
  }

  const message = err.message || "Internal Server Error";
  const status = (err as { status?: number }).status || 500;

  if (process.env.NODE_ENV !== "test") {
    console.error(`[ERROR] ${c.req.method} ${c.req.path} -> ${message}`, err.stack);
  }

  return c.json(
    {
      success: false,
      error: message,
      ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    },
    status as any
  );
};
