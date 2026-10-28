"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SpringSegmentedControlProps {
  options: (string | { id?: string; value?: string; label?: string; icon?: React.ReactNode })[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
}

export function normalizeSegmentedControlOptions(
  options: (string | { id?: string; value?: string; label?: string; icon?: React.ReactNode })[] = []
): SegmentedControlOption[] {
  return options.map((opt) => {
    if (typeof opt === "string") {
      return { id: opt, label: opt, icon: undefined };
    }
    return {
      id: (opt.id ?? opt.value ?? opt.label) as string,
      label: (opt.label ?? opt.id ?? opt.value) as string,
      icon: opt.icon,
    };
  });
}

export function SpringSegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  className,
  ariaLabel = "Selector de opciones",
}: SpringSegmentedControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const [isSquashing, setIsSquashing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const prevIndexRef = useRef(-1);
  const squashTimeoutRef = useRef<any>(null);

  const normalizedOptions = normalizeSegmentedControlOptions(options);
  const activeIndex = normalizedOptions.findIndex((opt) => opt.id === value);

  const updatePill = (triggerSquash = true) => {
    const currentBtn = buttonRefs.current[value];
    const container = containerRef.current;

    if (currentBtn && container) {
      const btnLeft = currentBtn.offsetLeft;
      const btnWidth = currentBtn.offsetWidth;

      setPillStyle({
        left: btnLeft,
        width: btnWidth,
      });

      if (
        triggerSquash &&
        hasInitialized &&
        prevIndexRef.current !== -1 &&
        prevIndexRef.current !== activeIndex
      ) {
        setIsSquashing(true);
        if (squashTimeoutRef.current) {
          clearTimeout(squashTimeoutRef.current);
        }
        squashTimeoutRef.current = setTimeout(() => {
          setIsSquashing(false);
        }, 280);
      }
      prevIndexRef.current = activeIndex;
    }
  };

  useLayoutEffect(() => {
    updatePill(false);
    if (typeof document !== "undefined" && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => updatePill(false));
    }
    const timer = setTimeout(() => {
      setHasInitialized(true);
      updatePill(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    updatePill(true);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(() => {
        updatePill(false);
      });
      ro.observe(containerRef.current);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, [value, options]);

  useEffect(() => {
    const handleResize = () => updatePill(false);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (squashTimeoutRef.current) {
        clearTimeout(squashTimeoutRef.current);
      }
    };
  }, [value]);

  const sizeClasses = {
    sm: "text-xs py-1 px-3 gap-1.5",
    md: "text-xs py-1.5 px-3.5 gap-2",
    lg: "text-sm py-2 px-4.5 gap-2.5",
  }[size];

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center p-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-950/80 shadow-inner select-none backdrop-blur-sm",
        className
      )}
    >
      {/* Sliding Pill */}
      <div
        className="absolute inset-y-1 left-0 rounded-full pointer-events-none border-0 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
        style={{
          left: 0,
          transition: hasInitialized
            ? "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), width 300ms cubic-bezier(0.34, 1.56, 0.64, 1)"
            : "none",
          transform: `translate3d(${pillStyle.left}px, 0, 0) ${
            isSquashing ? "scaleX(1.12) scaleY(0.92)" : "scale(1)"
          }`,
          width: `${pillStyle.width}px`,
          transformOrigin: "center center",
          willChange: "transform, width",
        }}
        aria-hidden="true"
      />

      {normalizedOptions.map((opt) => {
        const isSelected = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              if (el) buttonRefs.current[opt.id] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => {
              if (opt.id !== value && onChange) {
                onChange(opt.id);
              }
            }}
            className={cn(
              "relative z-10 rounded-full font-medium flex items-center justify-center transition-colors duration-200 cursor-pointer border-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-900",
              sizeClasses,
              isSelected
                ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            )}
          >
            {opt.icon && (
              <span
                className={cn(
                  "transition-colors shrink-0",
                  isSelected ? "text-rose-600 dark:text-rose-400" : "text-zinc-400 dark:text-zinc-500"
                )}
              >
                {opt.icon}
              </span>
            )}
            <span className="tracking-tight whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SpringSegmentedControl;
