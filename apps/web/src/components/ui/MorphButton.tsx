"use client";

import React, { useState, useRef, useEffect } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function sanitizeCopyLabel(label?: string, fallback = "Copiado"): string {
  if (!label) return fallback;
  const stripped = String(label)
    .replace(/[✓✔✅☑🗸🗹√]/gu, "")
    .trim();
  if (!stripped || stripped.toLowerCase() === "folio") {
    return fallback;
  }
  return stripped;
}

function fallbackCopyText(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    textArea.style.opacity = "0";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export interface MorphButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  isSuccess?: boolean;
  successText?: string;
  icon?: React.ReactNode;
  text?: string;
  copiedText?: string;
  copyValue?: string;
  iconOnly?: boolean;
  title?: string;
  copiedTitle?: string;
  onSuccess?: (val?: string) => void;
}

export function MorphButton({
  variant = "primary",
  size = "md",
  isLoading = false,
  isSuccess: externalIsSuccess,
  successText = "Éxito",
  icon,
  text = "Copiar",
  copiedText = "Copiado",
  copyValue,
  iconOnly = false,
  title,
  copiedTitle = "¡Copiado!",
  className,
  onSuccess,
  onClick,
  children,
  ...props
}: MorphButtonProps) {
  const [internalSuccess, setInternalSuccess] = useState(false);
  const timeoutRef = useRef<any>(null);

  const isSuccess = externalIsSuccess !== undefined ? externalIsSuccess : internalSuccess;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const cleanCopiedText = sanitizeCopyLabel(copyValue ? copiedText : successText, "Copiado");
  const cleanText = text ? sanitizeCopyLabel(text, "Copiar") : "";

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isLoading || props.disabled) return;

    if (copyValue !== undefined) {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(copyValue);
        } catch {
          fallbackCopyText(copyValue);
        }
      } else {
        fallbackCopyText(copyValue);
      }

      setInternalSuccess(true);
      if (onSuccess) onSuccess(copyValue);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setInternalSuccess(false);
      }, 2000);
    }

    if (onClick) {
      await onClick(e);
    }
  };

  const variants = {
    primary:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-sm border-transparent hover:shadow-rose-500/20 active:bg-rose-700",
    secondary:
      "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700/70",
    outline:
      "bg-transparent hover:bg-zinc-100 text-zinc-800 border-zinc-300 dark:hover:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700",
    ghost:
      "bg-transparent hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 border-transparent dark:hover:bg-zinc-800/50 dark:text-zinc-300 dark:hover:text-white",
    destructive:
      "bg-rose-600 hover:bg-rose-500 text-white border-transparent",
  };

  const sizes = {
    sm: iconOnly ? "w-7 h-7 p-0" : "text-xs py-1.5 px-3 gap-1.5",
    md: iconOnly ? "w-8 h-8 p-0" : "text-xs py-2 px-4 gap-2",
    lg: iconOnly ? "w-10 h-10 p-0" : "text-sm py-2.5 px-5 gap-2.5",
  };

  const stateClasses = isSuccess
    ? "bg-emerald-600 text-white shadow-md border-transparent hover:bg-emerald-500"
    : variants[variant];

  const idleTitle =
    title ||
    (iconOnly
      ? copyValue
        ? `Copiar ${copyValue}`
        : "Copiar"
      : "Haga clic para ejecutar");
  const activeTitle = copiedTitle || "¡Completado!";
  const effectiveTitle = isSuccess ? activeTitle : idleTitle;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={effectiveTitle}
      aria-label={effectiveTitle}
      aria-live="polite"
      disabled={isLoading || props.disabled}
      className={cn(
        "relative inline-flex items-center justify-center font-medium rounded-full border transition-all duration-150 ease-out select-none cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 disabled:opacity-60 disabled:cursor-not-allowed",
        sizes[size],
        stateClasses,
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
          {!iconOnly && <span className="tracking-tight">Procesando...</span>}
        </>
      ) : isSuccess ? (
        <>
          <Check
            className="w-3.5 h-3.5 animate-bounce shrink-0"
            aria-hidden="true"
          />
          {!iconOnly && <span className="tracking-tight">{cleanCopiedText}</span>}
        </>
      ) : (
        <>
          {icon ? (
            icon
          ) : copyValue !== undefined ? (
            <Copy className="w-3.5 h-3.5 opacity-80 shrink-0" aria-hidden="true" />
          ) : null}
          {!iconOnly && (children || (cleanText && <span className="tracking-tight">{cleanText}</span>))}
        </>
      )}
    </button>
  );
}

export default MorphButton;
