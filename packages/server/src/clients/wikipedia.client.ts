import type { IWikipediaClient } from "@repo/database";

export class WikipediaClient implements IWikipediaClient {
  private cache = new Map<string, string | null>();

  /**
   * Búsqueda genérica de artículos en Wikipedia con OpenSearch.
   */
  async searchArticleUrl(query: string, language: string = "es"): Promise<string | null> {
    const cacheKey = `${language}:${query.toLowerCase().trim()}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    try {
      const url = `https://${language}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        query
      )}&limit=1&format=json`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        headers: { "User-Agent": "NotionTracker/2.0 (contact: admin@local)" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const data = (await res.json()) as unknown[];
      // OpenSearch devuelve [query, [titles], [descriptions], [urls]]
      if (Array.isArray(data) && data.length > 3 && Array.isArray(data[3]) && data[3].length > 0) {
        const link = String(data[3][0]);
        this.cache.set(cacheKey, link);
        return link;
      }

      this.cache.set(cacheKey, null);
      return null;
    } catch {
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Búsqueda especializada de videojuegos en Wikipedia (con fallback español/inglés).
   */
  async searchGameWikiUrl(gameTitle: string): Promise<string | null> {
    const clean = gameTitle.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();
    const searches = [
      { lang: "es", q: `${clean} videojuego` },
      { lang: "es", q: clean },
      { lang: "en", q: `${clean} video game` },
    ];

    for (const item of searches) {
      const url = await this.searchArticleUrl(item.q, item.lang);
      if (url) return url;
    }

    return null;
  }

  /**
   * Búsqueda especializada de películas en Wikipedia (con fallback película/film).
   */
  async searchMovieWikiUrl(movieTitle: string): Promise<string | null> {
    const clean = movieTitle.replace(/\s*\(\d{4}\)/, "").trim();
    const searches = [
      { lang: "es", q: `${clean} (película)` },
      { lang: "es", q: `${clean} (film)` },
      { lang: "es", q: clean },
      { lang: "en", q: `${clean} (film)` },
    ];

    for (const item of searches) {
      const url = await this.searchArticleUrl(item.q, item.lang);
      if (url) return url;
    }

    return null;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const wikipediaClient = new WikipediaClient();
