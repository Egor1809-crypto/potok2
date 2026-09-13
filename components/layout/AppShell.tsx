"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/utils";
import { useSidebarPreference } from "@/lib/sidebar-preference";

import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { MobileNavigation } from "./mobile-navigation";
import { NavigationRail } from "./navigation-rail";
import { getProductSection } from "./navigation";
import { Topbar } from "./topbar";
import { ProductGuide } from "../onboarding/ProductGuide";

type ContentWidth = "default" | "wide" | "full";

export type AppShellProps = {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  contentWidth?: ContentWidth;
  contentClassName?: string;
  viewportLocked?: boolean;
  desktopSidebarCollapsible?: boolean;
};

const contentWidths: Record<ContentWidth, string> = {
  default: "max-w-[1280px]",
  wide: "max-w-[1560px]",
  full: "max-w-none",
};

export function AppShell({
  children,
  title,
  action,
  contentWidth = "wide",
  contentClassName,
  viewportLocked = false,
  desktopSidebarCollapsible = true,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const mobileReturnFocus = useRef<HTMLElement | null>(null);
  const sidebar = useSidebarPreference();
  const desktopSidebarCollapsed = desktopSidebarCollapsible && sidebar.collapsed;
  const changeSearchOpen = useCallback((open: boolean) => {
    if (open) searchReturnFocus.current = document.activeElement?.closest('[aria-label="Меню навигации"]') ? mobileReturnFocus.current : document.activeElement as HTMLElement | null;
    setCommandMenuOpen(open);
    if (open) setMobileNavigationOpen(false);
  }, []);
  const toggleSidebar = () => {
    sidebar.toggle();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(desktopSidebarCollapsed ? "[data-sidebar-collapse]" : "[data-rail-expand]")?.focus());
  };

  return (
    <div
      data-product-shell
      className={cn(
        viewportLocked
          ? "fixed inset-0 h-dvh w-full overflow-hidden"
          : "min-h-screen",
        "bg-background text-text-strong",
      )}
    >
      <div inert={commandMenuOpen || mobileNavigationOpen} className={viewportLocked ? "h-full" : undefined}>
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg outline-none transition-transform focus:translate-y-0"
      >
        К содержанию
      </a>

      <div
        className={cn(
          "flex items-start",
          viewportLocked ? "h-full min-h-0" : "min-h-screen",
        )}
      >
        <div id="platform-sidebar" className={cn("sticky top-0 z-50 h-dvh w-14 shrink-0 sm:w-16", !desktopSidebarCollapsed && "xl:w-[264px]")}>
          {!desktopSidebarCollapsed ? <div className="hidden xl:block"><AppSidebar onCollapse={desktopSidebarCollapsible ? toggleSidebar : undefined} /></div> : null}
          <NavigationRail className={!desktopSidebarCollapsed ? "xl:hidden" : undefined} onExpand={() => {
            if (window.matchMedia("(min-width: 1280px)").matches) toggleSidebar();
            else { mobileReturnFocus.current = document.activeElement as HTMLElement | null; setMobileNavigationOpen(true); }
          }} />
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            viewportLocked ? "h-full min-h-0" : "min-h-screen",
          )}
        >
          <Topbar
            currentSection={title ?? getProductSection(pathname)}
            onSearchClick={() => changeSearchOpen(true)}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "min-w-0 flex-1 outline-none",
              viewportLocked && "min-h-0 overflow-hidden",
            )}
          >
            <div
              className={cn(
                "mx-auto w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8",
                viewportLocked && "h-full min-h-0",
                contentWidths[contentWidth],
                contentClassName,
              )}
            >
              {action && <div className="mb-4 flex flex-wrap justify-end gap-2">{action}</div>}
              {children}
            </div>
          </main>
        </div>
      </div>
      <ProductGuide />
      </div>

      <MobileNavigation
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
        returnFocusRef={mobileReturnFocus}
      />
      <CommandMenu open={commandMenuOpen} onOpenChange={changeSearchOpen} returnFocusRef={searchReturnFocus} />
    </div>
  );
}
