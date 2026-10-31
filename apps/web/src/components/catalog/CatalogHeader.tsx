"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { SpringSegmentedControl } from "@/components/ui/SpringSegmentedControl";
import { cn } from "@/lib/utils";

export type CategoryFilter = "ALL" | "GAMES" | "MOVIES";
export type StatusFilter = "ALL" | "PLAYING" | "TODO" | "COMPLETED";

export interface CatalogHeaderProps {
  category: CategoryFilter;
  onCategoryChange: (cat: CategoryFilter) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  totalGames?: number;
  totalMovies?: number;
  className?: string;
}

export function CatalogHeader({
  category,
  onCategoryChange,
  status,
  onStatusChange,
  search,
  onSearchChange,
  totalGames = 0,
  totalMovies = 0,
  className,
}: CatalogHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Category SpringSegmentedControl */}
        <SpringSegmentedControl
          options={[
            { id: "ALL", label: `Colección (${totalGames + totalMovies})` },
            { id: "GAMES", label: `🎮 Videojuegos (${totalGames})` },
            { id: "MOVIES", label: `🎬 Películas & Series (${totalMovies})` },
          ]}
          value={category}
          onChange={(val) => onCategoryChange(val as CategoryFilter)}
          size="md"
          ariaLabel="Filtro de categorías de entretenimiento"
          className="self-start shadow-xs"
        />

        {/* Search Input Bar (Organic, integrated, zero Cmd+K slop) */}
        <div className="group/search relative w-full lg:w-80">
          <Search
            className={cn(
              "w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none",
              search ? "text-rose-500" : "text-zinc-400 dark:text-zinc-500 group-focus-within/search:text-rose-500"
            )}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por título, género o notas..."
            className="w-full pl-10 pr-9 py-2 rounded-full bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-hidden focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 transition-all duration-200 shadow-inner"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95 hover:rotate-90"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Secondary Status Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-zinc-400 dark:text-zinc-500 text-[11px] font-mono uppercase tracking-wider mr-1 hidden sm:inline">
          Estado:
        </span>
        {[
          { id: "ALL" as const, label: "Todos" },
          { id: "PLAYING" as const, label: "En Curso / Jugando" },
          { id: "TODO" as const, label: "Pendientes / Por Disfrutar" },
          { id: "COMPLETED" as const, label: "Completados / Vistos" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onStatusChange(item.id)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all duration-200 cursor-pointer active:scale-95 hover:-translate-y-0.5",
              status === item.id
                ? "bg-zinc-900 text-white dark:bg-white/10 dark:text-zinc-100 border-zinc-900 dark:border-white/20 font-semibold shadow-xs ring-1 ring-zinc-900/10 dark:ring-white/10"
                : "bg-transparent text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80 hover:border-zinc-300/50 dark:hover:border-white/5"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CatalogHeader;
