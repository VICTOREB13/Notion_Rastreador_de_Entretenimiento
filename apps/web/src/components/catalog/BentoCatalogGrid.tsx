"use client";

import React, { useState } from "react";
import { Gamepad2, Film, ChevronDown } from "lucide-react";
import { GameCard } from "./GameCard";
import { MovieCard } from "./MovieCard";
import type { GameItem, MovieItem } from "@/lib/types";
import type { CategoryFilter, StatusFilter } from "./CatalogHeader";

export interface BentoCatalogGridProps {
  category: CategoryFilter;
  status: StatusFilter;
  search: string;
  games: GameItem[];
  movies: MovieItem[];
  onSelectGame: (game: GameItem) => void;
  onSelectMovie: (movie: MovieItem) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 12;

export function BentoCatalogGrid({
  category,
  status,
  search,
  games,
  movies,
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

  if (combinedItems.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl border border-white/5 bg-[#111113]/50">
        <Gamepad2 className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-zinc-300">No se encontraron títulos</h4>
        <p className="text-xs text-zinc-500 mt-1">
          {search ? `Ningún resultado coincide con "${search}".` : "No hay elementos en esta vista."}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
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
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <span>Mostrar más títulos ({combinedItems.length - visibleCount} restantes)</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default BentoCatalogGrid;
