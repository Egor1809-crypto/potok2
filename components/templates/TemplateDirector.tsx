"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Modal } from "@/components/ui";
import { CreativeDirectorPanel } from "@/components/email-builder/CreativeDirectorPanel";
import { documentFromApiTemplate, type BuilderDocument } from "@/components/email-builder/builder-types";
import type { EmailTemplateRecord } from "@/types/api";
import { LetterPreview } from "./LetterPreview";
import { ImportedLetterDirector } from "./ImportedLetterDirector";
import { DirectorTemplateRail } from "./DirectorTemplateRail";

type WorkingTemplate = { template: EmailTemplateRecord; document: BuilderDocument; dirty: boolean };
export function TemplateDirector({ open, onOpenChange, templates, initialTemplate, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; templates: EmailTemplateRecord[];
  initialTemplate: EmailTemplateRecord | null; onSaved: (template: EmailTemplateRecord) => void;
}) {
  const [working, setWorking] = useState<WorkingTemplate | null>(null);
  const [view, setView] = useState<"audit" | "preview">("audit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const drafts = useRef(new Map<string, WorkingTemplate>());
  const openedFor = useRef<string | null>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const initialId = initialTemplate?.id;
  useEffect(() => { if (workspace.current) workspace.current.scrollTop = 0; }, [working?.template.id, view]);
  useEffect(() => {
    if (!open) { openedFor.current = null; return; }
    const selectionKey = initialId ?? "library";
    if (openedFor.current === selectionKey || !templates.length) return;
    openedFor.current = selectionKey;
    const selected = templates.find(template => template.id === initialId);
    if (selected) { setWorking(drafts.current.get(selected.id) ?? { template: selected, document: documentFromApiTemplate(selected), dirty: false }); setView("audit"); }
    else if (!working && templates.length) {
      const template = templates.find(item => !item.isStarter) ?? templates[0];
      setWorking(drafts.current.get(template.id) ?? { template, document: documentFromApiTemplate(template), dirty: false });
    }
    setError("");
  // Opening a card is an explicit selection; list refreshes must not replace unsaved edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialId, templates.length]);
  function select(id: string) {
    const template = templates.find(item => item.id === id); if (!template) return;
    setWorking(drafts.current.get(id) ?? { template, document: documentFromApiTemplate(template), dirty: false }); setError(""); setNotice("");
  }
  async function save() {
    if (!working || busy) return;
    setBusy(true); setError("");
    const { template, document } = working;
    let name = template.name;
    const saveCopy = template.isStarter || Boolean(document.rawHtml);
    if (saveCopy) {
      const base = `${name} — редакция`; name = base;
      for (let index = 2; templates.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()); index++) name = `${base} ${index}`;
    }
    try {
      const response = await fetch("/api/templates", { method: saveCopy ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...(saveCopy ? {} : { id: template.id, expectedUpdatedAt: template.updatedAt }),
        name, description: template.description, category: template.category, subject: document.subject, previewText: document.previewText, builderDocument: document,
      }) });
      const body = await response.json() as { template?: EmailTemplateRecord; error?: string; details?: string[] };
      if (!response.ok || !body.template) throw new Error([body.error || "Не удалось сохранить изменения.", ...(body.details ?? [])].join(" "));
      const next = { template: body.template, document: documentFromApiTemplate(body.template), dirty: false };
      drafts.current.delete(template.id); drafts.current.set(next.template.id, next); setWorking(next); onSaved(body.template); setNotice(saveCopy ? "Копия сохранена в библиотеке. Исходное письмо не изменено." : "Изменения сохранены в библиотеке.");
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить изменения."); }
    finally { setBusy(false); }
  }
  return <Modal open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }} title="Арт-директор шаблонов" hideHeader size="full" panelClassName="!max-w-[1600px] h-[calc(100dvh-32px)]" contentClassName="!p-0 !overflow-hidden flex" closeOnEscape={!busy} closeOnBackdrop={!busy}
    footer={<><span role="status" className="mr-auto min-w-0 text-sm text-text-muted">{notice || (working?.dirty ? "Есть изменения. Они останутся здесь до закрытия страницы." : "")}</span>{working && !working.dirty && !busy && <Link href={`/email-builder?template=${encodeURIComponent(working.template.id)}`} className="text-sm font-medium text-primary underline">Редактировать вручную</Link>}<Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>В библиотеку</Button><Button disabled={busy || !working?.dirty} loading={busy} onClick={() => void save()}>{working?.document.rawHtml ? "Сохранить отдельную копию" : working?.template.isStarter ? "Сохранить в мои шаблоны" : "Сохранить изменения"}</Button></>}>
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[76px_minmax(0,1fr)] sm:grid-cols-[148px_minmax(0,1fr)] xl:grid-cols-[188px_minmax(0,1fr)]">
      <DirectorTemplateRail templates={templates} selectedId={working?.template.id} disabled={busy} onSelect={select} />
      <section aria-label="Рабочая область арт-директора" className="flex min-h-0 min-w-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 pe-12 sm:px-5 sm:pe-14"><div className="flex max-w-full gap-1 rounded-lg bg-surface-subtle p-1" role="group" aria-label="Режим арт-директора"><Button size="sm" variant={view === "audit" ? "primary" : "ghost"} aria-pressed={view === "audit"} aria-label="Разбор и правки" className="max-sm:!px-2" onClick={() => setView("audit")}><span className="hidden sm:inline">Разбор и правки</span><span className="sm:hidden">Правки</span></Button><Button size="sm" variant={view === "preview" ? "primary" : "ghost"} aria-pressed={view === "preview"} className="max-sm:!px-2" onClick={() => setView("preview")}>Письмо</Button></div></div>
        <div ref={workspace} className="scrollbar-subtle min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-5" data-director-workspace>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {working ? view === "preview" ? <LetterPreview fill document={working.document} title={`Письмо: ${working.template.name}`} /> : working.document.rawHtml ? <fieldset disabled={busy} className="min-w-0"><ImportedLetterDirector key={working.template.id} document={working.document} onApply={(document, message) => { const next = { ...working, document, dirty: true }; drafts.current.set(working.template.id, next); setWorking(next); setNotice(message); }} /></fieldset> : <fieldset disabled={busy} className="min-w-0"><CreativeDirectorPanel key={working.template.id} embedded open onOpenChange={() => {}} document={working.document} onApply={(document, message) => { const next = { ...working, document, dirty: true }; drafts.current.set(working.template.id, next); setWorking(next); setNotice(`${message}. Откройте вкладку «Письмо», чтобы посмотреть результат.`); }} /></fieldset> : <p className="py-8 text-sm text-text-muted">В библиотеке пока нет шаблонов. Добавьте письмо, чтобы начать разбор.</p>}
        </div>
      </section>
    </div>
  </Modal>;
}
