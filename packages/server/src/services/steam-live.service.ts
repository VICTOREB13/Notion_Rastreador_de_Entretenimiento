import type {
  ISteamClient,
  ISessionRepository,
  IGameRepository,
} from "@repo/database";
import {
  sessionRepository,
  gameRepository,
  cleanGameTitle,
} from "@repo/database";
import { PlaytimeTrackerService, playtimeTrackerService } from "./playtime-tracker.service";
import { SteamClient, steamClient } from "../clients/steam.client";
import { broadcastEvent } from "../controllers/events.controller";
import { config } from "../config";

export interface LiveStatusGame {
  id: string;
  title: string;
  steamAppId: number;
  coverUrl: string | null;
  sessionStartedAt: string;
  sessionMinutes: number;
}

export interface LiveDebounceStatus {
  inGracePeriod: boolean;
  gracePeriodRemainingSeconds: number;
}

export interface LiveStatusResponse {
  isPlaying: boolean;
  game: LiveStatusGame | null;
  debounceStatus: LiveDebounceStatus;
}

export class SteamLiveService {
  private candidateDisconnectAt: Date | null = null;
  private lastPollAt: Date | null = null;

  constructor(
    private steam: ISteamClient = steamClient,
    private sessionRepo: ISessionRepository = sessionRepository,
    private gameRepo: IGameRepository = gameRepository,
    private playtimeTracker: PlaytimeTrackerService = playtimeTrackerService,
    private steamUserId: string = config.steamUserId,
    private gracePeriodMs: number = config.steamGracePeriodMs
  ) {}

  /**
   * Configura o actualiza el tiempo de gracia (útil para pruebas unitarias).
   */
  setGracePeriodMs(ms: number): void {
    this.gracePeriodMs = ms;
  }

  setCandidateDisconnectAt(date: Date | null): void {
    this.candidateDisconnectAt = date;
  }

  getCandidateDisconnectAt(): Date | null {
    return this.candidateDisconnectAt;
  }

