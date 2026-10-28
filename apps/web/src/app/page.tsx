"use client";

import React, { useState } from "react";
import { Gamepad2, Clock, CheckCircle2, Film } from "lucide-react";
import { BrandHeader } from "@/components/brand/BrandHeader";
import { ConsolidatedMetricBand } from "@/components/brand/ConsolidatedMetricBand";
import { DarkIslandSplineCard } from "@/components/brand/DarkIslandSplineCard";
import { SegmentedProgressCard } from "@/components/brand/SegmentedProgressCard";
import { FloatingIslandNavDock } from "@/components/brand/FloatingIslandNavDock";
import { LiveGamingBadge } from "@/components/live/LiveGamingBadge";
import { CatalogHeader, type CategoryFilter, type StatusFilter } from "@/components/catalog/CatalogHeader";
import { BentoCatalogGrid } from "@/components/catalog/BentoCatalogGrid";
import { AiRecommendationHero } from "@/components/catalog/AiRecommendationHero";
import { ItemDetailModal } from "@/components/detail/ItemDetailModal";
import { TelemetryModal } from "@/components/settings/TelemetryModal";
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
  const [search, setSearch] = useState("");

  const [selectedItem, setSelectedItem] = useState<{
    item: GameItem | MovieItem;
    type: "GAME" | "MOVIE";
  } | null>(null);

  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);

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
  const { data: gamesData } = useGamesQuery({ status: gameStatus });
  const { data: moviesData } = useMoviesQuery({ status: movieStatus });

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

  // Juego recomendado destacado para el hero
  const featuredGame =
    games.find((g) => g.status === "Jugando") ||
    games.find((g) => g.aiEnrichment) ||
    games[0] ||
    null;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 pb-28 pt-6 sm:pt-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto transition-colors duration-200">
      {/* Brand Header with Authentic Vectors, Crimson Border & Version Badge */}
      <BrandHeader
        version="v2.0.0"
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
      {featuredGame && (
        <section className="mt-8">
          <AiRecommendationHero
            game={featuredGame}
            onSelectGame={(g) => setSelectedItem({ item: g, type: "GAME" })}
          />
        </section>
      )}

      {/* Catalog Bento Grid with SpringSegmentedControl */}
      <section id="catalogo" className="mt-12 space-y-6">
        <CatalogHeader
          category={category}
          onCategoryChange={setCategory}
          status={status}
          onStatusChange={setStatus}
          search={search}
          onSearchChange={setSearch}
          totalGames={summary?.totalGames ?? games.length}
          totalMovies={summary?.totalMovies ?? movies.length}
        />

        <BentoCatalogGrid
          category={category}
          status={status}
          search={search}
          games={games}
          movies={movies}
          onSelectGame={(g) => setSelectedItem({ item: g, type: "GAME" })}
          onSelectMovie={(m) => setSelectedItem({ item: m, type: "MOVIE" })}
        />
      </section>

      {/* Floating Island Navigation Dock */}
      <FloatingIslandNavDock
        activeId={category === "ALL" ? "coleccion" : category === "GAMES" ? "juegos" : "peliculas"}
        onItemClick={(id) => {
          if (id === "coleccion") {
            setCategory("ALL");
            document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
          } else if (id === "juegos") {
            setCategory("GAMES");
            document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
          } else if (id === "peliculas") {
            setCategory("MOVIES");
            document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
          } else if (id === "ritmo") {
            document.getElementById("ritmo")?.scrollIntoView({ behavior: "smooth" });
          }
        }}
        onOpenSettings={() => setIsTelemetryOpen(true)}
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
    </main>
  );
}
