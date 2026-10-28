"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Sliders, Activity, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface BrandHeaderProps {
  version?: string;
  onOpenTelemetry?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function BrandHeader({
  version = "v2.0.0",
  onOpenTelemetry,
  actions,
  className,
}: BrandHeaderProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc =
    mounted && resolvedTheme === "light"
      ? "/brand/ve-logo-horizontal-light-mode.svg"
      : "/brand/ve-logo-horizontal-dark-mode.svg";

  return (
    <header
      className={cn(
        "flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-zinc-200 dark:border-white/10 transition-colors duration-200",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {/* Official Brand Logo with Crimson Border */}
        <div className="relative group shrink-0">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-rose-500/40 dark:border-rose-500/60 shadow-lg shadow-rose-500/10 group-hover:border-rose-500 group-hover:shadow-rose-500/20 transition-all duration-300">
            <Image
              src={logoSrc}
              alt="Victor Engineer Brand Logo"
              width={160}
              height={38}
              priority
              className="h-7 sm:h-8 w-auto object-contain select-none"
            />
          </div>
          {/* Version Badge */}
          <span className="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-600 text-white shadow-sm border border-rose-400/40">
            {version}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold">
              Personal Engineering Suite
            </span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Obsidian & Crimson
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-zinc-900 dark:text-white">
            Rastreador de Entretenimiento
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 max-w-xl">
            Centro de comando y telemetría para videojuegos, cinefilia y enriquecimiento contextual con IA.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
        {actions}

        {/* Dark / Light Mode Toggle */}
        <ThemeToggle />

        {/* Telemetry & System Button */}
        {onOpenTelemetry && (
          <button
            type="button"
            onClick={onOpenTelemetry}
            title="Sistema & Telemetría"
            aria-label="Abrir modal de Sistema y Telemetría"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-white/10 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Telemetría & IA</span>
          </button>
        )}
      </div>
    </header>
  );
}

export default BrandHeader;
