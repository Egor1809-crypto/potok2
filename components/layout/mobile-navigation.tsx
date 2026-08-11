"use client";

import { useEffect, useRef } from "react";

import { AppSidebar } from "./app-sidebar";
import { containTabFocus } from "./focus-management";

type MobileNavigationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileNavigation({
  open,
  onOpenChange,
}: MobileNavigationProps) {
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    priorFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
      containTabFocus(event, dialogRef.current);
    };
    document.addEventListener("keydown", onKeyDown);

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>("[data-mobile-nav-close]")
        ?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      priorFocusRef.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Меню навигации"
      className="fixed inset-0 z-[80] xl:hidden"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Закрыть навигацию"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px] motion-safe:animate-[mf-fade-in_160ms_ease-out]"
      />
      <div className="relative h-full w-fit motion-safe:animate-[mf-slide-in-left_200ms_cubic-bezier(0.2,0.8,0.2,1)]">
        <AppSidebar
          mobile
          onClose={() => onOpenChange(false)}
          onNavigate={() => onOpenChange(false)}
        />
      </div>
    </div>
  );
}
