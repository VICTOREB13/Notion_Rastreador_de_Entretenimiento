"use client";

import React from "react";
import { Sparkles, ArrowRight, Compass, Film } from "lucide-react";
import { SpotlightCard } from "../brand/SpotlightCard";
import { ShinyText } from "../brand/ShinyText";
import { cn } from "@/lib/utils";
import type { GameItem, MovieItem } from "@/lib/types";

export interface AiRecommendationHeroProps {
  game?: GameItem | null;
  movie?: MovieItem | null;
  item?: GameItem | MovieItem | null;
  itemType?: "GAME" | "MOVIE";
  onSelectGame?: (game: GameItem) => void;
  onSelectItem?: (item: GameItem | MovieItem, type: "GAME" | "MOVIE") => void;
  className?: string;
}

export function AiRecommendationHero({
  game,
  movie,
  item,
  itemType,
  onSelectGame,
  onSelectItem,
  className,
}: AiRecommendationHeroProps) {
  // Resolver el item activo y su tipo ("GAME" o "MOVIE")
  const activeItem = item || game || movie || null;
  if (!activeItem) return null;

  const isMovie = itemType === "MOVIE" || Boolean(movie && !game && !item);
  const type: "GAME" | "MOVIE" = isMovie ? "MOVIE" : "GAME";

  const aiData = activeItem.aiEnrichment;
  const gameItem = !isMovie ? (activeItem as GameItem) : null;
  const movieItem = isMovie ? (activeItem as MovieItem) : null;

  const pitch =
    aiData?.personalizedPitch ||
    (isMovie
      ? movieItem?.overview || movieItem?.summary || "Película destacada según las preferencias cinematográficas de tu biblioteca."
      : "Título pendiente de explorar según el estado y catálogo de tu biblioteca.");

  const vibeTags = (aiData?.vibeTags || []).slice(0, 3);
  const coverImage = isMovie ? movieItem?.posterUrl : gameItem?.coverUrl;

  const handleSelect = () => {
    if (onSelectItem) {
      onSelectItem(activeItem, type);
    } else if (onSelectGame && !isMovie && gameItem) {
      onSelectGame(gameItem);
    }
  };

  return (
    <SpotlightCard
      role="button"
      tabIndex={0}
      aria-label={`Ver detalles de ${activeItem.title}`}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      className={cn(
        "relative overflow-hidden p-6 sm:p-8 border border-zinc-200 dark:border-white/10 bg-linear-to-br from-rose-50/70 via-white to-zinc-50 dark:from-zinc-900 dark:via-[#111113] dark:to-zinc-950 cursor-pointer group/hero transition-all duration-200 hover:border-zinc-300 dark:hover:border-white/20",
        isMovie && "from-sky-50/70 via-white to-zinc-50 dark:from-sky-950/40 dark:via-[#111113] dark:to-zinc-950 hover:border-sky-500/30",
        className
      )}
    >
      {/* Background Cover/Poster Overlay */}
      {coverImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10 dark:opacity-15 blur-sm pointer-events-none transform scale-105"
          style={{ backgroundImage: `url(${coverImage})` }}
        />
      )}

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          {/* Badge Contextual */}
          {isMovie ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/25 dark:border-sky-500/30 text-sky-600 dark:text-sky-300 text-xs font-semibold mb-3">
              <Film className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span>Selección Cinematográfica IA: ¿Por qué verla hoy?</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>Recomendación Contextual IA: ¿Por qué jugarlo hoy?</span>
            </div>
          )}

          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center flex-wrap gap-2">
            <ShinyText speed={5}>{activeItem.title}</ShinyText>
            {isMovie && movieItem?.year && (
              <span className="text-lg font-normal text-zinc-500 dark:text-zinc-400 font-mono">
                ({movieItem.year})
              </span>
            )}
          </h2>

          <p className="mt-3 text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
            "{pitch}"
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-mono">
            {vibeTags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border transition-colors duration-150 select-none",
                  isMovie
                    ? "border-zinc-200 dark:border-white/10 hover:border-sky-500/30 text-sky-600 dark:text-sky-300"
                    : "border-zinc-200 dark:border-white/10 hover:border-rose-500/30 text-rose-600 dark:text-rose-300"
                )}
              >
                Vibe: {tag}
              </span>
            ))}

            {!isMovie && aiData?.completionEstimateWeeks && (
              <span className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 text-zinc-700 dark:text-zinc-300 flex items-center gap-1 transition-colors duration-150 select-none">
                <Compass className="w-3 h-3 text-zinc-400" />
                Tiempo Estimado: ~{aiData.completionEstimateWeeks} semanas
              </span>
            )}

            {!isMovie && gameItem?.platform && (
              <span className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hidden sm:inline-flex select-none">
                Plataforma: {gameItem.platform}
              </span>
            )}

            {isMovie && movieItem?.status && (
              <span className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 select-none">
                Estado: {movieItem.status}
              </span>
            )}

            {isMovie && movieItem?.rating && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 select-none">
                ★ {movieItem.rating}
              </span>
            )}
          </div>
        </div>

        {(onSelectItem || onSelectGame) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect();
            }}
            className={cn(
              "group self-start md:self-center shrink-0 flex items-center gap-2 px-5 py-3 rounded-full text-white font-medium text-xs sm:text-sm shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer",
              isMovie
                ? "bg-sky-600 hover:bg-sky-500 hover:shadow-sky-500/25"
                : "bg-rose-600 hover:bg-rose-500 hover:shadow-rose-500/25"
            )}
          >
            <span>{isMovie ? "Explorar Ficha y Sinopsis" : "Explorar Ficha y Tropos"}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
        )}
      </div>
    </SpotlightCard>
  );
}

export default AiRecommendationHero;
