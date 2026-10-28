import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases condicionales con resolución de conflictos Tailwind v4.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formatea horas a formato legible (ej. "45.2 hrs" o "2h 30m").
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "0 hrs";
  return `${Number(hours).toFixed(1)} hrs`;
}

/**
 * Formatea minutos a horas y minutos legibles.
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
