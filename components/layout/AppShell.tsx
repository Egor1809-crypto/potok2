"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/components/ui/utils";

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
  desktopSidebarCollapsible = false,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

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
        {!desktopSidebarCollapsed ? (
          <AppSidebar className="sticky top-0 hidden xl:flex" />
        ) : null}

        {desktopSidebarCollapsible ? (
          <button
            type="button"
            aria-label={
              desktopSidebarCollapsed
                ? "Показать навигацию платформы"
                : "Скрыть навигацию платформы"
            }
            title={
              desktopSidebarCollapsed
                ? "Показать навигацию"
                : "Скрыть навигацию"
            }
            onClick={() => setDesktopSidebarCollapsed((current) => !current)}
            className={cn(
              "fixed top-2.5 z-50 hidden size-8 place-items-center rounded-lg border border-border bg-surface text-text-muted shadow-[var(--shadow-sm)] outline-none transition hover:bg-surface-subtle hover:text-text-strong focus-visible:ring-2 focus-visible:ring-primary/30 xl:grid",
              desktopSidebarCollapsed ? "left-2.5" : "left-[222px]",
            )}
          >
            {desktopSidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-4" />
            )}
          </button>
        ) : null}

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
