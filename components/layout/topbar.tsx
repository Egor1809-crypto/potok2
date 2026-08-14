"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Command, Menu, Plus, Search } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { IconButton, buttonVariants } from "@/components/ui/button";
import { demoUser } from "@/config/brand";

import { BrandMark } from "./brand-mark";

type TopbarProps = {
  currentSection: string;
  onMenuClick: () => void;
  onSearchClick: () => void;
  action?: ReactNode;
};

export function Topbar({
  currentSection,
  onMenuClick,
  onSearchClick,
  action,
}: TopbarProps) {
  const [participantName, setParticipantName] = useState<string>(demoUser.name);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void fetch("/api/workspace", { cache: "no-store" })
        .then((response) => response.ok
          ? response.json() as Promise<{ participant?: { displayName?: string } }>
          : null)
        .then((payload) => {
          if (payload?.participant?.displayName) setParticipantName(payload.participant.displayName);
        })
        .catch(() => undefined);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-[var(--topbar-height)] shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
      <span className="sr-only">Текущий раздел: {currentSection}</span>

      <div className="flex min-w-0 items-center gap-2.5">
        <IconButton
          label="Открыть навигацию"
          variant="ghost"
          className="xl:hidden"
          onClick={onMenuClick}
        >
          <Menu aria-hidden="true" className="size-[18px]" />
        </IconButton>
        <BrandMark compact className="sm:hidden" />
        <BrandMark className="hidden sm:inline-flex xl:hidden" />

        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Найти раздел"
          className="group hidden h-9 w-56 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-[12px] text-text-subtle shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition hover:border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-primary/30 xl:flex"
        >
          <Search aria-hidden="true" className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">Найти раздел</span>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-subtle px-1 py-0.5 font-sans text-[9px] font-medium text-text-subtle">
            <Command aria-hidden="true" className="size-2.5" />K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onSearchClick}
          className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[12px] text-text-muted outline-none transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-primary/30 md:flex xl:hidden"
        >
          <Search aria-hidden="true" className="size-3.5" />
          Найти
          <kbd className="rounded border border-border bg-surface-subtle px-1 py-0.5 font-sans text-[9px] text-text-subtle">
            ⌘K
          </kbd>
        </button>
        <span className="md:hidden">
          <IconButton
            label="Найти раздел"
            variant="ghost"
            onClick={onSearchClick}
          >
            <Search aria-hidden="true" className="size-[17px]" />
          </IconButton>
        </span>

        {action ? (
          <div className="flex items-center">{action}</div>
        ) : (
          <Link
            href="/dashboard#creative-studio"
            aria-label="Создать проект"
            className={buttonVariants({
              variant: "primary",
              size: "sm",
              className: "px-2.5 sm:px-3",
            })}
          >
            <Plus aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Создать</span>
          </Link>
        )}

        <Link
          href="/settings"
          aria-label={`${participantName}: профиль участника и настройки`}
          className="ml-0.5 hidden rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:inline-flex"
        >
          <Avatar name={participantName} size="sm" status="online" />
        </Link>
      </div>
    </header>
  );
}
