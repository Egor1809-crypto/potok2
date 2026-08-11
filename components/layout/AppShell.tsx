"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { workspaceConfig } from "@/config/brand";
import { cn } from "@/components/ui/utils";

import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { MobileNavigation } from "./mobile-navigation";
import { getProductSection } from "./navigation";
import { Topbar } from "./topbar";
import type { WorkspaceOption } from "./workspace-switcher";

type ContentWidth = "default" | "wide" | "full";

export type AppShellProps = {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  contentWidth?: ContentWidth;
  contentClassName?: string;
  workspaces?: WorkspaceOption[];
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
  workspaces,
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string>(workspaceConfig.id);

  useEffect(() => {
    let frame = 0;
    try {
      const storedPreference =
        window.localStorage.getItem("mailflow:sidebar-collapsed") === "true";
      frame = window.requestAnimationFrame(() => {
        setSidebarCollapsed(storedPreference);
      });
    } catch {
      // The preference is optional when storage is unavailable.
    }
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateSidebar = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    try {
      window.localStorage.setItem(
        "mailflow:sidebar-collapsed",
        String(collapsed),
      );
    } catch {
      // Keep the current-session state if storage is unavailable.
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-strong">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg outline-none transition-transform focus:translate-y-0"
      >
        К содержанию
      </a>

      <div className="flex min-h-screen items-start">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={updateSidebar}
          workspaces={workspaces}
          selectedWorkspaceId={workspaceId}
          onWorkspaceChange={setWorkspaceId}
          className="sticky top-0 hidden lg:flex"
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topbar
            title={title ?? getProductSection(pathname)}
            onMenuClick={() => setMobileNavigationOpen(true)}
            onSearchClick={() => setCommandMenuOpen(true)}
            action={action}
          />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
            <div
              className={cn(
                "mx-auto w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8",
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
        workspaces={workspaces}
        selectedWorkspaceId={workspaceId}
        onWorkspaceChange={setWorkspaceId}
      />
      <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
    </div>
  );
}
