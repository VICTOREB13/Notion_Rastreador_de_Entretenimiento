"use client";

import React from "react";
import { Gamepad2, Radio, Clock } from "lucide-react";
import { cn, formatMinutes } from "@/lib/utils";
import type { LiveSteamStatus } from "@/lib/types";

export interface LiveGamingBadgeProps {
  status?: LiveSteamStatus;
  isLoading?: boolean;
  className?: string;
}

export function LiveGamingBadge({ status, isLoading, className }: LiveGamingBadgeProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 text-xs text-zinc-400 animate-pulse",
          className
        )}
      >
        <span className="w-2 h-2 rounded-full bg-zinc-600" />
        <span>Sincronizando estado de Steam...</span>
      </div>
    );
  }

  const isLive = Boolean(status?.isPlaying && status?.game?.title);
  const activeGame = status?.game;

  if (isLive && activeGame) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-200 backdrop-blur-md shadow-xs animate-in fade-in duration-300",
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <div className="flex items-center gap-1.5 font-medium">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Jugando AHORA:
          </span>
          <span className="font-semibold text-emerald-100 max-w-[180px] sm:max-w-[260px] truncate">
            {activeGame.title}
          </span>
        </div>
        {activeGame.sessionMinutes ? (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300/80 bg-emerald-900/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
            <Clock className="w-2.5 h-2.5" />
            {formatMinutes(activeGame.sessionMinutes)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/10 text-xs text-zinc-400 backdrop-blur-md",
        className
      )}
    >
      <span className="w-2 h-2 rounded-full bg-zinc-600" />
      <span className="font-mono text-[11px] text-zinc-400">Steam: En descanso</span>
    </div>
  );
}

export default LiveGamingBadge;
