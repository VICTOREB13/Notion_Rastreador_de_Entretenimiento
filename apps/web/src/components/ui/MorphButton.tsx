"use client";

import React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function sanitizeCopyLabel(label?: string, fallback = "Copiado"): string {
  if (!label) return fallback;
  const stripped = String(label)
    .replace(/[✓✔✅☑🗸🗹√]/gu, "")
    .trim();
  if (!stripped || stripped.toLowerCase() === "folio") return fallback;
  return stripped;
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
}

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
  sm: "text-xs py-1.5 px-3 gap-1.5",
  md: "text-xs py-2 px-4 gap-2",
  lg: "text-sm py-2.5 px-5 gap-2.5",
};

export function MorphButton({
  variant = "primary",
  size = "md",
  isLoading = false,
  isSuccess = false,
  successText = "¡Sincronizado!",
  icon,
  text,
  iconOnly = false,
  className,
  children,
  disabled,
  onClick,
  ...props
}: MorphButtonProps) {
  const displayLabel = isSuccess ? successText : text;

  return (
    <button
      type="button"
      disabled={isLoading || disabled}
      onClick={onClick}
      aria-live="polite"
      className={cn(
        "relative inline-flex items-center justify-center font-medium rounded-full border transition-all duration-150 ease-out select-none cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 disabled:opacity-60 disabled:cursor-not-allowed",
        sizes[size],
        isSuccess
          ? "bg-emerald-600 text-white shadow-md border-transparent hover:bg-emerald-500"
          : variants[variant],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
          {!iconOnly && <span className="tracking-tight">Sincronizando...</span>}
        </>
      ) : isSuccess ? (
        <>
          <Check className="w-3.5 h-3.5 animate-bounce shrink-0" aria-hidden="true" />
          {!iconOnly && <span className="tracking-tight">{displayLabel}</span>}
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {!iconOnly && (children || (displayLabel && <span className="tracking-tight">{displayLabel}</span>))}
        </>
      )}
    </button>
  );
}

export default MorphButton;
