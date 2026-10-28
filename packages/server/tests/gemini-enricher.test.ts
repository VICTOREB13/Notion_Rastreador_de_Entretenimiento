import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/app";
import { prisma, configurePragmas } from "@repo/database";
import { GeminiClient, geminiClient, type GenAiClientLike } from "../src/clients/gemini.client";
import { GeminiEnricherService } from "../src/services/gemini-enricher.service";

describe("Gemini Enricher Service & Hono Endpoints (Fase 4)", () => {
  const testGamePageId = "test-gemini-game-1";
  const testMoviePageId = "test-gemini-movie-1";
  let gameId: string;
  let movieId: string;

  let mockCallCount = 0;
  let lastModelUsed = "";
  let lastPrompt = "";

  const mockGenAiClient: GenAiClientLike = {
    models: {
      async generateContent(params) {
        mockCallCount++;
        lastModelUsed = params.model;
        lastPrompt = params.contents;

        if (params.contents.includes("OK")) {
          return { text: "OK" };
        }

        if (params.contents.includes("markdown-fenced-test")) {
          return {
            text: "```json\n" + JSON.stringify({
              vibeTags: "Cyberpunk, Neon",
              personalizedPitch: "Great atmosphere.",
              thematicTropes: "Noir, Hacking",
              completionEstimateWeeks: "4.5",
            }) + "\n```",
          };
        }

        const isGame = params.contents.includes("videojuego");
        const sampleResponse = isGame
          ? {
              vibeTags: ["Distopía Neón", "Adrenalina Pura", "Inmersión Nocturna"],
              personalizedPitch:
                "Una inmersión brutal en las calles cibernéticas perfecta para sesiones intensas nocturnas.",
              thematicTropes: ["Ciberimplantes", "Mega-Corporaciones", "Anti-Héroe"],
              completionEstimateWeeks: 3.5,
            }
          : {
              vibeTags: ["Tensión Histórica", "Cine de Autor", "Dilema Moral"],
              personalizedPitch:
                "Un viaje sobrecogedor a la mente de los artífices de la era atómica con una puesta en escena monumental.",
              thematicTropes: ["Destrucción Mutua", "Culpa Existencial", "Drama Político"],
              completionEstimateWeeks: 0,
            };

        return {
          text: JSON.stringify(sampleResponse),
        };
      },
    },
  };

  let mockNotionUpdated = false;
  let mockNotionProps: Record<string, any> = {};

  const mockNotionClient: any = {
    async updatePageProperties(pageId: string, properties: Record<string, unknown>) {
      mockNotionUpdated = true;
      mockNotionProps = properties;
    },
  };

  let testGeminiClient: GeminiClient;
  let enricherService: GeminiEnricherService;

  beforeAll(async () => {
    await configurePragmas(prisma);

    // Limpiar datos previos
    await prisma.aiEnrichment.deleteMany({
      where: {
        OR: [{ targetType: "GAME" }, { targetType: "MOVIE" }],
      },
    });
    await prisma.game.deleteMany({ where: { notionPageId: testGamePageId } });
    await prisma.movie.deleteMany({ where: { notionPageId: testMoviePageId } });

    // Configurar cliente de prueba y mockear singleton para las rutas HTTP de app
    geminiClient.setCustomClient(mockGenAiClient);
    testGeminiClient = new GeminiClient("fake-key-for-testing", mockGenAiClient);
    enricherService = new GeminiEnricherService(
      testGeminiClient,
      undefined,
      undefined,
      undefined,
      undefined,
      mockNotionClient
    );

    // Crear juego de prueba
    const game = await prisma.game.create({
      data: {
        notionPageId: testGamePageId,
        title: "Cyberpunk 2077: Phantom Liberty",
        cleanTitle: "cyberpunk 2077 phantom liberty",
        steamAppId: 1091500,
        playtimeForever: 45.2,
        hltbMain: 20.0,
        hltbCompletionist: 40.0,
        genres: JSON.stringify(["Action RPG", "Cyberpunk", "Open World"]),
        platform: "PC",
        status: "Jugando",
      },
    });
    gameId = game.id;

    // Crear película de prueba
    const movie = await prisma.movie.create({
      data: {
        notionPageId: testMoviePageId,
        title: "Oppenheimer (2023)",
        cleanTitle: "oppenheimer 2023",
        tmdbId: 872585,
        overview: "La historia del físico estadounidense J. Robert Oppenheimer al frente del Proyecto Manhattan.",
        genres: JSON.stringify(["Drama", "Historia"]),
        year: 2023,
        status: "Vista",
      },
    });
    movieId = movie.id;
  });

  afterAll(async () => {
    await prisma.aiEnrichment.deleteMany({
      where: {
        OR: [
          { targetType: "GAME", targetId: gameId },
          { targetType: "MOVIE", targetId: movieId },
        ],
      },
    });
    await prisma.game.deleteMany({ where: { notionPageId: testGamePageId } });
    await prisma.movie.deleteMany({ where: { notionPageId: testMoviePageId } });
    geminiClient.setCustomClient(undefined);
  });

  describe("GeminiClient Unit Tests", () => {
    it("should build structured prompt containing game attributes", () => {
      const prompt = testGeminiClient.buildPrompt({
        title: "Test Game",
        type: "GAME",
        genres: ["RPG", "Sci-Fi"],
        playtimeOrDuration: "25h",
        userContext: "Status: Jugando",
      });

      expect(prompt).toContain("Test Game");
      expect(prompt).toContain("RPG, Sci-Fi");
      expect(prompt).toContain("vibeTags");
      expect(prompt).toContain("personalizedPitch");
      expect(prompt).toContain("thematicTropes");
      expect(prompt).toContain("completionEstimateWeeks");
    });

    it("should generate enrichment matching schema with custom model override", async () => {
      const initialCount = mockCallCount;
      const result = await testGeminiClient.generateEnrichment(
        {
          title: "Hollow Knight",
          type: "GAME",
          genres: ["Metroidvania", "Souls-like"],
        },
        "gemini-1.5-pro",
        "mock-key"
      );

      expect(mockCallCount).toBe(initialCount + 1);
      expect(lastModelUsed).toBe("gemini-1.5-pro");
      expect(result.vibeTags.length).toBeGreaterThan(0);
      expect(typeof result.personalizedPitch).toBe("string");
      expect(result.thematicTropes.length).toBeGreaterThan(0);
      expect(typeof result.completionEstimateWeeks).toBe("number");
    });

    it("should handle markdown code fences and coerce string properties safely", async () => {
      const result = await testGeminiClient.generateEnrichment(
        {
          title: "markdown-fenced-test",
          type: "GAME",
          genres: ["Cyberpunk"],
        },
        "gemini-2.5-flash",
        "mock-key"
      );

      expect(result.vibeTags).toEqual(["Cyberpunk", "Neon"]);
      expect(result.personalizedPitch).toBe("Great atmosphere.");
      expect(result.thematicTropes).toEqual(["Noir", "Hacking"]);
      expect(result.completionEstimateWeeks).toBe(4.5);
    });

    it("should test connection successfully", async () => {
      const ok = await testGeminiClient.testConnection("mock-key");
      expect(ok).toBe(true);
    });

    it("should throw error if no API key is available when constructing default client", () => {
      const unconfiguredClient = new GeminiClient("");
      expect(() => unconfiguredClient.getClient("")).toThrow("GEMINI_API_KEY no configurada");
    });
  });

  describe("GeminiEnricherService Integration Tests", () => {
    it("should enrich a game, save to SQLite, and update Notion properties", async () => {
      mockNotionUpdated = false;
      const initialCallCount = mockCallCount;

      const result = await enricherService.enrichGame(gameId, {
        force: true,
        model: "gemini-2.5-flash",
        syncToNotion: true,
      });

      expect(result.cached).toBe(false);
      expect(result.game.id).toBe(gameId);
      expect(result.enrichment.vibeTags).toContain("Distopía Neón");
      expect(result.enrichment.completionEstimateWeeks).toBe(3.5);
      expect(mockCallCount).toBe(initialCallCount + 1);
      expect(lastModelUsed).toBe("gemini-2.5-flash");

      // Verificar persistencia en SQLite
      const inDb = await prisma.aiEnrichment.findUnique({
        where: { targetType_targetId: { targetType: "GAME", targetId: gameId } },
      });
      expect(inDb).toBeDefined();
      expect(inDb?.modelUsed).toBe("gemini-2.5-flash");
      expect(JSON.parse(inDb?.vibeTags || "[]")).toContain("Distopía Neón");

      // Verificar que se invocó la sincronización con Notion
      expect(mockNotionUpdated).toBe(true);
      expect(mockNotionProps["Vibe IA"]).toBeDefined();
      expect(mockNotionProps["Pitch IA"]).toBeDefined();
    });

    it("should return cached enrichment on subsequent calls without force", async () => {
      const callCountBefore = mockCallCount;

      const result = await enricherService.enrichGame(gameId, {
        force: false,
      });

      expect(result.cached).toBe(true);
      expect(result.enrichment.vibeTags).toContain("Distopía Neón");
      // No debe llamar a Gemini de nuevo
      expect(mockCallCount).toBe(callCountBefore);
    });

    it("should re-generate when force=true is provided", async () => {
      const callCountBefore = mockCallCount;

      const result = await enricherService.enrichGame(gameId, {
        force: true,
        model: "gemini-1.5-flash",
      });

      expect(result.cached).toBe(false);
      expect(mockCallCount).toBe(callCountBefore + 1);
      expect(lastModelUsed).toBe("gemini-1.5-flash");
    });

    it("should enrich a movie and cache the result", async () => {
      const result = await enricherService.enrichMovie(movieId, {
        force: true,
      });

      expect(result.cached).toBe(false);
      expect(result.movie.id).toBe(movieId);
      expect(result.enrichment.vibeTags).toContain("Tensión Histórica");

      // Verificar caché
      const cachedResult = await enricherService.enrichMovie(movieId, { force: false });
      expect(cachedResult.cached).toBe(true);
    });

    it("should throw error when target game or movie does not exist", async () => {
      expect(enricherService.enrichGame("non-existent-id")).rejects.toThrow("no encontrado");
      expect(enricherService.enrichMovie("non-existent-id")).rejects.toThrow("no encontrada");
    });
  });

  describe("Hono Enrichment Endpoints (/api/games & /api/movies)", () => {
    it("POST /api/games/:id/enrich should enrich game via HTTP and return result", async () => {
      const res = await app.request(`/api/games/${gameId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.gameId).toBe(gameId);
      expect(body.data.enrichment).toBeDefined();
      expect(body.data.cached).toBe(true);
    });

    it("GET /api/games/:id/enrichment should retrieve enrichment for existing game", async () => {
      const res = await app.request(`/api/games/${gameId}/enrichment`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.vibeTags).toContain("Distopía Neón");
      expect(body.data.personalizedPitch).toBeDefined();
    });

    it("GET /api/games/:id/enrichment should return 404 for non-existent game", async () => {
      const res = await app.request("/api/games/non-existent-game-404/enrichment");
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
    });

    it("POST /api/movies/:id/enrich should enrich movie via HTTP", async () => {
      const res = await app.request(`/api/movies/${movieId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.movieId).toBe(movieId);
      expect(body.data.enrichment).toBeDefined();
    });

    it("GET /api/movies/:id/enrichment should retrieve enrichment for existing movie", async () => {
      const res = await app.request(`/api/movies/${movieId}/enrichment`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.vibeTags).toContain("Tensión Histórica");
    });

    it("GET /api/movies/:id/enrichment should return 404 for non-existent movie", async () => {
      const res = await app.request("/api/movies/non-existent-movie-404/enrichment");
      expect(res.status).toBe(404);
    });

    it("POST /api/settings/ai/test should test AI provider connection", async () => {
      const res = await app.request("/api/settings/ai/test", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.provider).toBe("gemini");
      expect(typeof body.connected).toBe("boolean");
    });

    it("POST /api/settings/ai/test should accept custom apiKey and model in body", async () => {
      const res = await app.request("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "custom-api-key",
          model: "gemini-1.5-pro",
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.provider).toBe("gemini");
      expect(body.model).toBe("gemini-1.5-pro");
      expect(typeof body.connected).toBe("boolean");
    });
  });

  describe("AiEnrichmentRepository Batching (Anti N+1)", () => {
    it("findManyByTargets should retrieve multiple enrichments in a single query", async () => {
      const { aiEnrichmentRepository } = await import("@repo/database");
      const map = await aiEnrichmentRepository.findManyByTargets("GAME", [gameId, "dummy-id"]);

      expect(map instanceof Map).toBe(true);
      expect(map.has(gameId)).toBe(true);
      expect(map.get(gameId)?.vibeTags).toContain("Distopía Neón");
      expect(map.has("dummy-id")).toBe(false);
    });
  });
});

