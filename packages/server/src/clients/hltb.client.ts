import type { HltbEstimate, IHltbClient } from "@repo/database";
import { cleanGameTitle } from "@repo/database";

export class HltbClient implements IHltbClient {
  private cache = new Map<string, HltbEstimate>();

  /**
   * Busca estimación de horas de duración en HowLongToBeat.
   * Retorna horas para la historia principal (mainHours) y 100% (completionistHours).
   */
  async searchDuration(title: string): Promise<HltbEstimate> {
    if (!title.trim()) {
      return { mainHours: null, completionistHours: null };
    }

    const clean = cleanGameTitle(title);
    if (this.cache.has(clean)) {
      return this.cache.get(clean)!;
    }

    try {
      const searchTerms = clean.split(" ").filter(Boolean);
      const payload = {
        searchType: "games",
        searchTerms,
        searchPage: 1,
        size: 5,
        searchOptions: {
          games: {
            userId: 0,
            platform: "",
            sortCategory: "popular",
            rangeCategory: "main",
            rangeTime: { min: null, max: null },
            gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
            rangeYear: { min: "", max: "" },
            modifier: "",
          },
          users: { sortCategory: "postcount" },
          lists: { sortCategory: "follows" },
          filter: "",
          sort: 0,
          randomizer: 0,
        },
        useCache: true,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch("https://howlongtobeat.com/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://howlongtobeat.com",
          Origin: "https://howlongtobeat.com",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const fallback: HltbEstimate = { mainHours: null, completionistHours: null };
        this.cache.set(clean, fallback);
        return fallback;
      }

      const data = (await res.json()) as {
        data?: Array<{
          comp_main?: number;
          comp_100?: number;
        }>;
      };

      const first = data.data?.[0];
      if (!first) {
        const fallback: HltbEstimate = { mainHours: null, completionistHours: null };
        this.cache.set(clean, fallback);
        return fallback;
      }

      const mainHours = first.comp_main ? Math.round((first.comp_main / 3600) * 10) / 10 : null;
      const completionistHours = first.comp_100 ? Math.round((first.comp_100 / 3600) * 10) / 10 : null;

      const result: HltbEstimate = { mainHours, completionistHours };
      this.cache.set(clean, result);
      return result;
    } catch {
      const fallback: HltbEstimate = { mainHours: null, completionistHours: null };
      this.cache.set(clean, fallback);
      return fallback;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const hltbClient = new HltbClient();
