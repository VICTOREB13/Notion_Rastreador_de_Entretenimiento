"use client";

import React, { useState, useEffect } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const next: Theme =
      theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
  };

  const getLabel = () => {
    if (!mounted) return "Cambiar tema (Atajo: T)";
    if (theme === "dark") return "Tema: Oscuro (clic para Claro, Atajo: T)";
    if (theme === "light") return "Tema: Claro (clic para Sistema, Atajo: T)";
    return "Tema: Sistema (clic para Oscuro, Atajo: T)";
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "group relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 shadow-2xs hover:shadow-xs",
        "bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200/80 hover:border-zinc-300",
        "dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:border-zinc-700",
        className
      )}
      aria-label={getLabel()}
      title={getLabel()}
    >
      {!mounted ? (
        <Sun className="h-4 w-4 opacity-0" />
      ) : theme === "system" ? (
        <Monitor className="h-4 w-4 text-rose-500 transition-all duration-300 group-hover:rotate-12" />
      ) : theme === "light" ? (
        <Sun className="h-4 w-4 text-amber-500 transition-all duration-300 group-hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-rose-400 transition-all duration-300 group-hover:-rotate-12" />
      )}
      <span className="sr-only">{getLabel()}</span>
    </button>
  );
}

export default ThemeToggle;
