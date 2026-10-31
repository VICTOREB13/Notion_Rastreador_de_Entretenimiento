"use client";

import React from "react";
import { Film, Sparkles, Calendar, Star } from "lucide-react";
import { SpotlightCard } from "../brand/SpotlightCard";
import { cn } from "@/lib/utils";
import type { MovieItem } from "@/lib/types";

export interface MovieCardProps {
  movie: MovieItem;
  onClick?: () => void;
  className?: string;
  aspectRatio?: "video" | "poster";
}

export function MovieCard({ movie, onClick, className, aspectRatio = "poster" }: MovieCardProps) {
  const aiData = movie.aiEnrichment;
  const isWatched = movie.status === "Vista";
  const isWatching = movie.status === "Viendo";
  const firstVibe = aiData?.vibeTags?.[0];

  const [imageError, setImageError] = React.useState(false);

  return (
    <SpotlightCard
      onClick={onClick}
      className={cn(
        "group flex flex-col justify-between cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:border-rose-500/40 dark:hover:border-rose-500/30 hover:shadow-xl hover:shadow-rose-500/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500",
        className
      )}
    >
      <div>
        {/* Poster / Cover Container */}
        <div
          className={cn(
            "relative w-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden",
            aspectRatio === "video" ? "aspect-video" : "aspect-[2/3]"
          )}
        >
          {movie.posterUrl && !imageError ? (
            <img
              src={movie.posterUrl}
              alt={movie.title}
              loading="lazy"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-106"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600">
              <Film className="w-10 h-10 mb-1 group-hover:text-rose-500 group-hover:scale-110 transition-all duration-300" />
              <span className="text-[11px] font-mono">Sin póster</span>
            </div>
          )}

          {/* Rating Badge */}
          {movie.rating && (
            <div className="absolute top-2.5 left-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-950/80 border border-amber-500/30 text-amber-300 backdrop-blur-md shadow-xs group-hover:scale-105 transition-transform duration-200">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                <span>{movie.rating}/5</span>
              </span>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-2.5 right-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md border shadow-xs group-hover:scale-105 transition-transform duration-200",
                isWatched
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                  : isWatching
                  ? "bg-sky-950/80 text-sky-300 border-sky-500/40"
                  : "bg-amber-950/80 text-amber-300 border-amber-500/40"
              )}
            >
              {isWatching && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
                </span>
              )}
              {movie.status}
            </span>
          </div>

          {/* Vibe Tag Badge */}
          {firstVibe && (
            <div className="absolute bottom-2.5 left-2.5 max-w-[85%]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950/85 border border-white/10 text-[10px] font-medium text-rose-300 backdrop-blur-md truncate group-hover:border-rose-500/30 transition-colors duration-200">
                <Sparkles className="w-2.5 h-2.5 shrink-0 text-rose-400 group-hover:scale-110 transition-transform duration-200" />
                <span className="truncate">{firstVibe}</span>
              </span>
            </div>
          )}
        </div>

        {/* Content Details */}
        <div className="p-4">
          <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200 line-clamp-1 tracking-tight">
            {movie.title}
          </h3>

          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {movie.year && (
              <span className="inline-flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                {movie.year}
              </span>
            )}
            {movie.tmdbId && (
              <>
                <span>•</span>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">TMDB {movie.tmdbId}</span>
              </>
            )}
          </div>

          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex items-center gap-1 mt-2 overflow-hidden">
              {movie.genres.slice(0, 2).map((genre, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 truncate hover:bg-zinc-200/80 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors duration-150"
                >
                  {genre}
                </span>
              ))}
              {movie.genres.length > 2 && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  +{movie.genres.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Synopsis Preview */}
      <div className="p-4 pt-0">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
          {aiData?.personalizedPitch || movie.overview || "Sin sinopsis registrada."}
        </p>
      </div>
    </SpotlightCard>
  );
}

export default MovieCard;
