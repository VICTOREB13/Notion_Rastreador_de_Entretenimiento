"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function ShinyText({
  text,
  children,
  className,
}: {
  text?: string;
  children?: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-block font-bold tracking-tight text-zinc-900 dark:text-zinc-100", className)}>
      {text || children}
    </span>
  );
}

export default ShinyText;
