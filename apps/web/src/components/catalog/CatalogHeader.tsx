"use client";

import React, { useMemo } from "react";
import { Search, X, ArrowUpDown, Filter, Calendar, RotateCcw } from "lucide-react";
import { SpringSegmentedControl } from "@/components/ui/SpringSegmentedControl";
import { CustomSelect, type SelectOption } from "@/components/ui/CustomSelect";
import { cn } from "@/lib/utils";

export type CategoryFilter = "ALL" | "GAMES" | "MOVIES";
export type StatusFilter = "ALL" | "PLAYING" | "TODO" | "COMPLETED";
export type SortOption = "recent" | "playtime" | "rating" | "alphabetical";
export type DateRangeFilter =
  | "ALL"
  | "2026"
  | "2025"
  | "2024"
  | "2020-2023"
  | "2010-2019"
  | "CLASSIC";

export type GenreEntry = string | { name: string; count?: number };

export const DATE_RANGE_OPTIONS: SelectOption<DateRangeFilter>[] = [
  { value: "ALL", label: "Cualquier año" },
  { value: "2026", label: "2026", description: "Lanzamientos o actividad 2026" },
  { value: "2025", label: "2025", description: "Lanzamientos o actividad 2025" },
  { value: "2024", label: "2024", description: "Lanzamientos o actividad 2024" },
  { value: "2020-2023", label: "2020 - 2023", description: "Años 2020 a 2023" },
  { value: "2010-2019", label: "2010 - 2019", description: "Década 2010-2019" },
  { value: "CLASSIC", label: "Clásicos (<2010)", description: "Títulos previos a 2010" },
];

export function getItemYears(item: {
  year?: number | string | null;
  releaseYear?: number | string | null;
  completionDate?: string | null;
  completedAt?: string | null;
  lastPlayedAt?: string | null;
  startDate?: string | null;
  createdAt?: string | Date | null;
}): number[] {
  const years = new Set<number>();

  const extractYear = (val: number | string | Date | null | undefined): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === "number" && !isNaN(val)) {
      if (val > 1800 && val < 2100) return Math.floor(val);
      return null;
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      if (y > 1800 && y < 2100) return y;
      return null;
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      const match = trimmed.match(/^(\d{4})/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > 1800 && num < 2100) return num;
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        if (y > 1800 && y < 2100) return y;
      }
    }
    return null;
  };

  // 1. Release year (movie.year or item.releaseYear)
  const relYear = extractYear(item.year) ?? extractYear(item.releaseYear);
  if (relYear) years.add(relYear);

  // 2. Completion date
  const compYear = extractYear(item.completionDate) || extractYear(item.completedAt);
  if (compYear) years.add(compYear);

  // 3. Start date or last played
  const startYear = extractYear(item.startDate);
  if (startYear) years.add(startYear);

  const playedYear = extractYear(item.lastPlayedAt);
  if (playedYear) years.add(playedYear);

  // 4. Fallback to createdAt if no other year is known
  if (years.size === 0) {
    const createdYear = extractYear(item.createdAt);
    if (createdYear) years.add(createdYear);
  }

  return Array.from(years);
}

export function isYearInDateRange(year: number, range: DateRangeFilter): boolean {
  if (typeof year !== "number" || isNaN(year) || year < 1800) return false;
  switch (range) {
    case "ALL":
      return true;
    case "2026":
      return year === 2026;
    case "2025":
      return year === 2025;
    case "2024":
      return year === 2024;
    case "2020-2023":
      return year >= 2020 && year <= 2023;
    case "2010-2019":
      return year >= 2010 && year <= 2019;
    case "CLASSIC":
      return year < 2010;
    default:
      return true;
  }
}

export function matchesDateRange(
  item: {
    year?: number | string | null;
    releaseYear?: number | string | null;
    completionDate?: string | null;
    completedAt?: string | null;
    lastPlayedAt?: string | null;
    startDate?: string | null;
    createdAt?: string | Date | null;
  },
  range?: DateRangeFilter | null
): boolean {
  if (!range || range === "ALL") return true;
  const years = getItemYears(item);
  if (years.length === 0) return false;
  return years.some((y) => isYearInDateRange(y, range));
}

