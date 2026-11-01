"use client";

import { useEffect } from "react";

export interface KeyboardShortcutsHandlers {
  onSearchFocus?: () => void;
  onEscape?: () => void;
  onToggleTheme?: () => void;
  enabled?: boolean;
}

/**
 * Determina si el evento ocurrió dentro de un elemento interactivo editable
 * (input, textarea, select o contentEditable).
 * Es seguro en entornos SSR y tests de Node/Bun (sin global Element).
 */
export function isInteractiveElement(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
    closest?: (selector: string) => unknown;
  };

  if (typeof el.tagName === "string") {
    const tagName = el.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return true;
    }
  }

  if (Boolean(el.isContentEditable)) {
    return true;
  }

  if (typeof el.closest === "function") {
    try {
      if (
        el.closest(
          "input, textarea, select, [contenteditable='true'], [contenteditable=''], [contenteditable='plaintext-only']"
        )
      ) {
        return true;
      }
    } catch {
      // Ignorar selectores no soportados en mocks de test
    }
  }

  return false;
}

/**
 * Hook de atajos de teclado globales:
 * - '/' o 'Ctrl+K' / 'Cmd+K': enfoca la barra de búsqueda y previene el scroll/navegación default.
 * - 'Escape': cierra modales o deselecciona.
 * - 'T' o 't': conmuta el tema visual dark/light.
 * - Respeta elementos de texto editables para no interferir con la escritura del usuario.
 */
export function useKeyboardShortcuts({
  onSearchFocus,
  onEscape,
  onToggleTheme,
  enabled = true,
}: KeyboardShortcutsHandlers) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = typeof document !== "undefined" ? document.activeElement : null;
      const isTargetInteractive = isInteractiveElement(e.target) || isInteractiveElement(activeEl);

      // Regla: Escape siempre se procesa para deseleccionar o cerrar modales
      if (e.key === "Escape") {
        onEscape?.();
        if (activeEl instanceof HTMLElement) {
          activeEl.blur();
        }
        return;
      }

      // Si el usuario está escribiendo en un input, textarea, select o contentEditable, ignorar atajos alfanuméricos
      if (isTargetInteractive) {
        return;
      }

      // Atajo de Búsqueda: '/' directo o 'Ctrl+K' / 'Cmd+K' (sin Alt para no colisionar con combinaciones AltGr)
      const isSearchKey =
        (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.altKey);

      if (isSearchKey) {
        e.preventDefault();
        onSearchFocus?.();
        return;
      }

      // Atajo de Tema: 'T' o 't' (sin modificadores Ctrl/Cmd/Alt)
      if ((e.key === "t" || e.key === "T") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onToggleTheme?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearchFocus, onEscape, onToggleTheme, enabled]);
}

export default useKeyboardShortcuts;
