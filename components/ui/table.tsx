import * as React from "react";
import { cn } from "./utils";

/* eslint-disable react/prop-types */

export const TableContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function TableContainer({ className, children, ...props }, ref) {
  return (
    <div ref={ref} className={cn("table-shell", className)} {...props}>
      <div className="table-scroll scrollbar-subtle">{children}</div>
    </div>
  );
});

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(function Table({ className, ...props }, ref) {
  return <table ref={ref} className={cn("data-table", className)} {...props} />;
});

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={cn(className)} {...props} />;
});

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn(className)} {...props} />;
});

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn("border-t border-border bg-surface-subtle font-medium", className)}
      {...props}
    />
  );
});

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  interactive?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  function TableRow(
    { className, selected, interactive, tabIndex, ...props },
    ref,
  ) {
    return (
      <tr
        ref={ref}
        data-selected={selected || undefined}
        tabIndex={interactive ? (tabIndex ?? 0) : tabIndex}
        className={cn(
          interactive &&
            "cursor-pointer outline-none focus-visible:bg-primary-subtle/50 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-inset",
          className,
        )}
        {...props}
      />
    );
  },
);

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function TableHead({ className, scope = "col", ...props }, ref) {
  return <th ref={ref} scope={scope} className={cn(className)} {...props} />;
});

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn(className)} {...props} />;
});

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn("p-4 text-left text-[12px] text-text-muted", className)}
      {...props}
    />
  );
});

export function TableEmpty({
  colSpan,
  children,
  className,
}: {
  colSpan: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableRow className="hover:!bg-transparent">
      <TableCell colSpan={colSpan} className={cn("!h-auto !p-0", className)}>
        {children}
      </TableCell>
    </TableRow>
  );
}

export function SortableTableHead({
  active,
  direction,
  onSort,
  children,
  className,
}: {
  active?: boolean;
  direction?: "asc" | "desc";
  onSort: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead
      aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "-ml-1 inline-flex h-7 items-center gap-1 rounded-md px-1 text-inherit transition-colors hover:bg-surface-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          active && "text-primary",
        )}
      >
        {children}
        <span aria-hidden="true" className="text-[9px] leading-none">
          {active ? (direction === "desc" ? "▼" : "▲") : "↕"}
        </span>
      </button>
    </TableHead>
  );
}

export function TablePagination({
  page,
  pageCount,
  onPageChange,
  totalLabel,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalLabel?: React.ReactNode;
  className?: string;
}) {
  const safePageCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safePageCount);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-[12px] text-text-muted",
        className,
      )}
    >
      <span>{totalLabel}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </button>
        <span className="min-w-20 text-center tabular-nums">
          {safePage} of {safePageCount}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={safePage >= safePageCount}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
