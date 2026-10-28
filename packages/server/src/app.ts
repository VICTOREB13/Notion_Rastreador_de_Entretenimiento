import { Hono } from "hono";
import { cors } from "hono/cors";
import { structuredLogger } from "./middlewares/logger.middleware";
import { errorHandler } from "./middlewares/error.middleware";
import { gamesController } from "./controllers/games.controller";
import { moviesController } from "./controllers/movies.controller";
import { liveController } from "./controllers/live.controller";
import { settingsController } from "./controllers/settings.controller";
import { analyticsController } from "./controllers/analytics.controller";

/**
 * Aplicación principal Hono que expone el contrato maestro AppType
 * para su consumo de extremo a extremo mediante Hono RPC (hc<AppType>).
 */
export const app = new Hono()
  .use("*", cors())
  .use("*", structuredLogger())
  .onError(errorHandler)
  .get("/healthz", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  })
  .basePath("/api")
  .route("/games", gamesController)
  .route("/movies", moviesController)
  .route("/live", liveController)
  .route("/settings", settingsController)
  .route("/analytics", analyticsController);

export type AppType = typeof app;
