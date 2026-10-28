"use client";

import React from "react";
import { Activity, Cpu, Server, Database, Gamepad2, Film } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ServicesTelemetryGridProps {
  telemetry?: {
    uptime?: number;
    isNotionConnected?: boolean;
    isSteamConnected?: boolean;
    isRawgConnected?: boolean;
    isTmdbConnected?: boolean;
    isGeminiConnected?: boolean;
    activeModel?: string;
  };
}

export function ServicesTelemetryGrid({ telemetry }: ServicesTelemetryGridProps) {
  const formatUptime = (seconds?: number) => {
    if (!seconds) return "0m";
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const services = [
    { label: "Daemon API", sub: "Hono Core", icon: <Activity className="w-4 h-4 text-emerald-500" />, ok: true },
    { label: "Notion SSoT", sub: telemetry?.isNotionConnected ? "Conectado" : "Offline", icon: <Database className="w-4 h-4 text-rose-500" />, ok: telemetry?.isNotionConnected },
    { label: "Steam Live", sub: telemetry?.isSteamConnected ? "Conectado" : "Offline", icon: <Gamepad2 className="w-4 h-4 text-sky-500" />, ok: telemetry?.isSteamConnected },
    { label: "RAWG API", sub: telemetry?.isRawgConnected ? "Conectado" : "Cuota Preservada", icon: <Gamepad2 className="w-4 h-4 text-amber-500" />, ok: telemetry?.isRawgConnected },
    { label: "TMDB Cine", sub: telemetry?.isTmdbConnected ? "Conectado" : "Offline", icon: <Film className="w-4 h-4 text-purple-500" />, ok: telemetry?.isTmdbConnected },
    { label: "Gemini IA", sub: telemetry?.activeModel || "gemini-2.0-flash", icon: <Cpu className="w-4 h-4 text-rose-500" />, ok: telemetry?.isGeminiConnected },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-rose-500" /> Estado de Conexiones & Servicios
        </h4>
        <span className="text-[10px] font-mono text-zinc-400">
          Uptime: {formatUptime(telemetry?.uptime)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {services.map((svc) => (
          <div
            key={svc.label}
            className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              {svc.icon}
              <div className="truncate">
                <span className="block font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] truncate">{svc.label}</span>
                <span className="text-[10px] text-zinc-500 font-mono truncate">{svc.sub}</span>
              </div>
            </div>
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0 shadow-xs",
                svc.ok ? "bg-emerald-500 shadow-emerald-500/50" : "bg-zinc-400"
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
