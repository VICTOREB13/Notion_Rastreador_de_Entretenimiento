import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  prisma,
  configurePragmas,
  type INotionSyncClient,
  type NotionPageDelta,
} from "@repo/database";
import { NotionSyncService } from "../src/services/notion-sync.service";
import { GameRepository } from "../../database/src/repositories/game.repository";
import { MovieRepository } from "../../database/src/repositories/movie.repository";

class MockNotionClient implements INotionSyncClient {
  public modifiedPagesResponse: NotionPageDelta[] = [];
  public allPagesResponse: NotionPageDelta[] = [];
  public queryDatabaseCalls: Array<{ dbId: string; filter?: any }> = [];

  async fetchModifiedPages(databaseId: string, lastEditedAfter: Date): Promise<NotionPageDelta[]> {
    this.queryDatabaseCalls.push({ dbId: databaseId, filter: { after: lastEditedAfter } });
    return this.modifiedPagesResponse;
  }

  async fetchAllPages(databaseId: string): Promise<NotionPageDelta[]> {
    this.queryDatabaseCalls.push({ dbId: databaseId });
    return this.allPagesResponse;
  }

  async queryDatabase(databaseId: string, filter?: Record<string, unknown>): Promise<NotionPageDelta[]> {
    this.queryDatabaseCalls.push({ dbId: databaseId, filter });
    return this.allPagesResponse;
  }

  async createPage(databaseId: string, properties: Record<string, unknown>): Promise<string> {
    return "created-page-id";
  }

  async updatePageProperties(pageId: string, properties: Record<string, unknown>): Promise<void> {}
}

