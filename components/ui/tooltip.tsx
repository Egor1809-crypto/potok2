"use client";

import * as React from "react";
import { cn } from "./utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
  className?: string;
  contentClassName?: string;
}

const sideClasses = {
  top: "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
  right: "top-1/2 left-[calc(100%+8px)] -translate-y-1/2",
  bottom: "top-[calc(100%+8px)] left-1/2 -translate-x-1/2",
  left: "top-1/2 right-[calc(100%+8px)] -translate-y-1/2",
};

export function Tooltip({
  content,
  children,
  side = "top",
  delay = 250,
  className,
  contentClassName,
}: TooltipProps) {
  const tooltipId = React.useId();
  if (!content) return children;

  return (
    <span
      className={cn("group/tooltip relative inline-flex", className)}
      aria-describedby={tooltipId}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[180] w-max max-w-64 rounded-[7px] bg-[#22242d] px-2.5 py-1.5 text-[11px] leading-4 font-medium text-white opacity-0 shadow-[var(--shadow-md)] transition-[opacity,transform] duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          sideClasses[side],
          contentClassName,
        )}
        style={{ transitionDelay: `${delay}ms` }}
      >
        {content}
      </span>
    </span>
  );
}

export function Kbd({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex min-h-5 min-w-5 items-center justify-center rounded-[5px] border border-border-strong bg-surface-subtle px-1.5 font-sans text-[10px] leading-none font-medium text-text-muted shadow-[inset_0_-1px_0_rgb(17_24_39/0.06)]",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
