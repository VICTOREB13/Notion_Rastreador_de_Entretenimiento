"use client";

import React, { useState } from "react";
import { Gamepad2, Clock, CheckCircle2, Film } from "lucide-react";
import { BrandHeader } from "@/components/brand/BrandHeader";
import { ConsolidatedMetricBand } from "@/components/brand/ConsolidatedMetricBand";
import { DarkIslandSplineCard } from "@/components/brand/DarkIslandSplineCard";
import { SegmentedProgressCard } from "@/components/brand/SegmentedProgressCard";
import { FloatingIslandNavDock } from "@/components/brand/FloatingIslandNavDock";
import { LiveGamingBadge } from "@/components/live/LiveGamingBadge";
import { CatalogHeader, type CategoryFilter, type StatusFilter, type SortOption } from "@/components/catalog/CatalogHeader";
import { BentoCatalogGrid } from "@/components/catalog/BentoCatalogGrid";
import { AiRecommendationHero } from "@/components/catalog/AiRecommendationHero";
import { ItemDetailModal } from "@/components/detail/ItemDetailModal";
import { TelemetryModal } from "@/components/settings/TelemetryModal";
import { AnalyticsModal } from "@/components/analytics/AnalyticsModal";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useTheme } from "@/lib/theme";
import {
  useLiveStatusQuery,
  useAnalyticsQuery,
  useGamesQuery,
  useMoviesQuery,
  useServerEvents,
} from "@/lib/hooks";
import type { GameItem, MovieItem, LiveSteamStatus } from "@/lib/types";

