"use client";

import React from "react";
import { Gamepad2, Film, BarChart3, Activity, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

export interface DockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  onClick?: () => void;
  isActive?: boolean;
}

export interface FloatingIslandNavDockProps {
  items?: DockItem[];
  activeId?: string;
  onItemClick?: (id: string) => void;
  onOpenSettings?: () => void;
  onOpenTelemetry?: () => void;
  showThemeToggle?: boolean;
  className?: string;
}

export function FloatingIslandNavDock({
  items,
  activeId,
  onItemClick,
  onOpenSettings,
  onOpenTelemetry,
  showThemeToggle = true,
  className,
}: FloatingIslandNavDockProps) {
  const handleOpenTelemetry = onOpenTelemetry || onOpenSettings;
  const defaultItems: DockItem[] = [
    {
      id: "coleccion",
      label: "Colección",
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: "juegos",
      label: "Juegos",
      icon: <Gamepad2 className="w-4 h-4" />,
    },
    {
      id: "peliculas",
      label: "Películas",
      icon: <Film className="w-4 h-4" />,
    },
    {
      id: "ritmo",
      label: "Ritmo",
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  const currentItems = items || defaultItems;

  return (
    <nav
      aria-label="Navegación Rápida Flotante"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto",
        className
      )}
    >
      <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-white/90 dark:bg-zinc-950/85 text-zinc-700 dark:text-zinc-200 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-floating">
        {currentItems.map((item) => {
          const isActive = activeId === item.id || item.isActive;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                item.onClick?.();
                onItemClick?.(item.id);
              }}
              title={item.label}
              className={cn(
                "relative flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer",
                isActive
                  ? "bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs font-semibold border border-zinc-200 dark:border-white/15"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-white/5"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="hidden sm:inline-block max-w-[120px] truncate">{item.label}</span>

              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              )}

              {item.badge !== undefined && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {handleOpenTelemetry && (
          <>
            <div className="w-[1px] h-4 bg-zinc-200 dark:bg-white/10 mx-1" />
            <button
              type="button"
              onClick={handleOpenTelemetry}
              title="Telemetría"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-zinc-800 transition-all duration-200 cursor-pointer"
            >
              <Activity className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline-block">Telemetría</span>
            </button>
          </>
        )}

        {showThemeToggle && (
          <>
            <div className="w-[1px] h-4 bg-zinc-200 dark:bg-white/10 mx-0.5" />
            <ThemeToggle className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white" />
          </>
        )}
      </div>
    </nav>
  );
}

export default FloatingIslandNavDock;
