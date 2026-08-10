"use client";

import * as React from "react";
import { X } from "lucide-react";
import { IconButton } from "./button";
import { cn } from "./utils";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function useOverlayBehavior({
  open,
  panelRef,
  onClose,
  closeOnEscape,
}: {
  open: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  closeOnEscape: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      const autofocus = panel?.querySelector<HTMLElement>("[data-autofocus]");
      const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (autofocus ?? firstFocusable ?? panel)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [closeOnEscape, onClose, open, panelRef]);
}

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  contentClassName?: string;
}

const modalSizes: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(1120px,calc(100vw-32px))]",
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  closeLabel = "Close dialog",
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
  contentClassName,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  useOverlayBehavior({ open, panelRef, onClose: close, closeOnEscape });
  if (!open) return null;

  return (
    <div
      role="presentation"
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-[#10121b]/45 p-4 backdrop-blur-[2px] animate-[mf-fade-in_160ms_ease-out]",
        className,
      )}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "flex max-h-[min(760px,calc(100vh-32px))] w-full flex-col overflow-hidden rounded-[16px] border border-border bg-surface-raised shadow-[var(--shadow-lg)] outline-none animate-[mf-slide-up_220ms_var(--ease-out)]",
          modalSizes[size],
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4.5 sm:px-6">
          <div className="min-w-0 pt-0.5">
            <h2
              id={titleId}
              className="m-0 text-[16px] leading-5 font-semibold tracking-[-0.015em] text-text-strong"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1.5 mb-0 text-[12px] leading-5 text-text-muted"
              >
                {description}
              </p>
            )}
          </div>
          <IconButton
            label={closeLabel}
            variant="ghost"
            size="sm"
            onClick={close}
            className="-mt-1 -mr-1 shrink-0"
          >
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        <div className={cn("scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-5 sm:p-6", contentClassName)}>
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-subtle/55 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface DrawerProps
  extends Omit<ModalProps, "size" | "contentClassName"> {
  side?: "left" | "right";
  width?: "sm" | "md" | "lg" | "xl";
  contentClassName?: string;
}

const drawerWidths: Record<NonNullable<DrawerProps["width"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-2xl",
};

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  width = "md",
  closeLabel = "Close panel",
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
  contentClassName,
}: DrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  useOverlayBehavior({ open, panelRef, onClose: close, closeOnEscape });
  if (!open) return null;

  return (
    <div
      role="presentation"
      className={cn(
        "fixed inset-0 z-[100] flex bg-[#10121b]/40 backdrop-blur-[2px] animate-[mf-fade-in_160ms_ease-out]",
        side === "right" ? "justify-end" : "justify-start",
        className,
      )}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "flex h-full w-[calc(100%-24px)] flex-col border-border bg-surface-raised shadow-[var(--shadow-lg)] outline-none",
          drawerWidths[width],
          side === "right"
            ? "border-l animate-[mf-slide-in-right_240ms_var(--ease-out)]"
            : "border-r animate-[mf-slide-in-left_240ms_var(--ease-out)]",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="m-0 text-[16px] leading-5 font-semibold tracking-[-0.015em] text-text-strong"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1.5 mb-0 text-[12px] leading-5 text-text-muted"
              >
                {description}
              </p>
            )}
          </div>
          <IconButton
            label={closeLabel}
            variant="ghost"
            size="sm"
            onClick={close}
            className="-mt-1 -mr-1 shrink-0"
          >
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        <div className={cn("scrollbar-subtle min-h-0 flex-1 overflow-y-auto p-5 sm:p-6", contentClassName)}>
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-subtle/55 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function DialogActions({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap justify-end gap-2", className)}>{children}</div>;
}

export { Modal as Dialog, Drawer as Sheet };
export type { ModalProps as DialogProps, DrawerProps as SheetProps };
