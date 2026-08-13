"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { IconButton, buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { demoUser, workspaceConfig } from "@/config/brand";

import { BrandMark } from "./brand-mark";
import { isProductRouteActive, productNavigation } from "./navigation";

export type AppSidebarProps = {
  mobile?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
  className?: string;
};

export function AppSidebar({
  mobile = false,
  onNavigate,
  onClose,
  className,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [workspaceName, setWorkspaceName] = useState<string>(workspaceConfig.name);
  const [participantName, setParticipantName] = useState<string>(demoUser.name);

  useEffect(() => {
    const onWorkspaceUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      if (detail?.name) setWorkspaceName(detail.name);
    };
    window.addEventListener("mailflow:workspace-updated", onWorkspaceUpdate);
    const frame = window.requestAnimationFrame(() => {
      void fetch("/api/workspace", { cache: "no-store" })
        .then((response) => response.ok ? response.json() as Promise<{ workspace?: { name?: string }; participant?: { displayName?: string } }> : null)
        .then((payload) => {
          if (payload?.workspace?.name) setWorkspaceName(payload.workspace.name);
          if (payload?.participant?.displayName) setParticipantName(payload.participant.displayName);
        })
        .catch(() => undefined);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("mailflow:workspace-updated", onWorkspaceUpdate);
    };
  }, []);

  const workspaceInitials = workspaceName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("ru-RU");

  return (
    <aside
      aria-label="Навигация по платформе"
      className={cn(
        "relative flex h-dvh w-[264px] shrink-0 flex-col border-r border-border bg-surface text-text-strong",
        mobile && "w-[min(86vw,304px)] shadow-2xl",
        className,
      )}
    >
      <div className="flex h-[var(--topbar-height)] shrink-0 items-center justify-between border-b border-border/70 px-5">
        <BrandMark />
        {mobile ? (
          <IconButton
            data-mobile-nav-close
            label="Закрыть навигацию"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        ) : null}
      </div>

      <div className="shrink-0 px-3 pb-2 pt-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle/70 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-subtle text-[10px] font-bold tracking-wide text-primary">
            {workspaceInitials || "MF"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold text-text-strong">
              {workspaceName}
            </span>
            <span className="block truncate text-[10px] text-text-muted">
              Единое рабочее пространство
            </span>
          </span>
        </div>
      </div>

      <nav
        aria-label="Основные разделы"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-2"
      >
        {productNavigation.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
              {group.label}
            </p>
            <ul className="m-0 grid list-none gap-1 p-0">
              {group.items.map((item) => {
                const active = isProductRouteActive(pathname, item);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "group flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30",
                        active
                          ? "bg-primary-subtle text-primary"
                          : "text-text-muted hover:bg-surface-subtle hover:text-text-strong",
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-[18px] shrink-0",
                          active ? "text-primary" : "text-text-subtle group-hover:text-text-muted",
                        )}
                        strokeWidth={1.8}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.children?.length ? (
                        <ChevronRight
                          aria-hidden="true"
                          className={cn(
                            "size-3.5 shrink-0 text-text-subtle transition-transform",
                            active && "rotate-90 text-primary/70",
                          )}
                        />
                      ) : null}
                    </Link>

                    {active && item.children?.length ? (
                      <ul className="mb-1 ml-[19px] mt-1 grid list-none gap-0.5 border-l border-border pl-3">
                        {item.children.map((child) => {
                          const childActive = isProductRouteActive(pathname, child);
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                aria-current={childActive ? "page" : undefined}
                                onClick={onNavigate}
                                className={cn(
                                  "relative flex min-h-8 items-center rounded-md px-2 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30",
                                  childActive
                                    ? "font-semibold text-primary"
                                    : "text-text-muted hover:bg-surface-subtle hover:text-text-strong",
                                )}
                              >
                                {childActive ? (
                                  <span
                                    aria-hidden="true"
                                    className="absolute -left-[15px] size-1.5 rounded-full bg-primary ring-2 ring-surface"
                                  />
                                ) : null}
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border/70 p-3">
        <Link
          href="/dashboard#creative-studio"
          onClick={onNavigate}
          className={buttonVariants({
            variant: "primary",
            size: "sm",
            className: "mb-3 w-full justify-center shadow-[0_5px_16px_rgba(124,53,242,0.24)]",
          })}
        >
          <Plus aria-hidden="true" className="size-4" />
          Создать проект
        </Link>

        <Link
          href="/settings"
          onClick={onNavigate}
          aria-label={`${participantName}: профиль участника и настройки`}
          className="group flex items-center gap-2.5 rounded-xl p-2 outline-none transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Avatar name={participantName} size="sm" status="online" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-text-strong">
              {participantName}
            </span>
            <span className="block truncate text-[10px] text-text-subtle">
              {demoUser.role}
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 text-text-subtle transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </aside>
  );
}
