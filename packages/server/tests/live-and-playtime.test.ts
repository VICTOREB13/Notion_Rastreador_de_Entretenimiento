import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/app";
import {
  prisma,
  configurePragmas,
  type ISteamClient,
  type SteamPlayerSummary,
  type SteamOwnedGame,
  type SteamStoreDetails,
} from "@repo/database";
import { SteamLiveService } from "../src/services/steam-live.service";
import { PlaytimeTrackerService } from "../src/services/playtime-tracker.service";
import { SessionRepository } from "../../database/src/repositories/session.repository";
import { DailyPlaytimeRepository } from "../../database/src/repositories/daily-playtime.repository";
import { GameRepository } from "../../database/src/repositories/game.repository";

class MockSteamClient implements ISteamClient {
  public mockSummary: SteamPlayerSummary = {
    steamId: "76561198000000000",
    personaName: "PlayerOne",
    isPlaying: false,
  };

  async getPlayerSummary(steamId: string): Promise<SteamPlayerSummary> {
    return this.mockSummary;
  }

  async getOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
    return [];
  }

  async getAppDetails(appId: number): Promise<SteamStoreDetails | null> {
    return {
      appId,
      name: "Mock Game " + appId,
      headerImage: "https://mock.cdn/header.jpg",
      genres: ["Action"],
    };
  }
}

