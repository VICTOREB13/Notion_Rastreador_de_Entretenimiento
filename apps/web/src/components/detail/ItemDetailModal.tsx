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
  CalendarCheck,
  MessageSquare,
} from "lucide-react";
import { cn, formatHours, formatDate } from "@/lib/utils";
import type { GameItem, MovieItem, AIEnrichmentData } from "@/lib/types";
import {
  useGameDetailQuery,
  useMovieDetailQuery,
  useEnrichGameMutation,
  useEnrichMovieMutation,
  useSystemSettingsQuery,
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

  useEffect(() => {
    if (!item || !type || typeof document === "undefined") return;
    document.body.style.overflow = "hidden";
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    lenis?.stop();

    return () => {
      document.body.style.overflow = "";
      lenis?.start();
    };
  }, [item, type]);

  const isGame = type === "GAME";
  const { data: freshGame } = useGameDetailQuery(isGame && item ? item.id : null);
  const { data: freshMovie } = useMovieDetailQuery(!isGame && item ? item.id : null);
  const { data: telemetry } = useSystemSettingsQuery();

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        data-lenis-prevent
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-floating text-zinc-900 dark:text-zinc-100 p-6 sm:p-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar modal de detalle"
          className="absolute top-4 right-4 p-2 sm:p-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-all duration-200 cursor-pointer z-20 hover:scale-110 active:scale-95 hover:rotate-90 shadow-2xs min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Media Header Banner */}
        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 mb-6">
          {coverImage && !imageError ? (
            <img
              src={coverImage}
              alt={currentItem.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-xs font-mono">
              Sin imagen oficial disponible
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-white dark:from-[#111113] via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-950/80 border border-white/10 text-white backdrop-blur-md">
              {item.status}
            </span>
            <div className="flex items-center gap-2">
              {typeof currentItem.rating === "number" && currentItem.rating > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-zinc-950/80 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 backdrop-blur-md">
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((starIdx) => (
                      <Star
                        key={starIdx}
                        className={cn(
                          "w-3 h-3",
                          starIdx <= Math.round(currentItem.rating!)
                            ? "fill-amber-400 text-amber-400"
                            : "text-zinc-600"
                        )}
                      />
                    ))}
                  </span>
                  <span>{currentItem.rating}/5</span>
                </span>
              )}
              {movie?.tmdbId && (
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-zinc-950/80 border border-amber-500/30 text-amber-300 flex items-center gap-1 backdrop-blur-md">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  TMDB #{movie.tmdbId}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Title & Metadata */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-bold font-display tracking-tight text-zinc-900 dark:text-white">{item.title}</h2>
            {(movie?.wikiUrl || game?.link) && (
              <a
                href={(movie?.wikiUrl || game?.link)!}
                target="_blank"
                rel="noopener noreferrer"
                className="group shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-500/20 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-2xs"
              >
                <span>{(movie?.wikiUrl || game?.link)?.includes("wikipedia.org") ? "Wikipedia" : "Enlace"}</span>
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            {isGame ? (
              <>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">{game?.platform}</span>
                <span>• Horas: {formatHours(game?.playtimeForever)}</span>
                {game?.completionDate && formatDate(game.completionDate) && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    • <CalendarCheck className="w-3 h-3" /> Culminado: {formatDate(game.completionDate)}
                  </span>
                )}
              </>
            ) : (
              <>
                {movie?.year && <span>Año {movie.year}</span>}
                {movie?.tmdbId && <span>• TMDB ID: {movie.tmdbId}</span>}
                {movie?.completionDate && formatDate(movie.completionDate) && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    • <CalendarCheck className="w-3 h-3" /> Fecha de visualización: {formatDate(movie.completionDate)}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Genres from Notion */}
          {(((isGame && game?.notionGenres && game.notionGenres.length > 0) ? game.notionGenres : currentItem.genres) || []).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {((isGame && game?.notionGenres && game.notionGenres.length > 0) ? game.notionGenres : currentItem.genres).map((genre, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/5 hover:border-rose-500/30 hover:scale-105 transition-all duration-150 select-none"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* User's Personal Thoughts / Summary / Opinion from Notion */}
        {(game?.summary || movie?.summary) && (
          <div className="mt-5 p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 hover:border-amber-500/40 transition-colors duration-200">
            <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Mi Resumen & Opinión Personal</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed italic whitespace-pre-line">
              "{game?.summary || movie?.summary}"
            </p>
          </div>
        )}

        {/* HLTB Breakdown for Games */}
        {isGame && (game?.hltbMain || game?.hltbCompletionist) && (
          <div className="mt-5 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-lg hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors duration-150">
              <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 block">
                Historia Principal
              </span>
              <span className="text-base font-bold font-mono text-zinc-800 dark:text-zinc-200">
                {game.hltbMain ? `${game.hltbMain}h` : "--"}
              </span>
            </div>
            <div className="p-2 rounded-lg hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors duration-150">
              <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 block">
                Completista 100%
              </span>
              <span className="text-base font-bold font-mono text-zinc-800 dark:text-zinc-200">
                {game.hltbCompletionist ? `${game.hltbCompletionist}h` : "--"}
              </span>
            </div>
          </div>
        )}

        {/* Synopsis / Overview for Movies */}
        {movie?.overview && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Sinopsis Oficial
            </h4>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{movie.overview}</p>
          </div>
        )}

        {/* AI Analysis Section */}
        <div className="mt-6 p-5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                Análisis Contextual de IA
              </h4>
              {telemetry?.activeModel && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold">
                  {telemetry.activeModel}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleReEnrich}
              disabled={isEnriching}
              className="group flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-zinc-200 hover:border-rose-500/30 dark:border-white/10 dark:hover:border-rose-500/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-2xs"
            >
              <RefreshCw className={cn("w-3 h-3 group-hover:rotate-180 transition-transform duration-500", isEnriching && "animate-spin")} />
              <span>{isEnriching ? "Analizando..." : "Re-analizar con IA"}</span>
            </button>
          </div>

          {enrichmentError && (
            <div className="mb-3 p-3 rounded-lg bg-rose-50 dark:bg-red-950/40 border border-rose-200 dark:border-red-500/30 text-rose-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-red-400" />
              <span>{enrichmentError}</span>
            </div>
          )}

          {aiData ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
                <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-semibold block mb-1">
                  ¿Por qué experimentarlo hoy?
                </span>
                <p className="text-zinc-700 dark:text-zinc-200 leading-relaxed italic">
                  "{aiData.personalizedPitch}"
                </p>
              </div>

              {aiData.vibeTags && aiData.vibeTags.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 block mb-1.5">
                    Vibe Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {aiData.vibeTags.map((vibe, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300 text-[11px]"
                      >
                        {vibe}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {aiData.thematicTropes && aiData.thematicTropes.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 block mb-1.5">
                    Tropos y Elementos Narrativos
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {aiData.thematicTropes.map((trope, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/5 text-[11px]"
                      >
                        {trope}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-zinc-500 dark:text-zinc-400">
              <p>Este título aún no cuenta con análisis estructurado de Gemini.</p>
              <p className="mt-1 text-zinc-400 dark:text-zinc-500">
                Haz clic en "Re-analizar con IA" para generar pitch, vibe y tropos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ItemDetailModal;
