import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "./utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const alertConfig = {
  info: {
    icon: Info,
    classes: "border-info/15 bg-info-subtle text-info",
  },
  success: {
    icon: CheckCircle2,
    classes: "border-success/15 bg-success-subtle text-success",
  },
  warning: {
    icon: AlertTriangle,
    classes: "border-warning/15 bg-warning-subtle text-warning",
  },
  danger: {
    icon: AlertCircle,
    classes: "border-danger/15 bg-danger-subtle text-danger",
  },
};

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: React.ReactNode;
  icon?: React.ReactNode;
}

export function Alert({
  tone = "info",
  title,
  icon,
  children,
  className,
  ...props
}: AlertProps) {
  const config = alertConfig[tone];
  const Icon = config.icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-[11px] border p-3.5",
        config.classes,
        className,
      )}
      {...props}
    >
      <span className="mt-0.5 shrink-0">
        {icon ?? <Icon aria-hidden="true" className="size-4" />}
      </span>
      <div className="min-w-0 text-text">
        {title && (
          <p className="m-0 text-[12px] leading-5 font-semibold text-text-strong">
            {title}
          </p>
        )}
        <div className={cn("text-[12px] leading-5", Boolean(title) && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}
