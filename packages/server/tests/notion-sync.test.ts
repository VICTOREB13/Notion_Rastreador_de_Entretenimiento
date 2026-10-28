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
});