export interface CatalogHeaderProps {
  category: CategoryFilter;
  onCategoryChange: (cat: CategoryFilter) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  selectedGenre: string | null;
  onGenreChange: (genre: string | null) => void;
  availableGenres?: GenreEntry[];
  dateRange?: DateRangeFilter;
  onDateRangeChange?: (range: DateRangeFilter) => void;
  onResetFilters?: () => void;
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
  dateRange = "ALL",
  onDateRangeChange,
  onResetFilters,
  search,
  onSearchChange,
  searchInputRef,
  totalGames = 0,
  totalMovies = 0,
  className,
}: CatalogHeaderProps) {
  // Normalizar los géneros disponibles a formato { name, count }
  const normalizedGenres = useMemo(() => {
    return availableGenres.map((g) => {
      if (typeof g === "string") {
        return { name: g, count: undefined };
      }
      return g;
    });
  }, [availableGenres]);

  // Generar opciones para el selector desplegable de géneros
  const genreOptions = useMemo<SelectOption<string>[]>(() => {
    const totalCount =
      category === "GAMES"
        ? totalGames
        : category === "MOVIES"
        ? totalMovies
        : totalGames + totalMovies;

    const allOption: SelectOption<string> = {
      value: "ALL",
      label: "Todos los géneros",
      badge: totalCount > 0 ? String(totalCount) : undefined,
    };

    const genreSelectOptions: SelectOption<string>[] = normalizedGenres.map((g) => ({
      value: g.name,
      label: g.name,
      badge: g.count !== undefined ? String(g.count) : undefined,
    }));

    return [allOption, ...genreSelectOptions];
  }, [category, totalGames, totalMovies, normalizedGenres]);

  // Contabilizar filtros activos para el botón de limpieza
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (status !== "ALL") count++;
    if (selectedGenre !== null && selectedGenre !== "ALL") count++;
    if (dateRange && dateRange !== "ALL") count++;
    if (search.trim().length > 0) count++;
    return count;
  }, [status, selectedGenre, dateRange, search]);

  const handleResetFilters = () => {
    if (onResetFilters) {
      onResetFilters();
    } else {
      onStatusChange("ALL");
      onGenreChange(null);
      if (onDateRangeChange) onDateRangeChange("ALL");
      onSearchChange("");
    }
  };

  return (
    <div className={cn("relative z-20 space-y-3.5", className)}>
      {/* Fila Principal: Selector de Categorías (Izquierda) + Ordenamiento y Buscador (Derecha) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
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

        {/* Lado derecho: Selector de Ordenamiento + Buscador Global */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Sort By Select */}
          <div className="w-full sm:w-52 lg:w-56 shrink-0">
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

          {/* Search Input Bar (Orgánico, con shortcut Ctrl+K / indicador) */}
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

      {/* Fila Secundaria: Barra de Filtros Avanzados (Estado Cohesivo + Géneros Desplegables + Rango Fechas + Reset) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-zinc-200/60 dark:border-white/5">
        {/* Filtro de Estado: Bloque cohesivo que nunca se desarticula */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-zinc-400 dark:text-zinc-500 text-[11px] font-mono uppercase tracking-wider hidden sm:inline shrink-0">
            Estado:
          </span>
          <SpringSegmentedControl
            options={[
              { id: "ALL", label: "Todos" },
              { id: "PLAYING", label: "En Curso" },
              { id: "TODO", label: "Pendientes" },
              { id: "COMPLETED", label: "Completados" },
            ]}
            value={status}
            onChange={(val) => onStatusChange(val as StatusFilter)}
            size="sm"
            ariaLabel="Filtro por estado de progreso"
            className="shrink-0 shadow-xs"
          />
        </div>

        {/* Controles de Filtro Avanzado: Selector de Géneros, Selector de Rango de Fechas y Limpiar Filtros */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Selector Ergonómico de Géneros (Dropdown con búsqueda integrada, badges y ancho holgado) */}
          <div className="w-full sm:w-48 lg:w-52 shrink-0">
            <CustomSelect<string>
              value={selectedGenre || "ALL"}
              onChange={(val) => onGenreChange(val === "ALL" ? null : val)}
              options={genreOptions}
              size="sm"
              icon={Filter}
              placeholder="Todos los géneros"
              ariaLabel="Filtrar por género"
              searchable
              searchPlaceholder="Buscar género..."
              active={Boolean(selectedGenre && selectedGenre !== "ALL")}
              menuClassName="min-w-[15rem] sm:min-w-[16rem]"
              disabled={genreOptions.length <= 1 && totalGames + totalMovies === 0}
            />
          </div>

          {/* Selector de Rango de Fechas / Año */}
          {onDateRangeChange && (
            <div className="w-full sm:w-44 lg:w-48 shrink-0">
              <CustomSelect<DateRangeFilter>
                value={dateRange}
                onChange={(val) => onDateRangeChange(val as DateRangeFilter)}
                options={DATE_RANGE_OPTIONS}
                size="sm"
                icon={Calendar}
                placeholder="Cualquier año"
                ariaLabel="Filtrar por rango de fechas o año"
                active={Boolean(dateRange && dateRange !== "ALL")}
              />
            </div>
          )}

          {/* Botón Discreto de Limpiar Filtros con Badge Numérico Activo */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              aria-label="Limpiar todos los filtros aplicados"
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 transition-all duration-150 cursor-pointer active:scale-95 shadow-2xs shrink-0 animate-in fade-in duration-200"
              title="Restablecer filtros activos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300">
                {activeFiltersCount}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CatalogHeader;
