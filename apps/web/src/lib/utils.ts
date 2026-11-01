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

/**
 * Formatea una fecha ISO o string (YYYY-MM-DD) a formato legible en español (ej. "15 may 2024").
 * Devuelve un string vacío si la fecha es nula, indefinida, inválida o está vacía.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString || typeof dateString !== "string") return "";
  const trimmed = dateString.trim();
  if (!trimmed) return "";

  try {
    const raw = trimmed.split("T")[0];
    const parts = raw.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      if (
        !isNaN(year) &&
        !isNaN(month) &&
        !isNaN(day) &&
        year >= 1900 &&
        year <= 2200 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      ) {
        const date = new Date(Date.UTC(year, month - 1, day));
        // Validar que la fecha no se haya desbordado (ej. 31 de febrero o 29 de feb en año no bisiesto)
        if (
          date.getUTCFullYear() === year &&
          date.getUTCMonth() === month - 1 &&
          date.getUTCDate() === day
        ) {
          return date.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          });
        }
      }
      return "";
    }

    const fallbackDate = new Date(trimmed);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    return "";
  } catch {
    return "";
  }
}

