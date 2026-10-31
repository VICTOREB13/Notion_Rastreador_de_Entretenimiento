"use client";

import { ReactNode, useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Respetar preferencias de accesibilidad del sistema operativo
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    let animationFrameId: number;

    const updateTicker = (time: number) => {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(updateTicker);
    };

    animationFrameId = requestAnimationFrame(updateTicker);

    // Observar cambios de tamaño en el body (filtros del catálogo, modales, etc.)
    const ro = new ResizeObserver(() => {
      lenis.resize();
    });
    ro.observe(document.body);

    // Interceptar clics en enlaces ancla (#id) para navegación fluida
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor && anchor.hash && anchor.hash.startsWith("#") && anchor.pathname === window.location.pathname) {
        if (anchor.hash === "#top") {
          e.preventDefault();
          lenis.scrollTo(0);
        } else {
          const el = document.querySelector(anchor.hash) as HTMLElement;
          if (el) {
            e.preventDefault();
            lenis.scrollTo(el);
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
      ro.disconnect();
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return <>{children}</>;
}

export default SmoothScroll;
