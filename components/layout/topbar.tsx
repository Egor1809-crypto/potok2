"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Search } from "@/components/ui/icons";

import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { clearAccountDrafts } from "@/lib/browser-session";
import { demoUser } from "@/config/brand";

type TopbarProps = {
  currentSection: string;
  onSearchClick: () => void;
};

export function Topbar({
  currentSection,
  onSearchClick,
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
    <header className="sticky top-0 z-40 grid h-[var(--topbar-height)] shrink-0 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 bg-background px-4 sm:grid-cols-[minmax(88px,1fr)_minmax(0,400px)_minmax(88px,1fr)] sm:px-6 lg:px-8">
      <span className="sr-only">Текущий раздел: {currentSection}</span>

      <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-center">
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Поиск разделов и действий"
          aria-haspopup="dialog"
          className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border-strong bg-surface px-3 text-left text-sm text-text-muted hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Search aria-hidden="true" className="size-5" />
          <span className="min-w-0 flex-1 truncate">Поиск</span>
          <kbd className="hidden font-sans text-xs text-text-subtle sm:inline">⌘ / Ctrl K</kbd>
        </button>
      </div>

      <div className="col-start-3 row-start-1 flex shrink-0 items-center justify-self-end gap-1.5 sm:gap-2">
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
              clearAccountDrafts();
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
