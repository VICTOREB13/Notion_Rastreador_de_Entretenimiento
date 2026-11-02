"use client";

import React from "react";
import { Search, X, ArrowUpDown, Sparkles, Filter } from "lucide-react";
import { SpringSegmentedControl } from "@/components/ui/SpringSegmentedControl";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { cn } from "@/lib/utils";

export type CategoryFilter = "ALL" | "GAMES" | "MOVIES";
export type StatusFilter = "ALL" | "PLAYING" | "TODO" | "COMPLETED";
export type SortOption = "recent" | "playtime" | "rating" | "alphabetical";

export interface CatalogHeaderProps {
  category: CategoryFilter;
  onCategoryChange: (cat: CategoryFilter) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  selectedGenre: string | null;
  onGenreChange: (genre: string | null) => void;
  availableGenres?: string[];
  search: string;
  onSearchChange: (search: string) => void;
  searchInputRef?: React.Ref<HTMLInputElement>;
  totalGames?: number;
  totalMovies?: number;
  className?: string;
}

export function CatalogHeader({
  category,
  onCategoryChange,
  status,
  onStatusChange,
  sortBy,
  onSortByChange,
  selectedGenre,
  onGenreChange,
  availableGenres = [],
  search,
  onSearchChange,
  searchInputRef,
  totalGames = 0,
  totalMovies = 0,
  className,
}: CatalogHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Primary Bar: Category Switcher, Sort Control & Search Input */}
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
          className="self-start shadow-xs shrink-0"
        />

        {/* Right side: Sort Selector & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Sort By Select */}
          <div className="w-full sm:w-56 shrink-0">
            <CustomSelect<SortOption>
              value={sortBy}
              onChange={onSortByChange}
              options={[
                { value: "recent", label: "Jugados recientemente" },
                { value: "playtime", label: "Más jugados" },
                { value: "rating", label: "Mejor calificados" },
                { value: "alphabetical", label: "Alfabético (A-Z)" },
              ]}
              size="sm"
              icon={ArrowUpDown}
              ariaLabel="Ordenar catálogo"
            />
          </div>

          {/* Search Input Bar (Organic, integrated, with subtle shortcut indicators) */}
          <div className="group/search relative w-full sm:w-72 lg:w-80">
            <Search
              className={cn(
                "w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none",
                search ? "text-rose-500" : "text-zinc-400 dark:text-zinc-500 group-focus-within/search:text-rose-500"
              )}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar títulos, géneros o notas..."
              aria-label="Buscar títulos, géneros o notas... (Ctrl+K o /)"
              className="w-full pl-10 pr-16 py-2 rounded-full bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-hidden focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 transition-all duration-200 shadow-inner"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95 hover:rotate-90"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-800/80 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 shadow-2xs">
                  <span>Ctrl+K</span>
                </kbd>
                <kbd className="inline-flex sm:hidden items-center px-1.5 py-0.5 rounded border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-800/80 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 shadow-2xs">
                  /
                </kbd>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Level 2: Contextual Filters (Status & Dynamic Genres) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        {/* Status Filter Pills (Ergonomic py-1.5, flex-wrap responsive without vertical clipping) */}
        <div className="flex items-center gap-1.5 flex-wrap py-1.5 px-0.5 text-xs">
          <span className="text-zinc-400 dark:text-zinc-500 text-[11px] font-mono uppercase tracking-wider mr-1 hidden sm:inline shrink-0">
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
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all duration-200 cursor-pointer active:scale-95 hover:-translate-y-0.5 shrink-0",
                status === item.id
                  ? "bg-zinc-900 text-white dark:bg-white/10 dark:text-zinc-100 border-zinc-900 dark:border-white/20 font-semibold shadow-xs ring-1 ring-zinc-900/10 dark:ring-white/10"
                  : "bg-transparent text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80 hover:border-zinc-300/50 dark:hover:border-white/5"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Dynamic Genre Filter Pill Bar with lateral fade mask and clear button */}
        {availableGenres.length > 0 && (
          <div className="relative flex items-center min-w-0 md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-0.5 text-xs scrollbar-none [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent_100%)] [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent_100%)]">
              <span className="text-zinc-400 dark:text-zinc-500 text-[11px] font-mono uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                <Filter className="w-3 h-3 text-rose-500/70" />
                Género:
              </span>
              <button
                type="button"
                onClick={() => onGenreChange(null)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all duration-200 cursor-pointer active:scale-95 shrink-0",
                  selectedGenre === null
                    ? "bg-zinc-900 text-white dark:bg-white/10 dark:text-zinc-100 border-zinc-900 dark:border-white/20 font-semibold shadow-xs ring-1 ring-zinc-900/10 dark:ring-white/10"
                    : "bg-transparent text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80 hover:border-zinc-300/50 dark:hover:border-white/5"
                )}
              >
                Todos
              </button>
              {availableGenres.map((genre) => {
                const isSelected = selectedGenre?.toLowerCase() === genre.toLowerCase();
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => onGenreChange(isSelected ? null : genre)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all duration-200 cursor-pointer active:scale-95 shrink-0",
                      isSelected
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 font-semibold shadow-xs ring-1 ring-rose-500/20"
                        : "bg-transparent text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80 hover:border-zinc-300/50 dark:hover:border-white/5"
                    )}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>

            {/* Quick Clear Genre Filter Button */}
            {selectedGenre !== null && (
              <button
                type="button"
                onClick={() => onGenreChange(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer active:scale-95 shrink-0 ml-2"
                title="Limpiar filtro de género"
              >
                <X className="w-3 h-3" />
                <span className="hidden sm:inline">Limpiar filtro</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CatalogHeader;
