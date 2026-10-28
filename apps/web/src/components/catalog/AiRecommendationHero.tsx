"use client";

import React from "react";
import { Sparkles, ArrowRight, Compass } from "lucide-react";
import { SpotlightCard } from "../brand/SpotlightCard";
import { ShinyText } from "../brand/ShinyText";
import { cn } from "@/lib/utils";
import type { GameItem } from "@/lib/types";

export interface AiRecommendationHeroProps {
  game?: GameItem | null;
  onSelectGame?: (game: GameItem) => void;
  className?: string;
}

export function AiRecommendationHero({
  game,
  onSelectGame,
  className,
}: AiRecommendationHeroProps) {
  if (!game) return null;

  const aiData = game.aiEnrichment;
  const pitch =
    aiData?.personalizedPitch ||
    "Una experiencia cuidadosamente seleccionada de tu biblioteca para sumergirte hoy.";
  const firstVibe = aiData?.vibeTags?.[0];

  return (
    <SpotlightCard
      className={cn(
        "relative overflow-hidden p-6 sm:p-8 border border-white/10 bg-linear-to-br from-zinc-900 via-[#111113] to-zinc-950",
        className
      )}
    >
      {/* Background Cover Overlay */}
      {game.coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15 blur-sm pointer-events-none transform scale-105"
          style={{ backgroundImage: `url(${game.coverUrl})` }}
        />
      )}

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Recomendación Contextual IA: ¿Por qué jugarlo hoy?</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-zinc-100 tracking-tight flex items-center gap-2">
            <ShinyText speed={5}>{game.title}</ShinyText>
          </h2>

          <p className="mt-3 text-sm sm:text-base text-zinc-300 leading-relaxed italic">
            "{pitch}"
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-mono">
            {firstVibe && (
              <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-rose-300">
                Vibe: {firstVibe}
              </span>
            )}
            {aiData?.completionEstimateWeeks && (
              <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 flex items-center gap-1">
                <Compass className="w-3 h-3 text-zinc-400" />
                Tiempo Estimado: ~{aiData.completionEstimateWeeks} semanas
              </span>
            )}
            {game.platform && (
              <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hidden sm:inline-flex">
                Plataforma: {game.platform}
              </span>
            )}
          </div>
        </div>

        {onSelectGame && (
          <button
            type="button"
            onClick={() => onSelectGame(game)}
            className="self-start md:self-center shrink-0 flex items-center gap-2 px-5 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs sm:text-sm shadow-card hover:shadow-card-hover active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <span>Explorar Ficha y Tropos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </SpotlightCard>
  );
}

export default AiRecommendationHero;
