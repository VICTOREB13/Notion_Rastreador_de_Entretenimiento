import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/app";
import { prisma, configurePragmas } from "@repo/database";

describe("Movies Controller API (/api/movies)", () => {
  const testNotionPageId = "test-hono-movie-1";
  let createdMovieId: string;

  beforeAll(async () => {
    await configurePragmas(prisma);

    await prisma.movie.deleteMany({
      where: { notionPageId: testNotionPageId },
    });

    const movie = await prisma.movie.create({
      data: {
        notionPageId: testNotionPageId,
        title: "Dune: Part Two",
        cleanTitle: "dune part two",
        tmdbId: 693134,
        posterUrl: "https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg",
        overview: "Paul Atreides se une a Chani y a los Fremen mientras busca venganza...",
        genres: JSON.stringify(["Ciencia Ficción", "Aventura"]),
        status: "Vista",
        year: 2024,
      },
    });
    createdMovieId = movie.id;

    await prisma.aiEnrichment.upsert({
      where: {
        targetType_targetId: {
          targetType: "MOVIE",
          targetId: movie.id,
        },
      },
      update: {},
      create: {
        targetType: "MOVIE",
        targetId: movie.id,
        vibeTags: JSON.stringify(["Épica Desértica", "Tensión Mesiánica"]),
        personalizedPitch: "Una escala audiovisual colosal donde cada grano de arena cuenta.",
        thematicTropes: JSON.stringify(["Profecía", "Guerra Santa"]),
        provider: "gemini",
        modelUsed: "gemini-2.5-flash",
      },
    });
  });

  afterAll(async () => {
    await prisma.movie.deleteMany({
      where: { notionPageId: testNotionPageId },
    });
  });

  it("GET /api/movies should list movies with pagination and parsed genres", async () => {
    const res = await app.request("/api/movies?limit=10&offset=0");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);

    const testMovie = body.data.find((m: any) => m.id === createdMovieId);
    expect(testMovie).toBeDefined();
    expect(testMovie.title).toBe("Dune: Part Two");
    expect(testMovie.genres).toEqual(["Ciencia Ficción", "Aventura"]);
    expect(testMovie.aiEnrichment).toBeDefined();
    expect(testMovie.aiEnrichment.vibeTags).toContain("Épica Desértica");
  });

  it("GET /api/movies with filter by status and year should filter correctly", async () => {
    const res = await app.request("/api/movies?status=Vista&year=2024");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    for (const movie of body.data) {
      expect(movie.status).toBe("Vista");
      expect(movie.year).toBe(2024);
    }
  });

  it("GET /api/movies/:id should return movie by ID", async () => {
    const res = await app.request(`/api/movies/${createdMovieId}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdMovieId);
    expect(body.data.tmdbId).toBe(693134);
  });

  it("GET /api/movies/:id should return movie by cleanTitle", async () => {
    const res = await app.request("/api/movies/dune part two");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdMovieId);
  });

  it("GET /api/movies/:id should return 404 for non-existent movie", async () => {
    const res = await app.request("/api/movies/non-existent-movie-slug");
    expect(res.status).toBe(404);

    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
  });

  it("POST /api/movies/enrich should return enriched status for valid movieId", async () => {
    const res = await app.request("/api/movies/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: createdMovieId }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdMovieId);
    expect(body.data.enriched).toBe(true);
  });
});
