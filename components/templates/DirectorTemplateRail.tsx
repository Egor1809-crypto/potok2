"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { EmailTemplateRecord } from "@/types/api";
import { LetterPreview } from "./LetterPreview";

/** Render the real compiled letter, including imported artwork. Only nearby
 * thumbnails mount frames, so a large library doesn't load hundreds of emails. */
function DirectorThumbnail({ template }: { template: EmailTemplateRecord }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const pageWidth = Math.max(640, template.builderDocument.contentWidth || 640);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "240px 0px" });
    resize.observe(element); intersection.observe(element);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, []);
  return <div ref={container} aria-hidden="true" inert className="pointer-events-none relative aspect-[3/4] w-full overflow-hidden rounded bg-white">
    {visible && width > 0 ? <div className="absolute left-0 top-0 origin-top-left" style={{ width: pageWidth, transform: `scale(${width / pageWidth})` }}>
      <LetterPreview html={template.emailBodyHtml} title={`Миниатюра: ${template.name}`} className="h-[1600px]" />
    </div> : <div className="absolute inset-0 bg-surface-subtle" />}
  </div>;
}

export function DirectorTemplateRail({ templates, selectedId, disabled, onSelect }: {
  templates: EmailTemplateRecord[]; selectedId?: string; disabled: boolean; onSelect: (id: string) => void;
}) {
  const rail = useRef<HTMLElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // Scroll only the rail, never the modal or the workspace. Opening a template
  // near the bottom of the library should still reveal its selected thumbnail.
  useEffect(() => {
    const list = rail.current, button = selectedId ? buttons.current.get(selectedId) : undefined;
    if (!list || !button) return;
    const viewport = list.getBoundingClientRect(), item = button.getBoundingClientRect();
    if (item.top < viewport.top + 8) list.scrollTop += item.top - viewport.top - 8;
    else if (item.bottom > viewport.bottom - 8) list.scrollTop += item.bottom - viewport.bottom + 8;
  }, [selectedId]);
  return <nav ref={rail} aria-label="Выбор письма" className="scrollbar-subtle min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain border-e border-border bg-surface-subtle p-2">
    <ul className="m-0 grid list-none gap-3 p-0">
      {templates.map((template, index) => <li key={template.id} className="min-w-0"><button
        ref={element => { if (element) buttons.current.set(template.id, element); else buttons.current.delete(template.id); }}
        type="button" disabled={disabled} aria-label={template.name} title={template.name} aria-pressed={template.id === selectedId}
        tabIndex={template.id === selectedId || (!selectedId && index === 0) ? 0 : -1}
        className={`relative block w-full rounded-lg border-2 p-1 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${template.id === selectedId ? "border-primary bg-primary/10" : "border-transparent bg-white hover:border-border-strong"}`}
        onClick={() => onSelect(template.id)}
        onKeyDown={event => {
          const offset = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
          if (!offset && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? templates.length - 1 : Math.max(0, Math.min(templates.length - 1, index + offset));
          onSelect(templates[next].id); buttons.current.get(templates[next].id)?.focus({ preventScroll: true });
        }}>
        <DirectorThumbnail template={template} />
        {template.id === selectedId && <span aria-hidden="true" className="absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-white shadow-sm"><Check className="size-3" /></span>}
      </button></li>)}
    </ul>
  </nav>;
}
