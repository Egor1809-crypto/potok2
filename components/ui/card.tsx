import * as React from "react";
import { cn } from "./utils";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Card({ className, ...props }, ref) {
  return <div ref={ref} className={cn("card", className)} {...props} />;
});

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 px-5 pt-5 sm:px-6 sm:pt-6", className)}
      {...props}
    />
  );
});

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, children, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn(
        "m-0 text-[15px] leading-5 font-semibold tracking-[-0.012em] text-text-strong",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn("m-0 text-[13px] leading-5 text-text-muted", className)}
      {...props}
    />
  );
});

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardContent({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn("px-5 py-5 sm:px-6 sm:py-6", className)} {...props} />
  );
});

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 border-t border-border px-5 py-4 sm:px-6",
        className,
      )}
      {...props}
    />
  );
});

export function MetricCard({
  label,
  value,
  change,
  positive = true,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  change?: React.ReactNode;
  positive?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <p className="m-0 text-[13px] font-medium text-text-muted">{label}</p>
        {icon && (
          <span className="grid size-8 place-items-center rounded-[9px] bg-surface-subtle text-text-muted">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="m-0 text-[26px] leading-none font-semibold tracking-[-0.035em] text-text-strong">
          {value}
        </p>
        {change && (
          <span
            className={cn(
              "text-[11px] font-semibold",
              positive ? "text-success" : "text-danger",
            )}
          >
            {change}
          </span>
        )}
      </div>
    </Card>
  );
}
