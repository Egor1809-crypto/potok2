"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Plug2 } from "@/components/ui/icons";
import { cn } from "@/components/ui/utils";
import { BrandMark } from "./brand-mark";
import { isProductRouteActive, productNavigation, type ProductNavItem } from "./navigation";

type OpenGroup = { item: ProductNavItem; top: number; left: number; trigger: HTMLButtonElement };
const targetClass = "relative grid size-10 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface-subtle hover:text-text-strong";

export function NavigationRail({ onExpand, className }: { onExpand: () => void; className?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const location = `${pathname}${params.size ? `?${params.toString()}` : ""}`;
  const [group, setGroup] = useState<OpenGroup | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!group) return;
    const frame = requestAnimationFrame(() => popupRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());
    const dismiss = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node) && !group.trigger.contains(event.target as Node)) setGroup(null);
    };
    const close = () => setGroup(null);
    const escape = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyK") setGroup(null);
      if (event.key === "Escape") { event.preventDefault(); setGroup(null); group.trigger.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", close);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", close);
    };
  }, [group]);

  const openGroup = (item: ProductNavItem, trigger: HTMLButtonElement) => {
    if (group?.item === item) { setGroup(null); return; }
    const rect = trigger.getBoundingClientRect();
    const height = 50 + (item.children?.length ?? 0) * 44;
    setGroup({ item, trigger, left: rect.right + 8, top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)) });
  };
  const moveFocus = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const links = Array.from(popupRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    if (!links.length) return;
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
    event.preventDefault(); links[next]?.focus();
  };

  return <>
    <aside aria-label="Краткая навигация" className={cn("flex h-dvh w-14 flex-col items-center border-r border-border bg-surface sm:w-16", className)}>
      <div className="flex h-[var(--topbar-height)] shrink-0 items-center justify-center"><BrandMark compact /></div>
      <button data-rail-expand type="button" className={cn(targetClass, "my-2")} aria-label="Развернуть левую панель" title="Развернуть левую панель" aria-controls="platform-sidebar" aria-expanded="false" onClick={onExpand}><ChevronRight aria-hidden="true" className="size-7" /></button>
      <nav aria-label="Разделы платформы" className="scrollbar-subtle min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-2 pb-3 sm:px-3" onScroll={() => setGroup(null)}>
        {productNavigation.map(section => <ul key={section.label} aria-label={section.label} className="mb-5 grid list-none gap-1 p-0 last:mb-0">
          {section.items.map(item => {
            const Icon = item.icon;
            const active = isProductRouteActive(location, item);
            const classes = cn(targetClass, active && "bg-primary-subtle text-primary before:absolute before:inset-y-3 before:-left-2 before:w-0.5 before:rounded-full before:bg-primary");
            return <li key={item.href}>{item.children?.length ? <button type="button" className={classes} title={item.label} aria-label={item.label} aria-expanded={group?.item === item} aria-controls={group?.item === item ? "rail-group-links" : undefined} onClick={event => openGroup(item, event.currentTarget)} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); openGroup(item, event.currentTarget); } }}><Icon aria-hidden="true" className="size-7" strokeWidth={1.8} /><span aria-hidden="true" className="absolute bottom-1 right-1 size-1 rounded-full bg-current opacity-50" /></button> : <Link href={item.href} aria-label={item.label} title={item.label} aria-current={active ? "page" : undefined} className={classes}><Icon aria-hidden="true" className="size-7" strokeWidth={1.8} /></Link>}</li>;
          })}
        </ul>)}
      </nav>
      <div className="shrink-0 border-t border-border py-2"><Link href="/integrations" title="Подключения каналов" aria-label="Подключения каналов" aria-current={pathname === "/integrations" ? "page" : undefined} className={cn(targetClass, pathname === "/integrations" && "bg-primary-subtle text-primary")}><Plug2 aria-hidden="true" className="size-7" strokeWidth={1.8} /></Link></div>
    </aside>
    {group ? createPortal(<div ref={popupRef} id="rail-group-links" role="dialog" tabIndex={-1} aria-label={group.item.label} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== group.trigger) setGroup(null); }} style={{ top: group.top, left: group.left, width: 256, maxWidth: `calc(100vw - ${group.left + 8}px)`, maxHeight: "calc(100dvh - 16px)", overflowY: "auto" }} className="fixed z-[70] rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-md)]">
      <p className="px-3 py-2 text-xs font-medium text-text-muted">{group.item.label}</p>
      {group.item.children?.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} onKeyDown={moveFocus} onClick={() => setGroup(null)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-text-strong hover:bg-surface-subtle"><Icon aria-hidden="true" className="size-6 shrink-0" />{item.label}</Link>; })}
    </div>, document.body) : null}
  </>;
}
