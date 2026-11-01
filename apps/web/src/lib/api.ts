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
  all?: boolean;
} = {}) {
  const queryParams: Record<string, string> = {
    limit: String(params.limit ?? 200),
    offset: String(params.offset ?? 0),
  };
  if (params.status) queryParams.status = params.status;
  if (params.search) queryParams.search = params.search;
  if (params.all !== undefined) queryParams.all = String(params.all);

  const res = await client.api.games.$get({
    query: queryParams as any,
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


async function handleEnrichRes(res: any, fallback: string) {
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error("error" in json ? (json as any).error : fallback);
  return json;
}

export async function enrichGame(id: string, options: { force?: boolean; model?: string } = {}) {
  return handleEnrichRes(await client.api.games[":id"].enrich.$post({ param: { id }, json: options }), "Error enriching game");
}

export async function enrichMovie(id: string, options: { force?: boolean; model?: string } = {}) {
  return handleEnrichRes(await client.api.movies[":id"].enrich.$post({ param: { id }, json: options }), "Error enriching movie");
}

export async function fetchSystemSettings() {
  const res = await client.api.settings.$get();
  if (!res.ok) throw new Error("Error fetching system telemetry settings");
  const json = await res.json();
  return json.data;
}

export async function triggerManualSync() {
  const res = await client.api.sync.trigger.$post();
  if (!res.ok) throw new Error("Error triggering manual synchronization");
  return await res.json();
}

export async function triggerBatchEnrich(options: {
  limit?: number;
  delayMs?: number;
  targetType?: "ALL" | "GAME" | "MOVIE";
  force?: boolean;
  model?: string;
} = {}) {
  const res = await client.api.enrich.batch.$post({
    json: options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    const errorMsg = "error" in json ? (json as any).error : "Error al procesar enriquecimiento en lote";
    throw new Error(errorMsg);
  }
  return json.data;
}

export function getBackupDownloadUrl(): string {
  return `${baseUrl}/api/backup/export`;
}

