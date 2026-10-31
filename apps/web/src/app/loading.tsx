import React from "react";
import Image from "next/image";

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090B] flex flex-col items-center justify-center p-6 text-zinc-900 dark:text-zinc-100 select-none transition-colors duration-200">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        {/* Animated Brand Isotipo with Crimson Glow */}
        <div className="relative group">
          <div className="absolute -inset-3 bg-rose-500/20 rounded-3xl blur-xl animate-pulse pointer-events-none" />
          <div className="relative p-4 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-rose-500/50 shadow-xl shadow-rose-500/10">
            <Image
              src="/brand/ve-isotipo-red.svg"
              alt="Victor Engineer Isotipo"
              width={72}
              height={72}
              priority
              unoptimized
              className="h-12 w-auto object-contain animate-pulse"
            />
          </div>
        </div>

        {/* Text Header */}
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold block mb-1">
            Personal Engineering Suite
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-zinc-900 dark:text-white">
            Rastreador de Entretenimiento
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Conectando con Steam, Notion SSoT & Gemini IA...
          </p>
        </div>

        {/* Minimal Kinetic Progress Line */}
        <div className="w-48 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden relative">
          <div className="h-full bg-linear-to-r from-rose-500 via-rose-600 to-rose-400 rounded-full animate-[shiny-text-shimmer_1.5s_infinite_linear] w-full" />
        </div>
      </div>
    </div>
  );
}
