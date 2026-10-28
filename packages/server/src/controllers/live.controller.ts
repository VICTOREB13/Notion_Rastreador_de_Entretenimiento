import { Hono } from "hono";
import { steamLiveService } from "../services/steam-live.service";

export const liveController = new Hono()
  .get("/status", async (c) => {
    const status = await steamLiveService.getStatus();
    return c.json({
      success: true,
      data: status,
    });
  })
  .post("/check", async (c) => {
    const status = await steamLiveService.check();
    return c.json({
      success: true,
      data: status,
    });
  });
