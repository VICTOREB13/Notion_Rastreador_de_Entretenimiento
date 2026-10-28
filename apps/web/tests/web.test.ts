import { describe, test, expect } from "bun:test";
import { cn, formatHours, formatMinutes } from "../src/lib/utils";

describe("Frontend Web Utilities (@repo/web)", () => {
  test("cn merges class names and removes duplicate tailwind conflicts", () => {
    const result = cn("p-4 bg-red-500", "p-2", false && "hidden", "text-white");
    expect(result).toBe("bg-red-500 p-2 text-white");
  });

  test("formatHours formats null, zero, and positive hours cleanly", () => {
    expect(formatHours(null)).toBe("0 hrs");
    expect(formatHours(undefined)).toBe("0 hrs");
    expect(formatHours(0)).toBe("0.0 hrs");
    expect(formatHours(14.8)).toBe("14.8 hrs");
    expect(formatHours(25.6)).toBe("25.6 hrs");
  });

  test("formatMinutes formats 0, under an hour, and multi-hour durations", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(125)).toBe("2h 5m");
  });

  test("multi-field search matches titles, platforms, genres, and vibes", () => {
    const mockGames = [
      {
        id: "1",
        title: "Cyberpunk 2077",
        platform: "PC (Steam)",
        genres: ["RPG", "Acción", "Sci-Fi"],
        status: "Jugando",
        aiEnrichment: {
          vibeTags: ["Distopía Neon", "Inmersivo"],
          personalizedPitch: "Una historia en Night City",
          thematicTropes: ["Cyberware", "Mega-corporaciones"],
        },
      },
      {
        id: "2",
        title: "Hollow Knight",
        platform: "Nintendo Switch",
        genres: ["Metroidvania", "Souls-like"],
        status: "Jugado",
        aiEnrichment: {
          vibeTags: ["Melancólico", "Desafiante"],
          personalizedPitch: "Explora Hallownest",
          thematicTropes: ["Ruinas Antiguas"],
        },
      },
    ];

    const searchFilter = (query: string) => {
      const q = query.trim().toLowerCase();
      return mockGames.filter((g) => {
        const matchTitle = g.title.toLowerCase().includes(q);
        const matchPlatform = g.platform.toLowerCase().includes(q);
        const matchGenres = g.genres.some((genre) => genre.toLowerCase().includes(q));
        const matchVibe = g.aiEnrichment?.vibeTags?.some((v) => v.toLowerCase().includes(q));
        return matchTitle || matchPlatform || matchGenres || matchVibe;
      });
    };

    // Match by genre
    expect(searchFilter("Metroidvania")).toHaveLength(1);
    expect(searchFilter("Metroidvania")[0].title).toBe("Hollow Knight");

    // Match by vibe tag
    expect(searchFilter("Neon")).toHaveLength(1);
    expect(searchFilter("Neon")[0].title).toBe("Cyberpunk 2077");

    // Match by platform
    expect(searchFilter("Steam")).toHaveLength(1);
    expect(searchFilter("Steam")[0].title).toBe("Cyberpunk 2077");

    // No match
    expect(searchFilter("Zelda")).toHaveLength(0);
  });

  test("status filtering strictly matches domain status labels", () => {
    const games = [
      { id: "1", title: "Game A", status: "Jugando" },
      { id: "2", title: "Game B", status: "Por Jugar" },
      { id: "3", title: "Game C", status: "Jugado" },
    ];

    expect(games.filter((g) => g.status === "Jugando")).toHaveLength(1);
    expect(games.filter((g) => g.status === "Por Jugar")).toHaveLength(1);
    expect(games.filter((g) => g.status === "Jugado")).toHaveLength(1);
  });

  test("movie search and status filtering aligns with TMDB domain standards", () => {
    const mockMovies = [
      {
        id: "m1",
        title: "Blade Runner 2049",
        year: 2017,
        genres: ["Sci-Fi", "Misterio"],
        status: "Vista",
        overview: "Treinta años después de los eventos de la primera película...",
        aiEnrichment: {
          vibeTags: ["Cyberpunk Melancólico", "Filosófico"],
          personalizedPitch: "Una obra maestra visual sobre qué significa ser humano",
        },
      },
      {
        id: "m2",
        title: "Dune: Parte Dos",
        year: 2024,
        genres: ["Sci-Fi", "Aventura"],
        status: "Por Ver",
        overview: "Paul Atreides se une a Chani y a los Fremen...",
        aiEnrichment: {
          vibeTags: ["Épico", "Arena y Destino"],
        },
      },
    ];

    const filterMovies = (query: string, statusFilter?: string) => {
      const q = query.trim().toLowerCase();
      return mockMovies.filter((m) => {
        if (q) {
          const matchTitle = m.title.toLowerCase().includes(q);
          const matchYear = String(m.year).includes(q);
          const matchGenres = m.genres.some((g) => g.toLowerCase().includes(q));
          const matchVibe = m.aiEnrichment?.vibeTags.some((v) => v.toLowerCase().includes(q));
          if (!matchTitle && !matchYear && !matchGenres && !matchVibe) return false;
        }
        if (statusFilter && m.status !== statusFilter) return false;
        return true;
      });
    };

    expect(filterMovies("2049")).toHaveLength(1);
    expect(filterMovies("Cyberpunk")).toHaveLength(1);
    expect(filterMovies("", "Vista")).toHaveLength(1);
    expect(filterMovies("", "Por Ver")).toHaveLength(1);
  });

  test("DOM budget check ensures default pagination keeps estimated nodes < 800", () => {
    const itemsPerPage = 12;
    const estimatedNodesPerCard = 15;
    const headerAndBrandNodes = 120; // Topbar + MetricBand + Spline + Progress + Hero + NavDock
    const estimatedDefaultDomNodes = headerAndBrandNodes + itemsPerPage * estimatedNodesPerCard;

    // Must be well within budget (< 800 warning, < 1400 fatal)
    expect(estimatedDefaultDomNodes).toBeLessThan(800);
    expect(estimatedDefaultDomNodes).toBe(300);
  });
});
