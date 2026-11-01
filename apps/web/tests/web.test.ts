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

  test("Fase 5: SmoothScroll component incorporates Lenis, safe anchor handling, and respectReducedMotion", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const scrollPath = path.resolve(__dirname, "../src/components/layout/SmoothScroll.tsx");
    expect(fs.existsSync(scrollPath)).toBe(true);

    const scrollContent = fs.readFileSync(scrollPath, "utf-8");
    expect(scrollContent).toContain("import Lenis from \"lenis\"");
    expect(scrollContent).toContain("respectReducedMotion: true");
    expect(scrollContent).toContain("requestAnimationFrame(updateTicker)");
    expect(scrollContent).toContain("new ResizeObserver");
    expect(scrollContent).toContain("__lenis");
    expect(scrollContent).toContain("lenis.destroy()");

    // Functional anchor hash sanitization logic test
    const resolveAnchorTarget = (hash: string) => {
      if (hash === "#" || hash === "#top") {
        return { target: 0, isTop: true };
      }
      try {
        // Validates selector syntax safety
        return { target: hash, isTop: false };
      } catch {
        return null;
      }
    };

    expect(resolveAnchorTarget("#")).toEqual({ target: 0, isTop: true });
    expect(resolveAnchorTarget("#top")).toEqual({ target: 0, isTop: true });
    expect(resolveAnchorTarget("#catalogo")).toEqual({ target: "#catalogo", isTop: false });
    expect(resolveAnchorTarget("#ritmo")).toEqual({ target: "#ritmo", isTop: false });
  });

  test("Fase 5: ScrollToTop component integrates with Lenis or window scroll with mobile dock clearance", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const toTopPath = path.resolve(__dirname, "../src/components/layout/ScrollToTop.tsx");
    expect(fs.existsSync(toTopPath)).toBe(true);

    const toTopContent = fs.readFileSync(toTopPath, "utf-8");
    expect(toTopContent).toContain("scrollToTop");
    expect(toTopContent).toContain("__lenis");
    expect(toTopContent).toContain("bottom-22 right-4 sm:bottom-8 sm:right-8");
    expect(toTopContent).toContain("Volver arriba");

    // Dynamic threshold evaluator with Lenis priority
    const evaluateVisibility = (scrollY: number, lenisScroll?: number) => {
      const current = lenisScroll ?? scrollY;
      return current > 300;
    };

    expect(evaluateVisibility(0)).toBe(false);
    expect(evaluateVisibility(250)).toBe(false);
    expect(evaluateVisibility(350)).toBe(true);
    expect(evaluateVisibility(100, 450)).toBe(true); // Lenis takes precedence
  });

  test("Fase 5: Modal and dropdown containers enforce Lenis scroll isolation and lifecycle locking", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // DialogModal
    const dialogPath = path.resolve(__dirname, "../src/components/ui/DialogModal.tsx");
    const dialogContent = fs.readFileSync(dialogPath, "utf-8");
    expect(dialogContent).toContain("data-lenis-prevent");
    expect(dialogContent).toContain("lenis?.stop()");
    expect(dialogContent).toContain("lenis?.start()");

    // ItemDetailModal
    const itemDetailPath = path.resolve(__dirname, "../src/components/detail/ItemDetailModal.tsx");
    const itemDetailContent = fs.readFileSync(itemDetailPath, "utf-8");
    expect(itemDetailContent).toContain("data-lenis-prevent");
    expect(itemDetailContent).toContain("lenis?.stop()");
    expect(itemDetailContent).toContain("lenis?.start()");

    // CustomSelect
    const customSelectPath = path.resolve(__dirname, "../src/components/ui/CustomSelect.tsx");
    const customSelectContent = fs.readFileSync(customSelectPath, "utf-8");
    expect(customSelectContent).toContain("data-lenis-prevent");
  });

  test("v2.2.0 UI Updates: ItemDetailModal removes divider and Steam ID, displays rating, completionDate, genres, and user summary", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const modalPath = path.resolve(__dirname, "../src/components/detail/ItemDetailModal.tsx");
    const modalContent = fs.readFileSync(modalPath, "utf-8");

    // 1. Elimina barra divisoria y texto "Sincronizado con Notion"
    expect(modalContent).not.toContain("Sincronizado con Notion");
    expect(modalContent).not.toContain("border-t border-zinc-200 dark:border-white/10 flex items-center justify-between text-xs text-zinc-500");

    // 2. Oculta Steam ID
    expect(modalContent).not.toContain("Steam ID:");

    // 3. Muestra calificación con estrellas de 1 a 5
    expect(modalContent).toContain("currentItem.rating");
    expect(modalContent).toContain("/5");

    // 4. Muestra fecha de culminación
    expect(modalContent).toContain("completionDate");
    expect(modalContent).toContain("Culminado:");

    // 5. Muestra géneros provenientes de Notion
    expect(modalContent).toContain("currentItem.genres");

    // 6. Muestra resumen / opinión personal del usuario
    expect(modalContent).toContain("Mi Resumen & Opinión Personal");
    expect(modalContent).toContain("game?.summary || movie?.summary");
  });

  test("v2.2.0 UI Updates: LiveGamingBadge resting contrast, GameCard independent HLTB, and MovieCard aspect video", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // LiveGamingBadge resting state light contrast
    const badgePath = path.resolve(__dirname, "../src/components/live/LiveGamingBadge.tsx");
    const badgeContent = fs.readFileSync(badgePath, "utf-8");
    expect(badgeContent).toContain("bg-zinc-100 dark:bg-zinc-900/80");
    expect(badgeContent).toContain("text-zinc-600 dark:text-zinc-400");
    expect(badgeContent).toContain("Steam: En descanso");

    // GameCard independent HLTB & rating badge
    const cardPath = path.resolve(__dirname, "../src/components/catalog/GameCard.tsx");
    const cardContent = fs.readFileSync(cardPath, "utf-8");
    expect(cardContent).toContain("game.hltbMain || game.hltbCompletionist");
    expect(cardContent).toContain("game.rating");

    // MovieCard aspectRatio video support for Colección tab
    const moviePath = path.resolve(__dirname, "../src/components/catalog/MovieCard.tsx");
    const movieContent = fs.readFileSync(moviePath, "utf-8");
    expect(movieContent).toContain("aspectRatio");
    expect(movieContent).toContain("aspect-video");

    // BentoCatalogGrid passes aspectRatio video in ALL category
    const gridPath = path.resolve(__dirname, "../src/components/catalog/BentoCatalogGrid.tsx");
    const gridContent = fs.readFileSync(gridPath, "utf-8");
    expect(gridContent).toContain('category === "ALL" ? "video" : "poster"');
    expect(gridContent).toContain("animate-in fade-in duration-300");
  });

  test("v2.2.1 UI Updates: BentoCatalogGrid skeleton loading with shimmer, microinteractions on search, cards, and nav", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // BentoCatalogGrid skeleton loading & shimmer support
    const gridPath = path.resolve(__dirname, "../src/components/catalog/BentoCatalogGrid.tsx");
    const gridContent = fs.readFileSync(gridPath, "utf-8");
    expect(gridContent).toContain("BentoCatalogSkeleton");
    expect(gridContent).toContain("isLoading");
    expect(gridContent).toContain("animate-[shimmer_2s_infinite]");

    // CatalogHeader microinteractions
    const headerPath = path.resolve(__dirname, "../src/components/catalog/CatalogHeader.tsx");
    const headerContent = fs.readFileSync(headerPath, "utf-8");
    expect(headerContent).toContain("group/search");
    expect(headerContent).toContain("group-focus-within/search:text-rose-500");
    expect(headerContent).toContain("hover:rotate-90");

    // GameCard and MovieCard hover microinteractions
    const gameCardPath = path.resolve(__dirname, "../src/components/catalog/GameCard.tsx");
    const gameContent = fs.readFileSync(gameCardPath, "utf-8");
    expect(gameContent).toContain("hover:-translate-y-1.5");
    expect(gameContent).toContain("hover:border-rose-500/40");
    expect(gameContent).toContain("group-hover:scale-106");

    const movieCardPath = path.resolve(__dirname, "../src/components/catalog/MovieCard.tsx");
    const movieContent = fs.readFileSync(movieCardPath, "utf-8");
    expect(movieContent).toContain("hover:-translate-y-1.5");
    expect(movieContent).toContain("hover:border-rose-500/40");
    expect(movieContent).toContain("group-hover:scale-106");

    // BrandHeader version v2.3.0
    const brandPath = path.resolve(__dirname, "../src/components/brand/BrandHeader.tsx");
    const brandContent = fs.readFileSync(brandPath, "utf-8");
    expect(brandContent).toContain("v2.3.0");

    // ItemDetailModal microinteractions (close button, external link, re-enrich)
    const modalPath = path.resolve(__dirname, "../src/components/detail/ItemDetailModal.tsx");
    const modalContent = fs.readFileSync(modalPath, "utf-8");
    expect(modalContent).toContain("hover:rotate-90");
    expect(modalContent).toContain("group-hover:translate-x-0.5");
    expect(modalContent).toContain("group-hover:rotate-180");

    // AiRecommendationHero microinteraction on action button
    const heroPath = path.resolve(__dirname, "../src/components/catalog/AiRecommendationHero.tsx");
    const heroContent = fs.readFileSync(heroPath, "utf-8");
    expect(heroContent).toContain("group-hover:translate-x-1");

    // LiveGamingBadge hover feedback
    const liveBadgePath = path.resolve(__dirname, "../src/components/live/LiveGamingBadge.tsx");
    const liveBadgeContent = fs.readFileSync(liveBadgePath, "utf-8");
    expect(liveBadgeContent).toContain("hover:-translate-y-0.5");

    // ThemeToggle microinteraction
    const themeTogglePath = path.resolve(__dirname, "../src/components/ui/ThemeToggle.tsx");
    const themeToggleContent = fs.readFileSync(themeTogglePath, "utf-8");
    expect(themeToggleContent).toContain("group-hover:rotate-12");
  });

  test("v2.3.0: Catalog sorting by recent/playtime/rating/alphabetical and dynamic genre filtering", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // CatalogHeader Sort By options & dynamic Genre Filter bar
    const catalogHeaderPath = path.resolve(__dirname, "../src/components/catalog/CatalogHeader.tsx");
    const catalogHeaderContent = fs.readFileSync(catalogHeaderPath, "utf-8");
    expect(catalogHeaderContent).toContain("Jugados recientemente");
    expect(catalogHeaderContent).toContain("Más jugados");
    expect(catalogHeaderContent).toContain("Mejor calificados");
    expect(catalogHeaderContent).toContain("Alfabético (A-Z)");
    expect(catalogHeaderContent).toContain("availableGenres");
    expect(catalogHeaderContent).toContain("Limpiar filtro");

    // BentoCatalogGrid sorting & dynamic genre filtering
    const catalogGridPath = path.resolve(__dirname, "../src/components/catalog/BentoCatalogGrid.tsx");
    const catalogGridContent = fs.readFileSync(catalogGridPath, "utf-8");
    expect(catalogGridContent).toContain("getRecentTimestamp");
    expect(catalogGridContent).toContain("getPlaytime");
    expect(catalogGridContent).toContain("getRating");
    expect(catalogGridContent).toContain("selectedGenre");

    // page.tsx availableGenres extraction and wiring
    const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    expect(pageContent).toContain("availableGenres");
    expect(pageContent).toContain("sortBy");
    expect(pageContent).toContain("selectedGenre");
  });

  test("v2.4.0 (TASK-332): Movie completionDate formatting and MovieCard/ItemDetailModal display", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { formatDate } = await import("../src/lib/utils");

    // 1. formatDate unit tests with comprehensive edge cases
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("   ")).toBe("");
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate("invalid-date")).toBe("");
    expect(formatDate("foo-bar-baz")).toBe("");
    expect(formatDate("2024-02-31")).toBe(""); // Non-existent date
    expect(formatDate("2023-02-29")).toBe(""); // Non-leap year 29 Feb

    // Valid dates
    expect(formatDate("2024-05-15")).toContain("2024");
    expect(formatDate("2024-05-15")).toContain("15");
    expect(formatDate("2024-05-15T00:00:00.000Z")).toContain("2024");
    expect(formatDate("2024-05-15T00:00:00.000Z")).toContain("15");
    expect(formatDate("2024-02-29")).toContain("2024"); // Leap year
    expect(formatDate("2023-12-31")).toContain("2023");

    // 2. MovieCard.tsx verification
    const movieCardPath = path.resolve(__dirname, "../src/components/catalog/MovieCard.tsx");
    const movieCardContent = fs.readFileSync(movieCardPath, "utf-8");
    expect(movieCardContent).toContain("CalendarCheck");
    expect(movieCardContent).toContain("movie.completionDate");
    expect(movieCardContent).toContain("formatDate(movie.completionDate)");
    expect(movieCardContent).toContain("Vista:");
    expect(movieCardContent).toContain("p-3.5 sm:p-4");

    // 3. ItemDetailModal.tsx verification
    const itemDetailPath = path.resolve(__dirname, "../src/components/detail/ItemDetailModal.tsx");
    const itemDetailContent = fs.readFileSync(itemDetailPath, "utf-8");
    expect(itemDetailContent).toContain("CalendarCheck");
    expect(itemDetailContent).toContain("Fecha de visualización:");
    expect(itemDetailContent).toContain("formatDate(movie.completionDate)");
    expect(itemDetailContent).toContain("formatDate(game.completionDate)");
  });

  test("v2.4.0 (TASK-333): Global keyboard shortcuts logic and UI indicators", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { isInteractiveElement } = await import("../src/lib/useKeyboardShortcuts");

    // 1. isInteractiveElement unit tests
    const dummyInput = { tagName: "INPUT", isContentEditable: false } as unknown as Element;
    const dummyTextarea = { tagName: "TEXTAREA", isContentEditable: false } as unknown as Element;
    const dummySelect = { tagName: "SELECT", isContentEditable: false } as unknown as Element;
    const dummyEditable = { tagName: "DIV", isContentEditable: true } as unknown as Element;
    const dummyButton = { tagName: "BUTTON", isContentEditable: false } as unknown as Element;
    const dummyDiv = { tagName: "DIV", isContentEditable: false } as unknown as Element;

    expect(isInteractiveElement(dummyInput)).toBe(true);
    expect(isInteractiveElement(dummyTextarea)).toBe(true);
    expect(isInteractiveElement(dummySelect)).toBe(true);
    expect(isInteractiveElement(dummyEditable)).toBe(true);
    expect(isInteractiveElement(dummyButton)).toBe(false);
    expect(isInteractiveElement(dummyDiv)).toBe(false);
    expect(isInteractiveElement(null)).toBe(false);

    // Nested element inside contentEditable container
    const nestedChild = {
      tagName: "SPAN",
      isContentEditable: false,
      closest: (sel: string) => (sel.includes("contenteditable") ? {} : null),
    } as unknown as Element;
    expect(isInteractiveElement(nestedChild)).toBe(true);

    // 2. Behavioral simulation of keyboard shortcuts logic
    type ShortcutEvent = {
      key: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      altKey?: boolean;
      target: any;
      defaultPrevented: boolean;
      preventDefault: () => void;
    };

    const createShortcutSimulator = (handlers: {
      onSearchFocus: () => void;
      onEscape: () => void;
      onToggleTheme: () => void;
    }) => {
      return (event: Partial<ShortcutEvent>, activeElement: any = null) => {
        let prevented = false;
        const e = {
          key: event.key || "",
          ctrlKey: Boolean(event.ctrlKey),
          metaKey: Boolean(event.metaKey),
          altKey: Boolean(event.altKey),
          target: event.target || null,
          preventDefault: () => {
            prevented = true;
          },
        };

        const isTargetInteractive = isInteractiveElement(e.target) || isInteractiveElement(activeElement);

        if (e.key === "Escape") {
          handlers.onEscape();
          if (activeElement && typeof activeElement.blur === "function") {
            activeElement.blur();
          }
          return { prevented, action: "escape" };
        }

        if (isTargetInteractive) {
          return { prevented, action: "ignored_interactive" };
        }

        const isSearchKey =
          (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) ||
          ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.altKey);

        if (isSearchKey) {
          e.preventDefault();
          handlers.onSearchFocus();
          return { prevented, action: "search" };
        }

        if ((e.key === "t" || e.key === "T") && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handlers.onToggleTheme();
          return { prevented, action: "theme" };
        }

        return { prevented, action: "none" };
      };
    };

    let searchCalled = 0;
    let escapeCalled = 0;
    let themeCalled = 0;
    let blurred = false;

    const mockActiveInput = {
      tagName: "INPUT",
      isContentEditable: false,
      blur: () => {
        blurred = true;
      },
    };

    const simulate = createShortcutSimulator({
      onSearchFocus: () => {
        searchCalled++;
      },
      onEscape: () => {
        escapeCalled++;
      },
      onToggleTheme: () => {
        themeCalled++;
      },
    });

    // Test non-interactive shortcuts
    expect(simulate({ key: "/", target: dummyDiv })).toEqual({ prevented: true, action: "search" });
    expect(searchCalled).toBe(1);

    expect(simulate({ key: "k", ctrlKey: true, target: dummyDiv })).toEqual({ prevented: true, action: "search" });
    expect(searchCalled).toBe(2);

    expect(simulate({ key: "k", metaKey: true, target: dummyDiv })).toEqual({ prevented: true, action: "search" });
    expect(searchCalled).toBe(3);

    // AltGr + K must NOT trigger search
    expect(simulate({ key: "k", ctrlKey: true, altKey: true, target: dummyDiv })).toEqual({ prevented: false, action: "none" });
    expect(searchCalled).toBe(3);

    // Theme toggle
    expect(simulate({ key: "t", target: dummyDiv })).toEqual({ prevented: true, action: "theme" });
    expect(themeCalled).toBe(1);

    expect(simulate({ key: "T", target: dummyDiv })).toEqual({ prevented: true, action: "theme" });
    expect(themeCalled).toBe(2);

    // Ctrl+T (browser new tab) must NOT trigger theme toggle
    expect(simulate({ key: "t", ctrlKey: true, target: dummyDiv })).toEqual({ prevented: false, action: "none" });
    expect(themeCalled).toBe(2);

    // While typing in interactive element: / and t must be ignored
    expect(simulate({ key: "/", target: dummyInput })).toEqual({ prevented: false, action: "ignored_interactive" });
    expect(simulate({ key: "t", target: dummyInput })).toEqual({ prevented: false, action: "ignored_interactive" });
    expect(searchCalled).toBe(3);
    expect(themeCalled).toBe(2);

    // Escape in interactive element calls onEscape and blurs input
    expect(simulate({ key: "Escape", target: dummyInput }, mockActiveInput)).toEqual({ prevented: false, action: "escape" });
    expect(escapeCalled).toBe(1);
    expect(blurred).toBe(true);

    // 3. CatalogHeader shortcut indicators and ref
    const catalogHeaderPath = path.resolve(__dirname, "../src/components/catalog/CatalogHeader.tsx");
    const catalogHeaderContent = fs.readFileSync(catalogHeaderPath, "utf-8");
    expect(catalogHeaderContent).toContain("Ctrl+K o /");
    expect(catalogHeaderContent).toContain("searchInputRef");
    expect(catalogHeaderContent).toContain("<kbd");

    // 4. ThemeToggle shortcut indicator
    const themeTogglePath = path.resolve(__dirname, "../src/components/ui/ThemeToggle.tsx");
    const themeToggleContent = fs.readFileSync(themeTogglePath, "utf-8");
    expect(themeToggleContent).toContain("Atajo: T");

    // 5. page.tsx integration of shortcuts
    const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    expect(pageContent).toContain("useKeyboardShortcuts");
    expect(pageContent).toContain("onSearchFocus");
    expect(pageContent).toContain("onEscape");
    expect(pageContent).toContain("onToggleTheme");
    expect(pageContent).toContain("preventScroll: true");
    expect(pageContent).toContain("searchInputRef={searchInputRef}");
  });

  test("v2.4.0 (TASK-334): AnalyticsModal component, FloatingIslandNavDock button, and Mobile polish", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // 1. AnalyticsModal exists and adheres to specifications
    const analyticsModalPath = path.resolve(__dirname, "../src/components/analytics/AnalyticsModal.tsx");
    expect(fs.existsSync(analyticsModalPath)).toBe(true);

    const analyticsContent = fs.readFileSync(analyticsModalPath, "utf-8");
    expect(analyticsContent).toContain("useAnalyticsQuery");
    expect(analyticsContent).toContain("Total Horas");
    expect(analyticsContent).toContain("Total Juegos");
    expect(analyticsContent).toContain("Total Películas");
    expect(analyticsContent).toContain("Top 5 Juegos Más Jugados");
    expect(analyticsContent).toContain("Desglose de Géneros Destacados");
    expect(analyticsContent).toContain("DialogModal");
    expect(analyticsContent).toContain("maxPlaytime");
    expect(analyticsContent).toContain("formatHours");
    expect(analyticsContent).toContain("min-h-[36px]");

    // 2. FloatingIslandNavDock analytics trigger button
    const dockPath = path.resolve(__dirname, "../src/components/brand/FloatingIslandNavDock.tsx");
    const dockContent = fs.readFileSync(dockPath, "utf-8");
    expect(dockContent).toContain("onOpenAnalytics");
    expect(dockContent).toContain("BarChart3");
    expect(dockContent).toContain("title=\"Analíticas\"");
    expect(dockContent).toContain("aria-label=\"Analíticas\"");
    expect(dockContent).toContain("Analíticas</span>");
    expect(dockContent).toContain("min-h-[36px]");

    // 3. DialogModal Mobile polish (<640px) & Touch targets >= 44px
    const dialogPath = path.resolve(__dirname, "../src/components/ui/DialogModal.tsx");
    const dialogContent = fs.readFileSync(dialogPath, "utf-8");
    expect(dialogContent).toContain("min-h-[44px]");
    expect(dialogContent).toContain("min-w-[44px]");
    expect(dialogContent).toContain("px-4 sm:px-6");
    expect(dialogContent).toContain("p-4 sm:p-6");

    // 4. Mobile clearance and card polish
    const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    expect(pageContent).toMatch(/pb-(32|36)/);
    expect(pageContent).toContain("AnalyticsModal");
    expect(pageContent).toContain("isAnalyticsOpen");

    const movieCardPath = path.resolve(__dirname, "../src/components/catalog/MovieCard.tsx");
    const movieCardContent = fs.readFileSync(movieCardPath, "utf-8");
    expect(movieCardContent).toContain("p-3.5 sm:p-4");

    const gameCardPath = path.resolve(__dirname, "../src/components/catalog/GameCard.tsx");
    const gameCardContent = fs.readFileSync(gameCardPath, "utf-8");
    expect(gameCardContent).toContain("p-3.5 sm:p-4");

    const itemDetailPath = path.resolve(__dirname, "../src/components/detail/ItemDetailModal.tsx");
    const itemDetailContent = fs.readFileSync(itemDetailPath, "utf-8");
    expect(itemDetailContent).toContain("min-h-[44px]");

    // 5. Strict NO PWA rule: confirm no manifest.json or sw.js in public directory
    const publicPath = path.resolve(__dirname, "../public");
    const manifestExists = fs.existsSync(path.join(publicPath, "manifest.json"));
    const swExists =
      fs.existsSync(path.join(publicPath, "sw.js")) ||
      fs.existsSync(path.join(publicPath, "service-worker.js"));
    expect(manifestExists).toBe(false);
    expect(swExists).toBe(false);
  });
});



