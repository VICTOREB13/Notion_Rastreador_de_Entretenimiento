"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ShinyTextProps {
  text?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export function ShinyText({
  text,
  children,
  className,
}: ShinyTextProps) {
  return (
    <span className={cn("inline-block font-bold tracking-tight text-zinc-900 dark:text-zinc-100", className)}>
      {text || children}
    </span>
  );
}

export default ShinyText;
