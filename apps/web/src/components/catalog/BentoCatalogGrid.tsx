"use client";

import React, { useState } from "react";
import { Gamepad2, Film, ChevronDown } from "lucide-react";
import { GameCard } from "./GameCard";
import { MovieCard } from "./MovieCard";
import { cn } from "@/lib/utils";
import type { GameItem, MovieItem } from "@/lib/types";
import type { CategoryFilter, StatusFilter } from "./CatalogHeader";

export interface BentoCatalogGridProps {
  category: CategoryFilter;
  status: StatusFilter;
  search: string;
  games: GameItem[];
  movies: MovieItem[];
  isLoading?: boolean;
  onSelectGame: (game: GameItem) => void;
  onSelectMovie: (movie: MovieItem) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 12;

function BentoCatalogSkeleton({ count = 8, category }: { count?: number; category: CategoryFilter }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`skeleton-${idx}`}
          className="relative overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100 shadow-card flex flex-col justify-between"
        >
          <div>
            {/* Shimmer Image Area */}
            <div
              className={cn(
                "relative w-full bg-zinc-200/70 dark:bg-zinc-800/60 overflow-hidden",
                category === "MOVIES" ? "aspect-[2/3]" : "aspect-video"
              )}
            >
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
              {/* Badge placeholder */}
              <div className="absolute top-2.5 right-2.5 w-16 h-5 rounded-full bg-zinc-300/80 dark:bg-zinc-700/60" />
            </div>

            {/* Details placeholder */}
            <div className="p-4 space-y-2.5">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-3/4 relative overflow-hidden">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3.5 w-14 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
                <div className="h-3.5 w-16 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
              </div>
            </div>
          </div>

          {/* Footer placeholder */}
          <div className="p-4 pt-0">
            <div className="pt-3 border-t border-zinc-200/60 dark:border-white/10 flex items-center justify-between">
              <div className="h-3.5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="h-3.5 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BentoCatalogGrid({
  category,
  status,
  search,
  games,
  movies,
  isLoading = false,
  onSelectGame,
  onSelectMovie,
  className,
}: BentoCatalogGridProps) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Resetear paginación al cambiar filtros o búsqueda para proteger presupuesto de DOM (< 800 nodos)
  React.useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [category, status, search]);

  // Filtro de búsqueda enriquecido multi-campo (título, plataforma, géneros, vibe)
  const query = search.trim().toLowerCase();

  const filteredGames = games.filter((g) => {
    if (query) {
      const matchTitle = g.title.toLowerCase().includes(query);
      const matchPlatform = g.platform?.toLowerCase().includes(query);
      const matchGenres = g.genres?.some((genre) => genre.toLowerCase().includes(query));
      const matchVibe = g.aiEnrichment?.vibeTags?.some((v) => v.toLowerCase().includes(query));
      if (!matchTitle && !matchPlatform && !matchGenres && !matchVibe) return false;
    }
    if (status === "PLAYING" && g.status !== "Jugando") return false;
    if (status === "TODO" && g.status !== "Por Jugar") return false;
    if (status === "COMPLETED" && g.status !== "Jugado") return false;
    return true;
  });

  const filteredMovies = movies.filter((m) => {
    if (query) {
      const matchTitle = m.title.toLowerCase().includes(query);
      const matchYear = m.year ? String(m.year).includes(query) : false;
      const matchGenres = m.genres?.some((genre) => genre.toLowerCase().includes(query));
      const matchOverview = m.overview?.toLowerCase().includes(query);
      const matchVibe = m.aiEnrichment?.vibeTags?.some((v) => v.toLowerCase().includes(query));
      if (!matchTitle && !matchYear && !matchGenres && !matchOverview && !matchVibe) return false;
    }
    if (status === "PLAYING" && m.status !== "Viendo") return false;
    if (status === "TODO" && m.status !== "Por Ver") return false;
    if (status === "COMPLETED" && m.status !== "Vista") return false;
    return true;
  });

  // Combinar según categoría
  type CombinedItem =
    | { type: "GAME"; data: GameItem }
    | { type: "MOVIE"; data: MovieItem };

  const combinedItems: CombinedItem[] = [];

  if (category === "ALL") {
    const maxLen = Math.max(filteredGames.length, filteredMovies.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < filteredGames.length) combinedItems.push({ type: "GAME", data: filteredGames[i] });
      if (i < filteredMovies.length) combinedItems.push({ type: "MOVIE", data: filteredMovies[i] });
    }
  } else if (category === "GAMES") {
    filteredGames.forEach((g) => combinedItems.push({ type: "GAME", data: g }));
  } else {
    filteredMovies.forEach((m) => combinedItems.push({ type: "MOVIE", data: m }));
  }

  const visibleItems = combinedItems.slice(0, visibleCount);
  const hasMore = visibleCount < combinedItems.length;

  if (isLoading) {
    return <BentoCatalogSkeleton count={ITEMS_PER_PAGE} category={category} />;
  }

  if (combinedItems.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-100/80 dark:bg-[#111113]/50 text-zinc-600 dark:text-zinc-300">
        <Gamepad2 className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">No se encontraron títulos</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {search ? `Ningún resultado coincide con "${search}".` : "No hay elementos en esta vista."}
        </p>
      </div>
    );
  }

  return (
    <div key={`${category}-${status}`} className={cn("animate-in fade-in duration-300 transition-opacity", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleItems.map((item) => {
          if (item.type === "GAME") {
            return (
              <GameCard
                key={`game-${item.data.id}`}
                game={item.data}
                onClick={() => onSelectGame(item.data)}
              />
            );
          }
          return (
            <MovieCard
              key={`movie-${item.data.id}`}
              movie={item.data}
              aspectRatio={category === "ALL" ? "video" : "poster"}
              onClick={() => onSelectMovie(item.data)}
            />
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
            className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:border-rose-500/40 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-xs hover:shadow-md hover:shadow-rose-500/5"
          >
            <span>Mostrar más títulos ({combinedItems.length - visibleCount} restantes)</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-500 group-hover:translate-y-0.5 transition-all duration-200" />
          </button>
        </div>
      )}
    </div>
  );
}

export default BentoCatalogGrid;
