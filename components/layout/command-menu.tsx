"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { BRAND_NAME } from "@/config/brand";

import { productRoutes, quickCreateRoutes, secondaryProductRoutes } from "./navigation";
import { containTabFocus } from "./focus-management";

type CommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const commandRoutes = [...quickCreateRoutes, ...productRoutes, ...secondaryProductRoutes];

function searchScore(route: (typeof commandRoutes)[number], query: string) {
  const label = route.label.toLocaleLowerCase("ru-RU");
  const description = route.description.toLocaleLowerCase("ru-RU");
  const keywords = (route.keywords ?? []).map((value) => value.toLocaleLowerCase("ru-RU"));
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  if (keywords.some((keyword) => keyword === query)) return 3;
  if (keywords.some((keyword) => keyword.startsWith(query))) return 4;
  if (label.includes(query)) return 5;
  if (description.includes(query)) return 6;
  return 7;
}

function formatResultsCount(count: number) {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  const noun = remainder100 >= 11 && remainder100 <= 14
    ? "результатов"
    : remainder10 === 1
      ? "результат"
      : remainder10 >= 2 && remainder10 <= 4
        ? "результата"
        : "результатов";
  return `${count} ${noun}`;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (open && event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
      if (open) containTabFocus(event, dialogRef.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    priorFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      setQuery("");
      inputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      priorFocusRef.current?.focus();
    };
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commandRoutes;
    return commandRoutes.filter((route) =>
      [route.label, route.description, ...(route.keywords ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    ).sort((first, second) =>
      searchScore(first, normalized) - searchScore(second, normalized),
    );
  }, [query]);

  if (!open) return null;

  const goToFirstResult = () => {
    if (!results[0]) return;
    router.push(results[0].href);
    onOpenChange(false);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-menu-title"
      className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[9vh] sm:px-6 sm:pt-[12vh]"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Закрыть поиск"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 cursor-default bg-slate-950/30 backdrop-blur-[2px] motion-safe:animate-[mf-fade-in_150ms_ease-out]"
      />
      <div className="relative flex max-h-[76dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(15,23,42,0.22)] motion-safe:animate-[mf-slide-up_180ms_cubic-bezier(0.2,0.8,0.2,1)] sm:max-h-[460px]">
        <h2 id="command-menu-title" className="sr-only">
          Поиск в {BRAND_NAME}
        </h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            goToFirstResult();
          }}
          className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border px-4"
        >
          <Search aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
          <label htmlFor="mailflow-command-search" className="sr-only">
            Поиск разделов и действий
          </label>
          <input
            ref={inputRef}
            id="mailflow-command-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти раздел…"
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-text-strong outline-none placeholder:text-text-subtle"
          />
          {query ? (
            <IconButton
              label="Очистить поиск"
              variant="ghost"
              size="sm"
              onClick={() => setQuery("")}
            >
              <X aria-hidden="true" className="size-3.5" />
            </IconButton>
          ) : (
            <kbd className="hidden rounded-md border border-border bg-surface-subtle px-1.5 py-0.5 font-sans text-[10px] font-medium text-text-subtle sm:inline-flex">
              ESC
            </kbd>
          )}
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <p className="px-2.5 pb-1.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
            {query ? formatResultsCount(results.length) : "Быстрый переход"}
          </p>
          {results.length ? (
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {results.map((route, index) => {
                const Icon = route.icon;
                return (
                  <li key={route.href}>
                    <Link
                      href={route.href}
                      onClick={() => onOpenChange(false)}
                      className="group flex items-center gap-3 rounded-xl px-2.5 py-2 outline-none transition hover:bg-surface-subtle focus-visible:bg-primary-subtle"
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-[9px] border",
                          index === 0 && !query
                            ? "border-primary/15 bg-primary-subtle text-primary"
                            : "border-border bg-surface text-text-muted",
                        )}
                      >
                        <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-text-strong">
                          {route.label}
                        </span>
                        <span className="block truncate text-[10px] text-text-subtle">
                          {route.description}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 -translate-x-1 text-text-subtle opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid min-h-40 place-items-center px-6 text-center">
              <div>
                <p className="text-[13px] font-medium text-text-strong">Ничего не нашлось</p>
                <p className="mt-1 text-[12px] text-text-muted">
                  Попробуйте ввести «Контакты» или «Аналитика».
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