  /**
   * Ejecuta un ciclo de verificación del estado de juego en Steam.
   * Aplica un periodo de gracia (debounce) de 3 minutos para evitar fragmentar sesiones
   * ante micro-cortes de red o reinicios rápidos del juego.
   */
  async check(): Promise<LiveStatusResponse> {
    this.lastPollAt = new Date();

    if (!this.steamUserId) {
      return this.getStatus();
    }

    let summary;
    try {
      summary = await this.steam.getPlayerSummary(this.steamUserId);
      if (summary?.isError) {
        console.warn("[SteamLiveService] Steam API reported error: preserving active session state.");
        return this.getStatus();
      }
    } catch (err) {
      console.warn(`[SteamLiveService] Could not reach Steam API (${err}): preserving active session state.`);
      return this.getStatus();
    }

    const activeSession = await this.sessionRepo.findActiveSession();

    if (summary.isPlaying && summary.gameId) {
      // 1. El jugador está activo en Steam
      if (this.candidateDisconnectAt !== null) {
        // Se cancela el candidato a desconexión: el jugador volvió dentro del tiempo de gracia
        this.candidateDisconnectAt = null;
      }

      if (activeSession) {
        const isSameGame =
          activeSession.steamAppId === summary.gameId ||
          activeSession.game?.steamAppId === summary.gameId;

        if (isSameGame) {
          // Registrar latido de actividad (heartbeat)
          if (this.sessionRepo.touchSession) {
            await this.sessionRepo.touchSession(activeSession.id);
          }
          return this.getStatus();
        }

        // El usuario cambió de juego: cerrar la sesión anterior de inmediato
        await this.playtimeTracker.closeActiveSession(activeSession, new Date());
        broadcastEvent("live_status_updated", { isPlaying: false, game: null });
        broadcastEvent("catalog_updated", { source: "steam_live", action: "session_closed" });
      }

      // Iniciar sesión para el nuevo juego detectado
      let game = await this.gameRepo.findBySteamAppId(summary.gameId);

      if (!game && summary.gameExtraInfo) {
        game = await this.gameRepo.findByCleanTitle(cleanGameTitle(summary.gameExtraInfo));
      }

      if (!game) {
        // Intentar obtener detalles desde Steam Store API
        const details = await this.steam.getAppDetails(summary.gameId);
        const title = summary.gameExtraInfo || details?.name || `Steam App ${summary.gameId}`;

        game = await this.gameRepo.upsert({
          notionPageId: `steam-auto-${summary.gameId}`,
          title,
          cleanTitle: cleanGameTitle(title),
          steamAppId: summary.gameId,
          status: "Jugando",
          platform: "PC",
          coverUrl: details?.headerImage || null,
          genres: JSON.stringify(details?.genres || []),
        });
      } else if (game.status === "Por Jugar") {
        await this.gameRepo.updateStatus(game.id, "Jugando");
      }

      await this.sessionRepo.startSession(game.id, summary.gameId, new Date());
      const status = await this.getStatus();
      broadcastEvent("live_status_updated", status);
      broadcastEvent("catalog_updated", { source: "steam_live", action: "session_started", gameId: game.id });
      return status;
    }

    // 2. El jugador NO está jugando según Steam
    if (activeSession) {
      const now = Date.now();
      const lastActiveAt = activeSession.updatedAt ?? activeSession.startedAt;
      const timeSinceLastActive = now - lastActiveAt.getTime();

      // Detección de sesión huérfana / crash previo prolongado:
      // Si la sesión no ha tenido actividad por más de 2 veces el periodo de gracia
      // (ej. el servidor reinició horas o días después), cerrarla con lastActiveAt
      // para evitar inflación artificial de duración.
      if (this.candidateDisconnectAt === null && timeSinceLastActive > this.gracePeriodMs * 2) {
        await this.playtimeTracker.closeActiveSession(activeSession, lastActiveAt);
        this.candidateDisconnectAt = null;
        broadcastEvent("live_status_updated", { isPlaying: false, game: null });
        broadcastEvent("catalog_updated", { source: "steam_live", action: "session_closed" });
        return this.getStatus();
      }

      if (this.candidateDisconnectAt === null) {
        // Iniciar periodo de gracia (debounce)
        this.candidateDisconnectAt = new Date(now);
      } else {
        const elapsed = now - this.candidateDisconnectAt.getTime();
        if (elapsed >= this.gracePeriodMs) {
          // El periodo de gracia expiró: cerrar la sesión formalmente
          await this.playtimeTracker.closeActiveSession(activeSession, this.candidateDisconnectAt);
          this.candidateDisconnectAt = null;
          broadcastEvent("live_status_updated", { isPlaying: false, game: null });
          broadcastEvent("catalog_updated", { source: "steam_live", action: "session_closed" });
        }
      }
    } else {
      this.candidateDisconnectAt = null;
    }

    return this.getStatus();
  }

  /**
   * Retorna el estado actual en vivo consultando la persistencia y el estado del debounce.
   */
  async getStatus(): Promise<LiveStatusResponse> {
    const activeSession = await this.sessionRepo.findActiveSession();

    if (!activeSession) {
      return {
        isPlaying: false,
        game: null,
        debounceStatus: {
          inGracePeriod: false,
          gracePeriodRemainingSeconds: 0,
        },
      };
    }

    const now = Date.now();
    const sessionMinutes = Math.max(
      1,
      Math.round((now - activeSession.startedAt.getTime()) / (1000 * 60))
    );

    let inGracePeriod = false;
    let gracePeriodRemainingSeconds = 0;

    if (this.candidateDisconnectAt !== null) {
      inGracePeriod = true;
      const elapsed = now - this.candidateDisconnectAt.getTime();
      gracePeriodRemainingSeconds = Math.max(
        0,
        Math.ceil((this.gracePeriodMs - elapsed) / 1000)
      );
    }

    return {
      isPlaying: true,
      game: {
        id: activeSession.game.id,
        title: activeSession.game.title,
        steamAppId: activeSession.steamAppId || activeSession.game.steamAppId || 0,
        coverUrl: activeSession.game.coverUrl,
        sessionStartedAt: activeSession.startedAt.toISOString(),
        sessionMinutes,
      },
      debounceStatus: {
        inGracePeriod,
        gracePeriodRemainingSeconds,
      },
    };
  }
}

export const steamLiveService = new SteamLiveService();
