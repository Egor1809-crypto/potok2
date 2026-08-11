"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/utils";

import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { MobileNavigation } from "./mobile-navigation";
import { getProductSection } from "./navigation";
import { Topbar } from "./topbar";

type ContentWidth = "default" | "wide" | "full";

export type AppShellProps = {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  contentWidth?: ContentWidth;
  contentClassName?: string;
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
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-text-strong">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg outline-none transition-transform focus:translate-y-0"
      >
        К содержанию
      </a>

      <div className="flex min-h-screen items-start">
        <AppSidebar className="sticky top-0 hidden xl:flex" />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topbar
            currentSection={title ?? getProductSection(pathname)}
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
      />
      <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
    </div>
  );
}
