import { steamLiveService } from "../services/steam-live.service";
import { notionSyncService } from "../services/notion-sync.service";
import { config } from "../config";

export class DaemonScheduler {
  private steamTimer: ReturnType<typeof setInterval> | null = null;
  private notionTimer: ReturnType<typeof setInterval> | null = null;
  private initialSteamTimer: ReturnType<typeof setTimeout> | null = null;
  private bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.initialSteamTimer = setTimeout(async () => {
      if (!this.running) return;
      try {
        await steamLiveService.check();
      } catch (err) {
        console.warn("[DaemonScheduler] Initial Steam check error:", err);
      }
    }, 2000);

    // Sincronización Bootstrap diferida (3s) para hidratar la base de datos de inmediato al arranque
    this.bootstrapTimer = setTimeout(async () => {
      if (!this.running) return;
      console.log("[DaemonScheduler] Running initial bootstrap sync for games and movies...");
      try {
        await notionSyncService.syncGames();
      } catch (err) {
        console.warn("[DaemonScheduler] Initial Notion games bootstrap sync error:", err);
      }

      if (!this.running) return;
      try {
        await notionSyncService.syncMovies();
      } catch (err) {
        console.warn("[DaemonScheduler] Initial Notion movies bootstrap sync error:", err);
      }
    }, 3000);

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
      } catch (err) {
        console.warn("[DaemonScheduler] Notion games delta sync error:", err);
      }
      try {
        await notionSyncService.syncMovies();
      } catch (err) {
        console.warn("[DaemonScheduler] Notion movies delta sync error:", err);
      }
    }, this.notionIntervalMs);
  }

  stop(): void {
    if (!this.running) return;

    if (this.initialSteamTimer) {
      clearTimeout(this.initialSteamTimer);
      this.initialSteamTimer = null;
    }

    if (this.bootstrapTimer) {
      clearTimeout(this.bootstrapTimer);
      this.bootstrapTimer = null;
    }

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
