import * as React from "react";
import { cn } from "./utils";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "",
  accent: "badge-accent",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  outline: "badge-outline",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  className,
  variant = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn("badge", variantClasses[variant], className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current opacity-80"
        />
      )}
      {children}
    </span>
  );
}

export type StatusTone = "active" | "draft" | "scheduled" | "sending" | "error";

const statusConfig: Record<StatusTone, { label: string; variant: BadgeVariant }> = {
  active: { label: "Активна", variant: "success" },
  draft: { label: "Черновик", variant: "neutral" },
  scheduled: { label: "Запланирована", variant: "info" },
  sending: { label: "Отправляется", variant: "accent" },
  error: { label: "Требуется действие", variant: "danger" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusTone;
  label?: string;
  className?: string;
}) {
  const config = statusConfig[status];
  return (
    <Badge className={className} variant={config.variant} dot>
      {label ?? config.label}
    </Badge>
  );
}
