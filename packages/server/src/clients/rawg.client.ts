import type { IRawgClient, RawgGameMatch } from "@repo/database";
import { cleanGameTitle } from "@repo/database";
import { config } from "../config";

export class RawgClient implements IRawgClient {
  private apiKey: string;
  private baseUrl = "https://api.rawg.io/api";
  private cache = new Map<string, RawgGameMatch | null>();

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? config.rawgKey;
  }

  /**
   * Busca metadatos de un videojuego en RAWG (portada HD y géneros).
   * Implementa caché en memoria para ahorro de cuota y búsqueda normalizada.
   */
  async searchGame(title: string): Promise<RawgGameMatch | null> {
    if (!this.apiKey || !title.trim()) {
      return null;
    }

    const cacheKey = cleanGameTitle(title);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    try {
      const url = `${this.baseUrl}/games?key=${this.apiKey}&search=${encodeURIComponent(title)}&page_size=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[RawgClient] RAWG API responded with HTTP ${res.status} for "${title}"`);
        this.cache.set(cacheKey, null);
        return null;
      }

      const data = (await res.json()) as {
        results?: Array<{
          name?: string;
          background_image?: string | null;
          genres?: Array<{ name: string }>;
        }>;
      };

      const result = data.results?.[0];
      if (!result) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const genres = (result.genres || []).map((g) => g.name);
      const match: RawgGameMatch = {
        backgroundImage: result.background_image || null,
        genres,
      };

      this.cache.set(cacheKey, match);
      return match;
    } catch (error) {
      console.warn(`[RawgClient] Error searching game "${title}":`, error);
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const rawgClient = new RawgClient();
