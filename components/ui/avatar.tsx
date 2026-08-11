"use client";

import * as React from "react";
import { cn, getInitials } from "./utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[10px]",
  md: "size-9 text-[11px]",
  lg: "size-11 text-[13px]",
  xl: "size-14 text-[16px]",
};

const statusLabels = {
  online: "В сети",
  away: "Отошёл",
  offline: "Не в сети",
} as const;

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string | null;
  alt?: string;
  size?: AvatarSize;
  status?: "online" | "away" | "offline";
}

export function Avatar({
  name,
  src,
  alt,
  size = "md",
  status,
  className,
  ...props
}: AvatarProps) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-visible rounded-full bg-primary-subtle font-semibold text-primary ring-1 ring-border",
        sizeClasses[size],
        className,
      )}
      aria-label={alt ?? name}
      role="img"
      {...props}
    >
      {showImage ? (
        // A plain img keeps this primitive compatible with remote mock avatars.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          className="size-full rounded-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
      {status && (
        <span
          aria-label={statusLabels[status]}
          className={cn(
            "absolute right-0 bottom-0 size-[27%] min-h-2 min-w-2 rounded-full ring-2 ring-surface",
            status === "online" && "bg-success",
            status === "away" && "bg-warning",
            status === "offline" && "bg-text-subtle",
          )}
        />
      )}
    </span>
  );
}

export function AvatarGroup({
  children,
  className,
  max,
  total,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  total?: number;
}) {
  const avatars = React.Children.toArray(children);
  const visible = max ? avatars.slice(0, max) : avatars;
  const overflow = Math.max(0, (total ?? avatars.length) - visible.length);

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible}
      {overflow > 0 && (
        <span className="relative inline-grid size-9 shrink-0 place-items-center rounded-full bg-surface-subtle text-[10px] font-semibold text-text-muted ring-2 ring-surface">
          +{overflow}
        </span>
      )}
    </div>
  );
}
