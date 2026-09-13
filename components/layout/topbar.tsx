"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, LogOut, Plus, Search } from "@/components/ui/icons";

import { Avatar } from "@/components/ui/avatar";
import { IconButton, buttonVariants } from "@/components/ui/button";
import { demoUser } from "@/config/brand";

type TopbarProps = {
  currentSection: string;
  onSearchClick: () => void;
  action?: ReactNode;
};

export function Topbar({
  currentSection,
  onSearchClick,
  action,
}: TopbarProps) {
  const [participantName, setParticipantName] = useState<string>(demoUser.name);
  const [participantColor, setParticipantColor] = useState("#6558E8");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void fetch("/api/workspace?scope=identity", { cache: "force-cache" })
        .then((response) => response.ok
          ? response.json() as Promise<{ participant?: { displayName?: string; color?: string } }>
          : null)
        .then((payload) => {
          if (payload?.participant?.displayName) setParticipantName(payload.participant.displayName);
          if (payload?.participant?.color) setParticipantColor(payload.participant.color);
        })
        .catch(() => undefined);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-[var(--topbar-height)] shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
      <span className="sr-only">Текущий раздел: {currentSection}</span>

      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Поиск разделов и действий"
          aria-haspopup="dialog"
          className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm text-text-muted hover:bg-surface-subtle sm:w-56"
        >
          <Search aria-hidden="true" className="size-5" />
          <span className="min-w-0 flex-1 truncate">Поиск</span>
          <kbd className="hidden font-sans text-xs text-text-subtle sm:inline">⌘ / Ctrl K</kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
            <Plus aria-hidden="true" className="size-6" />
            <span className="hidden sm:inline">Создать</span>
          </Link>
        )}

        <Link
          href="/calendar"
          aria-label="Открыть календарь рассылок"
          className="hidden h-9 items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 text-[12px] font-semibold text-primary shadow-[0_1px_2px_rgba(101,88,232,0.1)] transition hover:-translate-y-px hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/30 md:inline-flex"
        >
          <CalendarDays aria-hidden="true" className="size-6" />
          Календарь
        </Link>

        <Link
          href="/settings"
          aria-label={`${participantName}: профиль участника и настройки`}
          className="ml-0.5 hidden rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:inline-flex"
        >
          <Avatar name={participantName} size="sm" status="online" style={{ backgroundColor: `${participantColor}18`, color: participantColor }} />
        </Link>
        <span className="hidden sm:inline-flex"><IconButton
          label="Выйти из аккаунта"
          variant="ghost"
          onClick={() => {
            void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
              window.location.assign("/");
            });
          }}
        >
          <LogOut aria-hidden className="size-6" />
        </IconButton></span>
      </div>
    </header>
  );
}
