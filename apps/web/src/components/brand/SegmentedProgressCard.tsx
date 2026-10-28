"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegmentedProgressCardProps {
  title?: string;
  subtitle?: string;
  currentPercentage?: number;
  targetPercentage?: number;
  count?: number;
  total?: number;
  className?: string;
}

export function SegmentedProgressCard({
  title = "Progreso del Backlog de Entretenimiento",
  subtitle = "Juegos Completados vs Registrados",
  currentPercentage = 35.5,
  targetPercentage = 50.0,
  count = 22,
  total = 62,
  className,
}: SegmentedProgressCardProps) {
  const isOptimal = currentPercentage >= targetPercentage;

  return (
    <div
      className={cn(
        "bg-[#111113] rounded-2xl border border-white/10 p-5 shadow-card hover:shadow-card-hover transition-all duration-300",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            {subtitle}
          </span>
          <h4 className="text-base font-bold text-zinc-100 mt-0.5 leading-snug truncate">
            {title}
          </h4>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border",
              isOptimal
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isOptimal ? "Meta Cumplida" : "En Progreso"}</span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-display tabular-nums text-zinc-100">
            {currentPercentage.toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-400 font-medium">completados</span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[11px] text-zinc-400 block leading-none mb-0.5">Meta Anual:</span>
          <span className="text-xs font-mono font-bold text-rose-400">
            Target {targetPercentage}%
          </span>
        </div>
      </div>

      {/* Segmented Hardware-Meter Track */}
      <div className="mt-4 p-1.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center gap-1">
        {Array.from({ length: 20 }).map((_, i) => {
          const activeSegments = Math.round((Math.max(0, Math.min(100, currentPercentage)) / 100) * 20);
          const isFilled = i < activeSegments;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 h-3 rounded-xs transition-all duration-300",
                isFilled
                  ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  : "bg-zinc-850/60 border border-white/5"
              )}
            />
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <span>0%</span>
        <span className="font-semibold text-zinc-300">
          {count} de {total} completados
        </span>
        <span>100%</span>
      </div>
    </div>
  );
}

export default SegmentedProgressCard;
