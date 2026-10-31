"use client";

import React from "react";
import { Clock, Trophy, Sparkles, Gamepad2 } from "lucide-react";
import { SpotlightCard } from "../brand/SpotlightCard";
import { cn, formatHours } from "@/lib/utils";
import type { GameItem } from "@/lib/types";

export interface GameCardProps {
  game: GameItem;
  onClick?: () => void;
  className?: string;
}

export function GameCard({ game, onClick, className }: GameCardProps) {
  const aiData = game.aiEnrichment;
  const playtime = game.playtimeForever || 0;
  const hltb = game.hltbMain || null;
  const completionPercentage = hltb && hltb > 0 ? Math.min(100, (playtime / hltb) * 100) : null;

  const isCompleted = game.status === "Jugado";
  const isPlaying = game.status === "Jugando";
  const firstVibe = aiData?.vibeTags?.[0];

  const [imageError, setImageError] = React.useState(false);

  return (
    <SpotlightCard
      onClick={onClick}
      className={cn(
        "group flex flex-col justify-between cursor-pointer transition-transform duration-200 hover:-translate-y-1 hover:border-zinc-300 dark:hover:border-white/20",
        className
      )}
    >
      <div>
        {/* Cover Image Container */}
        <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
          {game.coverUrl && !imageError ? (
            <img
              src={game.coverUrl}
              alt={game.title}
              loading="lazy"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600">
              <Gamepad2 className="w-10 h-10 mb-1" />
              <span className="text-[11px] font-mono">Sin carátula</span>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-2.5 right-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md border shadow-xs",
                isCompleted
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                  : isPlaying
                  ? "bg-blue-950/80 text-blue-300 border-blue-500/40"
                  : "bg-amber-950/80 text-amber-300 border-amber-500/40"
              )}
            >
              {isPlaying && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                </span>
              )}
              {game.status}
            </span>
          </div>

          {/* Vibe Tag Badge */}
          {firstVibe && (
            <div className="absolute bottom-2.5 left-2.5 max-w-[85%]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950/80 border border-white/10 text-[10px] font-medium text-rose-300 backdrop-blur-md truncate">
                <Sparkles className="w-2.5 h-2.5 shrink-0 text-rose-400" />
                <span className="truncate">{firstVibe}</span>
              </span>
            </div>
          )}
        </div>

        {/* Content Details */}
        <div className="p-4">
          <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors line-clamp-1 tracking-tight">
            {game.title}
          </h3>

          {/* Genres */}
          {game.genres && game.genres.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
              {game.genres.slice(0, 3).map((genre, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 truncate"
                >
                  {genre}
                </span>
              ))}
              {game.genres.length > 3 && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  +{game.genres.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Playtime vs HLTB */}
      <div className="p-4 pt-0">
        <div className="pt-3 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            <span className="font-bold">{formatHours(playtime)}</span>
          </div>

          {hltb ? (
            <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              <Trophy className="w-3 h-3 text-amber-500/70" />
              <span>HLTB {hltb}h</span>
            </div>
          ) : (
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">Steam</span>
          )}
        </div>

        {/* Mini progress bar if HLTB available */}
        {completionPercentage !== null && (
          <div className="mt-2 w-full h-1 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                completionPercentage >= 100 ? "bg-emerald-500" : "bg-rose-500"
              )}
              style={{ width: `${Math.min(100, completionPercentage)}%` }}
            />
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}

export default GameCard;
