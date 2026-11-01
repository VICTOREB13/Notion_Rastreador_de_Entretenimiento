"use client";

import React, { useState } from "react";
import {
  Clock,
  Gamepad2,
  Film,
  Trophy,
  BarChart3,
  TrendingUp,
  Sparkles,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { DialogModal } from "@/components/ui/DialogModal";
import { useAnalyticsQuery } from "@/lib/hooks";
import { formatHours, cn } from "@/lib/utils";

export interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDays?: number;
}

export function AnalyticsModal({
  isOpen,
  onClose,
  initialDays = 30,
}: AnalyticsModalProps) {
  const [days, setDays] = useState<number>(initialDays);
  const { data: analytics, isLoading, isError } = useAnalyticsQuery(days);

  const summary = analytics?.summary;
  const topGames = analytics?.topGames || [];
  const genreDistribution = analytics?.genreDistribution || [];

  const maxPlaytime = Math.max(...topGames.map((g) => g.hours), 1);
  const maxGenreCount = Math.max(...genreDistribution.map((g) => g.count), 1);

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={onClose}
      title="Rendimiento & Analíticas"
      subtitle="Estadísticas consolidadas de tiempo de juego, cine y preferencias de catálogo"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Time-Range Switcher */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs font-mono font-medium text-zinc-500 dark:text-zinc-400">
            <TrendingUp className="w-4 h-4 text-rose-500" />
            <span>Ventana de análisis:</span>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 text-xs">
            {[
              { label: "7 días", value: 7 },
              { label: "30 días", value: 30 },
              { label: "90 días", value: 90 },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDays(option.value)}
                className={cn(
                  "px-3 py-1.5 sm:py-1 rounded-lg font-medium transition-all duration-200 cursor-pointer text-xs min-h-[36px] sm:min-h-0 flex items-center justify-center",
                  days === option.value
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50" />
              ))}
            </div>
            <div className="h-48 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50" />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
            No se pudieron cargar las analíticas del servidor. Compruebe la conexión con la API.
          </div>
        )}

        {/* Main Content */}
        {!isLoading && !isError && (
          <>
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Total Horas Jugadas */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-white/10 flex flex-col justify-between shadow-2xs hover:border-amber-500/30 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Horas</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {formatHours(summary?.totalPlaytimeHours)}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Tiempo acumulado en Steam
                  </div>
                </div>
              </div>

              {/* Card 2: Total Juegos */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-white/10 flex flex-col justify-between shadow-2xs hover:border-rose-500/30 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Juegos</span>
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                    <Gamepad2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {summary?.totalGames ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span>{summary?.completedGames ?? 0} completados ({summary?.completionRate ?? 0}%)</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Total Películas */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-white/10 flex flex-col justify-between shadow-2xs hover:border-sky-500/30 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Películas</span>
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                    <Film className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {summary?.totalMovies ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {summary?.watchedMovies ?? 0} visualizadas
                  </div>
                </div>
              </div>
            </div>

            {/* Top 5 Most Played Games with Animated Progress Bars */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-white/10 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Top 5 Juegos Más Jugados
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                  Total acumulado histórico
                </span>
              </div>

              {topGames.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4 text-center">
                  No hay datos suficientes de sesiones registradas.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {topGames.map((game, idx) => {
                    const percentage = Math.round((game.hours / maxPlaytime) * 100);
                    const rank = idx + 1;

                    return (
                      <div key={game.id} className="space-y-1.5 group">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Rank Badge */}
                            <span
                              className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0",
                                rank === 1
                                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  : rank === 2
                                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-white/10"
                                  : rank === 3
                                  ? "bg-amber-700/20 text-amber-700 dark:text-amber-300 border border-amber-700/30"
                                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
                              )}
                            >
                              {rank}
                            </span>

                            {/* Cover preview */}
                            {game.coverUrl ? (
                              <img
                                src={game.coverUrl}
                                alt={game.title}
                                className="w-8 h-8 rounded-md object-cover border border-zinc-200 dark:border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-md bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                <Gamepad2 className="w-4 h-4 text-zinc-400" />
                              </div>
                            )}

                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-rose-500 transition-colors duration-150">
                              {game.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {formatHours(game.hours)}
                            </span>
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                              ({percentage}%)
                            </span>
                          </div>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-900 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700 ease-out",
                              rank === 1
                                ? "bg-linear-to-r from-amber-500 to-rose-500"
                                : rank === 2
                                ? "bg-linear-to-r from-rose-500 to-rose-600"
                                : "bg-zinc-400 dark:bg-zinc-600"
                            )}
                            style={{ width: `${Math.max(percentage, 3)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Genre Breakdown */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-white/10 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Desglose de Géneros Destacados
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                  {genreDistribution.length} categorías
                </span>
              </div>

              {genreDistribution.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 py-3 text-center">
                  Sin géneros catalogados.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {genreDistribution.slice(0, 8).map((item) => {
                    const ratio = Math.round((item.count / maxGenreCount) * 100);

                    return (
                      <div
                        key={item.genre}
                        className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                            {item.genre}
                          </span>
                          <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400 ml-2 shrink-0">
                            {item.count} títulos
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-sky-500 transition-all duration-500"
                            style={{ width: `${Math.max(ratio, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DialogModal>
  );
}

export default AnalyticsModal;