describe("NotionSyncService (Intelligent Delta Polling & Anti-Loop Guard)", () => {
  let mockNotion: MockNotionClient;
  let gameRepo: GameRepository;
  let movieRepo: MovieRepository;
  let syncService: NotionSyncService;

  const gamePageId1 = "notion-game-page-1";
  const moviePageId1 = "notion-movie-page-1";

  beforeAll(async () => {
    await configurePragmas(prisma);

    await prisma.game.deleteMany({
      where: {
        OR: [
          { notionPageId: gamePageId1 },
          { notionPageId: "notion-game-archived" },
        ],
      },
    });

    await prisma.movie.deleteMany({
      where: { notionPageId: moviePageId1 },
    });

    mockNotion = new MockNotionClient();
    gameRepo = new GameRepository();
    movieRepo = new MovieRepository();

    syncService = new NotionSyncService(
      mockNotion,
      gameRepo,
      movieRepo,
      "dummy-games-db",
      "dummy-movies-db"
    );
  });

  afterAll(async () => {
    await prisma.game.deleteMany({
      where: {
        OR: [
          { notionPageId: gamePageId1 },
          { notionPageId: "notion-game-archived" },
        ],
      },
    });

    await prisma.movie.deleteMany({
      where: { notionPageId: moviePageId1 },
    });
  });

  it("should ingest a new game from Notion with rich properties", async () => {
    mockNotion.allPagesResponse = [
      {
        id: gamePageId1,
        lastEditedTime: "2026-10-25T12:00:00.000Z",
        properties: {
          Título: { title: [{ text: { content: "Metaphor: ReFantazio" } }] },
          "Steam ID": { number: 2620600 },
          "Horas Jugadas": { number: 18.5 },
          "HLTB Principal": { number: 65.0 },
          "HLTB Completista": { number: 105.0 },
          Portada: { files: [{ file: { url: "https://notion.so/cover.png" } }] },
          Géneros: { multi_select: [{ name: "JRPG" }, { name: "Turn-Based" }] },
          Link: { url: "https://store.steampowered.com/app/2620600" },
          Plataforma: { select: { name: "PC" } },
          Estado: { status: { name: "Jugando" } },
        },
      },
    ];

    const stats = await syncService.syncGames(true);
    expect(stats.gamesProcessed).toBe(1);
    expect(stats.gamesCreated).toBe(1);

    const saved = await gameRepo.findByNotionPageId(gamePageId1);
    expect(saved).not.toBeNull();
    expect(saved?.title).toBe("Metaphor: ReFantazio");
    expect(saved?.cleanTitle).toBe("metaphor refantazio");
    expect(saved?.steamAppId).toBe(2620600);
    expect(saved?.playtimeForever).toBe(18.5);
    expect(saved?.status).toBe("Jugando");
    expect(saved?.coverUrl).toBe("https://notion.so/cover.png");
    expect(JSON.parse(saved?.genres || "[]")).toEqual(["JRPG", "Turn-Based"]);
  });

  it("should handle tombstones by deleting existing records and ignoring non-existent archived pages", async () => {
    // 1. Crear un juego que posteriormente será archivado
    await gameRepo.upsert({
      notionPageId: "notion-game-to-delete",
      title: "Game To Delete",
      cleanTitle: "game to delete",
      status: "Por Jugar",
    });

    const beforeDelete = await gameRepo.findByNotionPageId("notion-game-to-delete");
    expect(beforeDelete).not.toBeNull();

    // 2. Simular delta poll con tombstone (archived: true)
    mockNotion.allPagesResponse = [
      {
        id: "notion-game-to-delete",
        lastEditedTime: "2026-10-25T13:00:00.000Z",
        archived: true,
        properties: {},
      },
      {
        id: "notion-game-archived-never-existed",
        lastEditedTime: "2026-10-25T13:00:00.000Z",
        archived: true,
        properties: {},
      },
    ];

    const stats = await syncService.syncGames(true);
    expect(stats.gamesProcessed).toBe(0);

    // Debe haberse eliminado de SQLite
    const afterDelete = await gameRepo.findByNotionPageId("notion-game-to-delete");
    expect(afterDelete).toBeNull();

    const neverExisted = await gameRepo.findByNotionPageId("notion-game-archived-never-existed");
    expect(neverExisted).toBeNull();
  });

  it("should enforce anti-loop guard and skip unchanged records", async () => {
    // La página tiene un timestamp anterior o igual al último sync
    mockNotion.allPagesResponse = [
      {
        id: gamePageId1,
        lastEditedTime: "2026-10-25T11:00:00.000Z", // Más viejo que la sincronización anterior
        properties: {
          Título: { title: [{ text: { content: "Metaphor: ReFantazio" } }] },
          "Horas Jugadas": { number: 18.5 },
        },
      },
    ];

    const stats = await syncService.syncGames(true);
    expect(stats.gamesProcessed).toBe(1);
    expect(stats.gamesUpdated).toBe(0); // El anti-loop guard evitó la escritura innecesaria
  });

  it("should preserve manual lock: cannot overwrite 'Jugado' status back to 'Por Jugar'", async () => {
    // 1. Marcar juego localmente como "Jugado"
    const game = await gameRepo.findByNotionPageId(gamePageId1);
    await gameRepo.updateStatus(game!.id, "Jugado");

    // 2. Notion intenta ponerlo como "Por Jugar" con un timestamp nuevo
    mockNotion.allPagesResponse = [
      {
        id: gamePageId1,
        lastEditedTime: new Date(Date.now() + 60000).toISOString(),
        properties: {
          Título: { title: [{ text: { content: "Metaphor: ReFantazio" } }] },
          Estado: { status: { name: "Por Jugar" } },
        },
      },
    ];

    const stats = await syncService.syncGames(true);
    expect(stats.gamesUpdated).toBe(1);

    // 3. El estado en la DB sigue siendo "Jugado" (Zero-Overwrite Policy)
    const updated = await gameRepo.findByNotionPageId(gamePageId1);
    expect(updated?.status).toBe("Jugado");
  });

  it("should sync movies, extract year from title '(YYYY)', and parse movie attributes", async () => {
    mockNotion.allPagesResponse = [
      {
        id: moviePageId1,
        lastEditedTime: "2026-10-25T14:00:00.000Z",
        properties: {
          Título: { title: [{ text: { content: "Spider-Man: Across the Spider-Verse (2023)" } }] },
          Resumen: { rich_text: [{ text: { content: "Miles Morales viaja a través del Multiverso..." } }] },
          Géneros: { multi_select: [{ name: "Animación" }, { name: "Superhéroes" }] },
          Link: { url: "https://es.wikipedia.org/wiki/Spider-Man:_Across_the_Spider-Verse" },
          Estado: { status: { name: "Vista" } },
        },
      },
    ];

    const stats = await syncService.syncMovies(true);
    expect(stats.moviesCreated).toBe(1);

    const savedMovie = await movieRepo.findByNotionPageId(moviePageId1);
    expect(savedMovie).not.toBeNull();
    expect(savedMovie?.title).toBe("Spider-Man: Across the Spider-Verse");
    expect(savedMovie?.cleanTitle).toBe("spider man across the spider verse");
    expect(savedMovie?.year).toBe(2023); // Año extraído del regex
    expect(savedMovie?.status).toBe("Vista");
    expect(savedMovie?.overview).toContain("Miles Morales");
  });

  it("should extract rating, completion date, and user summary/opinion from Notion", async () => {
    const customGamePageId = "notion-game-custom-props";
    mockNotion.allPagesResponse = [
      {
        id: customGamePageId,
        lastEditedTime: "2026-10-25T15:00:00.000Z",
        properties: {
          Título: { title: [{ text: { content: "Elden Ring" } }] },
          Calificación: { select: { name: "⭐⭐⭐⭐⭐" } },
          "Fecha de Culminación (primera campaña)": { date: { start: "2024-03-15" } },
          Pensamiento: { rich_text: [{ text: { content: "Una obra maestra absoluta de diseño de mundo abierto." } }] },
          Géneros: { multi_select: [{ name: "Soulslike" }, { name: "RPG" }] },
          Estado: { status: { name: "Jugado" } },
        },
      },
    ];

    await syncService.syncGames(true);

    const savedGame = await gameRepo.findByNotionPageId(customGamePageId);
    expect(savedGame).not.toBeNull();
    expect(savedGame?.title).toBe("Elden Ring");
    expect(savedGame?.rating).toBe(5);
    expect(savedGame?.completionDate).toBe("2024-03-15");
    expect(savedGame?.completedAt).toBe("2024-03-15");
    expect(savedGame?.summary).toBe("Una obra maestra absoluta de diseño de mundo abierto.");
    expect(savedGame?.userNotes).toBe("Una obra maestra absoluta de diseño de mundo abierto.");
    expect(savedGame?.personalSummary).toBe("Una obra maestra absoluta de diseño de mundo abierto.");
    expect(JSON.parse((savedGame as any)?.notionGenres || "[]")).toEqual(["Soulslike", "RPG"]);

    // Limpieza
    await gameRepo.delete(savedGame!.id);
  });

  it("should extract numeric ratings, Fecha de Finalización, and ignore external Sinopsis", async () => {
    const customGamePageId2 = "notion-game-custom-props-2";
    mockNotion.allPagesResponse = [
      {
        id: customGamePageId2,
        lastEditedTime: "2026-10-25T16:00:00.000Z",
        properties: {
          Título: { title: [{ text: { content: "Hades II" } }] },
          "Calificación Personal": { number: 4.5 },
          "Fecha de Finalización": { date: { start: "2024-05-10" } },
          Sinopsis: { rich_text: [{ text: { content: "Sinopsis externa oficial del juego sobre Melinoë." } }] },
          Notas: { rich_text: [{ text: { content: "Excelente combate roguelike y banda sonora." } }] },
          Genres: { multi_select: [{ name: "Roguelike" }, { name: "Action" }] },
          Estado: { status: { name: "Jugado" } },
        },
      },
    ];

    await syncService.syncGames(true);

    const savedGame = await gameRepo.findByNotionPageId(customGamePageId2);
    expect(savedGame).not.toBeNull();
    expect(savedGame?.title).toBe("Hades II");
    expect(savedGame?.rating).toBe(4.5);
    expect(savedGame?.completedAt).toBe("2024-05-10");
    expect(savedGame?.completionDate).toBe("2024-05-10");
    // Verificar que extrajo las notas personales y NO la sinopsis externa
    expect(savedGame?.userNotes).toBe("Excelente combate roguelike y banda sonora.");
    expect(savedGame?.personalSummary).toBe("Excelente combate roguelike y banda sonora.");
    expect(savedGame?.summary).toBe("Excelente combate roguelike y banda sonora.");
    expect(savedGame?.summary).not.toContain("Sinopsis externa");
    expect(JSON.parse((savedGame as any)?.notionGenres || "[]")).toEqual(["Roguelike", "Action"]);

    // Limpieza
    await gameRepo.delete(savedGame!.id);
  });

  it("should correctly parse edge-case ratings: '4.5 ⭐', '0' (unrated as null), half-stars, and Spanish fractions", async () => {
    // Verificar helper extractRating directamente a través del servicio
    const s = syncService as any;

    // 1. Números con estrellas no deben colapsar a 1
    expect(s.extractRating({ Cal: { select: { name: "4.5 ⭐" } } }, ["Cal"])).toBe(4.5);
    expect(s.extractRating({ Cal: { select: { name: "5 ⭐" } } }, ["Cal"])).toBe(5);
    expect(s.extractRating({ Cal: { select: { name: "4 ⭐" } } }, ["Cal"])).toBe(4);
    expect(s.extractRating({ Cal: { select: { name: "10/10 ⭐" } } }, ["Cal"])).toBe(5);
    expect(s.extractRating({ Cal: { select: { name: "8/10 ⭐" } } }, ["Cal"])).toBe(4);
    expect(s.extractRating({ Cal: { select: { name: "4.5 / 5 ⭐" } } }, ["Cal"])).toBe(4.5);

    // 2. Unrated / 0 no debe convertirse en 1 estrella
    expect(s.extractRating({ Cal: { number: 0 } }, ["Cal"])).toBeNull();
    expect(s.extractRating({ Cal: { select: { name: "0" } } }, ["Cal"])).toBeNull();
    expect(s.extractRating({ Cal: { select: { name: "0/5" } } }, ["Cal"])).toBeNull();
    expect(s.extractRating({ Cal: { select: { name: "0 estrellas" } } }, ["Cal"])).toBeNull();
    expect(s.extractRating({ Cal: { select: { name: "Sin calificar" } } }, ["Cal"])).toBeNull();
    expect(s.extractRating({ Cal: { select: { name: "☆☆☆☆☆" } } }, ["Cal"])).toBeNull();

    // 3. Medias estrellas y estrellas vacías
    expect(s.extractRating({ Cal: { select: { name: "⭐⭐⭐⭐½" } } }, ["Cal"])).toBe(4.5);
    expect(s.extractRating({ Cal: { select: { name: "⭐⭐⭐½" } } }, ["Cal"])).toBe(3.5);
    expect(s.extractRating({ Cal: { select: { name: "★★★★☆" } } }, ["Cal"])).toBe(4);
    expect(s.extractRating({ Cal: { select: { name: "★★★☆☆" } } }, ["Cal"])).toBe(3);

    // 4. Formatos textuales en español
    expect(s.extractRating({ Cal: { select: { name: "4.5 de 5" } } }, ["Cal"])).toBe(4.5);
    expect(s.extractRating({ Cal: { select: { name: "9 sobre 10" } } }, ["Cal"])).toBe(4.5);
    expect(s.extractRating({ Cal: { select: { name: "5 - Obra Maestra" } } }, ["Cal"])).toBe(5);
  });

  it("should extract completion date and personal thoughts using formulas and extended aliases", async () => {
    const extendedPageId = "notion-game-extended-props";
    mockNotion.allPagesResponse = [
      {
        id: extendedPageId,
        lastEditedTime: "2026-10-25T17:00:00.000Z",
        properties: {
          Título: { title: [{ text: { content: "Chrono Trigger" } }] },
          Rating: { select: { name: "5 ⭐" } },
          "Fecha de Término": { formula: { type: "date", date: { start: "2023-11-20" } } },
          "Personal Summary": { formula: { type: "string", string: "Inolvidable viaje en el tiempo y banda sonora legendaria." } },
          Genres: { multi_select: [{ name: "JRPG" }] },
          Estado: { status: { name: "Jugado" } },
        },
      },
    ];

    await syncService.syncGames(true);

    const savedGame = await gameRepo.findByNotionPageId(extendedPageId);
    expect(savedGame).not.toBeNull();
    expect(savedGame?.title).toBe("Chrono Trigger");
    expect(savedGame?.rating).toBe(5);
    expect(savedGame?.completedAt).toBe("2023-11-20");
    expect(savedGame?.completionDate).toBe("2023-11-20");
    expect(savedGame?.userNotes).toBe("Inolvidable viaje en el tiempo y banda sonora legendaria.");
    expect(savedGame?.personalSummary).toBe("Inolvidable viaje en el tiempo y banda sonora legendaria.");
    expect(savedGame?.summary).toBe("Inolvidable viaje en el tiempo y banda sonora legendaria.");
    expect(JSON.parse((savedGame as any)?.notionGenres || "[]")).toEqual(["JRPG"]);

    // Limpieza
    await gameRepo.delete(savedGame!.id);
  });
});

