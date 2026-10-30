import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  prisma,
  configurePragmas,
  ensureDatabaseDirectory,
  cleanGameTitle,
  computeSimilarityRatio,
  gameRepository,
  movieRepository,
  sessionRepository,
  dailyPlaytimeRepository,
  aiSettingsRepository,
  aiEnrichmentRepository,
} from "../src/index";

describe("SQLite Database & Prisma Repositories", () => {
  const testNotionPageId = "test-game-page-123";
  let createdGameId: string;

  beforeAll(async () => {
    // 1. Configurar pragmas (WAL mode, busy timeout, foreign keys)
    await configurePragmas(prisma);

    // 2. Limpiar posibles registros de pruebas previas
    const existing = await prisma.game.findUnique({ where: { notionPageId: testNotionPageId } });
    if (existing) {
      await prisma.game.delete({ where: { id: existing.id } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("SQLite Pragmas & WAL Configuration", () => {
    it("should have WAL journal_mode and busy_timeout configured", async () => {
      const journalMode = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>("PRAGMA journal_mode;");
      expect(journalMode[0].journal_mode.toLowerCase()).toBe("wal");

      const busyTimeout = await prisma.$queryRawUnsafe<{ timeout: number }[]>("PRAGMA busy_timeout;");
      expect(busyTimeout[0].timeout).toBeGreaterThanOrEqual(5000);
    });
  });

  describe("Title Normalizer & Fuzzy Similarity", () => {
    it("should normalize titles removing trademarks, accents, emojis and brackets", () => {
      expect(cleanGameTitle("Cyberpunk 2077® (2020)")).toBe("cyberpunk 2077 2020");
      expect(cleanGameTitle("The Witcher 3: Wild Hunt™ ⚔️")).toBe("the witcher 3 wild hunt");
      expect(cleanGameTitle("Pokémon: Let's Go, Pikachu!™")).toBe("pokemon let s go pikachu");
      expect(cleanGameTitle("DOOM [PC Edition]")).toBe("doom pc edition");
      // Idempotencia
      const raw = "Grand Theft Auto V™ (Premium Edition) 🚗";
      expect(cleanGameTitle(cleanGameTitle(raw))).toBe(cleanGameTitle(raw));
    });

    it("should compute accurate similarity ratio", () => {
      const exact = computeSimilarityRatio("Cyberpunk 2077", "Cyberpunk 2077");
      expect(exact).toBe(1.0);

      const highSim = computeSimilarityRatio("The Witcher 3: Wild Hunt", "The Witcher 3 Wild Hunt");
      expect(highSim).toBeGreaterThanOrEqual(0.85);

      const different = computeSimilarityRatio("Super Mario Odyssey", "Dark Souls III");
      expect(different).toBeLessThan(0.3);
    });
  });

  describe("GameRepository", () => {
    it("should upsert a new game and auto-generate cleanTitle", async () => {
      const game = await gameRepository.upsert({
        notionPageId: testNotionPageId,
        title: "The Witcher 3: Wild Hunt™",
        cleanTitle: "", // Debe ser inferido y normalizado
        steamAppId: 292030,
        playtimeForever: 84.5,
        playtimeNotion: 80.0,
        hltbMain: 51.5,
        hltbCompletionist: 173.0,
        genres: JSON.stringify(["RPG", "Aventura"]),
        status: "Jugando",
        platform: "PC",
      });

      expect(game).toBeDefined();
      expect(game.id).toBeDefined();
      expect(game.title).toBe("The Witcher 3: Wild Hunt™");
      expect(game.cleanTitle).toBe("the witcher 3 wild hunt");
      expect(game.steamAppId).toBe(292030);
      createdGameId = game.id;
    });

    it("should find game by different identifiers including cleanTitle", async () => {
      const byId = await gameRepository.findById(createdGameId);
      expect(byId?.title).toBe("The Witcher 3: Wild Hunt™");

      const byNotion = await gameRepository.findByNotionPageId(testNotionPageId);
      expect(byNotion?.id).toBe(createdGameId);

      const bySteam = await gameRepository.findBySteamAppId(292030);
      expect(bySteam?.id).toBe(createdGameId);

      const byCleanTitle = await gameRepository.findByCleanTitle("The Witcher 3 Wild Hunt");
      expect(byCleanTitle?.id).toBe(createdGameId);
    });

    it("should update playtime and status", async () => {
      const updated = await gameRepository.updatePlaytime(createdGameId, 88.0, 88.0);
      expect(updated.playtimeForever).toBe(88.0);
      expect(updated.playtimeNotion).toBe(88.0);

      const withStatus = await gameRepository.updateStatus(createdGameId, "Jugado");
      expect(withStatus.status).toBe("Jugado");
    });

    it("should list games with filters", async () => {
      const result = await gameRepository.list({ search: "Witcher", status: "Jugado" });
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.items.some((g) => g.id === createdGameId)).toBe(true);
    });
  });

  describe("MovieRepository", () => {
    const testMoviePageId = "test-movie-page-456";
    let createdMovieId: string;

    it("should upsert a movie, find by cleanTitle, and query it", async () => {
      const movie = await movieRepository.upsert({
        notionPageId: testMoviePageId,
        title: "Blade Runner 2049™",
        cleanTitle: "",
        tmdbId: 335984,
        overview: "Treinta años después de los eventos de la primera película...",
        genres: JSON.stringify(["Ciencia Ficción", "Misterio"]),
        status: "Por Ver",
        year: 2017,
      });

      expect(movie.id).toBeDefined();
      expect(movie.tmdbId).toBe(335984);
      expect(movie.cleanTitle).toBe("blade runner 2049");
      createdMovieId = movie.id;

      const foundByTmdb = await movieRepository.findByTmdbId(335984);
      expect(foundByTmdb?.title).toBe("Blade Runner 2049™");

      const foundByClean = await movieRepository.findByCleanTitle("Blade Runner 2049");
      expect(foundByClean?.id).toBe(createdMovieId);

      const listResult = await movieRepository.list({ year: 2017 });
      expect(listResult.items.some((m) => m.id === createdMovieId)).toBe(true);
    });
  });

  describe("SessionRepository & DailyPlaytimeRepository (Cascade)", () => {
    let sessionId: string;
    const testDate = "2026-10-25";

    it("should start and close a live session and calculate duration on orphan sessions", async () => {
      // 1. Iniciar primera sesión
      const startTime1 = new Date(Date.now() - 30 * 60 * 1000); // 30 min atrás
      const session1 = await sessionRepository.startSession(createdGameId, 292030, startTime1);
      expect(session1.isLive).toBe(true);
      expect(session1.gameId).toBe(createdGameId);

      // 2. Iniciar segunda sesión huérfana (debe cerrar la primera calculando sus ~30 min)
      const session2 = await sessionRepository.startSession(createdGameId, 292030, new Date());
      expect(session2.isLive).toBe(true);
      sessionId = session2.id;

      const closedOrphan = await prisma.gameSession.findUnique({ where: { id: session1.id } });
      expect(closedOrphan?.isLive).toBe(false);
      expect(closedOrphan?.durationMinutes).toBeGreaterThanOrEqual(29);

      // 3. Cerrar sesión 2 manualmente
      const closed = await sessionRepository.closeSession(sessionId, new Date(), 60);
      expect(closed.isLive).toBe(false);
      expect(closed.durationMinutes).toBe(60);

      const activeAfterClose = await sessionRepository.findActiveSession();
      expect(activeAfterClose).toBeNull();
    });

    it("should record daily playtime and compute time series", async () => {
      const daily = await dailyPlaytimeRepository.recordPlaytime(testDate, createdGameId, 60);
      expect(daily.minutes).toBe(60);

      // Incrementar
      const incremented = await dailyPlaytimeRepository.recordPlaytime(testDate, createdGameId, 30);
      expect(incremented.minutes).toBe(90);

      const series = await dailyPlaytimeRepository.getTimeSeries(7);
      expect(series.length).toBeGreaterThanOrEqual(1);
      const dayRecord = series.find((s) => s.date === testDate);
      expect(dayRecord).toBeDefined();
      expect(dayRecord!.hours).toBeGreaterThanOrEqual(1.5);
    });

    it("should cascade delete sessions and daily playtime when game is deleted", async () => {
      await gameRepository.delete(createdGameId);

      const deletedSession = await prisma.gameSession.findUnique({ where: { id: sessionId } });
      expect(deletedSession).toBeNull();

      const deletedDaily = await prisma.dailyPlaytime.findUnique({
        where: {
          date_gameId: {
            date: testDate,
            gameId: createdGameId,
          },
        },
      });
      expect(deletedDaily).toBeNull();
    });
  });

  describe("AiSettingsRepository & AiEnrichmentRepository", () => {
    it("should fetch default settings and update them", async () => {
      const settings = await aiSettingsRepository.getSettings();
      expect(settings.id).toBe("default");
      expect(settings.activeProvider).toBeDefined();

      const updated = await aiSettingsRepository.updateSettings({
        activeProvider: "ollama",
        selectedModel: "llama3.2:latest",
        temperature: 0.5,
      });

      expect(updated.activeProvider).toBe("ollama");
      expect(updated.selectedModel).toBe("llama3.2:latest");
      expect(updated.temperature).toBe(0.5);

      // Restaurar a gemini
      await aiSettingsRepository.updateSettings({
        activeProvider: "gemini",
        selectedModel: "gemini-2.5-flash",
        temperature: 0.7,
      });
    });

    it("should upsert and retrieve parsed AI enrichment", async () => {
      const enrichment = await aiEnrichmentRepository.upsert({
        targetType: "GAME",
        targetId: "test-target-game",
        vibeTags: JSON.stringify(["Fantasía Oscura", "Filosófico"]),
        personalizedPitch: "Una historia profunda de elecciones morales en un mundo despiadado.",
        thematicTropes: JSON.stringify(["Cazador de Monstruos", "Magia Caótica"]),
        completionEstimateWeeks: 8.0,
        provider: "gemini",
        modelUsed: "gemini-2.5-flash",
      });

      expect(enrichment.targetId).toBe("test-target-game");
      expect(enrichment.personalizedPitch).toContain("historia profunda");

      const parsed = await aiEnrichmentRepository.getParsedEnrichment("GAME", "test-target-game");
      expect(parsed).not.toBeNull();
      expect(parsed?.vibeTags).toContain("Fantasía Oscura");
      expect(parsed?.thematicTropes).toContain("Cazador de Monstruos");
      expect(parsed?.completionEstimateWeeks).toBe(8.0);
    });
  });

  describe("Concurrency Stress (WAL Resilience)", () => {
    it("should handle 20 concurrent reads and writes without SQLITE_BUSY locking errors", async () => {
      const concurrentTasks = Array.from({ length: 20 }).map(async (_, idx) => {
        const pageId = `concurrent-test-${idx}`;
        const game = await gameRepository.upsert({
          notionPageId: pageId,
          title: `Concurrent Game ${idx}`,
          cleanTitle: `concurrent game ${idx}`,
          status: "Por Jugar",
          platform: "PC",
        });

        // Lectura concurrente inmediata
        const found = await gameRepository.findByNotionPageId(pageId);
        expect(found?.id).toBe(game.id);

        // Limpieza concurrente
        await gameRepository.delete(game.id);
      });

      await Promise.all(concurrentTasks);
    });
  });

  describe("ensureDatabaseDirectory (Defense-in-depth)", () => {
    const testCustomDir = path.resolve("./data/test_auto_created_dir");
    const testCustomDirWithParams = path.resolve("./data/test_auto_created_dir_params");

    afterAll(() => {
      if (fs.existsSync(testCustomDir)) {
        fs.rmdirSync(testCustomDir);
      }
      if (fs.existsSync(testCustomDirWithParams)) {
        fs.rmdirSync(testCustomDirWithParams);
      }
    });

    it("should handle undefined and non-file URLs without throwing", () => {
      expect(() => ensureDatabaseDirectory(undefined)).not.toThrow();
      expect(() => ensureDatabaseDirectory("")).not.toThrow();
      expect(() => ensureDatabaseDirectory("postgresql://user:pass@localhost:5432/db")).not.toThrow();
      expect(() => ensureDatabaseDirectory("file::memory:?cache=shared")).not.toThrow();
    });

    it("should create directory for standard SQLite file URLs if missing", () => {
      const dbUrl = `file:${testCustomDir}/sub.db`;
      ensureDatabaseDirectory(dbUrl);
      expect(fs.existsSync(testCustomDir)).toBe(true);
    });

    it("should strip query parameters and create directory cleanly", () => {
      const dbUrl = `file:${testCustomDirWithParams}/sub.db?connection_limit=1&busy_timeout=5000`;
      ensureDatabaseDirectory(dbUrl);
      expect(fs.existsSync(testCustomDirWithParams)).toBe(true);
    });

    it("should handle RFC 8089 file:/// URIs with absolute Windows and POSIX paths", () => {
      const testTripleSlashDir = path.resolve("./data/test_triple_slash_dir");
      try {
        const normalized = testTripleSlashDir.replace(/\\/g, "/");
        const dbUrl = `file:///${normalized}/sub.db`;
        ensureDatabaseDirectory(dbUrl);
        expect(fs.existsSync(testTripleSlashDir)).toBe(true);
      } finally {
        if (fs.existsSync(testTripleSlashDir)) {
          fs.rmdirSync(testTripleSlashDir);
        }
      }
    });
  });
});
