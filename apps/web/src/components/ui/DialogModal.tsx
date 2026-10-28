"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

let modalIdCounter = 0;
const modalStack: number[] = [];

function lockBodyScroll() {
  if (modalStack.length === 1 && typeof document !== "undefined") {
    document.body.style.overflow = "hidden";
  }
}

function unlockBodyScroll() {
  if (modalStack.length === 0 && typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
}

export interface DialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  maxWidth?: string;
  preventBackdropClose?: boolean;
  className?: string;
}

export function DialogModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-2xl",
  preventBackdropClose = false,
  className,
}: DialogModalProps) {
  const [mounted, setMounted] = useState(false);
  const modalIdRef = useRef<number | null>(null);

  if (modalIdRef.current === null) {
    modalIdRef.current = ++modalIdCounter;
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const modalId = modalIdRef.current!;
    modalStack.push(modalId);
    lockBodyScroll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const topModalId = modalStack[modalStack.length - 1];
        if (topModalId === modalId && !preventBackdropClose) {
          onClose?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      const idx = modalStack.lastIndexOf(modalId);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
      }
      unlockBodyScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, preventBackdropClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (!preventBackdropClose) {
      onClose?.();
    }
  };

  if (!isOpen || !mounted) return null;

  const stackIndex = Math.max(0, modalStack.indexOf(modalIdRef.current!));
  const dynamicZIndex = 100 + stackIndex * 10;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      style={{ zIndex: dynamicZIndex }}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-modal-title" : undefined}
        className={cn(
          "w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 max-h-[88vh] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200",
          maxWidth,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-zinc-50/80 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-800 px-6 py-5 flex items-start justify-between gap-4 shrink-0">
          <div>
            {title && (
              <h3 id="dialog-modal-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-rose-500/10 hover:rotate-90 active:scale-90 transition-all duration-200 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar text-zinc-800 dark:text-zinc-200">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DialogModal;
