import type {
  Game,
  Movie,
  GameSession,
  DailyPlaytime,
  AiSettings,
  AiEnrichment,
  Prisma,
} from "@prisma/client";

// ==========================================
// 1. CONTRATOS DE REPOSITORIOS (PORTS)
// ==========================================

export interface GameFilter {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface IGameRepository {
  findById(id: string): Promise<Game | null>;
  findByNotionPageId(notionPageId: string): Promise<Game | null>;
  findBySteamAppId(steamAppId: number): Promise<Game | null>;
  findByCleanTitle(cleanTitle: string): Promise<Game | null>;
  upsert(gameData: Prisma.GameCreateInput): Promise<Game>;
  list(filter?: GameFilter): Promise<{ items: Game[]; total: number }>;
  updatePlaytime(id: string, playtimeForever: number, notionPlaytime?: number): Promise<Game>;
  updateStatus(id: string, status: string): Promise<Game>;
  delete(id: string): Promise<Game>;
}

export interface MovieFilter {
  status?: string;
  search?: string;
  year?: number;
  limit?: number;
  offset?: number;
}

export interface IMovieRepository {
  findById(id: string): Promise<Movie | null>;
  findByNotionPageId(notionPageId: string): Promise<Movie | null>;
  findByTmdbId(tmdbId: number): Promise<Movie | null>;
  findByCleanTitle(cleanTitle: string): Promise<Movie | null>;
  upsert(movieData: Prisma.MovieCreateInput): Promise<Movie>;
  list(filter?: MovieFilter): Promise<{ items: Movie[]; total: number }>;
  updateStatus(id: string, status: string): Promise<Movie>;
  delete(id: string): Promise<Movie>;
}

export interface ISessionRepository {
  findActiveSession(): Promise<(GameSession & { game: Game }) | null>;
  startSession(gameId: string, steamAppId?: number, startedAt?: Date): Promise<GameSession>;
  closeSession(sessionId: string, endedAt?: Date, durationMinutes?: number): Promise<GameSession>;
  getRecentSessions(limit?: number): Promise<(GameSession & { game: Game })[]>;
  touchSession?(sessionId: string): Promise<void>;
  delete(id: string): Promise<GameSession>;
}

export interface IDailyPlaytimeRepository {
  recordPlaytime(date: string, gameId: string, additionalMinutes: number): Promise<DailyPlaytime>;
  getTimeSeries(days?: number): Promise<{ date: string; hours: number }[]>;
}

export interface IAiSettingsRepository {
  getSettings(): Promise<AiSettings>;
  updateSettings(data: Prisma.AiSettingsUpdateInput): Promise<AiSettings>;
}

export interface IAiEnrichmentRepository {
  findByTarget(targetType: string, targetId: string): Promise<AiEnrichment | null>;
  findManyByTargets(targetType: string, targetIds: string[]): Promise<Map<string, AiEnrichmentResult>>;
  getParsedEnrichment?(targetType: string, targetId: string): Promise<AiEnrichmentResult | null>;
  upsert(data: Prisma.AiEnrichmentCreateInput): Promise<AiEnrichment>;
}

// ==========================================
// 2. CONTRATOS DE INTEGRACIÓN EXTERNA (DRIVEN PORTS)
// ==========================================

export interface NotionPageDelta {
  id: string;
  lastEditedTime: string;
  properties: Record<string, unknown>;
  archived?: boolean;
}

export interface INotionSyncClient {
  fetchModifiedPages(databaseId: string, lastEditedAfter: Date): Promise<NotionPageDelta[]>;
  fetchAllPages(databaseId: string): Promise<NotionPageDelta[]>;
  createPage(databaseId: string, properties: Record<string, unknown>): Promise<string>;
  updatePageProperties(pageId: string, properties: Record<string, unknown>): Promise<void>;
  queryDatabase(databaseId: string, filter?: Record<string, unknown>): Promise<NotionPageDelta[]>;
}

export interface SteamOwnedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  imgIconUrl?: string;
}

export interface SteamPlayerSummary {
  steamId: string;
  personaName: string;
  isPlaying: boolean;
  gameId?: number;
  gameExtraInfo?: string;
  isError?: boolean;
}

export interface SteamStoreDetails {
  appId: number;
  name: string;
  headerImage: string;
  genres: string[];
  shortDescription?: string;
}

export interface ISteamClient {
  getOwnedGames(steamId: string): Promise<SteamOwnedGame[]>;
  getPlayerSummary(steamId: string): Promise<SteamPlayerSummary>;
  getAppDetails(appId: number): Promise<SteamStoreDetails | null>;
}

export interface TmdbMovieMatch {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string;
  genres: string[];
}

export interface ITmdbClient {
  searchMovie(title: string, year?: number, language?: string): Promise<TmdbMovieMatch | null>;
  getMovieDetails(tmdbId: number, language?: string): Promise<TmdbMovieMatch | null>;
}

export interface IWikipediaClient {
  searchArticleUrl(title: string, language?: string): Promise<string | null>;
}

export interface HltbEstimate {
  mainHours: number | null;
  completionistHours: number | null;
}

export interface IHltbClient {
  searchDuration(title: string): Promise<HltbEstimate>;
}

// ==========================================
// 3. CONTRATOS DE SELECTOR DE IA (DRIVEN PORTS)
// ==========================================

export interface AiEnrichmentResult {
  vibeTags: string[];
  personalizedPitch: string;
  thematicTropes: string[];
  completionEstimateWeeks?: number;
  rawResponse?: string;
}

export interface AiPromptPayload {
  title: string;
  type: "GAME" | "MOVIE";
  overview?: string;
  genres: string[];
  playtimeOrDuration?: string;
  userContext?: string;
}

export interface IAiProvider {
  readonly id: "gemini" | "deepseek" | "groq" | "ollama";
  readonly defaultModel: string;
  generateEnrichment(payload: AiPromptPayload, modelOverride?: string): Promise<AiEnrichmentResult>;
  testConnection(): Promise<boolean>;
}
