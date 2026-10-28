import { describe, it, expect, beforeEach, mock } from "bun:test";
import { RawgClient } from "../src/clients/rawg.client";
import { TmdbClient } from "../src/clients/tmdb.client";
import { WikipediaClient } from "../src/clients/wikipedia.client";
import { HltbClient } from "../src/clients/hltb.client";
import { SteamClient } from "../src/clients/steam.client";

describe("Metadata Clients & Steam Family Sharing (Fase 2)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("RawgClient", () => {
    it("should return null if no API key is provided", async () => {
      const client = new RawgClient("");
      const result = await client.searchGame("Cyberpunk 2077");
      expect(result).toBeNull();
    });

    it("should fetch game background image and genres with caching", async () => {
      let fetchCount = 0;
      globalThis.fetch = (async (url: string | URL | Request) => {
        fetchCount++;
        return new Response(
          JSON.stringify({
            results: [
              {
                name: "Cyberpunk 2077",
                background_image: "https://media.rawg.io/media/games/cyberpunk.jpg",
                genres: [{ name: "Action" }, { name: "RPG" }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as any;

      const client = new RawgClient("test_rawg_key");
      const result1 = await client.searchGame("Cyberpunk 2077");

      expect(result1).not.toBeNull();
      expect(result1?.backgroundImage).toBe("https://media.rawg.io/media/games/cyberpunk.jpg");
      expect(result1?.genres).toEqual(["Action", "RPG"]);
      expect(fetchCount).toBe(1);

      // Segunda consulta: debe usar caché y NO hacer fetch
      const result2 = await client.searchGame("cyberpunk 2077");
      expect(result2?.backgroundImage).toBe("https://media.rawg.io/media/games/cyberpunk.jpg");
      expect(fetchCount).toBe(1);
    });

    it("should handle RAWG API error gracefully and return null", async () => {
      globalThis.fetch = (async () => {
        return new Response("Unauthorized", { status: 401 });
      }) as any;

      const client = new RawgClient("invalid_key");
      const result = await client.searchGame("Hollow Knight");
      expect(result).toBeNull();
    });
  });

  describe("TmdbClient", () => {
    it("should extract title and year cleanly from 'Title (YYYY)' format", () => {
      const res1 = TmdbClient.extractTitleAndYear("Barbie (2023)");
      expect(res1.title).toBe("Barbie");
      expect(res1.year).toBe(2023);

      const res2 = TmdbClient.extractTitleAndYear("Oppenheimer");
      expect(res2.title).toBe("Oppenheimer");
      expect(res2.year).toBeUndefined();
    });

    it("should map genres and overview fallback to English if Spanish is empty", async () => {
      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/search/movie")) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  id: 12345,
                  title: "Dune",
                  original_title: "Dune",
                  overview: "", // Vacía en español
                  poster_path: "/dune_poster.jpg",
                  release_date: "2021-10-22",
                  genre_ids: [878, 12], // Ciencia ficción, Aventura
                },
              ],
            }),
            { status: 200 }
          );
        }
        if (url.includes("/movie/12345") && url.includes("language=en-US")) {
          return new Response(
            JSON.stringify({
              overview: "Paul Atreides leads nomadic tribes in a battle to control the desert planet.",
            }),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      }) as any;

      const client = new TmdbClient("test_tmdb_key");
      const match = await client.searchMovie("Dune (2021)");

      expect(match).not.toBeNull();
      expect(match?.id).toBe(12345);
      expect(match?.posterPath).toBe("https://image.tmdb.org/t/p/w500/dune_poster.jpg");
      expect(match?.genres).toEqual(["Ciencia ficción", "Aventura"]);
      expect(match?.overview).toContain("Paul Atreides");
    });
  });

  describe("WikipediaClient", () => {
    it("should parse Wikipedia OpenSearch response and return article URL", async () => {
      globalThis.fetch = (async (input: string | URL | Request) => {
        return new Response(
          JSON.stringify([
            "Elden Ring videojuego",
            ["Elden Ring"],
            ["Videojuego de rol de acción"],
            ["https://es.wikipedia.org/wiki/Elden_Ring"],
          ]),
          { status: 200 }
        );
      }) as any;

      const client = new WikipediaClient();
      const url = await client.searchGameWikiUrl("Elden Ring");
      expect(url).toBe("https://es.wikipedia.org/wiki/Elden_Ring");
    });

    it("should return null gracefully if Wikipedia request fails", async () => {
      globalThis.fetch = (async () => {
        throw new Error("Network timeout");
      }) as any;

      const client = new WikipediaClient();
      const url = await client.searchArticleUrl("NonExistentGame123456");
      expect(url).toBeNull();
    });
  });

  describe("HltbClient", () => {
    it("should parse main story and completionist hours from HLTB search", async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            data: [
              {
                game_name: "Celeste",
                comp_main: 28800, // 8 hours (28800s)
                comp_100: 144000, // 40 hours (144000s)
              },
            ],
          }),
          { status: 200 }
        );
      }) as any;

      const client = new HltbClient();
      const estimate = await client.searchDuration("Celeste");

      expect(estimate.mainHours).toBe(8.0);
      expect(estimate.completionistHours).toBe(40.0);
    });

    it("should return null values gracefully when HLTB fails or blocks request", async () => {
      globalThis.fetch = (async () => {
        return new Response("Forbidden", { status: 403 });
      }) as any;

      const client = new HltbClient();
      const estimate = await client.searchDuration("Unknown Indie");

      expect(estimate.mainHours).toBeNull();
      expect(estimate.completionistHours).toBeNull();
    });
  });

  describe("SteamClient Family Sharing support", () => {
    it("should fetch recently played games and combine with owned games", async () => {
      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("GetOwnedGames")) {
          return new Response(
            JSON.stringify({
              response: {
                games: [
                  { appid: 10, name: "Counter-Strike", playtime_forever: 600 },
                  { appid: 20, name: "Team Fortress Classic", playtime_forever: 120 },
                ],
              },
            }),
            { status: 200 }
          );
        }
        if (url.includes("GetRecentlyPlayedGames")) {
          return new Response(
            JSON.stringify({
              response: {
                games: [
                  // Juego compartido por Family Sharing (no está en propios)
                  { appid: 1091500, name: "Cyberpunk 2077", playtime_forever: 1800 },
                  // Juego propio pero con más horas recientes
                  { appid: 10, name: "Counter-Strike", playtime_forever: 750 },
                ],
              },
            }),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      }) as any;

      const steam = new SteamClient("test_steam_key");
      const combined = await steam.getCombinedGames("76561198000000000");

      expect(combined.length).toBe(3);
      const cs = combined.find((g) => g.appId === 10);
      const cyberpunk = combined.find((g) => g.appId === 1091500);

      // Playtime actualizado desde recientemente jugado
      expect(cs?.playtimeMinutes).toBe(750);
      // Título detectado de Family Sharing
      expect(cyberpunk).toBeDefined();
      expect(cyberpunk?.playtimeMinutes).toBe(1800);
    });
  });
});
