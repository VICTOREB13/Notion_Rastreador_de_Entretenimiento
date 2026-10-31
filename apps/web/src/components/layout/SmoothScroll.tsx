"use client";

import { ReactNode, useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Verificar entorno cliente
    if (typeof window === "undefined") return;

    // Respetar preferencias de accesibilidad del sistema operativo
    const prefersReducedMotion =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    const lenis = new Lenis({
      duration: prefersReducedMotion ? 0 : 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: !prefersReducedMotion,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      respectReducedMotion: true,
    });

    let animationFrameId: number;

    const updateTicker = (time: number) => {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(updateTicker);
    };

    animationFrameId = requestAnimationFrame(updateTicker);

    // Observar cambios de tamaño en el body (filtros del catálogo, modales, etc.)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        lenis.resize();
      });
      ro.observe(document.body);
    }

    // Interceptar clics en enlaces ancla (#id) para navegación fluida y segura
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (
        anchor &&
        anchor.hash &&
        anchor.hash.startsWith("#") &&
        anchor.pathname === window.location.pathname
      ) {
        if (anchor.hash === "#" || anchor.hash === "#top") {
          e.preventDefault();
          lenis.scrollTo(0);
        } else {
          try {
            const el = document.querySelector(anchor.hash) as HTMLElement | null;
            if (el) {
              e.preventDefault();
              lenis.scrollTo(el);
            }
          } catch {
            // Prevenir excepciones por selectores CSS inválidos (ej. #/ruta)
          }
        }
      }
    };
    document.addEventListener("click", handleAnchorClick);

    // Exponer la instancia de Lenis globalmente para control programático
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    const timer = setTimeout(() => {
      lenis.resize();
    }, 500);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener("click", handleAnchorClick);
      ro?.disconnect();
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return <>{children}</>;
}

export default SmoothScroll;
