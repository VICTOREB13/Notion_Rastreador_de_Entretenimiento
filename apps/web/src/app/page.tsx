"use client";

import React, { useState } from "react";
import { Settings2, Gamepad2, Clock, CheckCircle2, Film } from "lucide-react";
import { ShinyText } from "@/components/brand/ShinyText";
import { ConsolidatedMetricBand } from "@/components/brand/ConsolidatedMetricBand";
import { DarkIslandSplineCard } from "@/components/brand/DarkIslandSplineCard";
import { SegmentedProgressCard } from "@/components/brand/SegmentedProgressCard";
import { FloatingIslandNavDock } from "@/components/brand/FloatingIslandNavDock";
import { LiveGamingBadge } from "@/components/live/LiveGamingBadge";
import { CatalogHeader, type CategoryFilter, type StatusFilter } from "@/components/catalog/CatalogHeader";
import { BentoCatalogGrid } from "@/components/catalog/BentoCatalogGrid";
import { AiRecommendationHero } from "@/components/catalog/AiRecommendationHero";
import { ItemDetailModal } from "@/components/detail/ItemDetailModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import {
  useLiveStatusQuery,
  useAnalyticsQuery,
  useGamesQuery,
  useMoviesQuery,
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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const daysNumber = timeRange === "7D" ? 7 : timeRange === "30D" ? 30 : 90;

  const { data: liveStatusData, isLoading: isLiveLoading } = useLiveStatusQuery();
  const { data: analytics } = useAnalyticsQuery(daysNumber);
  const { data: gamesData } = useGamesQuery();
  const { data: moviesData } = useMoviesQuery();

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
    <main className="min-h-screen bg-[#09090B] text-zinc-100 pb-28 pt-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Top Bar Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
              Victor Engineer
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-[11px] font-mono text-rose-400 font-semibold">
              Obsidian Zinc & Crimson
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-white flex items-center gap-2">
            Rastreador de Entretenimiento
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Centro de mando personal para curaduría de videojuegos, cine y series de tiempo con IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <LiveGamingBadge status={liveStatus} isLoading={isLiveLoading} />
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Configuración de Modelos IA"
            className="p-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* High-Level Consolidated Metrics */}
      <section id="metricas" className="mt-8">
        <ConsolidatedMetricBand
          columns={[
            {
              id: "games",
              icon: <Gamepad2 className="w-4 h-4 text-rose-400" />,
              label: "Catálogo de Juegos",
              value: summary?.totalGames ?? games.length,
              caption: `${summary?.completedGames ?? 0} completados`,
            },
            {
              id: "hours",
              icon: <Clock className="w-4 h-4 text-amber-400" />,
              label: "Horas de Vida (Steam)",
              value: `${summary?.totalPlaytimeHours ?? 0} hrs`,
              caption: "Tiempo acumulado",
            },
            {
              id: "completion",
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
              label: "Tasa de Finalización",
              value: `${summary?.completionRate ?? 0}%`,
              caption: "Ratio de catálogo",
            },
            {
              id: "movies",
              icon: <Film className="w-4 h-4 text-sky-400" />,
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

      {/* Catalog Bento Grid */}
      <section id="catalogo" className="mt-12 space-y-6">
        <CatalogHeader
          category={category}
          onCategoryChange={setCategory}
          status={status}
          onStatusChange={setStatus}
          search={search}
          onSearchChange={setSearch}
          totalGames={games.length}
          totalMovies={movies.length}
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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Detail Modal / Drawer */}
      <ItemDetailModal
        item={selectedItem?.item ?? null}
        type={selectedItem?.type ?? null}
        onClose={() => setSelectedItem(null)}
      />

      {/* AI Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </main>
  );
}
