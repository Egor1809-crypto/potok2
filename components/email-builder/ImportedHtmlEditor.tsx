"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { LetterImageControls } from "./LetterImageControls";
import { editLetterAttribute, editLetterStyle, editLetterText, insertLetterIcon, letterElements, letterLink, selectableLetterHtml } from "@/lib/email-import/visual-editor";
import type { BuilderDocument, PreviewMode } from "./builder-types";
import { EmailIconPicker } from "./EmailIconPicker";
import { emailIconMarkup } from "@/lib/email-icons";
import { LetterLinkEditor } from "./LetterLinkEditor";

export function ImportedHtmlEditor({ document: letter, onChange, previewMode, focusCanvas = false }: {
  document: BuilderDocument; onChange: (document: BuilderDocument) => void; previewMode: PreviewMode; focusCanvas?: boolean;
}) {
  const html = letter.rawHtml || "";
  const elements = useMemo(() => letterElements(html), [html]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [mobileProperties, setMobileProperties] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const scroll = useRef({ x: 0, y: 0 });
  const item = elements[selected] || elements[0];
  const currentHtml = useRef(html); currentHtml.current = html;
  const annotated = useMemo(() => selectableLetterHtml(html), [html]);
  const update = (fn: (source: string) => string) => {
    try { const next = fn(currentHtml.current); if (next !== currentHtml.current) onChange({ ...letter, rawHtml: next }); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось изменить элемент."); }
  };
  const highlight = () => {
    const doc = frame.current?.contentDocument;
    doc?.querySelectorAll("[data-potok-edit]").forEach(node => {
      const active = node.getAttribute("data-potok-edit") === String(item?.index);
      (node as HTMLElement).style.outline = active ? "2px solid #7835ff" : "";
      node.setAttribute("aria-pressed", String(active));
    });
  };
  useEffect(highlight, [item?.index]); // Outline is preview-only, never part of the saved source.
  const load = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll<HTMLElement>("[data-potok-edit]").forEach(node => { node.tabIndex = 0; node.style.cursor = "pointer"; node.setAttribute("role", "button"); node.setAttribute("aria-label", `Редактировать: ${elements[Number(node.dataset.potokEdit)]?.label || "элемент"}`); });
    const select = (event: Event) => {
      event.preventDefault();
      const target = (event.target as Element)?.closest?.("[data-potok-edit]");
      if (target) { setSelected(Number(target.getAttribute("data-potok-edit"))); if (window.matchMedia("(max-width: 1023px)").matches) setMobileProperties(true); }
    };
    // No scripts, forms or navigation inside the imported document are allowed.
    doc.addEventListener("click", select, true);
    doc.addEventListener("auxclick", event => event.preventDefault(), true);
    doc.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") select(event); });
    doc.defaultView?.addEventListener("scroll", () => { scroll.current = { x: doc.defaultView!.scrollX, y: doc.defaultView!.scrollY }; });
    doc.defaultView?.scrollTo(scroll.current.x, scroll.current.y);
    highlight();
  };
  const selectElement = (value: number) => {
    setSelected(value);
    frame.current?.contentDocument?.querySelector(`[data-potok-edit="${value}"]`)?.scrollIntoView({ block: "center" });
  };
  const visible = elements.filter(element => tab === "all" || element.kind === tab);
  return <section aria-label="Редактирование готового письма" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-inset">
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 text-xs">
      <span className="mr-auto text-text-muted">Нажмите на элемент письма, чтобы изменить его</span>
      <Button size="sm" variant="secondary" className="lg:!hidden" aria-pressed={mobileProperties} onClick={() => setMobileProperties(value => !value)}>{mobileProperties ? "Показать письмо" : "Элементы и свойства"}</Button>
    </div>
    <div className={`grid min-h-0 flex-1 ${focusCanvas ? "" : "lg:grid-cols-[minmax(0,1fr)_310px]"}`}>
      <div className={`min-h-0 min-w-0 overflow-auto p-3 ${mobileProperties && !focusCanvas ? "hidden lg:block" : ""}`}>
        <iframe ref={frame} title="Редактируемое письмо" sandbox="allow-same-origin" srcDoc={annotated} onLoad={load} className="mx-auto block h-full min-h-80 w-full border-0 bg-white shadow-sm" style={{ maxWidth: previewMode === "mobile" ? 390 : Math.max(640, letter.contentWidth) }} />
      </div>
      {!focusCanvas && <aside aria-label="Свойства элемента письма" className={`min-h-0 overflow-y-auto border-l border-border bg-surface p-4 ${mobileProperties ? "" : "hidden lg:block"}`}>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-xs font-medium">Показать<Select value={tab} onChange={event => setTab(event.target.value)} options={[{ value: "all", label: "Все элементы" }, { value: "image", label: "Изображения" }, { value: "link", label: "Кнопки и ссылки" }, { value: "text", label: "Текст" }]} /></label>
          <label className="grid gap-1.5 text-xs font-medium">Элемент<Select value={visible.some(value => value.index === item?.index) ? String(item?.index) : ""} onChange={event => selectElement(Number(event.target.value))} options={[{ value: "", label: "Выберите элемент", disabled: true }, ...visible.map(element => ({ value: String(element.index), label: `${element.kind === "image" ? "Изображение" : element.kind === "link" ? "Ссылка" : "Текст"} · ${element.label}` }))]} /></label>
          <div role="alert" className="text-xs text-danger">{error}</div>
          {item ? <div key={`${item.index}:${item.tag}`} className="grid gap-4">
            {item.texts.map((text, index) => <label key={index} className="grid gap-1.5 text-xs font-medium">{item.texts.length > 1 ? `Текст · часть ${index + 1}` : "Текст"}<textarea aria-label={item.texts.length > 1 ? `Текст · часть ${index + 1}` : "Текст"} key={text.value} defaultValue={text.value} rows={3} className="w-full rounded-lg border border-border bg-surface p-2 text-sm" onBlur={event => { if (event.target.value !== text.value) update(source => editLetterText(source, item.index, index, event.target.value)); }} /></label>)}
            {item.kind === "image" && <LetterImageControls item={item} update={update} />}
            {item.kind !== "image" && <label className="grid gap-1.5 text-xs font-medium">Выравнивание текста<Select value={/text-align:\s*(left|center|right)/i.exec(item.attributes.style || "")?.[1] || "left"} onChange={event => update(source => editLetterStyle(source, item.index, { "text-align": event.target.value }))} options={[{ value: "left", label: "Слева" }, { value: "center", label: "По центру" }, { value: "right", label: "Справа" }]} /></label>}
            <div className="grid grid-cols-2 gap-2">{(["top", "bottom"] as const).map(side => <label key={side} className="grid gap-1.5 text-xs font-medium">{side === "top" ? "Отступ сверху" : "Отступ снизу"}<input type="number" min={0} max={160} key={item.attributes.style} defaultValue={new RegExp(`padding-${side}:\\s*(\\d+)`).exec(item.attributes.style || "")?.[1] || ""} placeholder="Авто" className="min-w-0 rounded-lg border border-border p-2" onBlur={event => { if (event.target.value && event.target.value !== event.target.defaultValue) update(source => editLetterStyle(source, item.index, { [`padding-${side}`]: `${Math.max(0, Math.min(160, Number(event.target.value)))}px` })); }} /></label>)}</div>
            <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Добавить значок рядом</summary><div className="mt-3"><EmailIconPicker onSelect={id => update(source => insertLetterIcon(source, item.index, emailIconMarkup(id)))} /></div></details>
            <LetterLinkEditor html={html} index={item.index} value={letterLink(item)} onChange={next => update(() => next)} />
          </div> : <p className="text-sm text-text-muted">Нет отдельных элементов. Если письмо состоит из картинки, подготовьте редактируемую версию в арт-директоре.</p>}
        </div>
      </aside>}
    </div>
  </section>;
}
