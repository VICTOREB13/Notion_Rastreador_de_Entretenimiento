"use client";

import React from "react";
import { Search, X, Sparkles, Filter } from "lucide-react";
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-full border border-white/10 self-start">
          <button
            type="button"
            onClick={() => onCategoryChange("ALL")}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer",
              category === "ALL"
                ? "bg-white/10 text-white shadow-xs border border-white/10"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            Colección ({totalGames + totalMovies})
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange("GAMES")}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer",
              category === "GAMES"
                ? "bg-white/10 text-white shadow-xs border border-white/10"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            Juegos ({totalGames})
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange("MOVIES")}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer",
              category === "MOVIES"
                ? "bg-white/10 text-white shadow-xs border border-white/10"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            Películas ({totalMovies})
          </button>
        </div>

        {/* Search Input Bar (Organic, integrated, zero Cmd+K slop) */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por título, género o desarrollador..."
            className="w-full pl-10 pr-9 py-2 rounded-full bg-zinc-900/80 border border-white/10 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Secondary Status Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider mr-1 hidden sm:inline">
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
              "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all cursor-pointer",
              status === item.id
                ? "bg-white/10 text-zinc-100 border-white/20 font-semibold"
                : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-900"
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
