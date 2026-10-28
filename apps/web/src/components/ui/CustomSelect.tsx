"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
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
    .map((opt) => {
      if (typeof opt === "string" || typeof opt === "number") {
        return {
          value: opt as unknown as T,
          label: String(opt),
          icon: undefined,
          badge: undefined,
          disabled: false,
          description: undefined,
        };
      }
      return {
        value: opt.value,
        label: opt.label ?? String(opt.value),
        icon: opt.icon,
        badge: opt.badge,
        disabled: Boolean(opt.disabled),
        description: opt.description,
      };
    });
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
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  const normalizedOptions = normalizeSelectOptions(options);
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, [isOpen]);

  const findFirstEnabledIndex = (items: SelectOption<T>[]) =>
    items.findIndex((opt) => !opt.disabled);

  const findLastEnabledIndex = (items: SelectOption<T>[]) => {
    for (let i = items.length - 1; i >= 0; i--) {
      if (!items[i].disabled) return i;
    }
    return -1;
  };

  const handleToggleOpen = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
      return;
    }

    if (!isOpen) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
        const currentIdx = normalizedOptions.findIndex(
          (opt) => opt.value === value && !opt.disabled
        );
        const firstEnabled = findFirstEnabledIndex(normalizedOptions);
        setFocusedIndex(currentIdx >= 0 ? currentIdx : firstEnabled);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => {
        let next = prev + 1;
        while (next < normalizedOptions.length && normalizedOptions[next].disabled) {
          next++;
        }
        return next < normalizedOptions.length ? next : prev;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => {
        let next = prev - 1;
        while (next >= 0 && normalizedOptions[next].disabled) {
          next--;
        }
        return next >= 0 ? next : prev;
      });
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(findFirstEnabledIndex(normalizedOptions));
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIndex(findLastEnabledIndex(normalizedOptions));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
        const target = normalizedOptions[focusedIndex];
        if (!target.disabled) {
          onChange?.(target.value);
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[focusedIndex] as HTMLElement;
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusedIndex, isOpen]);

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

  const activeOptionId =
    isOpen && focusedIndex >= 0 ? `${listboxId}-option-${focusedIndex}` : undefined;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-block text-left select-none font-sans w-full",
        className,
        isOpen && "z-40"
      )}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label={ariaLabel || (typeof label === "string" ? label : placeholder)}
        className={cn(
          "w-full bg-white dark:bg-zinc-950 border text-zinc-900 dark:text-zinc-100 flex items-center justify-between transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
          sizeClasses,
          error
            ? "border-red-500 focus:border-red-500 ring-1 ring-red-500/20"
            : isOpen
            ? "border-rose-500 ring-2 ring-rose-500/20"
            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700",
          disabled && "opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900"
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {LeadingIcon && <LeadingIcon className={cn(iconSizes, "text-zinc-400 shrink-0")} />}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className={cn("truncate", !selectedOption && "text-zinc-400 dark:text-zinc-500 font-normal")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            iconSizes,
            "text-zinc-400 transition-transform duration-200 shrink-0 ml-1.5",
            isOpen && "rotate-180 text-rose-500"
          )}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={activeOptionId}
          className={cn(
            "absolute top-full mt-1.5 w-full min-w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-xl p-1.5 z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            menuClassName
          )}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500 text-center italic">
              No hay opciones disponibles
            </div>
          ) : (
            normalizedOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isFocused = idx === focusedIndex;
              const optionId = `${listboxId}-option-${idx}`;

              return (
                <div
                  key={`${String(opt.value)}-${idx}`}
                  id={optionId}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange?.(opt.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  onMouseEnter={() => {
                    if (!opt.disabled) setFocusedIndex(idx);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer",
                    opt.disabled
                      ? "opacity-40 cursor-not-allowed"
                      : isSelected
                      ? "bg-rose-500/10 dark:bg-rose-600/20 text-rose-600 dark:text-rose-400 font-semibold"
                      : isFocused
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
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
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-rose-500 font-bold shrink-0" />
                    )}
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
