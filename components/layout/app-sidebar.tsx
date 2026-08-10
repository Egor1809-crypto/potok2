"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";

import { demoUser } from "@/config/brand";
import { Avatar } from "@/components/ui/avatar";
import { IconButton, buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

import { BrandMark } from "./brand-mark";
import {
  isProductRouteActive,
  productNavigation,
} from "./navigation";
import {
  WorkspaceSwitcher,
  type WorkspaceOption,
} from "./workspace-switcher";

export type AppSidebarProps = {
  collapsed?: boolean;
  mobile?: boolean;
  workspaces?: WorkspaceOption[];
  selectedWorkspaceId?: string;
  onWorkspaceChange?: (workspaceId: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: () => void;
  onClose?: () => void;
  className?: string;
};

export function AppSidebar({
  collapsed = false,
  mobile = false,
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onCollapsedChange,
  onNavigate,
  onClose,
  className,
}: AppSidebarProps) {
  const pathname = usePathname();
  const isCompact = collapsed && !mobile;

  return (
    <aside
      aria-label="Product navigation"
      className={cn(
        "relative flex h-dvh shrink-0 flex-col border-r border-border bg-surface text-text-strong transition-[width] duration-200 ease-out",
        mobile
          ? "w-[min(88vw,320px)] shadow-2xl"
          : isCompact
            ? "w-20"
            : "w-[var(--sidebar-width)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-[var(--topbar-height)] shrink-0 items-center border-b border-border/70",
          isCompact ? "justify-center px-3" : "justify-between px-4",
        )}
      >
        <BrandMark compact={isCompact} />
        {mobile ? (
          <IconButton
            data-mobile-nav-close
            label="Close navigation"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        ) : !isCompact ? (
          <IconButton
            label="Collapse sidebar"
            variant="ghost"
            size="sm"
            onClick={() => onCollapsedChange?.(true)}
          >
            <PanelLeftClose aria-hidden="true" className="size-4" />
          </IconButton>
        ) : null}
      </div>

      <div className={cn("shrink-0", isCompact ? "px-[19px] py-4" : "px-3 py-4")}>
        <WorkspaceSwitcher
          collapsed={isCompact}
          workspaces={workspaces}
          value={selectedWorkspaceId}
          onValueChange={onWorkspaceChange}
        />
      </div>

      <nav
        aria-label="Main navigation"
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4",
          isCompact ? "px-3" : "px-3",
        )}
      >
        {productNavigation.map((group, groupIndex) => (
          <div
            key={group.label}
            className={cn(groupIndex > 0 && (isCompact ? "mt-2 border-t border-border/70 pt-2" : "mt-5"))}
          >
            {!isCompact ? (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
                {group.label}
              </p>
            ) : null}
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {group.items.map((item) => {
                const active = isProductRouteActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={isCompact ? item.label : undefined}
                      title={isCompact ? item.label : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex h-9 items-center rounded-lg text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30",
                        isCompact ? "justify-center px-0" : "gap-3 px-2.5",
                        active
                          ? "bg-primary-subtle text-primary"
                          : "text-text-muted hover:bg-surface-subtle hover:text-text-strong",
                      )}
                    >
                      {active && !isCompact ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary"
                        />
                      ) : null}
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-[17px] shrink-0",
                          active
                            ? "text-primary"
                            : "text-text-subtle transition-colors group-hover:text-text-muted",
                        )}
                        strokeWidth={1.8}
                      />
                      {!isCompact ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-border/70", isCompact ? "p-3" : "p-3")}>
        {!isCompact ? (
          <Link
            href="/campaigns/new"
            onClick={onNavigate}
            className={buttonVariants({
              variant: "primary",
              size: "sm",
              className: "mb-3 w-full justify-center shadow-[0_5px_16px_rgba(99,91,255,0.22)]",
            })}
          >
            <Plus aria-hidden="true" className="size-4" />
            New campaign
          </Link>
        ) : (
          <Link
            href="/campaigns/new"
            aria-label="New campaign"
            title="New campaign"
            className={buttonVariants({
              variant: "primary",
              size: "icon",
              className: "mx-auto mb-3 shadow-[0_5px_16px_rgba(99,91,255,0.2)]",
            })}
          >
            <Plus aria-hidden="true" className="size-4" />
          </Link>
        )}

        <Link
          href="/settings"
          onClick={onNavigate}
          aria-label={isCompact ? `${demoUser.name}, ${demoUser.role}` : undefined}
          title={isCompact ? demoUser.name : undefined}
          className={cn(
            "group flex items-center rounded-xl outline-none transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-primary/30",
            isCompact ? "justify-center p-1" : "gap-2.5 p-2",
          )}
        >
          <Avatar name={demoUser.name} size="sm" status="online" />
          {!isCompact ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-text-strong">
                  {demoUser.name}
                </span>
                <span className="block truncate text-[10px] text-text-subtle">
                  {demoUser.role}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 text-text-subtle transition-transform group-hover:translate-x-0.5"
              />
            </>
          ) : null}
        </Link>
      </div>

      {!mobile && isCompact ? (
        <button
          type="button"
          aria-label="Expand sidebar"
          title="Expand sidebar"
          onClick={() => onCollapsedChange?.(false)}
          className="absolute -right-3 top-[22px] z-10 grid size-6 place-items-center rounded-full border border-border bg-surface text-text-subtle shadow-sm outline-none transition hover:text-text-strong focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <PanelLeftOpen aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </aside>
  );
}
