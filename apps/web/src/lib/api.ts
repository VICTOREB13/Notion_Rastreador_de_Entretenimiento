import { hc } from "hono/client";
import type { AppType } from "@repo/server";

// Determinar URL del backend: en navegador usa ruta relativa "/api" que Next.js reescribe
// o en SSR usa INTERNAL_API_URL para evitar fallos de fetch con URLs relativas
const baseUrl =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin)
    : (process.env.INTERNAL_API_URL || "http://127.0.0.1:3001");

export const client = hc<AppType>(baseUrl);

export async function fetchLiveStatus() {
  const res = await client.api.live.status.$get();
  if (!res.ok) throw new Error("Error fetching live status");
  const json = await res.json();
  return json.data;
}

export async function fetchAnalytics(days = 30) {
  const res = await client.api.analytics.$get({ query: { days: String(days) } });
  if (!res.ok) throw new Error("Error fetching analytics");
  const json = await res.json();
  return json.data;
}

export async function fetchGames(params: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const res = await client.api.games.$get({
    query: {
      status: params.status,
      search: params.search,
      limit: String(params.limit ?? 50),
      offset: String(params.offset ?? 0),
    },
  });
  if (!res.ok) throw new Error("Error fetching games");
  const json = await res.json();
  return json;
}

export async function fetchMovies(params: {
  status?: string;
  search?: string;
  year?: number;
  limit?: number;
  offset?: number;
} = {}) {
  const res = await client.api.movies.$get({
    query: {
      status: params.status,
      search: params.search,
      year: params.year !== undefined ? String(params.year) : undefined,
      limit: String(params.limit ?? 50),
      offset: String(params.offset ?? 0),
    },
  });
  if (!res.ok) throw new Error("Error fetching movies");
  const json = await res.json();
  return json;
}

export async function fetchGameDetail(id: string) {
  const res = await client.api.games[":id"].$get({ param: { id } });
  if (!res.ok) throw new Error("Error fetching game detail");
  const json = await res.json();
  return json.data;
}

export async function fetchMovieDetail(id: string) {
  const res = await client.api.movies[":id"].$get({ param: { id } });
  if (!res.ok) throw new Error("Error fetching movie detail");
  const json = await res.json();
  return json.data;
}

export async function fetchAiSettings() {
  const res = await client.api.settings.ai.$get();
  if (!res.ok) throw new Error("Error fetching AI settings");
  const json = await res.json();
  return json.data;
}

export async function updateAiSettings(data: {
  activeProvider?: "gemini" | "deepseek" | "groq" | "ollama";
  selectedModel?: string;
  temperature?: number;
  geminiApiKey?: string;
}) {
  const res = await client.api.settings.ai.$put({ json: data });
  if (!res.ok) throw new Error("Error updating AI settings");
  return await res.json();
}

export async function testAiConnection(data: { apiKey?: string; model?: string } = {}) {
  const res = await client.api.settings.ai.test.$post({ json: data });
  if (!res.ok) throw new Error("Error testing AI connection");
  return await res.json();
}

export async function enrichGame(id: string, options: { force?: boolean; model?: string } = {}) {
  const res = await client.api.games[":id"].enrich.$post({
    param: { id },
    json: options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    const errorMsg = "error" in json ? (json as any).error : "Error enriching game";
    throw new Error(errorMsg);
  }
  return json;
}

export async function enrichMovie(id: string, options: { force?: boolean; model?: string } = {}) {
  const res = await client.api.movies[":id"].enrich.$post({
    param: { id },
    json: options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    const errorMsg = "error" in json ? (json as any).error : "Error enriching movie";
    throw new Error(errorMsg);
  }
  return json;
}
