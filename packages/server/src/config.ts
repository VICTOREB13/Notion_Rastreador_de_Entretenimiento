export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  notionToken: string;
  notionDatabaseIdGames: string;
  notionDatabaseIdMovies: string;
  steamKey: string;
  steamUserId: string;
  steamPollIntervalMs: number;
  notionPollIntervalMs: number;
  steamGracePeriodMs: number;
  geminiApiKey: string;
  geminiDefaultModel: string;
  rawgKey: string;
  tmdbKey: string;
}

export function getConfig(): AppConfig {
  return {
    port: Number(process.env.PORT || 3001),
    host: process.env.HOST || "0.0.0.0",
    nodeEnv: process.env.NODE_ENV || "development",
    notionToken: process.env.NOTION_TOKEN?.trim() || "",
    notionDatabaseIdGames: (process.env.DB_ID_GAMES || process.env.NOTION_DB_GAMES || "").trim(),
    notionDatabaseIdMovies: (process.env.DB_ID_MOVIES || process.env.NOTION_DB_MOVIES || "").trim(),
    steamKey: process.env.STEAM_KEY?.trim() || "",
    steamUserId: process.env.STEAM_USER_ID?.trim() || "",
    steamPollIntervalMs: Number(process.env.STEAM_POLL_INTERVAL_MS || 60000),
    notionPollIntervalMs: Number(process.env.NOTION_POLL_INTERVAL_MS || 120000),
    steamGracePeriodMs: Number(process.env.STEAM_GRACE_PERIOD_MS || 180000), // 3 min debounce
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
    geminiDefaultModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    rawgKey: process.env.RAWG_KEY?.trim() || "",
    tmdbKey: process.env.TMDB_KEY?.trim() || "",
  };
}

export const config = getConfig();
