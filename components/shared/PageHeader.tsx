import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/components/ui/utils";

export type PageHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
};

/**
 * Consistent product-page heading with a responsive action area. Keep dense
 * controls such as filters in a toolbar below this component.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  meta,
  action,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </div>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-[-0.035em] text-text-strong sm:text-[28px]">
            {title}
          </h1>
          {meta ? (
            <div className="text-[12px] font-medium text-text-subtle">{meta}</div>
          ) : null}
        </div>
        {description ? (
          <div className="mt-1.5 max-w-2xl text-[13px] leading-5 text-text-muted sm:text-[14px]">
            {description}
          </div>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {action}
        </div>
      ) : null}
    </div>
  );
}
