"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/utils";
import { useSidebarPreference } from "@/lib/sidebar-preference";

import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { MobileNavigation } from "./mobile-navigation";
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
  const sidebar = useSidebarPreference();
  const desktopSidebarCollapsed = desktopSidebarCollapsible && sidebar.collapsed;

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
        <div id="platform-sidebar" aria-hidden={desktopSidebarCollapsed} inert={desktopSidebarCollapsed}
          className={cn("sticky top-0 hidden h-dvh shrink-0 overflow-hidden motion-safe:transition-[width] motion-safe:duration-200 xl:block", desktopSidebarCollapsed ? "w-0" : "w-[264px]")}>
          <AppSidebar className={cn("motion-safe:transition-transform motion-safe:duration-200", desktopSidebarCollapsed && "-translate-x-full")} />
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            viewportLocked ? "h-full min-h-0" : "min-h-screen",
          )}
        >
          <Topbar
            currentSection={title ?? getProductSection(pathname)}
            onMenuClick={() => setMobileNavigationOpen(true)}
            onSearchClick={() => setCommandMenuOpen(true)}
            action={action}
            sidebar={desktopSidebarCollapsible ? { collapsed: desktopSidebarCollapsed, onToggle: sidebar.toggle } : undefined}
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
              {children}
            </div>
          </main>
        </div>
      </div>

      <MobileNavigation
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
      />
      <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
      <ProductGuide />
    </div>
  );
}