describe("SteamLiveService & PlaytimeTrackerService (Debounce Grace Period)", () => {
  const testGamePageId = "test-live-game-page";
  let testGameId: string;
  let mockSteam: MockSteamClient;
  let sessionRepo: SessionRepository;
  let dailyRepo: DailyPlaytimeRepository;
  let gameRepo: GameRepository;
  let tracker: PlaytimeTrackerService;
  let liveService: SteamLiveService;

  beforeAll(async () => {
    await configurePragmas(prisma);

    await prisma.game.deleteMany({
      where: { notionPageId: testGamePageId },
    });

    const game = await prisma.game.create({
      data: {
        notionPageId: testGamePageId,
        title: "Hollow Knight: Silksong",
        cleanTitle: "hollow knight silksong",
        steamAppId: 1030300,
        playtimeForever: 10.0,
        status: "Por Jugar",
        genres: JSON.stringify(["Metroidvania"]),
      },
    });
    testGameId = game.id;

    mockSteam = new MockSteamClient();
    sessionRepo = new SessionRepository();
    dailyRepo = new DailyPlaytimeRepository();
    gameRepo = new GameRepository();
    tracker = new PlaytimeTrackerService(sessionRepo, dailyRepo, gameRepo);
    liveService = new SteamLiveService(
      mockSteam,
      sessionRepo,
      gameRepo,
      tracker,
      "76561198000000000",
      180000 // 3 min debounce
    );
  });

  afterAll(async () => {
    await prisma.game.deleteMany({
      where: { notionPageId: testGamePageId },
    });
  });

  it("should start a live session when Steam reports active playing and promote status to 'Jugando'", async () => {
    mockSteam.mockSummary = {
      steamId: "76561198000000000",
      personaName: "PlayerOne",
      isPlaying: true,
      gameId: 1030300,
      gameExtraInfo: "Hollow Knight: Silksong",
    };

    const status = await liveService.check();
    expect(status.isPlaying).toBe(true);
    expect(status.game).toBeDefined();
    expect(status.game?.title).toBe("Hollow Knight: Silksong");
    expect(status.debounceStatus.inGracePeriod).toBe(false);

    // Comprobar que en la DB el juego pasó a "Jugando"
    const updatedGame = await gameRepo.findById(testGameId);
    expect(updatedGame?.status).toBe("Jugando");

    // Comprobar sesión activa en DB
    const active = await sessionRepo.findActiveSession();
    expect(active).not.toBeNull();
    expect(active?.gameId).toBe(testGameId);
    expect(active?.isLive).toBe(true);
  });

  it("should enter 3-minute grace period (debounce) when player drops offline instead of immediately closing session", async () => {
    // El jugador se desconecta
    mockSteam.mockSummary = {
      steamId: "76561198000000000",
      personaName: "PlayerOne",
      isPlaying: false,
    };

    const status = await liveService.check();

    // La sesión DEBE seguir viva durante el periodo de gracia
    expect(status.isPlaying).toBe(true);
    expect(status.debounceStatus.inGracePeriod).toBe(true);
    expect(status.debounceStatus.gracePeriodRemainingSeconds).toBeGreaterThan(0);
    expect(status.debounceStatus.gracePeriodRemainingSeconds).toBeLessThanOrEqual(180);

    // La sesión sigue activa en la base de datos
    const active = await sessionRepo.findActiveSession();
    expect(active).not.toBeNull();
    expect(active?.isLive).toBe(true);
  });

  it("should cancel grace period and preserve session uninterrupted if player resumes within 3 minutes", async () => {
    // El jugador vuelve a abrir el juego dentro de los 3 minutos
    mockSteam.mockSummary = {
      steamId: "76561198000000000",
      personaName: "PlayerOne",
      isPlaying: true,
      gameId: 1030300,
      gameExtraInfo: "Hollow Knight: Silksong",
    };

    const status = await liveService.check();

    expect(status.isPlaying).toBe(true);
    expect(status.debounceStatus.inGracePeriod).toBe(false);
    expect(liveService.getCandidateDisconnectAt()).toBeNull();

    // La sesión sigue siendo la misma sin haberse fragmentado
    const active = await sessionRepo.findActiveSession();
    expect(active).not.toBeNull();
    expect(active?.isLive).toBe(true);
  });

  it("should close the session and aggregate daily playtime once grace period expires", async () => {
    // Volver a simular desconexión
    mockSteam.mockSummary = {
      steamId: "76561198000000000",
      personaName: "PlayerOne",
      isPlaying: false,
    };

    // Forzar que el disconnect candidato haya ocurrido hace 4 minutos (240.000 ms)
    const fourMinutesAgo = new Date(Date.now() - 240000);
    liveService.setCandidateDisconnectAt(fourMinutesAgo);

    const status = await liveService.check();

    // Ahora sí debe figurar cerrado
    expect(status.isPlaying).toBe(false);
    expect(status.game).toBeNull();
    expect(status.debounceStatus.inGracePeriod).toBe(false);

    // La sesión activa debe haber sido cerrada en la DB
    const active = await sessionRepo.findActiveSession();
    expect(active).toBeNull();

    // El juego debe haber sumado horas
    const game = await gameRepo.findById(testGameId);
    expect(game?.playtimeForever).toBeGreaterThan(10.0);
  });

  it("should calculate consecutive streak correctly in PlaytimeTrackerService using local calendar days", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(today.getDate() - 2);

    const pad = (n: number) => String(n).padStart(2, "0");
    const toLocalStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const timeSeries = [
      { date: toLocalStr(dayBefore), hours: 2.0 },
      { date: toLocalStr(yesterday), hours: 1.5 },
      { date: toLocalStr(today), hours: 3.0 },
    ];

    const streak = tracker.calculateStreak(timeSeries);
    expect(streak).toBe(3);

    // Racha rota
    const brokenSeries = [
      { date: toLocalStr(dayBefore), hours: 2.0 },
      { date: toLocalStr(yesterday), hours: 0 },
      { date: toLocalStr(today), hours: 0 },
    ];
    expect(tracker.calculateStreak(brokenSeries)).toBe(0);
  });

  it("should preserve active session when Steam API fails (HTTP 503 / network error) instead of closing session", async () => {
    // 1. Iniciar sesión activa
    mockSteam.mockSummary = {
      steamId: "76561198000000000",
      personaName: "PlayerOne",
      isPlaying: true,
      gameId: 1030300,
      gameExtraInfo: "Hollow Knight: Silksong",
    };
    await liveService.check();

    const activeBefore = await sessionRepo.findActiveSession();
    expect(activeBefore).not.toBeNull();

    // 2. Simular fallo de red en Steam (error 503 / isError: true)
    mockSteam.mockSummary = {
      steamId: "76561198000000000",
      personaName: "Error",
      isPlaying: false,
      isError: true,
    };

    const status = await liveService.check();

    // La sesión DEBE mantenerse activa y NO entrar en grace period por error de red
    expect(status.isPlaying).toBe(true);
    expect(status.debounceStatus.inGracePeriod).toBe(false);
    expect(liveService.getCandidateDisconnectAt()).toBeNull();

    const activeAfter = await sessionRepo.findActiveSession();
    expect(activeAfter).not.toBeNull();
    expect(activeAfter?.isLive).toBe(true);
  });

  it("should recover stale active sessions from crashes without inflating duration to days", async () => {
    // 1. Simular una sesión huérfana de hace 24 horas (crash)
    const twentyFourHoursAgo = new Date(Date.now() - 86400000);
    const active = await sessionRepo.findActiveSession();
    if (active) {
      await prisma.gameSession.update({
        where: { id: active.id },
        data: {
          startedAt: twentyFourHoursAgo,
          updatedAt: twentyFourHoursAgo,
        },
      });
    }

    // 2. El usuario está offline
    mockSteam.mockSummary = {
      steamId: "76561198000000000",
      personaName: "PlayerOne",
      isPlaying: false,
    };
    liveService.setCandidateDisconnectAt(null);

    const status = await liveService.check();

    // La sesión debe cerrarse de inmediato con la fecha de última actividad (hace 24h), no 24h de duración
    expect(status.isPlaying).toBe(false);
    const activeAfter = await sessionRepo.findActiveSession();
    expect(activeAfter).toBeNull();
  });

  it("GET /api/live/status should return JSON conforming to api_spec contract", async () => {
    const res = await app.request("/api/live/status");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.isPlaying).toBe("boolean");
    expect(body.data.debounceStatus).toBeDefined();
    expect(typeof body.data.debounceStatus.inGracePeriod).toBe("boolean");
  });
});
