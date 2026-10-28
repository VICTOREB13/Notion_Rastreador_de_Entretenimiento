import type { MiddlewareHandler } from "hono";

/**
 * Middleware de observabilidad estructurada (ODD).
 * Registra latencias, método, ruta y código de respuesta HTTP sin sobrecargar el event-loop.
 */
export const structuredLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const status = c.res.status;

    if (process.env.NODE_ENV !== "test") {
      const logPayload = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO",
        method,
        path,
        status,
        durationMs,
      });
      console.log(logPayload);
    }
  };
};
