import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/app";
import { prisma, configurePragmas } from "@repo/database";

describe("Games Controller API (/api/games)", () => {
  const testNotionPageId = "test-hono-game-1";
  let createdGameId: string;

  beforeAll(async () => {
    await configurePragmas(prisma);

    // Limpiar registros previos
    await prisma.game.deleteMany({
      where: {
        OR: [
          { notionPageId: testNotionPageId },
          { notionPageId: "test-hono-game-2" },
        ],
      },
    });

    const game = await prisma.game.create({
      data: {
        notionPageId: testNotionPageId,
        title: "Elden Ring: Shadow of the Erdtree",
        cleanTitle: "elden ring shadow of the erdtree",
        steamAppId: 2778580,
        playtimeForever: 35.5,
        playtimeNotion: 35.5,
        hltbMain: 25.0,
        hltbCompletionist: 50.0,
        status: "Jugando",
        platform: "PC",
        genres: JSON.stringify(["Action RPG", "Open World"]),
        notionGenres: JSON.stringify(["Action RPG", "Open World"]),
        rating: 4.9,
        completedAt: "2024-06-25",
        completionDate: "2024-06-25",
        userNotes: "Excelente expansión, dificultad sublime.",
        personalSummary: "Excelente expansión, dificultad sublime.",
        summary: "Excelente expansión, dificultad sublime.",
      },
    });
    createdGameId = game.id;

    // Crear enriquecimiento IA de prueba
    await prisma.aiEnrichment.upsert({
      where: {
        targetType_targetId: {
          targetType: "GAME",
          targetId: game.id,
        },
      },
      update: {},
      create: {
        targetType: "GAME",
        targetId: game.id,
        vibeTags: JSON.stringify(["Desafío Épico", "Fantasía Oscura"]),
        personalizedPitch: "Una obra maestra de exploración castigadora y gratificante.",
        thematicTropes: JSON.stringify(["Souls-like", "Jefes Memorables"]),
        completionEstimateWeeks: 4.0,
        provider: "gemini",
        modelUsed: "gemini-2.5-flash",
      },
    });
  });

  afterAll(async () => {
    await prisma.game.deleteMany({
      where: {
        OR: [
          { notionPageId: testNotionPageId },
          { notionPageId: "test-hono-game-2" },
        ],
      },
    });
  });

  it("GET /api/games should list games with pagination and parsed AI enrichment", async () => {
    const res = await app.request("/api/games?limit=10&offset=0");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);

    const testGame = body.data.find((g: any) => g.id === createdGameId);
    expect(testGame).toBeDefined();
    expect(testGame.title).toBe("Elden Ring: Shadow of the Erdtree");
    expect(testGame.genres).toEqual(["Action RPG", "Open World"]);
    expect(testGame.notionGenres).toEqual(["Action RPG", "Open World"]);
    expect(testGame.rating).toBe(4.9);
    expect(testGame.completedAt).toBe("2024-06-25");
    expect(testGame.userNotes).toBe("Excelente expansión, dificultad sublime.");
    expect(testGame.personalSummary).toBe("Excelente expansión, dificultad sublime.");
    expect(testGame.aiEnrichment).toBeDefined();
    expect(testGame.aiEnrichment.vibeTags).toContain("Desafío Épico");
  });

  it("GET /api/games should support limit=200 for rendering 117+ titles without truncation", async () => {
    const res = await app.request("/api/games?limit=200");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.pagination.limit).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/games should support all=true to fetch all titles without truncation", async () => {
    const res = await app.request("/api/games?all=true");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.pagination.limit).toBe(body.pagination.total);
    expect(body.data.length).toBe(body.pagination.total);
  });

  it("GET /api/games with filter by status should filter items correctly", async () => {
    const res = await app.request("/api/games?status=Jugando");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    for (const game of body.data) {
      expect(game.status).toBe("Jugando");
    }
  });

  it("GET /api/games with search query should match by title", async () => {
    const res = await app.request("/api/games?search=Erdtree");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.some((g: any) => g.id === createdGameId)).toBe(true);
  });

  it("GET /api/games/:id should return game by ID with rating, completedAt, userNotes, and notionGenres", async () => {
    const res = await app.request(`/api/games/${createdGameId}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdGameId);
    expect(body.data.cleanTitle).toBe("elden ring shadow of the erdtree");
    expect(body.data.rating).toBe(4.9);
    expect(body.data.completedAt).toBe("2024-06-25");
    expect(body.data.userNotes).toBe("Excelente expansión, dificultad sublime.");
    expect(body.data.personalSummary).toBe("Excelente expansión, dificultad sublime.");
    expect(body.data.notionGenres).toEqual(["Action RPG", "Open World"]);
  });

  it("GET /api/games/:id should return game by cleanTitle slug", async () => {
    const res = await app.request("/api/games/elden ring shadow of the erdtree");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdGameId);
  });

  it("GET /api/games/:id should return 404 for non-existent game", async () => {
    const res = await app.request("/api/games/non-existent-id-9999");
    expect(res.status).toBe(404);

    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain("no encontrado");
  });

  it("POST /api/games/sync should execute sync trigger successfully", async () => {
    const res = await app.request("/api/games/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceFullSync: true }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.durationMs).toBe("number");
  });
});
