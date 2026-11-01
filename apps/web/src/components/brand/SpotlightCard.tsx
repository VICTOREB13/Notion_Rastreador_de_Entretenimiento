"use client";

import React, { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  spotlightColor?: string;
  spotlightSize?: number;
  className?: string;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor,
  spotlightSize = 340,
  onClick,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  const updateCoords = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || e.pointerType === "touch" || !cardRef.current) return false;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    return true;
  };

  const activeColor = spotlightColor || "rgba(239, 68, 68, 0.12)";

  return (
    <div
      ref={cardRef}
      onPointerMove={updateCoords}
      onPointerEnter={(e) => { if (updateCoords(e)) setIsHovered(true); }}
      onPointerLeave={() => setIsHovered(false)}
      onPointerCancel={() => setIsHovered(false)}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100 shadow-card hover:shadow-card-hover transition-all duration-300",
        className
      )}
      {...props}
    >
      {!reducedMotion && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-10"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(${spotlightSize}px circle at var(--mouse-x, -999px) var(--mouse-y, -999px), ${activeColor}, transparent 70%)`,
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

export default SpotlightCard;
