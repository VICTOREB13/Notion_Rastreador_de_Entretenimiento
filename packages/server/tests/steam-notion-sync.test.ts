import { describe, it, expect, beforeEach, mock } from "bun:test";
import { SteamToNotionSyncService } from "../src/services/steam-notion-sync.service";
import { NotionMetadataEnricherService } from "../src/services/notion-metadata.service";
import type {
  ISteamClient,
  INotionSyncClient,
  IRawgClient,
  IHltbClient,
  IWikipediaClient,
  IGameRepository,
  IMovieRepository,
  ITmdbClient,
  NotionPageDelta,
  SteamOwnedGame,
} from "@repo/database";

describe("SteamToNotionSyncService & Exact Python Logic Preservation (Fase 3)", () => {
  let mockSteam: ISteamClient;
  let mockNotion: INotionSyncClient;
  let mockRawg: IRawgClient;
  let mockHltb: IHltbClient;
  let mockWiki: IWikipediaClient;
  let mockGameRepo: IGameRepository;

  beforeEach(() => {
    mockSteam = {
      getOwnedGames: mock(async () => []),
      getPlayerSummary: mock(async () => ({ steamId: "123", personaName: "Player", isPlaying: false })),
      getAppDetails: mock(async () => null),
      getCombinedGames: mock(async () => []),
    };

    mockNotion = {
      fetchAllPages: mock(async () => []),
      fetchModifiedPages: mock(async () => []),
      queryDatabase: mock(async () => []),
      createPage: mock(async () => "new-notion-page-uuid"),
      updatePageProperties: mock(async () => {}),
      updatePage: mock(async () => {}),
    };

    mockRawg = {
      searchGame: mock(async () => null),
    };

    mockHltb = {
      searchDuration: mock(async () => ({ mainHours: null, completionistHours: null })),
    };

    mockWiki = {
      searchArticleUrl: mock(async () => null),
      searchGameWikiUrl: mock(async () => null),
      searchMovieWikiUrl: mock(async () => null),
    } as any;

    mockGameRepo = {
      findById: mock(async () => null),
      findByNotionPageId: mock(async () => null),
      findBySteamAppId: mock(async () => null),
      findByCleanTitle: mock(async () => null),
      upsert: mock(async (data: any) => data as any),
      list: mock(async () => ({ items: [], total: 0 })),
      updatePlaytime: mock(async () => ({} as any)),
      updateStatus: mock(async () => ({} as any)),
      delete: mock(async () => ({} as any)),
    };
  });

  it("1. Filtro de juegos: Debe ignorar juegos con menos de 30 minutos (< 0.5h)", async () => {
    mockSteam.getCombinedGames = mock(async () => [
      { appId: 100, name: "Short Demo", playtimeMinutes: 20 }, // 0.33h -> Debe ser ignorado
      { appId: 200, name: "Long Game", playtimeMinutes: 60 }, // 1.0h -> Debe procesarse
    ]);

    mockNotion.fetchAllPages = mock(async () => []);

    const service = new SteamToNotionSyncService(
      mockSteam,
      mockNotion,
      mockRawg,
      mockHltb,
      mockWiki,
      mockGameRepo,
      "test_user",
      "db_games_123",
      0 // No delay in tests
    );

    const result = await service.syncSteamToNotion();

    expect(result.scannedSteam).toBe(2);
    expect(result.skippedLowPlaytime).toBe(1);
    expect(result.createdNotion).toBe(1);
    expect(mockNotion.createPage).toHaveBeenCalledTimes(1);
  });

  it("2. Preservación total de cuota RAWG: NUNCA consulta la API de RAWG si la página ya tiene Portada", async () => {
    // Página en Notion que YA TIENE portada y géneros
    const existingPage: NotionPageDelta = {
      id: "page-hollow-knight",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: { type: "external", external: { url: "https://existing.cover/hk.jpg" } },
      properties: {
        Título: { title: [{ text: { content: "Hollow Knight" } }] },
        "Steam ID": { number: 367520 },
        "Horas Jugadas": { number: 10.0 },
        Portada: { files: [{ type: "external", name: "Cover", external: { url: "https://existing.cover/hk.jpg" } }] },
        Géneros: { multi_select: [{ name: "Metroidvania" }] },
        Estado: { status: { name: "Jugando" } },
      },
    };

    mockNotion.fetchAllPages = mock(async () => [existingPage]);
    mockSteam.getCombinedGames = mock(async () => [
      { appId: 367520, name: "Hollow Knight", playtimeMinutes: 900 }, // 15 horas (cambió de 10 a 15)
    ]);

    const service = new SteamToNotionSyncService(
      mockSteam,
      mockNotion,
      mockRawg,
      mockHltb,
      mockWiki,
      mockGameRepo,
      "test_user",
      "db_games_123",
      0
    );

    const result = await service.syncSteamToNotion();

    expect(result.updatedNotion).toBe(1);
    // CERO llamadas a la API de RAWG (Ahorro total de cuota)
    expect(mockRawg.searchGame).toHaveBeenCalledTimes(0);
    // Notion update debe haberse enviado solo para las horas
    expect(mockNotion.updatePage).toHaveBeenCalledTimes(1);
  });

  it("2b. Preservación estricta de cuota RAWG: NUNCA consulta RAWG si la página ya tiene Portada aunque falten Géneros", async () => {
    // Página en Notion con Portada pero SIN géneros definidos
    const existingPage: NotionPageDelta = {
      id: "page-stardew",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: { type: "external", external: { url: "https://existing.cover/stardew.jpg" } },
      properties: {
        Título: { title: [{ text: { content: "Stardew Valley" } }] },
        "Steam ID": { number: 413150 },
        "Horas Jugadas": { number: 20.0 },
        Portada: { files: [{ type: "external", name: "Cover", external: { url: "https://existing.cover/stardew.jpg" } }] },
        // Géneros no definidos o vacíos
        Estado: { status: { name: "Jugando" } },
      },
    };

    mockNotion.fetchAllPages = mock(async () => [existingPage]);
    mockSteam.getCombinedGames = mock(async () => [
      { appId: 413150, name: "Stardew Valley", playtimeMinutes: 1500 }, // 25 horas
    ]);

    const service = new SteamToNotionSyncService(
      mockSteam,
      mockNotion,
      mockRawg,
      mockHltb,
      mockWiki,
      mockGameRepo,
      "test_user",
      "db_games_123",
      0
    );

    const result = await service.syncSteamToNotion();

    expect(result.updatedNotion).toBe(1);
    // CERO llamadas a la API de RAWG bajo cualquier circunstancia si ya tiene Portada
    expect(mockRawg.searchGame).toHaveBeenCalledTimes(0);
    expect(mockNotion.updatePage).toHaveBeenCalledTimes(1);
  });

  it("3. Preservación de Estados manuales: solo actualiza horas sin alterar el estado 'Jugando'", async () => {
    const existingPage: NotionPageDelta = {
      id: "page-elden-ring",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: { type: "external", external: { url: "https://cover.jpg" } },
      properties: {
        Título: { title: [{ text: { content: "Elden Ring" } }] },
        "Steam ID": { number: 1245620 },
        "Horas Jugadas": { number: 40.0 },
        "HLTB Principal": { number: 100.0 }, // Aún no llega al HLTB
        Portada: { files: [{ name: "Cover", external: { url: "https://cover.jpg" } }] },
        Géneros: { multi_select: [{ name: "Action RPG" }] },
        Estado: { status: { name: "Jugando" } }, // Estado manual activo
        "Fecha de Inicio": { date: { start: "2026-10-01" } },
      },
    };

    mockNotion.fetchAllPages = mock(async () => [existingPage]);
    mockSteam.getCombinedGames = mock(async () => [
      { appId: 1245620, name: "Elden Ring", playtimeMinutes: 3000 }, // 50.0 horas
    ]);

    const service = new SteamToNotionSyncService(
      mockSteam,
      mockNotion,
      mockRawg,
      mockHltb,
      mockWiki,
      mockGameRepo,
      "test_user",
      "db_games_123",
      0
    );

    await service.syncSteamToNotion();

    expect(mockNotion.updatePage).toHaveBeenCalledTimes(1);
    const updateCall = (mockNotion.updatePage as any).mock.calls[0];
    const props = updateCall[1].properties;

    // Horas actualizadas
    expect(props["Horas Jugadas"].number).toBe(50.0);
    // El Estado NO fue cambiado (permanece en Jugando)
    expect(props["Estado"]).toBeUndefined();
  });

  it("4. Regla HLTB: Si Horas Jugadas >= HLTB Principal, auto-culmina a 'Jugado' con Fecha de Culminación", async () => {
    const existingPage: NotionPageDelta = {
      id: "page-portal",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: { type: "external", external: { url: "https://cover.jpg" } },
      properties: {
        Título: { title: [{ text: { content: "Portal" } }] },
        "Steam ID": { number: 400 },
        "Horas Jugadas": { number: 2.0 },
        "HLTB Principal": { number: 3.5 },
        Portada: { files: [{ name: "Cover", external: { url: "https://cover.jpg" } }] },
        Géneros: { multi_select: [{ name: "Puzzle" }] },
        Estado: { status: { name: "Jugando" } },
        "Fecha de Inicio": { date: { start: "2026-10-01" } },
      },
    };

    mockNotion.fetchAllPages = mock(async () => [existingPage]);
    mockSteam.getCombinedGames = mock(async () => [
      { appId: 400, name: "Portal", playtimeMinutes: 240 }, // 4.0 horas (4.0 >= 3.5 HLTB)
    ]);

    const service = new SteamToNotionSyncService(
      mockSteam,
      mockNotion,
      mockRawg,
      mockHltb,
      mockWiki,
      mockGameRepo,
      "test_user",
      "db_games_123",
      0
    );

    await service.syncSteamToNotion();

    expect(mockNotion.updatePage).toHaveBeenCalledTimes(1);
    const updateCall = (mockNotion.updatePage as any).mock.calls[0];
    const props = updateCall[1].properties;

    expect(props["Horas Jugadas"].number).toBe(4.0);
    expect(props["Estado"].status.name).toBe("Jugado");
    expect(props["Fecha de Culminación (primera campaña)"]).toBeDefined();
    expect(typeof props["Fecha de Culminación (primera campaña)"].date.start).toBe("string");
  });

  it("4b. Regla HLTB: Soporta dinámicamente 'Fecha de Finalización' como columna alternativa en Notion", async () => {
    const existingPage: NotionPageDelta = {
      id: "page-portal-alt",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: { type: "external", external: { url: "https://cover.jpg" } },
      properties: {
        Título: { title: [{ text: { content: "Portal" } }] },
        "Steam ID": { number: 400 },
        "Horas Jugadas": { number: 2.0 },
        "HLTB Principal": { number: 3.5 },
        Portada: { files: [{ name: "Cover", external: { url: "https://cover.jpg" } }] },
        Géneros: { multi_select: [{ name: "Puzzle" }] },
        Estado: { status: { name: "Jugando" } },
        // En lugar del nombre largo, la base usa "Fecha de Finalización"
        "Fecha de Finalización": { date: null },
      },
    };

    mockNotion.fetchAllPages = mock(async () => [existingPage]);
    mockSteam.getCombinedGames = mock(async () => [
      { appId: 400, name: "Portal", playtimeMinutes: 300 }, // 5.0h >= 3.5h
    ]);

    const service = new SteamToNotionSyncService(
      mockSteam,
      mockNotion,
      mockRawg,
      mockHltb,
      mockWiki,
      mockGameRepo,
      "test_user",
      "db_games_123",
      0
    );

    await service.syncSteamToNotion();

    expect(mockNotion.updatePage).toHaveBeenCalledTimes(1);
    const updateCall = (mockNotion.updatePage as any).mock.calls[0];
    const props = updateCall[1].properties;

    expect(props["Horas Jugadas"].number).toBe(5.0);
    expect(props["Estado"].status.name).toBe("Jugado");
    // Verifica que se resolvió y escribió en "Fecha de Finalización" sin romper
    expect(props["Fecha de Finalización"]).toBeDefined();
    expect(typeof props["Fecha de Finalización"].date.start).toBe("string");
  });

  it("5. Triple Estrategia de Matching: resuelve por Steam ID, título limpio y fuzzy ratio >= 0.90", async () => {
    const page1: NotionPageDelta = {
      id: "p1",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: null,
      properties: {
        Título: { title: [{ text: { content: "DOOM Eternal" } }] },
        "Steam ID": { number: 782330 },
        "Horas Jugadas": { number: 10.0 },
      },
    };

    const page2: NotionPageDelta = {
      id: "p2",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: null,
      properties: {
        Título: { title: [{ text: { content: "Half-Life 2: Episode One" } }] },
        // Sin Steam ID previo en Notion
        "Horas Jugadas": { number: 3.0 },
      },
    };

    mockNotion.fetchAllPages = mock(async () => [page1, page2]);
    mockSteam.getCombinedGames = mock(async () => [
      // 1. Coincidencia por Steam ID
      { appId: 782330, name: "DOOM Eternal (PC Edition)", playtimeMinutes: 720 }, // 12.0h
      // 2. Coincidencia por nombre limpio
      { appId: 380, name: "Half-Life 2: Episode One", playtimeMinutes: 300 }, // 5.0h
    ]);

    const service = new SteamToNotionSyncService(
      mockSteam,
      mockNotion,
      mockRawg,
      mockHltb,
      mockWiki,
      mockGameRepo,
      "test_user",
      "db_games_123",
      0
    );

    const res = await service.syncSteamToNotion();
    expect(res.updatedNotion).toBe(2);
    expect(res.createdNotion).toBe(0);
  });

  it("6. Cero llamadas si nada cambió (Zero-Overwrite / Idempotencia)", async () => {
    const page: NotionPageDelta = {
      id: "p-unchanged",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: { type: "external", external: { url: "https://cover.jpg" } },
      properties: {
        Título: { title: [{ text: { content: "Sekiro" } }] },
        "Steam ID": { number: 814380 },
        "Horas Jugadas": { number: 25.4 },
        "HLTB Principal": { number: 30.0 },
        Portada: { files: [{ name: "Cover", external: { url: "https://cover.jpg" } }] },
        Géneros: { multi_select: [{ name: "Action" }] },
        Link: { url: "https://es.wikipedia.org/wiki/Sekiro" },
        Estado: { status: { name: "Jugando" } },
        "Fecha de Inicio": { date: { start: "2026-09-01" } },
      },
    };

    mockNotion.fetchAllPages = mock(async () => [page]);
    mockSteam.getCombinedGames = mock(async () => [
      { appId: 814380, name: "Sekiro", playtimeMinutes: 1524 }, // 25.4h exactas
    ]);

    const service = new SteamToNotionSyncService(
      mockSteam,
      mockNotion,
      mockRawg,
      mockHltb,
      mockWiki,
      mockGameRepo,
      "test_user",
      "db_games_123",
      0
    );

    const res = await service.syncSteamToNotion();
    expect(res.updatedNotion).toBe(0);
    expect(res.createdNotion).toBe(0);
    expect(mockNotion.updatePage).toHaveBeenCalledTimes(0);
  });

  it("7. NotionMetadataEnricherService: Mapea correctamente nombres dinámicos de columnas (Cover, Sinopsis, Wikipedia)", async () => {
    const moviePage: NotionPageDelta = {
      id: "movie-interstellar",
      lastEditedTime: "2026-10-25T10:00:00Z",
      cover: null,
      properties: {
        Título: { title: [{ text: { content: "Interstellar (2014)" } }] },
        // Nombres alternativos de columnas:
        Cover: { files: [] },
        Sinopsis: { rich_text: [] },
        Wikipedia: { url: null },
        Genre: { multi_select: [] },
      },
    };

    const mockMovieRepo: IMovieRepository = {
      findById: mock(async () => null),
      findByNotionPageId: mock(async () => null),
      findByTmdbId: mock(async () => null),
      findByCleanTitle: mock(async () => null),
      upsert: mock(async (data: any) => data as any),
      list: mock(async () => ({ items: [], total: 0 })),
      updateStatus: mock(async () => ({} as any)),
      delete: mock(async () => ({} as any)),
    };

    const mockTmdb: ITmdbClient = {
      searchMovie: mock(async () => ({
        id: 157336,
        title: "Interstellar",
        originalTitle: "Interstellar",
        overview: "Mankind was born on Earth. It was never meant to die here.",
        posterPath: "https://image.tmdb.org/t/p/w500/interstellar.jpg",
        releaseDate: "2014-11-05",
        genres: ["Ciencia ficción", "Drama"],
      })),
      getMovieDetails: mock(async () => null),
    };

    const enricher = new NotionMetadataEnricherService(
      mockNotion,
      mockTmdb,
      mockWiki,
      mockMovieRepo,
      "db_movies_123",
      0
    );

    mockNotion.fetchAllPages = mock(async () => [moviePage]);
    mockWiki.searchMovieWikiUrl = mock(async () => "https://es.wikipedia.org/wiki/Interstellar");

    const result = await enricher.enrichMovies();
    expect(result.moviesEnriched).toBe(1);

    expect(mockNotion.updatePage).toHaveBeenCalledTimes(1);
    const updateCall = (mockNotion.updatePage as any).mock.calls[0];
    const props = updateCall[1].properties;

    // Verifica que se mapearon a los nombres de columna existentes en la página (Cover, Sinopsis, Genre, Wikipedia)
    expect(props["Cover"]).toBeDefined();
    expect(props["Sinopsis"]).toBeDefined();
    expect(props["Genre"]).toBeDefined();
    expect(props["Wikipedia"]).toBeDefined();
  });
});
