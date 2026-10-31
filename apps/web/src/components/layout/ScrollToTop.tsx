"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { clsx } from "clsx";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      const currentScroll =
        (window as unknown as { __lenis?: { scroll: number } }).__lenis?.scroll ??
        window.scrollY;
      if (currentScroll > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    const lenis = (window as unknown as { __lenis?: { on: (event: string, cb: () => void) => void; off: (event: string, cb: () => void) => void } }).__lenis;
    if (lenis?.on) {
      lenis.on("scroll", toggleVisibility);
    }
    window.addEventListener("scroll", toggleVisibility, { passive: true });

    return () => {
      if (lenis?.off) {
        lenis.off("scroll", toggleVisibility);
      }
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    const lenis = (window as unknown as { __lenis?: { scrollTo: (target: number) => void } }).__lenis;
    if (lenis) {
      lenis.scrollTo(0);
    } else {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  return (
    <button
      onClick={scrollToTop}
      className={clsx(
        "fixed bottom-22 right-4 sm:bottom-8 sm:right-8 z-30 p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-500/25 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer border border-rose-400/30",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      )}
      aria-label="Volver arriba"
      title="Volver arriba"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}

export default ScrollToTop;
