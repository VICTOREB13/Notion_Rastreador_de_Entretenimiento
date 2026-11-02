"use client";

import React, { useState, useRef, useEffect, useId, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}

export function normalizeSelectOptions<T = string>(
  options: (SelectOption<T> | string | number)[]
): SelectOption<T>[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((opt) => opt !== null && opt !== undefined)
    .map((opt) =>
      typeof opt === "object"
        ? {
            value: opt.value,
            label: opt.label ?? String(opt.value),
            icon: opt.icon,
            badge: opt.badge,
            disabled: Boolean(opt.disabled),
            description: opt.description,
          }
        : { value: opt as unknown as T, label: String(opt), disabled: false }
    );
}

export interface CustomSelectProps<T = string> {
  value?: T;
  onChange?: (value: T) => void;
  options?: (SelectOption<T> | string | number)[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  icon?: React.ComponentType<{ className?: string }>;
  align?: "left" | "right" | "auto";
  label?: string;
  ariaLabel?: string;
  error?: string | boolean;
  menuClassName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  active?: boolean;
}

export function CustomSelect<T = string>({
  value,
  onChange,
  options = [],
  placeholder = "Seleccionar...",
  disabled = false,
  className,
  size = "md",
  icon: LeadingIcon,
  align = "auto",
  label,
  ariaLabel,
  error,
  menuClassName,
  searchable = false,
  searchPlaceholder,
  active,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const normalizedOptions = useMemo(() => normalizeSelectOptions(options), [options]);
  const selectedOption = useMemo(
    () => normalizedOptions.find((opt) => opt.value === value),
    [normalizedOptions, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        String(opt.value).toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchable, searchQuery]);

  const isEffectivelyActive =
    active !== undefined
      ? active
      : value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== "ALL" &&
        value !== "all";

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: "h-8 px-2.5 text-xs rounded-xl gap-1.5",
    md: "h-9 px-3 text-xs font-semibold rounded-xl gap-2",
    lg: "h-11 px-4 text-sm font-semibold rounded-2xl gap-2.5",
  }[size];

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  }[size];

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left select-none font-sans w-full", className, isOpen && "z-40")}
      onKeyDown={(e) => {
        if (e.key === "Escape" && isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
      }}
    >
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => {
              if (prev) setSearchQuery("");
              return !prev;
            });
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || (typeof label === "string" ? label : placeholder)}
        className={cn(
          "w-full bg-white dark:bg-zinc-950 border text-zinc-900 dark:text-zinc-100 flex items-center justify-between transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
          sizeClasses,
          error
            ? "border-red-500 ring-1 ring-red-500/20"
            : isOpen
            ? "border-rose-500 ring-2 ring-rose-500/20"
            : isEffectivelyActive
            ? "border-rose-500/50 bg-rose-500/5 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold ring-1 ring-rose-500/20"
            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700",
          disabled && "opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900"
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {LeadingIcon && (
            <LeadingIcon
              className={cn(
                iconSizes,
                isEffectivelyActive ? "text-rose-500" : "text-zinc-400",
                "shrink-0"
              )}
            />
          )}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span
            className={cn(
              "truncate",
              !selectedOption && "text-zinc-400 dark:text-zinc-500 font-normal",
              isEffectivelyActive && "font-semibold text-rose-600 dark:text-rose-400"
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0",
                isEffectivelyActive
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-300"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              )}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            iconSizes,
            "text-zinc-400 transition-transform duration-200 shrink-0 ml-1.5",
            isOpen && "rotate-180 text-rose-500",
            !isOpen && isEffectivelyActive && "text-rose-500/80"
          )}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          data-lenis-prevent
          className={cn(
            "absolute top-full mt-1.5 w-full min-w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-xl p-1.5 z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            menuClassName
          )}
        >
          {searchable && (
            <div className="p-1 pb-1.5 border-b border-zinc-200/80 dark:border-zinc-800/80 sticky top-0 bg-white dark:bg-zinc-900 z-10 mb-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder || "Filtrar opciones..."}
                  className="w-full pl-7 pr-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-transparent focus:border-rose-500/50 focus:outline-hidden text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsOpen(false);
                      setSearchQuery("");
                      return;
                    }
                    e.stopPropagation();
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500 text-center italic">
              No hay opciones disponibles
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={`${String(opt.value)}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange?.(opt.value);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer",
                    opt.disabled
                      ? "opacity-40 cursor-not-allowed"
                      : isSelected
                      ? "bg-rose-500/10 dark:bg-rose-600/20 text-rose-600 dark:text-rose-400 font-semibold"
                      : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="truncate">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {opt.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-rose-500 font-bold shrink-0" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {error && typeof error === "string" && (
        <p className="mt-1 text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}

export default CustomSelect;
