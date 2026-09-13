"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "@/components/ui/icons";
import { cn } from "@/components/ui/utils";
import { nextSearchIndex, searchNavigation } from "@/lib/navigation-search";
import { containTabFocus } from "./focus-management";

type CommandMenuProps = { open: boolean; onOpenChange: (open: boolean) => void; returnFocusRef?: RefObject<HTMLElement | null> };

export function CommandMenu({ open, onOpenChange, returnFocusRef }: CommandMenuProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => searchNavigation(query), [query]);
  const selectedIndex = Math.min(activeIndex, Math.max(0, results.length - 1));
  const hasQuery = Boolean(query.trim());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if ((event.metaKey || event.ctrlKey) && (event.code === "KeyK" || event.key.toLowerCase() === "k")) {
        event.preventDefault(); onOpenChange(!open); return;
      }
      if (!open) return;
      if (event.key === "Escape") { event.preventDefault(); onOpenChange(false); return; }
      containTabFocus(event, dialogRef.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = returnFocusRef?.current ?? document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => { setQuery(""); setActiveIndex(0); inputRef.current?.focus(); });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (open) dialogRef.current?.querySelector<HTMLElement>(`#navigation-result-${selectedIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open, query]);

  if (!open) return null;
  const clear = () => { setQuery(""); setActiveIndex(0); inputRef.current?.focus(); };
  const openSelected = () => {
    const selected = results[selectedIndex];
    if (selected) { router.push(selected.href); onOpenChange(false); }
  };

  return <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[max(24px,8dvh)] sm:px-6 sm:pt-[12dvh]">
    <button type="button" tabIndex={-1} aria-label="Закрыть поиск" onClick={() => onOpenChange(false)} className="absolute inset-0 cursor-default bg-black/25" />
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="command-menu-title" className="relative flex max-h-[80dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_16px_48px_rgba(0,0,0,.16)]">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 id="command-menu-title" className="text-sm font-medium text-text-strong">Перейти к разделу</h2>
        <button type="button" aria-label="Закрыть поиск" title="Закрыть · Esc" onClick={() => onOpenChange(false)} className="-mr-2 grid size-10 place-items-center rounded-lg text-text-muted hover:bg-surface-subtle"><X aria-hidden="true" className="size-6" /></button>
      </div>
      <form onSubmit={event => { event.preventDefault(); openSelected(); }} className="px-4 pb-3">
        <div className="command-search-field flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-3">
          <Search aria-hidden="true" className="size-7 shrink-0 text-text-muted" />
          <label htmlFor="mailflow-command-search" className="sr-only">Поиск разделов и действий</label>
          <input ref={inputRef} id="mailflow-command-search" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="navigation-search-results" aria-activedescendant={results.length ? `navigation-result-${selectedIndex}` : undefined} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={160} value={query} onChange={event => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setActiveIndex(nextSearchIndex(selectedIndex, event.key, results.length));
            } else if (event.altKey && (event.key === "Home" || event.key === "End")) {
              event.preventDefault(); setActiveIndex(nextSearchIndex(selectedIndex, event.key, results.length));
            }
          }} placeholder="Например, календарь или импорт письма" className="command-search-input min-h-11 w-full min-w-0 border-0 bg-transparent p-0 text-base text-text-strong placeholder:text-text-subtle" />
          {query ? <button type="button" aria-label="Очистить поиск" onClick={clear} className="grid size-8 shrink-0 place-items-center rounded text-text-muted hover:bg-surface-subtle"><X aria-hidden="true" className="size-5" /></button> : null}
        </div>
      </form>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        <p role="status" aria-live="polite" className="px-3 pb-2 pt-1 text-xs text-text-subtle">{hasQuery ? `Найдено: ${results.length}` : "Разделы"}</p>
        <ul id="navigation-search-results" role="listbox" aria-label="Разделы и действия" className="m-0 list-none p-0">
          {results.map((route, index) => {
            const Icon = route.icon;
            return <li key={route.href} role="presentation">
              {!hasQuery && route.kind === "action" && results[index - 1]?.kind !== "action" ? <p className="px-3 pb-2 pt-4 text-xs text-text-subtle">Действия</p> : null}
              <Link id={`navigation-result-${index}`} role="option" aria-selected={selectedIndex === index} tabIndex={-1} href={route.href} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) onOpenChange(false); }} onMouseMove={() => setActiveIndex(index)} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-strong", selectedIndex === index ? "bg-surface-subtle" : "hover:bg-surface-subtle")}>
                <Icon aria-hidden="true" className="size-7 shrink-0 text-text-muted" strokeWidth={1.7} />
                <span className="min-w-0 flex-1">{route.label}</span>
                {hasQuery ? <span className="hidden text-xs text-text-subtle sm:inline">{route.category}</span> : null}
                <ArrowUpRight aria-hidden="true" className={cn("size-5 shrink-0 text-text-subtle", selectedIndex !== index && "opacity-0")} />
              </Link>
            </li>;
          })}
        </ul>
        {!results.length ? <div className="px-4 py-10 text-center"><p className="break-words text-sm text-text-strong">По запросу «{query}» ничего не найдено</p><p className="mt-2 text-sm text-text-muted">Попробуйте название раздела или действие: «рассылка», «импорт», «отчёты».</p><button type="button" onClick={clear} className="mt-4 min-h-10 rounded-lg border border-border px-4 text-sm text-text-strong hover:bg-surface-subtle">Сбросить поиск</button></div> : null}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border px-5 py-3 text-xs text-text-subtle"><span>↑ ↓ выбрать</span><span>Enter открыть</span><span>Esc закрыть</span></div>
    </div>
  </div>;
}
