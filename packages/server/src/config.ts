import { cleanNotionDatabaseId, cleanNotionToken, cleanAiModelName } from "@repo/database";

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

function cleanEnv(val: string | undefined): string {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "");
}

export function getConfig(): AppConfig {
  return {
    port: Number(process.env.PORT || 3001),
    host: process.env.HOST || "0.0.0.0",
    nodeEnv: process.env.NODE_ENV || "development",
    notionToken: cleanNotionToken(
      process.env.NOTION_TOKEN ||
        process.env.NOTION_API_KEY ||
        process.env.NOTION_SECRET ||
        process.env.NOTION_KEY ||
        process.env.NOTION_INTEGRATION_TOKEN ||
        ""
    ),
    notionDatabaseIdGames: cleanNotionDatabaseId(
      process.env.DB_ID_GAMES ||
        process.env.NOTION_DB_GAMES ||
        process.env.NOTION_DATABASE_ID_GAMES ||
        process.env.NOTION_GAMES_DATABASE_ID ||
        process.env.NOTION_GAMES_DB_ID ||
        process.env.NOTION_DB_ID_GAMES ||
        process.env.GAMES_DB_ID ||
        process.env.GAMES_DATABASE_ID ||
        process.env.NOTION_DATABASE_ID ||
        ""
    ),
    notionDatabaseIdMovies: cleanNotionDatabaseId(
      process.env.DB_ID_MOVIES ||
        process.env.NOTION_DB_MOVIES ||
        process.env.NOTION_DATABASE_ID_MOVIES ||
        process.env.NOTION_MOVIES_DATABASE_ID ||
        process.env.NOTION_MOVIES_DB_ID ||
        process.env.NOTION_DB_ID_MOVIES ||
        process.env.MOVIES_DB_ID ||
        process.env.MOVIES_DATABASE_ID ||
        ""
    ),
    steamKey: cleanEnv(
      process.env.STEAM_KEY || process.env.STEAM_API_KEY || process.env.STEAM_WEB_API_KEY
    ),
    steamUserId: cleanEnv(
      process.env.STEAM_USER_ID || process.env.STEAM_ID || process.env.STEAM_COMMUNITY_ID
    ),
    steamPollIntervalMs: Number(process.env.STEAM_POLL_INTERVAL_MS || 60000),
    notionPollIntervalMs: Number(process.env.NOTION_POLL_INTERVAL_MS || 120000),
    steamGracePeriodMs: Number(process.env.STEAM_GRACE_PERIOD_MS || 180000), // 3 min debounce
    geminiApiKey: cleanEnv(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    geminiDefaultModel:
      cleanAiModelName(process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL) || "gemini-2.5-flash",
    rawgKey: cleanEnv(process.env.RAWG_KEY || process.env.RAWG_API_KEY),
    tmdbKey: cleanEnv(process.env.TMDB_KEY || process.env.TMDB_API_KEY),
  };
}

export const config = getConfig();

