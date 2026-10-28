import { steamLiveService } from "../services/steam-live.service";
import { notionSyncService } from "../services/notion-sync.service";
import { config } from "../config";

export class DaemonScheduler {
  private steamTimer: ReturnType<typeof setInterval> | null = null;
  private notionTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private steamIntervalMs: number = config.steamPollIntervalMs,
    private notionIntervalMs: number = config.notionPollIntervalMs
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) {
      console.warn("[DaemonScheduler] Already running.");
      return;
    }

    this.running = true;
    console.log(
      `[DaemonScheduler] Starting background workers: Steam live monitor (${this.steamIntervalMs}ms), Notion delta poller (${this.notionIntervalMs}ms)`
    );

    // Ejecutar una comprobación inicial tras 2 segundos de arranque
    setTimeout(async () => {
      try {
        await steamLiveService.check();
      } catch (err) {
        console.warn("[DaemonScheduler] Initial Steam check error:", err);
      }
    }, 2000);

    // 1. Worker de monitoreo de Steam cada 60s
    this.steamTimer = setInterval(async () => {
      try {
        await steamLiveService.check();
      } catch (err) {
        console.warn("[DaemonScheduler] Steam live check error:", err);
      }
    }, this.steamIntervalMs);

    // 2. Worker de sondeo incremental de Notion cada 120s
    this.notionTimer = setInterval(async () => {
      try {
        await notionSyncService.syncGames();
        await notionSyncService.syncMovies();
      } catch (err) {
        console.warn("[DaemonScheduler] Notion delta sync error:", err);
      }
    }, this.notionIntervalMs);
  }

  stop(): void {
    if (!this.running) return;

    if (this.steamTimer) {
      clearInterval(this.steamTimer);
      this.steamTimer = null;
    }

    if (this.notionTimer) {
      clearInterval(this.notionTimer);
      this.notionTimer = null;
    }

    this.running = false;
    console.log("[DaemonScheduler] Background workers stopped.");
  }
}

export const daemonScheduler = new DaemonScheduler();
