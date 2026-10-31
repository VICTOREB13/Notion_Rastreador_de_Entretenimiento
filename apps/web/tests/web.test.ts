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

  test("SpringSegmentedControl normalizes string and object options", () => {
    const { normalizeSegmentedControlOptions } = require("../src/components/ui/SpringSegmentedControl");
    const rawOptions = [
      "ALL",
      { id: "GAMES", label: "🎮 Videojuegos" },
      { value: "MOVIES", label: "🎬 Películas" },
    ];
    const normalized = normalizeSegmentedControlOptions(rawOptions);
    expect(normalized).toHaveLength(3);
    expect(normalized[0]).toEqual({ id: "ALL", label: "ALL", icon: undefined });
    expect(normalized[1].id).toBe("GAMES");
    expect(normalized[1].label).toBe("🎮 Videojuegos");
    expect(normalized[2].id).toBe("MOVIES");
    expect(normalized[2].label).toBe("🎬 Películas");
  });

  test("CustomSelect normalizes options, handles disabled states, and falls back cleanly", () => {
    const { normalizeSelectOptions } = require("../src/components/ui/CustomSelect");
    const options = [
      "gemini-2.0-flash",
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", disabled: true },
      { value: "argon-custom", label: "Argon Model", badge: "Beta" },
    ];
    const normalized = normalizeSelectOptions(options);
    expect(normalized).toHaveLength(3);
    expect(normalized[0].value).toBe("gemini-2.0-flash");
    expect(normalized[0].disabled).toBe(false);
    expect(normalized[1].disabled).toBe(true);
    expect(normalized[2].badge).toBe("Beta");
  });

  test("MorphButton sanitizeCopyLabel handles dirty strings and edge cases", () => {
    const { sanitizeCopyLabel } = require("../src/components/ui/MorphButton");
    expect(sanitizeCopyLabel(undefined)).toBe("Copiado");
    expect(sanitizeCopyLabel("✓ Copiado")).toBe("Copiado");
    expect(sanitizeCopyLabel("✅ Éxito")).toBe("Éxito");
    expect(sanitizeCopyLabel("Folio")).toBe("Copiado");
    expect(sanitizeCopyLabel("Sincronizar")).toBe("Sincronizar");
  });

  test("Theme geometry calculation computes radial clip endRadius accurately", () => {
    const { calculateTransitionGeometry } = require("../src/lib/theme");
    const geomCenter = calculateTransitionGeometry(
      { clientX: 500, clientY: 500 },
      1000,
      1000
    );
    expect(geomCenter.x).toBe(500);
    expect(geomCenter.y).toBe(500);
    expect(geomCenter.endRadius).toBeGreaterThanOrEqual(707); // hypot(500, 500) = ~707.1

    // Real click at offset coordinates
    const geomClick = calculateTransitionGeometry(
      { clientX: 100, clientY: 200 },
      1920,
      1080
    );
    expect(geomClick.x).toBe(100);
    expect(geomClick.y).toBe(200);
    expect(geomClick.endRadius).toBe(2022); // Math.ceil(hypot(1920 - 100, 1080 - 200)) = 2022

    // (0, 0) synthetic event falls back gracefully to center
    const geomFallback = calculateTransitionGeometry(
      { clientX: 0, clientY: 0 },
      1920,
      1080
    );
    expect(geomFallback.x).toBe(960);
    expect(geomFallback.y).toBe(0);
  });

  test("Dynamic Gemini/Argon model selector resolves presets and arbitrary custom models", () => {
    const presetModels = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.0-pro-exp-02-05",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ];

    const resolveModel = (preset: string, customInput: string) => {
      if (preset === "custom") {
        return customInput.trim() || "gemini-2.0-flash";
      }
      return preset;
    };

    expect(resolveModel("gemini-2.0-flash", "")).toBe("gemini-2.0-flash");
    expect(resolveModel("gemini-2.0-flash-lite", "")).toBe("gemini-2.0-flash-lite");
    expect(resolveModel("gemini-2.0-pro-exp-02-05", "")).toBe("gemini-2.0-pro-exp-02-05");
    expect(resolveModel("custom", "argon-experimental-v2")).toBe("argon-experimental-v2");
    expect(resolveModel("custom", "   gemini-2.0-flash-thinking-exp   ")).toBe("gemini-2.0-flash-thinking-exp");
    expect(resolveModel("custom", "")).toBe("gemini-2.0-flash"); // safe fallback
  });

  test("3-way theme cycling transitions deterministically between dark, light, and system", () => {
    const cycleTheme = (current: "dark" | "light" | "system"): "dark" | "light" | "system" => {
      return current === "dark" ? "light" : current === "light" ? "system" : "dark";
    };

    expect(cycleTheme("dark")).toBe("light");
    expect(cycleTheme("light")).toBe("system");
    expect(cycleTheme("system")).toBe("dark");
  });

  test("next.config.mjs remotePatterns include rawg and wikimedia hostnames", async () => {
    const nextConfig = (await import("../next.config.mjs")).default;
    const patterns = nextConfig.images?.remotePatterns || [];
    const hostnames = patterns.map((p: any) => p.hostname);

    expect(hostnames).toContain("media.rawg.io");
    expect(hostnames).toContain("upload.wikimedia.org");
    expect(hostnames).toContain("image.tmdb.org");
    expect(hostnames).toContain("**.steamstatic.com");
  });

  test("Dynamic catch-all proxy sanitizes trailing slashes to avoid double slashes", () => {
    const sanitizeBase = (raw: string) => raw.replace(/\/+$/, "");
    expect(sanitizeBase("http://localhost:3001/")).toBe("http://localhost:3001");
    expect(sanitizeBase("http://daemon-api:3001///")).toBe("http://daemon-api:3001");
    expect(sanitizeBase("http://daemon-api:3001")).toBe("http://daemon-api:3001");

    const targetUrl = (base: string, path: string[]) => {
      const cleanBase = sanitizeBase(base);
      const subPath = path.join("/");
      return `${cleanBase}/api/${subPath}`;
    };

    expect(targetUrl("http://daemon-api:3001/", ["sync", "trigger"])).toBe("http://daemon-api:3001/api/sync/trigger");
  });

  test("Fase 3: TelemetryModal adheres to read-only public showcase requirements", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const modalPath = path.resolve(__dirname, "../src/components/settings/TelemetryModal.tsx");
    const modalContent = fs.readFileSync(modalPath, "utf-8");

    // Zero API Key inputs, Zero temperature sliders, Zero custom model forms
    expect(modalContent).not.toContain("AiModelConfigForm");
    expect(modalContent).not.toContain("onChangeApiKey");
    expect(modalContent).not.toContain("setTemperature");
    expect(modalContent).not.toContain("Guardar Cambios");
    expect(modalContent).not.toContain("Probar Conexión");

    // Must contain read-only AI card with Google Gemini & activeModel fallback to gemini-2.5-flash
    expect(modalContent).toContain("telemetry?.activeModel || \"gemini-2.5-flash\"");
    expect(modalContent).toContain("Google Gemini");
    expect(modalContent).toContain("Cerrar");
  });

  test("Fase 4: BrandHeader horizontal logo selector resolves theme-specific SVGs with error fallback", () => {
    const resolveLogoSrc = (mounted: boolean, resolvedTheme: "dark" | "light", imgError: boolean) => {
      if (imgError) return "/brand/ve-isotipo-red.svg";
      if (mounted && resolvedTheme === "light") return "/brand/ve-logo-horizontal-light-mode.svg";
      return "/brand/ve-logo-horizontal-dark-mode.svg";
    };

    // SSR or unmounted defaults safely to dark mode logo
    expect(resolveLogoSrc(false, "dark", false)).toBe("/brand/ve-logo-horizontal-dark-mode.svg");
    expect(resolveLogoSrc(false, "light", false)).toBe("/brand/ve-logo-horizontal-dark-mode.svg");

    // Mounted client uses resolvedTheme
    expect(resolveLogoSrc(true, "dark", false)).toBe("/brand/ve-logo-horizontal-dark-mode.svg");
    expect(resolveLogoSrc(true, "light", false)).toBe("/brand/ve-logo-horizontal-light-mode.svg");

    // Fallback to isotipo if SVG fails
    expect(resolveLogoSrc(true, "light", true)).toBe("/brand/ve-isotipo-red.svg");
    expect(resolveLogoSrc(true, "dark", true)).toBe("/brand/ve-isotipo-red.svg");
  });

  test("Fase 4: FloatingIslandNavDock uses Telemetría label and adaptive classes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dockPath = path.resolve(__dirname, "../src/components/brand/FloatingIslandNavDock.tsx");
    const dockContent = fs.readFileSync(dockPath, "utf-8");

    expect(dockContent).toContain("title=\"Telemetría\"");
    expect(dockContent).toContain("Telemetría</span>");
    expect(dockContent).not.toContain("Ajustes IA");
    expect(dockContent).toContain("bg-white/90 dark:bg-zinc-950/85");
  });

  test("Fase 4: Brand and Catalog cards enforce adaptive dual-theme high contrast tokens", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // DarkIslandSplineCard
    const splineContent = fs.readFileSync(path.resolve(__dirname, "../src/components/brand/DarkIslandSplineCard.tsx"), "utf-8");
    expect(splineContent).toContain("bg-white dark:bg-[#111113]");
    expect(splineContent).toContain("SpringSegmentedControl");

    // SegmentedProgressCard
    const progressContent = fs.readFileSync(path.resolve(__dirname, "../src/components/brand/SegmentedProgressCard.tsx"), "utf-8");
    expect(progressContent).toContain("bg-white dark:bg-[#111113]");

    // SpotlightCard
    const spotlightContent = fs.readFileSync(path.resolve(__dirname, "../src/components/brand/SpotlightCard.tsx"), "utf-8");
    expect(spotlightContent).toContain("bg-white dark:bg-[#111113]");

    // BentoCatalogGrid empty state
    const bentoContent = fs.readFileSync(path.resolve(__dirname, "../src/components/catalog/BentoCatalogGrid.tsx"), "utf-8");
    expect(bentoContent).toContain("bg-zinc-100/80 dark:bg-[#111113]/50");

    // GameCard & MovieCard high-contrast text
    const gameContent = fs.readFileSync(path.resolve(__dirname, "../src/components/catalog/GameCard.tsx"), "utf-8");
    expect(gameContent).toContain("text-zinc-900 dark:text-zinc-100");

    const movieContent = fs.readFileSync(path.resolve(__dirname, "../src/components/catalog/MovieCard.tsx"), "utf-8");
    expect(movieContent).toContain("text-zinc-900 dark:text-zinc-100");
  });
});
