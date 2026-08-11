import { useId, type ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";

export type ChartLegendItem = {
  label: string;
  color?: string;
  className?: string;
};

export type ChartShellProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  legend?: ChartLegendItem[];
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  chartClassName?: string;
};

/** A neutral, accessible frame for Recharts and product-native visualizations. */
export function ChartShell({
  title,
  description,
  action,
  legend,
  children,
  footer,
  className,
  contentClassName,
  chartClassName,
}: ChartShellProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn("min-w-0 overflow-hidden", className)}
    >
      <CardHeader className="gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="m-0 text-[15px] leading-5 font-semibold tracking-[-0.015em] text-text-strong"
          >
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="m-0 mt-1 text-[12px] leading-5 text-text-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn("p-4 sm:p-5 lg:p-6", contentClassName)}>
        {legend?.length ? <ChartLegend items={legend} className="mb-5" /> : null}
        <div className={cn("min-h-64 w-full", chartClassName)}>{children}</div>
      </CardContent>
      {footer ? (
        <div className="border-t border-border/70 px-5 py-3 text-[11px] text-text-muted sm:px-6">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}

export function ChartLegend({
  items,
  className,
}: {
  items: ChartLegendItem[];
  className?: string;
}) {
  return (
    <ul
      aria-label="Легенда графика"
      className={cn("m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0", className)}
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-[11px] font-medium text-text-muted">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full bg-primary", item.className)}
            style={item.color ? { backgroundColor: item.color } : undefined}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
