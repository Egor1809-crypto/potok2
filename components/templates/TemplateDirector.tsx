"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Modal, Select } from "@/components/ui";
import { CreativeDirectorPanel } from "@/components/email-builder/CreativeDirectorPanel";
import { documentFromApiTemplate, type BuilderDocument } from "@/components/email-builder/builder-types";
import type { EmailTemplateRecord } from "@/types/api";
import { LetterPreview } from "./LetterPreview";

type WorkingTemplate = { template: EmailTemplateRecord; document: BuilderDocument; dirty: boolean };
export function TemplateDirector({ open, onOpenChange, templates, initialTemplate, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; templates: EmailTemplateRecord[];
  initialTemplate: EmailTemplateRecord | null; onSaved: (template: EmailTemplateRecord) => void;
}) {
  const selectId = useId();
  const [working, setWorking] = useState<WorkingTemplate | null>(null);
  const [view, setView] = useState<"audit" | "preview">("audit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const drafts = useRef(new Map<string, WorkingTemplate>());
  const openedFor = useRef<string | null>(null);
  const initialId = initialTemplate?.id;
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
    if (template.isStarter) {
      const base = `${name} — редакция`; name = base;
      for (let index = 2; templates.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()); index++) name = `${base} ${index}`;
    }
    try {
      const response = await fetch("/api/templates", { method: template.isStarter ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...(template.isStarter ? {} : { id: template.id, expectedUpdatedAt: template.updatedAt }),
        name, description: template.description, category: template.category, subject: document.subject, previewText: document.previewText, builderDocument: document,
      }) });
      const body = await response.json() as { template?: EmailTemplateRecord; error?: string; details?: string[] };
      if (!response.ok || !body.template) throw new Error([body.error || "Не удалось сохранить изменения.", ...(body.details ?? [])].join(" "));
      const next = { template: body.template, document: documentFromApiTemplate(body.template), dirty: false };
      drafts.current.delete(template.id); drafts.current.set(next.template.id, next); setWorking(next); onSaved(body.template); setNotice("Изменения сохранены в библиотеке.");
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить изменения."); }
    finally { setBusy(false); }
  }
  return <Modal open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }} title="Арт-директор шаблонов" description="Выберите готовое письмо, проверьте его и сохраните улучшения в библиотеку." size="full" closeOnEscape={!busy} closeOnBackdrop={!busy}
    footer={<><span role="status" className="mr-auto min-w-0 text-sm text-text-muted">{notice || (working?.dirty ? "Есть изменения. Они останутся здесь до закрытия страницы." : "")}</span><Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>В библиотеку</Button><Button disabled={busy || !working?.dirty} loading={busy} onClick={() => void save()}>{working?.template.isStarter ? "Сохранить в мои шаблоны" : "Сохранить изменения"}</Button></>}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><label htmlFor={selectId} className="min-w-0 flex-1 text-sm"><span className="mb-1 block">Шаблон</span><Select id={selectId} value={working?.template.id ?? ""} disabled={busy} onChange={event => select(event.target.value)} options={templates.map(template => ({ value: template.id, label: template.name }))} /></label><div className="flex gap-1 rounded-lg bg-surface-subtle p-1" role="group" aria-label="Режим арт-директора"><Button size="sm" variant={view === "audit" ? "primary" : "ghost"} aria-pressed={view === "audit"} onClick={() => setView("audit")}>Разбор и правки</Button><Button size="sm" variant={view === "preview" ? "primary" : "ghost"} aria-pressed={view === "preview"} onClick={() => setView("preview")}>Письмо</Button></div></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {working ? view === "preview" ? <LetterPreview document={working.document} title={`Письмо: ${working.template.name}`} /> : working.document.rawHtml ? <div className="space-y-4"><p className="rounded-xl bg-surface-subtle p-4 text-sm leading-6">Это письмо импортировано в исходном HTML. Блочные дизайн-системы к нему не применяются, чтобы сохранить оформление. Проверьте макет ниже; изменить HTML можно в редакторе шаблона.</p><LetterPreview document={working.document} /><a className="btn btn-secondary" href={`/email-builder?template=${encodeURIComponent(working.template.id)}`}>Открыть редактор шаблона</a></div> : <fieldset disabled={busy} className="min-w-0"><CreativeDirectorPanel key={working.template.id} embedded open onOpenChange={() => {}} document={working.document} onApply={(document, message) => { const next = { ...working, document, dirty: true }; drafts.current.set(working.template.id, next); setWorking(next); setNotice(`${message}. Откройте вкладку «Письмо», чтобы посмотреть результат.`); }} /></fieldset> : <p className="py-8 text-sm text-text-muted">В библиотеке пока нет шаблонов. Добавьте письмо, чтобы начать разбор.</p>}
    </div>
  </Modal>;
}
