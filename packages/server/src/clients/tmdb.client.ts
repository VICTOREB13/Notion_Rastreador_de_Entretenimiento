import type { ITmdbClient, TmdbMovieMatch } from "@repo/database";
import { config } from "../config";

const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Acción",
  12: "Aventura",
  16: "Animación",
  35: "Comedia",
  80: "Crimen",
  99: "Documental",
  18: "Drama",
  10751: "Familia",
  14: "Fantasía",
  36: "Historia",
  27: "Terror",
  10402: "Música",
  9648: "Misterio",
  10749: "Romance",
  878: "Ciencia ficción",
  10770: "Película de TV",
  53: "Suspense",
  10752: "Bélica",
  37: "Western",
};

export class TmdbClient implements ITmdbClient {
  private apiKey: string;
  private baseUrl = "https://api.themoviedb.org/3";
  private imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  private cache = new Map<string, TmdbMovieMatch | null>();

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? config.tmdbKey;
  }

  /**
   * Extrae el título base y el año si viene en formato "Título (YYYY)".
   */
  static extractTitleAndYear(rawTitle: string): { title: string; year?: number } {
    const match = rawTitle.match(/^(.+?)\s*\((\d{4})\)$/);
    if (match && match[1] && match[2]) {
      return {
        title: match[1].trim(),
        year: parseInt(match[2], 10),
      };
    }
    return { title: rawTitle.trim() };
  }

  /**
   * Búsqueda multi-idioma con cadena de fallback:
   * 1. Título limpio + año en español
   * 2. Título limpio sin año en español
   * 3. Título limpio en inglés
   * 4. Título original en español
   */
  async searchMovie(
    rawTitle: string,
    yearFilter?: number,
    _language: string = "es-ES"
  ): Promise<TmdbMovieMatch | null> {
    if (!this.apiKey || !rawTitle.trim()) {
      return null;
    }

    const { title: cleanTitle, year: parsedYear } = TmdbClient.extractTitleAndYear(rawTitle);
    const targetYear = yearFilter ?? parsedYear;

    const cacheKey = `${cleanTitle.toLowerCase()}_${targetYear || "any"}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    const strategies: Array<{ query: string; year?: number; language: string }> = [];

    if (targetYear) {
      strategies.push({ query: cleanTitle, year: targetYear, language: "es-ES" });
    }
    strategies.push({ query: cleanTitle, language: "es-ES" });
    strategies.push({ query: cleanTitle, language: "en-US" });

    if (cleanTitle !== rawTitle.trim()) {
      strategies.push({ query: rawTitle.trim(), language: "es-ES" });
    }

    let bestMovie: any = null;

    for (const params of strategies) {
      try {
        const urlParams = new URLSearchParams({
          api_key: this.apiKey,
          query: params.query,
          language: params.language,
        });
        if (params.year) {
          urlParams.append("year", String(params.year));
        }

        const url = `${this.baseUrl}/search/movie?${urlParams.toString()}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = (await res.json()) as { results?: any[] };
          if (data.results && data.results.length > 0) {
            bestMovie = data.results[0];
            break;
          }
        }
      } catch (error) {
        console.warn(`[TmdbClient] Search error for "${params.query}":`, error);
      }
    }

    if (!bestMovie) {
      this.cache.set(cacheKey, null);
      return null;
    }

    // Sinopsis con fallback en-US
    let overview = bestMovie.overview || "";
    if (!overview) {
      try {
        const detailRes = await fetch(
          `${this.baseUrl}/movie/${bestMovie.id}?api_key=${this.apiKey}&language=en-US`
        );
        if (detailRes.ok) {
          const detailData = (await detailRes.json()) as { overview?: string };
          overview = detailData.overview || "";
        }
      } catch {
        // Ignorar error de fallback
      }
    }

    const genres = (bestMovie.genre_ids || [])
      .map((id: number) => TMDB_GENRE_MAP[id])
      .filter((g: string | undefined): g is string => Boolean(g));

    const posterPath = bestMovie.poster_path
      ? `${this.imageBaseUrl}${bestMovie.poster_path}`
      : null;

    const match: TmdbMovieMatch = {
      id: bestMovie.id,
      title: bestMovie.title || cleanTitle,
      originalTitle: bestMovie.original_title || cleanTitle,
      overview,
      posterPath,
      releaseDate: bestMovie.release_date || "",
      genres: genres.length > 0 ? genres : ["Otro"],
    };

    this.cache.set(cacheKey, match);
    return match;
  }

  async getMovieDetails(tmdbId: number, language: string = "es-ES"): Promise<TmdbMovieMatch | null> {
    if (!this.apiKey || !tmdbId) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/movie/${tmdbId}?api_key=${this.apiKey}&language=${language}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = (await res.json()) as any;
      const genres = (data.genres || []).map((g: any) => g.name);
      const posterPath = data.poster_path ? `${this.imageBaseUrl}${data.poster_path}` : null;

      return {
        id: data.id,
        title: data.title || "",
        originalTitle: data.original_title || "",
        overview: data.overview || "",
        posterPath,
        releaseDate: data.release_date || "",
        genres,
      };
    } catch (error) {
      console.warn(`[TmdbClient] getMovieDetails error for tmdbId ${tmdbId}:`, error);
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const tmdbClient = new TmdbClient();
