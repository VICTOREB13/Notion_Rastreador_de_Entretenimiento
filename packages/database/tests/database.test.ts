import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  prisma,
  configurePragmas,
  ensureDatabaseDirectory,
  cleanGameTitle,
  computeSimilarityRatio,
  cleanNotionDatabaseId,
  cleanNotionToken,
  cleanAiModelName,
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

    it("should clean and extract Notion Database IDs safely, even with query params and views", () => {
      expect(
        cleanNotionDatabaseId("https://www.notion.so/myorg/8a92f0b3c4d5e6f7a8b9c0d1e2f3a4b5?v=99999999999999999999999999999999")
      ).toBe("8a92f0b3c4d5e6f7a8b9c0d1e2f3a4b5");
      expect(
        cleanNotionDatabaseId("https://notion.so/workspace/Videojuegos-8a92f0b3-c4d5-e6f7-a8b9-c0d1e2f3a4b5?v=123")
      ).toBe("8a92f0b3-c4d5-e6f7-a8b9-c0d1e2f3a4b5");
      expect(cleanNotionDatabaseId('"8a92f0b3c4d5e6f7a8b9c0d1e2f3a4b5"')).toBe("8a92f0b3c4d5e6f7a8b9c0d1e2f3a4b5");
      expect(cleanNotionDatabaseId("")).toBe("");
    });

    it("should normalize AI model names converting spaces to hyphens", () => {
      expect(cleanAiModelName("gemini 3.8 flash")).toBe("gemini-3.8-flash");
      expect(cleanAiModelName("  gemini 2.5 flash  ")).toBe("gemini-2.5-flash");
      expect(cleanAiModelName('"gemini-1.5-pro"')).toBe("gemini-1.5-pro");
      expect(cleanAiModelName("")).toBe("");
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
        notionGenres: JSON.stringify(["RPG", "Aventura"]),
        rating: 4.8,
        completedAt: "2026-10-25",
        userNotes: "Una obra maestra absoluta de los RPG de mundo abierto.",
        personalSummary: "Una obra maestra absoluta de los RPG de mundo abierto.",
        status: "Jugando",
        platform: "PC",
      });

      expect(game).toBeDefined();
      expect(game.id).toBeDefined();
      expect(game.title).toBe("The Witcher 3: Wild Hunt™");
      expect(game.cleanTitle).toBe("the witcher 3 wild hunt");
      expect(game.steamAppId).toBe(292030);
      expect(game.rating).toBe(4.8);
      expect(game.completedAt).toBe("2026-10-25");
      expect(game.userNotes).toBe("Una obra maestra absoluta de los RPG de mundo abierto.");
      expect(game.personalSummary).toBe("Una obra maestra absoluta de los RPG de mundo abierto.");
      expect(JSON.parse(game.notionGenres)).toEqual(["RPG", "Aventura"]);
      createdGameId = game.id;
    });

    it("should find game by different identifiers including cleanTitle", async () => {
      const byId = await gameRepository.findById(createdGameId);
      expect(byId?.title).toBe("The Witcher 3: Wild Hunt™");
      expect(byId?.rating).toBe(4.8);
      expect(byId?.completedAt).toBe("2026-10-25");
      expect(byId?.userNotes).toBe("Una obra maestra absoluta de los RPG de mundo abierto.");
      expect(byId?.personalSummary).toBe("Una obra maestra absoluta de los RPG de mundo abierto.");
      expect(JSON.parse(byId?.notionGenres || "[]")).toEqual(["RPG", "Aventura"]);

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

    it("should list games with filters including all=true", async () => {
      const result = await gameRepository.list({ search: "Witcher", status: "Jugado" });
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.items.some((g) => g.id === createdGameId)).toBe(true);

      const allResult = await gameRepository.list({ all: true });
      expect(allResult.total).toBeGreaterThanOrEqual(1);
      expect(allResult.items.length).toBe(allResult.total);
    });

    it("should synchronize aliased columns on create (completedAt/completionDate, userNotes/summary, genres/notionGenres)", async () => {
      const aliasTestId = "test-notion-alias-sync";
      const created = await gameRepository.upsert({
        notionPageId: aliasTestId,
        title: "Celeste",
        completedAt: "2024-01-15",
        userNotes: "Plataformas desafiante y conmovedor.",
        genres: JSON.stringify(["Plataformas", "Indie"]),
      });

      expect(created.completedAt).toBe("2024-01-15");
      expect(created.completionDate).toBe("2024-01-15");
      expect(created.userNotes).toBe("Plataformas desafiante y conmovedor.");
      expect(created.personalSummary).toBe("Plataformas desafiante y conmovedor.");
      expect(created.summary).toBe("Plataformas desafiante y conmovedor.");
      expect(created.notionGenres).toBe(JSON.stringify(["Plataformas", "Indie"]));

      await gameRepository.delete(created.id);
    });

    it("should coalesce and unify game record on cleanTitle or steamAppId match (anti-split-brain)", async () => {
      // 1. Crear juego inicial desde Notion sin steamAppId
      const initial = await gameRepository.upsert({
        notionPageId: "notion-split-test-1",
        title: "Hollow Knight: Silksong",
        cleanTitle: "hollow knight silksong",
        playtimeForever: 5.0,
      });

      expect(initial.steamAppId).toBeNull();
      expect(initial.notionPageId).toBe("notion-split-test-1");

      // 2. Simular upsert desde Steam con notionPageId diferente pero mismo cleanTitle
      const coalesced = await gameRepository.upsert({
        notionPageId: "notion-split-test-2",
        title: "Hollow Knight Silksong",
        cleanTitle: "hollow knight silksong",
        steamAppId: 1030300,
        playtimeForever: 12.5,
      });

      // Debe ser el MISMO registro ID coalescido
      expect(coalesced.id).toBe(initial.id);
      expect(coalesced.steamAppId).toBe(1030300);
      expect(coalesced.notionPageId).toBe("notion-split-test-2");
      expect(coalesced.playtimeForever).toBe(12.5);

      // Verificar que no existe un duplicado en la base de datos
      const allMatches = await gameRepository.list({ search: "Silksong" });
      expect(allMatches.total).toBe(1);

      await gameRepository.delete(initial.id);
    });

    it("should merge daily playtimes and inherit metadata without data loss during anti-split-brain coalescence", async () => {
      // 1. Crear juego A con metadata y dailyPlaytime
      const gameA = await gameRepository.upsert({
        notionPageId: "notion-split-merge-a",
        title: "Dead Cells",
        cleanTitle: "dead cells",
        playtimeForever: 10.0,
        rating: 4.8,
        completedAt: "2024-03-01",
        coverUrl: "https://example.com/deadcells-a.jpg",
      });

      // Registrar 60 minutos en fecha 2026-10-01 y 30 minutos en 2026-10-02 para juego A
      await dailyPlaytimeRepository.recordPlaytime("2026-10-01", gameA.id, 60);
      await dailyPlaytimeRepository.recordPlaytime("2026-10-02", gameA.id, 30);

      // 2. Crear juego B independiente (simulando divergencia previa) con su propio steamAppId y dailyPlaytime
      const gameB = await prisma.game.create({
        data: {
          notionPageId: "notion-split-merge-b",
          title: "Dead Cells (PC)",
          cleanTitle: "dead cells pc",
          steamAppId: 588650,
          playtimeForever: 25.0,
          userNotes: "Excelente rogue-lite con combate veloz.",
        },
      });

      // Registrar 45 minutos en 2026-10-01 (misma fecha que A) y 50 minutos en 2026-10-03 (fecha exclusiva de B)
      await dailyPlaytimeRepository.recordPlaytime("2026-10-01", gameB.id, 45);
      await dailyPlaytimeRepository.recordPlaytime("2026-10-03", gameB.id, 50);

      // Registrar sesión en juego B
      await sessionRepository.startSession(gameB.id, 588650);

      // 3. Ejecutar upsert coalesciendo con cleanTitle "dead cells" y steamAppId 588650
      const coalesced = await gameRepository.upsert({
        notionPageId: "notion-split-merge-a",
        title: "Dead Cells",
        cleanTitle: "dead cells",
        steamAppId: 588650,
        playtimeForever: 30.0,
      });

      expect(coalesced.id).toBe(gameA.id);
      expect(coalesced.steamAppId).toBe(588650);
      expect(coalesced.rating).toBe(4.8); // Preservado de A
      expect(coalesced.completedAt).toBe("2024-03-01"); // Preservado de A
      expect(coalesced.coverUrl).toBe("https://example.com/deadcells-a.jpg"); // Preservado de A
      expect(coalesced.userNotes).toBe("Excelente rogue-lite con combate veloz."); // Heredado de B

      // Verificar que el juego B divergente fue eliminado
      const oldB = await gameRepository.findById(gameB.id);
      expect(oldB).toBeNull();

      // Verificar que las sesiones de B migraron a A
      const sessions = await prisma.gameSession.findMany({ where: { gameId: gameA.id } });
      expect(sessions.length).toBeGreaterThanOrEqual(1);

      // Verificar que DailyPlaytime se combinó sin pérdida de datos
      const dp1 = await prisma.dailyPlaytime.findUnique({
        where: { date_gameId: { date: "2026-10-01", gameId: gameA.id } },
      });
      expect(dp1).not.toBeNull();
      expect(dp1?.minutes).toBe(105); // 60 (A) + 45 (B) combinados!

      const dp2 = await prisma.dailyPlaytime.findUnique({
        where: { date_gameId: { date: "2026-10-02", gameId: gameA.id } },
      });
      expect(dp2?.minutes).toBe(30);

      const dp3 = await prisma.dailyPlaytime.findUnique({
        where: { date_gameId: { date: "2026-10-03", gameId: gameA.id } },
      });
      expect(dp3?.minutes).toBe(50); // Fecha exclusiva de B migrada intacta a A!

      await gameRepository.delete(gameA.id);
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

    it("should persist completionDate and coalesce divergent movie records on cleanTitle match", async () => {
      // 1. Crear película inicial desde Notion con completionDate
      const movie1 = await movieRepository.upsert({
        notionPageId: "notion-movie-coalesce-1",
        title: "Interstellar",
        cleanTitle: "interstellar",
        completionDate: "2024-01-20",
        rating: 4.9,
      });

      expect(movie1.completionDate).toBe("2024-01-20");

      // 2. Upsert con diferente notionPageId pero mismo cleanTitle y con tmdbId
      const movie2 = await movieRepository.upsert({
        notionPageId: "notion-movie-coalesce-2",
        title: "Interstellar (2014)",
        cleanTitle: "interstellar",
        tmdbId: 157336,
        overview: "Un grupo de exploradores espaciales viajan a través de un agujero de gusano...",
      });

      // Debe coalescer en el mismo registro y conservar completionDate y rating
      expect(movie2.id).toBe(movie1.id);
      expect(movie2.tmdbId).toBe(157336);
      expect(movie2.completionDate).toBe("2024-01-20");
      expect(movie2.rating).toBe(4.9);
      expect(movie2.overview).toContain("agujero de gusano");

      const allMatches = await movieRepository.list({ search: "Interstellar" });
      expect(allMatches.total).toBe(1);

      await movieRepository.delete(movie1.id);
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
