import * as React from "react";
import { Inbox, LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { cn } from "./utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md";
  tone?: "primary" | "success" | "warning" | "danger";
}

const progressTones = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  size = "md",
  tone = "primary",
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...props
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const percentage = Math.max(0, Math.min(100, (value / safeMax) * 100));

  return (
    <div className={cn("grid gap-2", className)} {...props}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
          <span className="text-text-muted">{label}</span>
          {showValue && (
            <span className="tabular-nums text-text-strong">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={ariaLabel ?? label}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(safeMax, Math.max(0, value))}
        className={cn(
          "w-full overflow-hidden rounded-full bg-surface-inset",
          size === "sm" ? "h-1" : "h-1.5",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            progressTones[tone],
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <LoaderCircle
      role="status"
      aria-label={label}
      className={cn("size-4 animate-[mf-spin_700ms_linear_infinite] text-primary", className)}
    />
  );
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
}

const skeletonRadius = {
  sm: "rounded-md",
  md: "rounded-[10px]",
  lg: "rounded-[14px]",
  full: "rounded-full",
};

export function Skeleton({
  className,
  width,
  height,
  rounded = "md",
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-surface-inset before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/55 before:to-transparent before:animate-[mf-shimmer_1.5s_infinite]",
        skeletonRadius[rounded],
        className,
      )}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height={10}
          width={index === lines - 1 ? "68%" : "100%"}
          rounded="full"
        />
      ))}
    </div>
  );
}

export interface EmptyStateAction
  extends Pick<ButtonProps, "variant" | "onClick" | "disabled"> {
  label: string;
}

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
}

export function EmptyState({
  icon = <Inbox className="size-5" />,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-5 py-8" : "px-6 py-14",
        className,
      )}
      {...props}
    >
      <span className="grid size-10 place-items-center rounded-[12px] border border-border bg-surface-subtle text-text-muted shadow-[var(--shadow-xs)]">
        {icon}
      </span>
      <h3 className="mt-4 mb-0 text-[14px] font-semibold text-text-strong">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 mb-0 max-w-sm text-[12px] leading-5 text-text-muted">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant ?? "secondary"}
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              size="sm"
            >
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button
              variant={action.variant ?? "primary"}
              onClick={action.onClick}
              disabled={action.disabled}
              size="sm"
            >
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
