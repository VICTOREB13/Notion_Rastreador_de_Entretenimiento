"use client";

import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

export interface CountUpProps {
  to: number | string;
  from?: number;
  duration?: number;
  delay?: number;
  separator?: string;
  decimalSeparator?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  formatter?: (value: number) => string;
  className?: string;
}

export function CountUp({
  to,
  from = 0,
  duration = 1.2,
  delay = 0,
  separator = ".",
  decimalSeparator = ",",
  decimals = 0,
  prefix = "",
  suffix = "",
  formatter,
  className,
}: CountUpProps) {
  const parseTarget = (val: number | string): number => {
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).trim();
    if (/\d+\.\d{3}(,\d+)?$/.test(str)) {
      const normalized = str.replace(/[^0-9,-]/g, "").replace(",", ".");
      const parsed = parseFloat(normalized);
      return isNaN(parsed) ? 0 : parsed;
    }
    const normalized = str.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const numericTarget = parseTarget(to);
  const [count, setCount] = useState<number>(from);
  const prevTargetRef = useRef<number>(from);
  const isReducedMotion = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      isReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    if (isReducedMotion.current) {
      setCount(numericTarget);
      prevTargetRef.current = numericTarget;
      return;
    }

    const startVal = prevTargetRef.current;
    let startTime: number | null = null;
    let animationFrame: number;
    let delayTimer: any;

    const runAnimation = () => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const currentVal = startVal + (numericTarget - startVal) * ease;
        setCount(currentVal);

        if (progress < 1) {
          animationFrame = requestAnimationFrame(step);
        } else {
          setCount(numericTarget);
          prevTargetRef.current = numericTarget;
        }
      };

      animationFrame = requestAnimationFrame(step);
    };

    if (delay > 0) {
      delayTimer = setTimeout(runAnimation, delay * 1000);
    } else {
      runAnimation();
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [numericTarget, duration, delay]);

  const formatNumber = (num: number): string => {
    if (formatter) {
      return formatter(num);
    }
    const fixed = Number(num).toFixed(decimals);
    const [intPart, decPart] = fixed.split(".");
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return decPart !== undefined && decimals > 0
      ? `${formattedInt}${decimalSeparator}${decPart}`
      : formattedInt;
  };

  const finalFormatted = `${prefix}${formatNumber(numericTarget)}${suffix}`;

  return (
    <span
      className={cn("tabular-nums font-mono", className)}
      title={finalFormatted}
      aria-label={finalFormatted}
    >
      {prefix}
      {formatNumber(count)}
      {suffix}
    </span>
  );
}

export default CountUp;