export default function EntertainmentShowcasePage() {
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D">("30D");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selectedItem, setSelectedItem] = useState<{
    item: GameItem | MovieItem;
    type: "GAME" | "MOVIE";
  } | null>(null);

  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const { toggleTheme } = useTheme();

  // Atajos de teclado globales (TASK-333)
  useKeyboardShortcuts({
    onSearchFocus: () => {
      const input = searchInputRef.current;
      if (input) {
        input.focus({ preventScroll: true });
        input.select();
        const catalogEl = document.getElementById("catalogo");
        if (catalogEl) {
          const lenis = (window as unknown as { __lenis?: { scrollTo: (target: HTMLElement) => void } }).__lenis;
          if (lenis) {
            lenis.scrollTo(catalogEl);
          } else {
            catalogEl.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
    },
    onEscape: () => {
      if (selectedItem) setSelectedItem(null);
      if (isTelemetryOpen) setIsTelemetryOpen(false);
      if (isAnalyticsOpen) setIsAnalyticsOpen(false);
    },
    onToggleTheme: () => {
      toggleTheme();
    },
  });

  // Hook reactivo SSE que escucha /api/events y actualiza la caché automáticamente
  const { isConnected: isSSEActive } = useServerEvents();

  const daysNumber = timeRange === "7D" ? 7 : timeRange === "30D" ? 30 : 90;

  const gameStatus =
    status === "PLAYING"
      ? "Jugando"
      : status === "TODO"
      ? "Por Jugar"
      : status === "COMPLETED"
      ? "Jugado"
      : undefined;

  const movieStatus =
    status === "PLAYING"
      ? "Viendo"
      : status === "TODO"
      ? "Por Ver"
      : status === "COMPLETED"
      ? "Vista"
      : undefined;

  const { data: liveStatusData, isLoading: isLiveLoading } = useLiveStatusQuery();
  const { data: analytics } = useAnalyticsQuery(daysNumber);
  const { data: gamesData, isLoading: isGamesLoading } = useGamesQuery({ status: gameStatus, limit: 200 });
  const { data: moviesData, isLoading: isMoviesLoading } = useMoviesQuery({ status: movieStatus, limit: 200 });

  const games: GameItem[] = (gamesData?.data as unknown as GameItem[]) || [];
  const movies: MovieItem[] = (moviesData?.data as unknown as MovieItem[]) || [];
  const liveStatus: LiveSteamStatus | undefined = liveStatusData as unknown as LiveSteamStatus | undefined;

  const summary = analytics?.summary;
  const timeSeries = (analytics?.timeSeries || []).map(
    (pt: { date: string; hours: number }) => ({
      label: pt.date.slice(5),
      value: pt.hours,
    })
  );

  // Extraer dinámicamente los géneros existentes en la biblioteca
  const availableGenres = React.useMemo(() => {
    const genreMap = new Map<string, number>();
    const sourceItems =
      category === "GAMES"
        ? games
        : category === "MOVIES"
        ? movies
        : [...games, ...movies];

    sourceItems.forEach((item) => {
      (item.genres || []).forEach((g) => {
        const clean = g.trim();
        if (clean) {
          genreMap.set(clean, (genreMap.get(clean) || 0) + 1);
        }
      });
    });

    return Array.from(genreMap.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .map(([genre]) => genre);
  }, [category, games, movies]);

  // Item recomendado contextual para el Hero según categoría activa
  const featuredItem = React.useMemo<{
    item: GameItem | MovieItem;
    type: "GAME" | "MOVIE";
  } | null>(() => {
    if (category === "MOVIES") {
      const movie =
        movies.find((m) => m.status === "Viendo") ||
        movies.find((m) => m.aiEnrichment) ||
        movies.find((m) => (m.rating || 0) >= 4) ||
        movies[0] ||
        null;
      return movie ? { item: movie, type: "MOVIE" } : null;
    }

    if (category === "GAMES") {
      const game =
        games.find((g) => g.status === "Jugando") ||
        games.find((g) => g.aiEnrichment) ||
        games.find((g) => (g.rating || 0) >= 4) ||
        games[0] ||
        null;
      return game ? { item: game, type: "GAME" } : null;
    }

    // category === "ALL": Priorizar lo que esté en curso ("Jugando" o "Viendo")
    const playingGame = games.find((g) => g.status === "Jugando");
    if (playingGame) return { item: playingGame, type: "GAME" };

    const watchingMovie = movies.find((m) => m.status === "Viendo");
    if (watchingMovie) return { item: watchingMovie, type: "MOVIE" };

    // Si nada está en progreso, priorizar el que tenga enriquecimiento IA
    const enrichedGame = games.find((g) => g.aiEnrichment);
    if (enrichedGame) return { item: enrichedGame, type: "GAME" };

    const enrichedMovie = movies.find((m) => m.aiEnrichment);
    if (enrichedMovie) return { item: enrichedMovie, type: "MOVIE" };

    // Fallback al mejor valorado o primer título disponible
    const topRatedGame = [...games].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    const topRatedMovie = [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    if (topRatedGame && (topRatedGame.rating || 0) >= (topRatedMovie?.rating || 0)) {
      return { item: topRatedGame, type: "GAME" };
    }
    if (topRatedMovie) return { item: topRatedMovie, type: "MOVIE" };

    if (games[0]) return { item: games[0], type: "GAME" };
    if (movies[0]) return { item: movies[0], type: "MOVIE" };
    return null;
  }, [category, games, movies]);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 pb-32 sm:pb-36 pt-6 sm:pt-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto transition-colors duration-200">
      {/* Brand Header with Authentic Vectors, Crimson Border & Version Badge */}
      <BrandHeader
        version="v2.4.0"
        onOpenTelemetry={() => setIsTelemetryOpen(true)}
        actions={
          <div className="flex items-center gap-2">
            <LiveGamingBadge status={liveStatus} isLoading={isLiveLoading} />
            {isSSEActive && (
              <span
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                title="Canal SSE /api/events activo y escuchando cambios"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            )}
          </div>
        }
      />

      {/* High-Level Consolidated Metrics with Animated CountUp */}
      <section id="metricas" className="mt-8">
        <ConsolidatedMetricBand
          columns={[
            {
              id: "games",
              icon: <Gamepad2 className="w-4 h-4 text-rose-500" />,
              label: "Catálogo de Juegos",
              value: summary?.totalGames ?? games.length,
              caption: `${summary?.completedGames ?? 0} completados`,
            },
            {
              id: "hours",
              icon: <Clock className="w-4 h-4 text-amber-500" />,
              label: "Horas de Vida (Steam)",
              value: `${summary?.totalPlaytimeHours ?? 0} hrs`,
              caption: "Tiempo acumulado",
            },
            {
              id: "completion",
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
              label: "Tasa de Finalización",
              value: `${summary?.completionRate ?? 0}%`,
              caption: "Ratio de catálogo",
            },
            {
              id: "movies",
              icon: <Film className="w-4 h-4 text-sky-500" />,
              label: "Cine & Películas",
              value: summary?.totalMovies ?? movies.length,
              caption: `${summary?.watchedMovies ?? 0} vistas`,
            },
          ]}
        />
      </section>

      {/* Analytical Section: Time-Series Spline & Backlog Progress */}
      <section id="ritmo" className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DarkIslandSplineCard
            title="Ritmo de Juego & Series de Tiempo"
            totalHours={timeSeries.reduce(
              (acc: number, p: { value: number }) => acc + p.value,
              0
            )}
            streakDays={summary?.currentStreakDays ?? 0}
            dataPoints={timeSeries.length > 0 ? timeSeries : undefined}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </div>
        <div>
          <SegmentedProgressCard
            title="Ratio de Finalización"
            subtitle="Backlog de Videojuegos"
            currentPercentage={summary?.completionRate ?? 0}
            targetPercentage={50}
            count={summary?.completedGames ?? 0}
            total={summary?.totalGames ?? games.length}
          />
        </div>
      </section>

      {/* Featured AI Recommendation Hero */}
      {featuredItem && (
        <section className="mt-8">
          <AiRecommendationHero
            item={featuredItem.item}
            itemType={featuredItem.type}
            onSelectItem={(it, tp) => setSelectedItem({ item: it, type: tp })}
          />
        </section>
      )}

      {/* Catalog Bento Grid with SpringSegmentedControl */}
      <section id="catalogo" className="mt-12 space-y-6">
        <CatalogHeader
          category={category}
          onCategoryChange={(cat) => {
            setCategory(cat);
            setSelectedGenre(null);
          }}
          status={status}
          onStatusChange={setStatus}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          selectedGenre={selectedGenre}
          onGenreChange={setSelectedGenre}
          availableGenres={availableGenres}
          search={search}
          onSearchChange={setSearch}
          searchInputRef={searchInputRef}
          totalGames={summary?.totalGames ?? games.length}
          totalMovies={summary?.totalMovies ?? movies.length}
        />

        <BentoCatalogGrid
          category={category}
          status={status}
          search={search}
          sortBy={sortBy}
          selectedGenre={selectedGenre}
          games={games}
          movies={movies}
          isLoading={
            category === "GAMES"
              ? isGamesLoading
              : category === "MOVIES"
              ? isMoviesLoading
              : isGamesLoading || isMoviesLoading
          }
          onClearSearch={() => setSearch("")}
          onClearGenre={() => setSelectedGenre(null)}
          onSelectGame={(g) => setSelectedItem({ item: g, type: "GAME" })}
          onSelectMovie={(m) => setSelectedItem({ item: m, type: "MOVIE" })}
        />
      </section>

      {/* Floating Island Navigation Dock */}
      <FloatingIslandNavDock
        activeId={category === "ALL" ? "coleccion" : category === "GAMES" ? "juegos" : "peliculas"}
        onItemClick={(id) => {
          const scrollToTarget = (targetId: string) => {
            const targetEl = document.getElementById(targetId);
            if (!targetEl) return;
            const lenis = (window as unknown as { __lenis?: { scrollTo: (target: HTMLElement) => void } }).__lenis;
            if (lenis) {
              lenis.scrollTo(targetEl);
            } else {
              targetEl.scrollIntoView({ behavior: "smooth" });
            }
          };

          if (id === "coleccion") {
            setCategory("ALL");
            scrollToTarget("catalogo");
          } else if (id === "juegos") {
            setCategory("GAMES");
            scrollToTarget("catalogo");
          } else if (id === "peliculas") {
            setCategory("MOVIES");
            scrollToTarget("catalogo");
          } else if (id === "ritmo") {
            scrollToTarget("ritmo");
          }
        }}
        onOpenSettings={() => setIsTelemetryOpen(true)}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
      />

      {/* Detail Modal / Drawer */}
      <ItemDetailModal
        item={selectedItem?.item ?? null}
        type={selectedItem?.type ?? null}
        onClose={() => setSelectedItem(null)}
      />

      {/* System Telemetry & Dynamic AI Modal */}
      <TelemetryModal
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
      />

      {/* Analytics Modal & Drawer */}
      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />
    </main>
  );
}
