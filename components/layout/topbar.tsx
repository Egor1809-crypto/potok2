"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  Check,
  CircleHelp,
  Command,
  LifeBuoy,
  Menu,
  Plus,
  Search,
} from "lucide-react";

import { brandConfig, demoUser } from "@/config/brand";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton, buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type TopbarProps = {
  title: string;
  onMenuClick: () => void;
  onSearchClick: () => void;
  action?: ReactNode;
};

type TopbarPanel = "notifications" | "help" | null;

export function Topbar({ title, onMenuClick, onSearchClick, action }: TopbarProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<TopbarPanel>(null);
  const [unread, setUnread] = useState(2);

  useEffect(() => {
    if (!panel) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) setPanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panel]);

  const togglePanel = (next: Exclude<TopbarPanel, null>) => {
    setPanel((current) => (current === next ? null : next));
  };

  return (
    <header className="sticky top-0 z-40 flex h-[var(--topbar-height)] shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-surface/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconButton
          label="Open navigation"
          variant="ghost"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu aria-hidden="true" className="size-[18px]" />
        </IconButton>
        <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-text-strong sm:text-[15px]">
          {title}
        </span>
      </div>

      <div ref={controlsRef} className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Search pages and actions"
          className="group hidden h-9 w-44 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-left text-[12px] text-text-subtle shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition hover:border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-primary/30 md:flex xl:w-56"
        >
          <Search aria-hidden="true" className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">Search</span>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-subtle px-1 py-0.5 font-sans text-[9px] font-medium text-text-subtle">
            <Command aria-hidden="true" className="size-2.5" />K
          </kbd>
        </button>
        <IconButton
          label="Search"
          variant="ghost"
          className="md:hidden"
          onClick={onSearchClick}
        >
          <Search aria-hidden="true" className="size-[17px]" />
        </IconButton>

        <IconButton
          label={unread ? `${unread} unread notifications` : "Notifications"}
          variant="ghost"
          aria-expanded={panel === "notifications"}
          aria-haspopup="dialog"
          onClick={() => togglePanel("notifications")}
          className="relative"
        >
          <Bell aria-hidden="true" className="size-[17px]" />
          {unread ? (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary ring-2 ring-surface" />
          ) : null}
        </IconButton>
        <IconButton
          label="Help and support"
          variant="ghost"
          aria-expanded={panel === "help"}
          aria-haspopup="dialog"
          onClick={() => togglePanel("help")}
          className="hidden sm:inline-flex"
        >
          <CircleHelp aria-hidden="true" className="size-[17px]" />
        </IconButton>

        {action ? (
          <div className="ml-0.5 flex items-center">{action}</div>
        ) : (
          <Link
            href="/campaigns/new"
            className={buttonVariants({
              variant: "primary",
              size: "sm",
              className: "ml-0.5 px-2.5 sm:px-3",
            })}
          >
            <Plus aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Create</span>
          </Link>
        )}

        <Link
          href="/settings"
          aria-label={`${demoUser.name} profile and settings`}
          className="ml-0.5 hidden rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:inline-flex"
        >
          <Avatar name={demoUser.name} size="sm" status="online" />
        </Link>

        {panel === "notifications" ? (
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 top-[calc(100%+10px)] w-[min(90vw,340px)] overflow-hidden rounded-xl border border-border bg-surface shadow-[0_18px_55px_rgba(15,23,42,0.16)]"
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-text-strong">Notifications</p>
                <p className="text-[10px] text-text-subtle">Updates from your workspace</p>
              </div>
              {unread ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-2 text-[11px]"
                  onClick={() => setUnread(0)}
                >
                  <Check aria-hidden="true" className="size-3.5" />
                  Mark read
                </Button>
              ) : null}
            </div>
            <div className="p-1.5">
              <NotificationItem
                unread={unread > 0}
                title="Campaign is ready to review"
                body="Legal Conference Invitation passed all delivery checks."
                time="8 min ago"
              />
              <NotificationItem
                unread={unread > 1}
                title="Import completed"
                body="4,701 contacts were added to Legal Team."
                time="42 min ago"
              />
            </div>
          </div>
        ) : null}

        {panel === "help" ? (
          <div
            role="dialog"
            aria-label="Help and support"
            className="absolute right-0 top-[calc(100%+10px)] w-[300px] overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-[0_18px_55px_rgba(15,23,42,0.16)]"
          >
            <p className="px-2.5 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Help & support
            </p>
            <HelpLink
              href="/dashboard"
              icon={BookOpen}
              title="Demo guide"
              description={`Explore the ${brandConfig.name} workflow`}
              onClick={() => setPanel(null)}
            />
            <HelpLink
              href={`mailto:${brandConfig.supportEmail}`}
              icon={LifeBuoy}
              title="Contact support"
              description={brandConfig.supportEmail}
              onClick={() => setPanel(null)}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}

function NotificationItem({
  unread,
  title,
  body,
  time,
}: {
  unread: boolean;
  title: string;
  body: string;
  time: string;
}) {
  return (
    <div className="relative rounded-lg px-3 py-2.5 transition hover:bg-surface-subtle">
      {unread ? (
        <span aria-label="Unread" className="absolute right-3 top-3 size-1.5 rounded-full bg-primary" />
      ) : null}
      <p className={cn("pr-4 text-[12px] font-medium text-text-strong")}>{title}</p>
      <p className="mt-0.5 pr-3 text-[11px] leading-[1.45] text-text-muted">{body}</p>
      <p className="mt-1.5 text-[9px] font-medium uppercase tracking-wide text-text-subtle">{time}</p>
    </div>
  );
}

function HelpLink({
  href,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  href: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 outline-none transition hover:bg-surface-subtle focus-visible:bg-primary-subtle"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-subtle text-text-muted">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-text-strong">{title}</span>
        <span className="block truncate text-[10px] text-text-subtle">{description}</span>
      </span>
    </Link>
  );
}
