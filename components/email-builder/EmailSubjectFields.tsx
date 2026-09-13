"use client";
import { ChevronDown } from "@/components/ui/icons";
import { useEffect, useRef, useState } from "react";
import { Button, FormField, Input, Modal } from "@/components/ui";
import { emptyAiEmailBrief } from "@/lib/email-ai/defaults";
import type { BuilderDocument } from "./builder-types";
import { useEmailAiRequest } from "./useEmailAiRequest";
import { EmailHtmlPreview } from "./EmailHtmlPreview";
import { emailReviewFingerprint } from "@/lib/email-ai/review";
import { EmailTestSend } from "./EmailTestSend";

export function EmailSubjectFields({ document, onUpdate, onOpenAi }: { document: BuilderDocument; onUpdate: (patch: Partial<BuilderDocument>) => void; onOpenAi: () => void }) {
  const ai = useEmailAiRequest(); const [variants, setVariants] = useState<Array<{ subject: string; preheader: string }>>([]); const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [appliedSubject, setAppliedSubject] = useState("");
  const [message, setMessage] = useState(""); const source = useRef("");
  const brief = document.aiMetadata?.brief || emptyAiEmailBrief();
  const identity = emailReviewFingerprint(document, brief);
  const current = useRef(document); useEffect(() => { current.current = document; }, [document]);
  const generate = async () => { const snapshot = identity; setMessage(""); const result = await ai.run("subject-variants", { document, brief: document.aiMetadata?.brief || { ...emptyAiEmailBrief(), description: `Предложи тему текущего письма: ${document.subject}` } }); if (!result) return; if (emailReviewFingerprint(current.current, current.current.aiMetadata?.brief || emptyAiEmailBrief()) !== snapshot) { ai.setError("Письмо изменилось. Повторите подбор темы для текущей версии."); return; } if (result?.variants) { source.current = snapshot; setVariants(result.variants); setOpen(true); } };
  return <div className="shrink-0 border-b border-border bg-surface px-3 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-expanded={expanded} aria-controls="email-envelope-fields" onClick={() => setExpanded(value => !value)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-primary">
        <span className="shrink-0 text-sm text-text-muted">Тема</span><span className="truncate text-sm font-medium">{document.subject || "Укажите тему письма"}</span><ChevronDown aria-hidden className={`size-6 shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={ai.busy || !document.blocks.length || Boolean(document.rawHtml)} onClick={() => void generate()}>{ai.busy ? "Подбираем темы…" : "Ещё варианты темы"}</Button>
        <EmailHtmlPreview document={document} /><EmailTestSend document={document} />
        <Button type="button" variant="secondary" size="sm" onClick={onOpenAi}>Изменить с ИИ</Button>
      </div>
    </div>
    <div id="email-envelope-fields" hidden={!expanded}>
      <div className="grid gap-3 pb-2 pt-3 sm:grid-cols-2">
        <FormField label="Тема" htmlFor="email-studio-subject"><Input id="email-studio-subject" value={document.subject} onChange={e => { setMessage(""); onUpdate({ subject: e.target.value }); }} maxLength={300} /></FormField>
        <FormField label="Прехедер" htmlFor="email-studio-preheader"><Input id="email-studio-preheader" value={document.previewText} onChange={e => { setMessage(""); onUpdate({ previewText: e.target.value }); }} maxLength={500} /></FormField>
      </div>
    </div>
    {ai.error ? <p role="alert" className="mb-0 text-xs text-danger">{ai.error}</p> : null}
    <div role="status" className="text-xs text-text-muted">{appliedSubject === document.subject ? message : ""}</div>
    <Modal open={open} onOpenChange={setOpen} title="Выберите тему и прехедер" description="Выбранная пара заменит тему и прехедер над письмом. Содержимое письма останется прежним." size="lg"><div className="grid gap-3">{variants.map((variant, index) => <button type="button" key={index} className="rounded-xl border border-border p-4 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary" onClick={() => {
        if (source.current !== emailReviewFingerprint(current.current, current.current.aiMetadata?.brief || emptyAiEmailBrief())) { setOpen(false); ai.setError("Письмо изменилось. Подберите темы заново."); return; }
        onUpdate({ subject: variant.subject, previewText: variant.preheader });
        setOpen(false); setExpanded(true); setAppliedSubject(variant.subject); setMessage("Тема и прехедер применены. Сохраните письмо, чтобы обновить шаблон.");
      }}><strong className="block text-sm">{variant.subject}</strong><span className="mt-2 block text-sm text-text-muted">{variant.preheader}</span></button>)}</div></Modal></div>;
}
