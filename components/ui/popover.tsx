"use client";

import * as React from "react";
import { cn } from "./utils";

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  rootRef: React.RefObject<HTMLDivElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopover() {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error("Popover components must be used inside <Popover>.");
  return context;
}

export function Popover({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
}: {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
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

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider value={{ open, setOpen, contentId, rootRef }}>
      <div ref={rootRef} className={cn("relative inline-flex", className)}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export interface PopoverTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function PopoverTrigger({
  asChild,
  children,
  onClick,
  className,
  ...props
}: PopoverTriggerProps) {
  const context = usePopover();
  const handleClick: React.MouseEventHandler = (event) => {
    context.setOpen(!context.open);
    onClick?.(event as React.MouseEvent<HTMLButtonElement>);
  };
  const shared = {
    "aria-expanded": context.open,
    "aria-controls": context.contentId,
    onClick: handleClick,
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      className?: string;
      onClick?: React.MouseEventHandler;
    }>;
    return React.cloneElement(child, {
      ...shared,
      className: cn(child.props.className, className),
      onClick: (event: React.MouseEvent) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) handleClick(event);
      },
    });
  }

  return (
    <button type="button" className={className} {...shared} {...props}>
      {children}
    </button>
  );
}

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  sideOffset?: number;
  width?: number | string;
}

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(
    {
      align = "start",
      side = "bottom",
      sideOffset = 8,
      width = 320,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const context = usePopover();
    if (!context.open) return null;
    return (
      <div
        ref={ref}
        id={context.contentId}
        role="dialog"
        tabIndex={-1}
        className={cn(
          "absolute z-[120] max-w-[calc(100vw-24px)] rounded-[12px] border border-border bg-surface-raised p-4 shadow-[var(--shadow-md)] outline-none animate-[mf-slide-up_180ms_var(--ease-out)]",
          side === "bottom" ? "top-full" : "bottom-full",
          align === "end"
            ? "right-0"
            : align === "center"
              ? "left-1/2 -translate-x-1/2"
              : "left-0",
          className,
        )}
        style={{
          width,
          ...(side === "bottom" ? { marginTop: sideOffset } : { marginBottom: sideOffset }),
          ...style,
        }}
        {...props}
      />
    );
  },
);
