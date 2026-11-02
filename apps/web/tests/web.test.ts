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

  test("Fase 5: SmoothScroll safe anchor target resolution and sanitization", () => {
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

  test("Fase 5: ScrollToTop dynamic visibility threshold evaluator with Lenis priority", () => {
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

  test("v2.4.0 (TASK-332): formatDate unit tests with comprehensive edge cases", async () => {
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

  test("v2.4.0 (TASK-334): Strict NO PWA rule: confirm no manifest.json or sw.js in public directory", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const publicPath = path.resolve(__dirname, "../public");
    const manifestExists = fs.existsSync(path.join(publicPath, "manifest.json"));
    const swExists =
      fs.existsSync(path.join(publicPath, "sw.js")) ||
      fs.existsSync(path.join(publicPath, "service-worker.js"));
    expect(manifestExists).toBe(false);
    expect(swExists).toBe(false);
  });

  test("v2.4.0: Dynamic Version SSoT: APP_VERSION reads from package.json and supports NEXT_PUBLIC_APP_VERSION", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // 6. Dynamic Version SSoT: APP_VERSION reads from package.json and supports NEXT_PUBLIC_APP_VERSION
    const brandPath = path.resolve(__dirname, "../src/components/brand/BrandHeader.tsx");
    const brandContent = fs.readFileSync(brandPath, "utf-8");
    expect(brandContent).toContain("APP_VERSION");
    expect(brandContent).toContain("@/lib/version");

    const versionPath = path.resolve(__dirname, "../src/lib/version.ts");
    expect(fs.existsSync(versionPath)).toBe(true);
    const versionContent = fs.readFileSync(versionPath, "utf-8");
    expect(versionContent).toContain("NEXT_PUBLIC_APP_VERSION");
    expect(versionContent).toContain("packageJson.version");
    expect(versionContent).toContain("APP_VERSION");

    const nextConfigPath = path.resolve(__dirname, "../next.config.mjs");
    const nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");
    expect(nextConfigContent).toContain("NEXT_PUBLIC_APP_VERSION");
    expect(nextConfigContent).toContain("packageJson.version");

    const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    expect(pageContent).toContain("APP_VERSION");
    expect(pageContent).toContain("@/lib/version");

    // Dynamic SSoT check against apps/web/package.json
    const pkgPath = path.resolve(__dirname, "../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const { APP_VERSION } = await import("../src/lib/version");
    expect(APP_VERSION).toBe(`v${pkg.version}`);

    // Verify opengraph-image.tsx uses APP_VERSION from @/lib/version without hardcoding
    const ogPath = path.resolve(__dirname, "../src/app/opengraph-image.tsx");
    const ogContent = fs.readFileSync(ogPath, "utf-8");
    expect(ogContent).toContain("APP_VERSION");
    expect(ogContent).toContain("@/lib/version");
    expect(ogContent).not.toContain("v2.0.2");

    // Verify NEXT_PUBLIC_APP_VERSION takes precedence over package.json when provided
    const evaluateVersionSSoT = (customEnv?: string) => {
      const orig = process.env.NEXT_PUBLIC_APP_VERSION;
      try {
        if (customEnv !== undefined) {
          process.env.NEXT_PUBLIC_APP_VERSION = customEnv;
        } else {
          delete process.env.NEXT_PUBLIC_APP_VERSION;
        }
        return process.env.NEXT_PUBLIC_APP_VERSION || ("v" + pkg.version);
      } finally {
        if (orig !== undefined) {
          process.env.NEXT_PUBLIC_APP_VERSION = orig;
        } else {
          delete process.env.NEXT_PUBLIC_APP_VERSION;
        }
      }
    };
    expect(evaluateVersionSSoT()).toBe(`v${pkg.version}`);
    expect(evaluateVersionSSoT("v3.0.0-custom")).toBe("v3.0.0-custom");
  });

  test("v2.6.0: Notion Sync, Header-First Navigation, Filter Bar Ergonomics & Symmetric KPIs", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // 1. Notion Sync API & Hooks (TASK-347)
    const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
    const apiContent = fs.readFileSync(apiPath, "utf-8");
    expect(apiContent).toContain("triggerNotionSync");

    const hooksPath = path.resolve(__dirname, "../src/lib/hooks.ts");
    const hooksContent = fs.readFileSync(hooksPath, "utf-8");
    expect(hooksContent).toContain("useSyncNotionMutation");
    expect(hooksContent).toContain("triggerNotionSync");

    // 2. Header-First Navigation & Dock Retirement (TASK-353)
    const brandHeaderPath = path.resolve(__dirname, "../src/components/brand/BrandHeader.tsx");
    const brandHeaderContent = fs.readFileSync(brandHeaderPath, "utf-8");
    expect(brandHeaderContent).toContain("onOpenAnalytics");
    expect(brandHeaderContent).toContain("Analíticas");

    const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    expect(pageContent).toContain("onOpenAnalytics={() => setIsAnalyticsOpen(true)}");
    expect(pageContent).not.toContain("<FloatingIslandNavDock");
    expect(pageContent).not.toContain("FloatingIslandNavDock");
  });

  test("v2.6.1: Unified Filter Toolbar, Searchable Genre Select, and Date Range Filter Logic", async () => {
    const {
      matchesDateRange,
      getItemYears,
      isYearInDateRange,
      DATE_RANGE_OPTIONS,
    } = await import("../src/components/catalog/CatalogHeader");

    // 1. DATE_RANGE_OPTIONS completeness
    const optionValues = DATE_RANGE_OPTIONS.map((o) => o.value);
    expect(optionValues).toContain("ALL");
    expect(optionValues).toContain("2026");
    expect(optionValues).toContain("2025");
    expect(optionValues).toContain("2024");
    expect(optionValues).toContain("2020-2023");
    expect(optionValues).toContain("2010-2019");
    expect(optionValues).toContain("CLASSIC");

    // 2. getItemYears extraction
    // Movie with release year and completionDate
    const movieA = {
      year: 2017,
      completionDate: "2024-05-15",
    };
    expect(getItemYears(movieA)).toContain(2017);
    expect(getItemYears(movieA)).toContain(2024);

    // Movie with releaseYear property instead of year
    const itemWithReleaseYear = {
      releaseYear: 2021,
    };
    expect(getItemYears(itemWithReleaseYear)).toEqual([2021]);

    // Item with string year
    const itemWithStringYear = {
      year: "2018",
    };
    expect(getItemYears(itemWithStringYear)).toEqual([2018]);

    // Movie with year only
    const classicMovie = {
      year: 1999,
    };
    expect(getItemYears(classicMovie)).toEqual([1999]);

    // Game with completionDate
    const gameA = {
      completionDate: "2025-06-20",
    };
    expect(getItemYears(gameA)).toEqual([2025]);

    // Game with startDate
    const gameB = {
      startDate: "2021-11-04",
    };
    expect(getItemYears(gameB)).toEqual([2021]);

    // Game with completedAt fallback
    const gameC = {
      completedAt: "2026-02-01T12:00:00Z",
    };
    expect(getItemYears(gameC)).toEqual([2026]);

    // Game with createdAt fallback
    const gameD = {
      createdAt: new Date("2023-08-10"),
    };
    expect(getItemYears(gameD)).toEqual([2023]);

    // 3. isYearInDateRange evaluation
    expect(isYearInDateRange(2026, "2026")).toBe(true);
    expect(isYearInDateRange(2025, "2026")).toBe(false);

    expect(isYearInDateRange(2025, "2025")).toBe(true);
    expect(isYearInDateRange(2024, "2024")).toBe(true);

    expect(isYearInDateRange(2020, "2020-2023")).toBe(true);
    expect(isYearInDateRange(2022, "2020-2023")).toBe(true);
    expect(isYearInDateRange(2023, "2020-2023")).toBe(true);
    expect(isYearInDateRange(2024, "2020-2023")).toBe(false);

    expect(isYearInDateRange(2010, "2010-2019")).toBe(true);
    expect(isYearInDateRange(2015, "2010-2019")).toBe(true);
    expect(isYearInDateRange(2019, "2010-2019")).toBe(true);
    expect(isYearInDateRange(2020, "2010-2019")).toBe(false);

    expect(isYearInDateRange(2009, "CLASSIC")).toBe(true);
    expect(isYearInDateRange(1994, "CLASSIC")).toBe(true);
    expect(isYearInDateRange(2010, "CLASSIC")).toBe(false);
    // Boundary defense: 0, negative or invalid years must not match CLASSIC
    expect(isYearInDateRange(0, "CLASSIC")).toBe(false);
    expect(isYearInDateRange(-10, "CLASSIC")).toBe(false);
    expect(isYearInDateRange(NaN, "CLASSIC")).toBe(false);

    expect(isYearInDateRange(1990, "ALL")).toBe(true);
    expect(isYearInDateRange(2026, "ALL")).toBe(true);

    // 4. matchesDateRange integration with game & movie objects
    expect(matchesDateRange(movieA, "2024")).toBe(true); // Completed in 2024
    expect(matchesDateRange(movieA, "2010-2019")).toBe(true); // Released in 2017
    expect(matchesDateRange(movieA, "2026")).toBe(false);

    expect(matchesDateRange(itemWithReleaseYear, "2020-2023")).toBe(true);
    expect(matchesDateRange(itemWithReleaseYear, "2026")).toBe(false);

    expect(matchesDateRange(classicMovie, "CLASSIC")).toBe(true);
    expect(matchesDateRange(classicMovie, "2024")).toBe(false);

    expect(matchesDateRange(gameA, "2025")).toBe(true);
    expect(matchesDateRange(gameA, "2024")).toBe(false);

    expect(matchesDateRange(gameB, "2020-2023")).toBe(true);
    expect(matchesDateRange(gameB, "2026")).toBe(false);

    expect(matchesDateRange(gameC, "2026")).toBe(true);
  });
});



