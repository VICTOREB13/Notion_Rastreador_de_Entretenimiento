"use client";

import React from "react";
import { TrendingUp, Gamepad2, Clock, CheckCircle2, Film } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConsolidatedMetricColumn {
  id?: string;
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  caption?: string;
  trend?: { value: string; isPositive: boolean };
}

export interface ConsolidatedMetricBandProps {
  columns?: ConsolidatedMetricColumn[];
  className?: string;
}

export function ConsolidatedMetricBand({ columns, className }: ConsolidatedMetricBandProps) {
  const defaultColumns: ConsolidatedMetricColumn[] = [
    {
      id: "games",
      icon: <Gamepad2 className="w-4 h-4 text-rose-400" />,
      label: "Catálogo de Juegos",
      value: "0",
      caption: "Títulos registrados",
    },
    {
      id: "hours",
      icon: <Clock className="w-4 h-4 text-amber-400" />,
      label: "Horas de Juego",
      value: "0.0 hrs",
      caption: "Tiempo de vida en Steam",
    },
    {
      id: "completion",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      label: "Tasa de Finalización",
      value: "0%",
      caption: "Juegos terminados",
    },
    {
      id: "movies",
      icon: <Film className="w-4 h-4 text-sky-400" />,
      label: "Cinefilia & Películas",
      value: "0",
      caption: "Películas completadas",
    },
  ];

  const items = columns && columns.length > 0 ? columns : defaultColumns;

  const defaultIconMap: Record<string, React.ReactNode> = {
    games: <Gamepad2 className="w-4 h-4 text-rose-400" />,
    hours: <Clock className="w-4 h-4 text-amber-400" />,
    completion: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    movies: <Film className="w-4 h-4 text-sky-400" />,
  };

  return (
    <div
      className={cn(
        "bg-[#111113] rounded-2xl border border-white/10 shadow-card overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/10 text-zinc-100",
        className
      )}
    >
      {items.map((col, index) => {
        const icon = col.icon || (col.id ? defaultIconMap[col.id] : null);
        return (
          <div
            key={col.id || index}
            className="p-4 sm:p-5 flex flex-col justify-between hover:bg-zinc-800/40 transition-colors duration-200"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                {icon && (
                  <span className="text-zinc-400 shrink-0">
                    {icon}
                  </span>
                )}
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 truncate">
                  {col.label}
                </span>
              </div>

              {col.trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 border",
                    col.trend.isPositive
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  <TrendingUp className="w-2.5 h-2.5" />
                  <span>{col.trend.value}</span>
                </span>
              )}
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold font-display tabular-nums text-zinc-100 tracking-tight">
                {col.value}
              </div>
              {col.caption && (
                <p className="text-[11px] font-mono text-zinc-500 mt-1.5 truncate">
                  {col.caption}
                </p>
              )}
            </div>
          </div>
      );
    })}
  </div>
  );
}

export default ConsolidatedMetricBand;
