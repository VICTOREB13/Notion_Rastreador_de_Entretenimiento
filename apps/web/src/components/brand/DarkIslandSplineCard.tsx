"use client";

import React, { useState, useMemo, useId } from "react";
import { TrendingUp, Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SplineDataPoint {
  label: string;
  value: number;
}

export interface DarkIslandSplineCardProps {
  title?: string;
  totalHours?: number;
  streakDays?: number;
  dataPoints?: SplineDataPoint[];
  timeRange?: "7D" | "30D" | "90D";
  onTimeRangeChange?: (range: "7D" | "30D" | "90D") => void;
  className?: string;
}

const defaultPoints: SplineDataPoint[] = [
  { label: "Lun", value: 1.5 },
  { label: "Mar", value: 2.8 },
  { label: "Mié", value: 0.5 },
  { label: "Jue", value: 3.2 },
  { label: "Vie", value: 4.5 },
  { label: "Sáb", value: 6.0 },
  { label: "Dom", value: 4.0 },
];

export function DarkIslandSplineCard({
  title = "Ritmo de Juego & Series de Tiempo",
  totalHours = 22.5,
  streakDays = 5,
  dataPoints = defaultPoints,
  timeRange = "30D",
  onTimeRangeChange,
  className,
}: DarkIslandSplineCardProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const strokeGradId = `${uid}-splineStroke`;
  const areaGradId = `${uid}-splineArea`;
  const glowFilterId = `${uid}-splineGlow`;

  const safeData = useMemo(() => {
    if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
      return defaultPoints;
    }
    return dataPoints;
  }, [dataPoints]);

  const { points, splinePath, areaPath, width, height, padX, padY } = useMemo(() => {
    const w = 500;
    const h = 180;
    const px = 24;
    const py = 24;

    const values = safeData.map((d) => Number(d?.value) || 0);
    const min = 0;
    const max = values.length > 0 ? Math.max(...values, 1) : 5;
    const range = max - min || 1;

    if (safeData.length === 1) {
      const d = safeData[0];
      const val = Number(d?.value) || 0;
      const y = h - py - ((val - min) / range) * (h - 2 * py);
      const pt = { x: w / 2, y, label: d?.label || "", value: val };
      const sp = `M ${px} ${y.toFixed(1)} L ${(w - px).toFixed(1)} ${y.toFixed(1)}`;
      const ap = `${sp} L ${(w - px).toFixed(1)} ${h - py} L ${px} ${h - py} Z`;

      return {
        points: [pt],
        splinePath: sp,
        areaPath: ap,
        width: w,
        height: h,
        padX: px,
        padY: py,
      };
    }

    const denom = safeData.length > 1 ? safeData.length - 1 : 1;
    const mapped = safeData.map((d, i) => {
      const x = px + (i / denom) * (w - 2 * px);
      const y = h - py - (((Number(d?.value) || 0) - min) / range) * (h - 2 * py);
      return { x, y, label: d?.label || "", value: Number(d?.value) || 0 };
    });

    let sp = `M ${mapped[0].x} ${mapped[0].y}`;
    for (let i = 0; i < mapped.length - 1; i++) {
      const p0 = mapped[i === 0 ? 0 : i - 1];
      const p1 = mapped[i];
      const p2 = mapped[i + 1];
      const p3 = mapped[i + 2 >= mapped.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      sp += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const last = mapped[mapped.length - 1];
    const first = mapped[0];
    const ap = `${sp} L ${last.x} ${h - py} L ${first.x} ${h - py} Z`;

    return {
      points: mapped,
      splinePath: sp,
      areaPath: ap,
      width: w,
      height: h,
      padX: px,
      padY: py,
    };
  }, [safeData]);

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div
      className={cn(
        "bg-[#111113] text-zinc-100 rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-hover border border-white/10 relative overflow-hidden transition-all duration-300",
        className
      )}
    >
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
              {title}
            </span>
            {streakDays > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                <Flame className="w-3 h-3 text-amber-400" />
                {streakDays} días racha
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold font-display tabular-nums text-zinc-100 tracking-tight">
              {totalHours.toFixed(1)} hrs
            </span>
            <span className="text-xs text-zinc-400 font-medium">en el periodo</span>
          </div>
        </div>

        {onTimeRangeChange && (
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-full border border-white/10 shrink-0 self-start sm:self-auto">
            {(["7D", "30D", "90D"] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => onTimeRangeChange(range)}
                className={cn(
                  "px-3 py-1 text-xs font-mono font-bold rounded-full transition-all cursor-pointer",
                  timeRange === range
                    ? "bg-white/10 text-white shadow-xs border border-white/10"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {range}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative mt-4 select-none">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id={strokeGradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#71717A" />
              <stop offset="60%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>

            <linearGradient id={areaGradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
            </linearGradient>

            <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line
            x1={padX}
            y1={padY}
            x2={width - padX}
            y2={padY}
            stroke="currentColor"
            strokeDasharray="3 3"
            strokeWidth="1"
            className="text-zinc-800"
          />
          <line
            x1={padX}
            y1={height / 2}
            x2={width - padX}
            y2={height / 2}
            stroke="currentColor"
            strokeDasharray="3 3"
            strokeWidth="1"
            className="text-zinc-800"
          />

          <path d={areaPath} fill={`url(#${areaGradId})`} />

          <path
            d={splinePath}
            fill="none"
            stroke={`url(#${strokeGradId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            filter={`url(#${glowFilterId})`}
          />

          {points.map((pt, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={`pt-${i}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 3.5}
                  fill={isHovered ? "#FFFFFF" : "#EF4444"}
                  stroke="currentColor"
                  strokeWidth="2"
                  className={cn(
                    "transition-all duration-200",
                    isHovered ? "text-rose-600" : "text-[#09090B]"
                  )}
                />
              </g>
            );
          })}
        </svg>

        {activePoint && (
          <div
            className="absolute pointer-events-none transition-all duration-150 transform -translate-x-1/2 -top-1"
            style={{ left: `${(activePoint.x / width) * 100}%` }}
          >
            <div className="bg-zinc-900 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded shadow-lg border border-zinc-700 whitespace-nowrap">
              {activePoint.label}: {activePoint.value.toFixed(1)} hrs
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mt-2 px-1">
        {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 7)) === 0).map((pt, i) => (
          <span key={i} className="truncate max-w-[60px] text-center">
            {pt.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default DarkIslandSplineCard;
