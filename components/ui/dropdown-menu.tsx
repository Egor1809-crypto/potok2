"use client";

import * as React from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "./utils";

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  focusItem: (position: "first" | "last") => void;
  focusTrigger: () => void;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdown(): DropdownContextValue {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used inside <DropdownMenu>.");
  }
  return context;
}

export interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function DropdownMenu({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const contentId = React.useId();

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  const focusItem = React.useCallback((position: "first" | "last") => {
    const items = rootRef.current?.querySelectorAll<HTMLElement>(
      '[role^="menuitem"]:not([aria-disabled="true"])',
    );
    if (!items?.length) return;
    items[position === "first" ? 0 : items.length - 1]?.focus();
  }, []);

  const focusTrigger = React.useCallback(() => {
    rootRef.current
      ?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
      ?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(focusTrigger);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [focusTrigger, open, setOpen]);

  return (
    <DropdownContext.Provider
      value={{ open, setOpen, contentId, focusItem, focusTrigger }}
    >
      <div ref={rootRef} className={cn("relative inline-flex", className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuTriggerProps
>(function DropdownMenuTrigger(
  { asChild = false, children, className, onClick, onKeyDown, ...props },
  ref,
) {
  const context = useDropdown();

  const handleClick: React.MouseEventHandler = (event) => {
    context.setOpen(!context.open);
    onClick?.(event as React.MouseEvent<HTMLButtonElement>);
  };

  const handleKeyDown: React.KeyboardEventHandler = (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!context.open) context.setOpen(true);
      window.requestAnimationFrame(() => {
        context.focusItem(event.key === "ArrowUp" ? "last" : "first");
      });
    }
    onKeyDown?.(event as React.KeyboardEvent<HTMLButtonElement>);
  };

  const sharedProps = {
    "aria-haspopup": "menu" as const,
    "aria-expanded": context.open,
    "aria-controls": context.contentId,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      className?: string;
      onClick?: React.MouseEventHandler;
      onKeyDown?: React.KeyboardEventHandler;
    }>;
    return React.cloneElement(child, {
      ...sharedProps,
      className: cn(child.props.className, className),
      onClick: (event: React.MouseEvent) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) handleClick(event);
      },
      onKeyDown: (event: React.KeyboardEvent) => {
        child.props.onKeyDown?.(event);
        if (!event.defaultPrevented) handleKeyDown(event);
      },
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      {...sharedProps}
      {...props}
    >
      {children}
    </button>
  );
});

export interface DropdownMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  sideOffset?: number;
  minWidth?: number | string;
}

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(function DropdownMenuContent(
  {
    align = "start",
    side = "bottom",
    sideOffset = 6,
    minWidth = 196,
    className,
    style,
    children,
    onKeyDown,
    ...props
  },
  forwardedRef,
) {
  const context = useDropdown();
  if (!context.open) return null;

  const alignmentClass =
    align === "end"
      ? "right-0"
      : align === "center"
        ? "left-1/2 -translate-x-1/2"
        : "left-0";

  return (
    <div
      ref={forwardedRef}
      id={context.contentId}
      role="menu"
      tabIndex={-1}
      className={cn(
        "absolute z-[130] max-h-[min(360px,calc(100vh-80px))] overflow-y-auto rounded-[11px] border border-border bg-surface-raised p-1.5 shadow-[var(--shadow-md)] outline-none animate-[mf-slide-up_180ms_var(--ease-out)]",
        side === "bottom" ? "top-full" : "bottom-full",
        alignmentClass,
        className,
      )}
      style={{
        minWidth,
        ...(side === "bottom" ? { marginTop: sideOffset } : { marginBottom: sideOffset }),
        ...style,
      }}
      onKeyDown={(event) => {
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            '[role^="menuitem"]:not([aria-disabled="true"])',
          ),
        );
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          items[(currentIndex + 1) % items.length]?.focus();
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          items[(currentIndex - 1 + items.length) % items.length]?.focus();
        }
        if (event.key === "Home") {
          event.preventDefault();
          items[0]?.focus();
        }
        if (event.key === "End") {
          event.preventDefault();
          items[items.length - 1]?.focus();
        }
        onKeyDown?.(event);
      }}
      {...props}
    >
      {children}
    </div>
  );
});

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
  destructive?: boolean;
  closeOnSelect?: boolean;
  onSelect?: () => void;
}

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuItemProps
>(function DropdownMenuItem(
  {
    inset,
    destructive,
    closeOnSelect = true,
    onSelect,
    onClick,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  const context = useDropdown();
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      className={cn(
        "flex min-h-8 w-full items-center gap-2 rounded-[7px] px-2.5 text-left text-[12px] font-medium text-text transition-colors hover:bg-surface-subtle hover:text-text-strong focus:bg-surface-subtle focus:text-text-strong focus:outline-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:shrink-0",
        inset && "pl-8",
        destructive && "text-danger hover:bg-danger-subtle hover:text-danger focus:bg-danger-subtle focus:text-danger",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        onSelect?.();
        if (closeOnSelect) {
          context.setOpen(false);
          window.requestAnimationFrame(context.focusTrigger);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
});

export interface DropdownMenuCheckboxItemProps
  extends Omit<DropdownMenuItemProps, "onSelect"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuCheckboxItemProps
>(function DropdownMenuCheckboxItem(
  { checked, onCheckedChange, children, className, ...props },
  ref,
) {
  return (
    <DropdownMenuItem
      ref={ref}
      role="menuitemcheckbox"
      aria-checked={checked}
      closeOnSelect={false}
      className={cn("relative pl-8", className)}
      onSelect={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className="absolute left-2.5 grid size-4 place-items-center">
        {checked && <Check aria-hidden="true" className="size-3.5 text-primary" />}
      </span>
      {children}
    </DropdownMenuItem>
  );
});

export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        "px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.055em] text-text-subtle uppercase",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn("-mx-1.5 my-1 h-px bg-border", className)} {...props} />;
}

export function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto pl-4 text-[10px] tracking-wide text-text-subtle", className)}
      {...props}
    />
  );
}

export function DropdownMenuSubIndicator() {
  return <ChevronRight aria-hidden="true" className="ml-auto size-3.5 text-text-subtle" />;
}
