"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type Theme = "dark" | "light" | "system";

export interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
  toggleTheme: (event?: React.MouseEvent | MouseEvent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "ve-theme-preference";

export interface TransitionGeometry {
  x: number;
  y: number;
  endRadius: number;
}

export function calculateTransitionGeometry(
  event?: React.MouseEvent | MouseEvent | { clientX?: number; clientY?: number; currentTarget?: any; target?: any },
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1920,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 1080
): TransitionGeometry {
  let x = viewportWidth / 2;
  let y = 0;

  if (event) {
    if (
      typeof event.clientX === "number" &&
      typeof event.clientY === "number" &&
      (event.clientX !== 0 || event.clientY !== 0)
    ) {
      x = event.clientX;
      y = event.clientY;
    } else {
      const target = (event.currentTarget || event.target) as HTMLElement | null;
      if (target && typeof target.getBoundingClientRect === "function") {
        const rect = target.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
    }
  }

  const endRadius = Math.hypot(
    Math.max(x, viewportWidth - x),
    Math.max(y, viewportHeight - y)
  );

  return {
    x: Math.round(x),
    y: Math.round(y),
    endRadius: Math.ceil(endRadius),
  };
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      const stored = localStorage.getItem(storageKey) as Theme | null;
      if (stored && (stored === "dark" || stored === "light" || stored === "system")) {
        return stored;
      }
    } catch {
      // Silently ignore storage issues
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme;
  });

  useEffect(() => {
    const root = document.documentElement;

    const updateResolvedTheme = () => {
      let active: "dark" | "light" = "dark";
      if (theme === "system") {
        active = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        active = theme;
      }
      setResolvedTheme(active);

      if (active === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
      }
    };

    updateResolvedTheme();

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => updateResolvedTheme();
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch {
      // Silently ignore storage errors
    }
    setThemeState(newTheme);

    if (typeof document !== "undefined") {
      const root = document.documentElement;
      let active: "dark" | "light" = "dark";
      if (newTheme === "system") {
        active = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        active = newTheme;
      }
      setResolvedTheme(active);

      if (active === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
      }
    }
  };

  const toggleTheme = (event?: React.MouseEvent | MouseEvent) => {
    const next = resolvedTheme === "dark" ? "light" : "dark";

    const hasViewTransition =
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      typeof (document as any).startViewTransition === "function";

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (hasViewTransition && !prefersReducedMotion) {
      const { x, y, endRadius } = calculateTransitionGeometry(event);

      const root = document.documentElement;
      root.style.setProperty("--vt-x", `${x}px`);
      root.style.setProperty("--vt-y", `${y}px`);
      root.style.setProperty("--vt-r", `${endRadius}px`);

      root.classList.add("vt-active");

      const cleanup = () => {
        root.classList.remove("vt-active");
      };

      try {
        const transition = (document as any).startViewTransition(() => {
          try {
            flushSync(() => {
              setTheme(next);
            });
          } catch {
            setTheme(next);
          }
        });

        if (transition) {
          if (typeof transition.ready?.then === "function") {
            transition.ready.then(cleanup).catch(() => cleanup());
          } else {
            cleanup();
          }

          if (typeof transition.finished?.catch === "function") {
            transition.finished.catch(() => {});
          }

          if (typeof transition.updateCallbackDone?.catch === "function") {
            transition.updateCallbackDone.catch(() => {});
          }
        } else {
          cleanup();
        }
      } catch {
        cleanup();
        setTheme(next);
      }
    } else {
      setTheme(next);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  try {
    const context = useContext(ThemeContext);
    if (!context) {
      return {
        theme: "dark",
        resolvedTheme: "dark",
        setTheme: () => {},
        toggleTheme: () => {},
      };
    }
    return context;
  } catch {
    return {
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
}
