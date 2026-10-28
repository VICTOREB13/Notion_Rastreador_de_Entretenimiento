"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Star,
  Film,
  Gamepad2,
  AlertCircle,
} from "lucide-react";
import { cn, formatHours } from "@/lib/utils";
import type { GameItem, MovieItem, AIEnrichmentData } from "@/lib/types";
import {
  useGameDetailQuery,
  useMovieDetailQuery,
  useEnrichGameMutation,
  useEnrichMovieMutation,
} from "@/lib/hooks";

export interface ItemDetailModalProps {
  item: GameItem | MovieItem | null;
  type: "GAME" | "MOVIE" | null;
  onClose: () => void;
}

export function ItemDetailModal({ item, type, onClose }: ItemDetailModalProps) {
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [localEnrichment, setLocalEnrichment] = useState<AIEnrichmentData | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setEnrichmentError(null);
    setLocalEnrichment(null);
    setImageError(false);
  }, [item?.id]);

  const isGame = type === "GAME";
  const { data: freshGame } = useGameDetailQuery(isGame && item ? item.id : null);
  const { data: freshMovie } = useMovieDetailQuery(!isGame && item ? item.id : null);

  const enrichGameMutation = useEnrichGameMutation();
  const enrichMovieMutation = useEnrichMovieMutation();

  if (!item || !type) return null;

  const currentItem = (isGame ? (freshGame as unknown as GameItem | undefined) : (freshMovie as unknown as MovieItem | undefined)) || item;
  const game = isGame ? (currentItem as GameItem) : null;
  const movie = !isGame ? (currentItem as MovieItem) : null;

  const coverImage = isGame ? game?.coverUrl : movie?.posterUrl;
  const aiData = localEnrichment || currentItem.aiEnrichment;

  const isEnriching = enrichGameMutation.isPending || enrichMovieMutation.isPending;

  const handleReEnrich = async () => {
    setEnrichmentError(null);
    try {
      if (isGame && game) {
        const res = await enrichGameMutation.mutateAsync({ id: game.id, options: { force: true } });
        if (res?.data?.enrichment) {
          setLocalEnrichment(res.data.enrichment as AIEnrichmentData);
        }
      } else if (movie) {
        const res = await enrichMovieMutation.mutateAsync({ id: movie.id, options: { force: true } });
        if (res?.data?.enrichment) {
          setLocalEnrichment(res.data.enrichment as AIEnrichmentData);
        }
      }
    } catch (err: any) {
      setEnrichmentError(err.message || "Error al enriquecer el contenido con Gemini IA");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#111113] border border-white/10 rounded-2xl shadow-floating text-zinc-100 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer z-20"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Media Header Banner */}
        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-950 border border-white/10 mb-6">
          {coverImage && !imageError ? (
            <img
              src={coverImage}
              alt={currentItem.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-mono">
              Sin imagen oficial disponible
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-[#111113] via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-950/80 border border-white/10 text-white backdrop-blur-md">
              {item.status}
            </span>
            {movie?.tmdbId && (
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-zinc-950/80 border border-amber-500/30 text-amber-300 flex items-center gap-1 backdrop-blur-md">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                TMDB #{movie.tmdbId}
              </span>
            )}
          </div>
        </div>

        {/* Title & Metadata */}
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">{item.title}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-zinc-400 font-mono">
            {isGame ? (
              <>
                <span className="text-rose-400 font-semibold">{game?.platform}</span>
                {game?.steamAppId && <span>• Steam ID: {game.steamAppId}</span>}
                <span>• Horas: {formatHours(game?.playtimeForever)}</span>
              </>
            ) : (
              <>
                {movie?.year && <span>Año {movie.year}</span>}
                {movie?.tmdbId && <span>• TMDB ID: {movie.tmdbId}</span>}
              </>
            )}
          </div>
        </div>

        {/* HLTB Breakdown for Games */}
        {isGame && (game?.hltbMain || game?.hltbCompletionist) && (
          <div className="mt-5 p-4 rounded-xl bg-zinc-900/60 border border-white/5 grid grid-cols-2 gap-2 text-center">
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                Historia Principal
              </span>
              <span className="text-base font-bold font-mono text-zinc-200">
                {game.hltbMain ? `${game.hltbMain}h` : "--"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                Completista 100%
              </span>
              <span className="text-base font-bold font-mono text-zinc-200">
                {game.hltbCompletionist ? `${game.hltbCompletionist}h` : "--"}
              </span>
            </div>
          </div>
        )}

        {/* Synopsis / Overview for Movies */}
        {movie?.overview && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Sinopsis Oficial
            </h4>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{movie.overview}</p>
          </div>
        )}

        {/* AI Analysis Section */}
        <div className="mt-6 p-5 rounded-xl bg-zinc-900/80 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Análisis Contextual de IA (Gemini 2.5 Flash)
              </h4>
            </div>
            <button
              type="button"
              onClick={handleReEnrich}
              disabled={isEnriching}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={cn("w-3 h-3", isEnriching && "animate-spin")} />
              <span>{isEnriching ? "Analizando..." : "Re-analizar con IA"}</span>
            </button>
          </div>

          {enrichmentError && (
            <div className="mb-3 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{enrichmentError}</span>
            </div>
          )}

          {aiData ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-zinc-950/60 border border-white/5">
                <span className="text-[11px] font-mono text-rose-400 font-semibold block mb-1">
                  ¿Por qué experimentarlo hoy?
                </span>
                <p className="text-zinc-200 leading-relaxed italic">
                  "{aiData.personalizedPitch}"
                </p>
              </div>

              {aiData.vibeTags && aiData.vibeTags.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1.5">
                    Vibe Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {aiData.vibeTags.map((vibe, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/20 text-rose-300 text-[11px]"
                      >
                        {vibe}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {aiData.thematicTropes && aiData.thematicTropes.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1.5">
                    Tropos y Elementos Narrativos
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {aiData.thematicTropes.map((trope, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-zinc-950 text-zinc-300 border border-white/5 text-[11px]"
                      >
                        {trope}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-zinc-500">
              <p>Este título aún no cuenta con análisis estructurado de Gemini.</p>
              <p className="mt-1 text-zinc-400">
                Haz clic en "Re-analizar con IA" para generar pitch, vibe y tropos.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500">
          <span>Sincronizado con Notion</span>
          {movie?.wikiUrl && (
            <a
              href={movie.wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 font-medium"
            >
              <span>Wikipedia</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default ItemDetailModal;
