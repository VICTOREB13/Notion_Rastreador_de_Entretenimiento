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
  disabled = false,
  speed = 4,
  className,
}: ShinyTextProps) {
  const content = text || children;
  return (
    <span
      className={cn("relative inline-block", !disabled && "shiny-text-animation", className)}
      style={{ "--shiny-speed": `${speed}s` } as React.CSSProperties}
    >
      {content}
    </span>
  );
}

export default ShinyText;
