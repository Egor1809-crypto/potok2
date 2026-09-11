"use client";
import { useEffect, useRef, useState } from "react";
import { Button, FormField, Input, Modal } from "@/components/ui";
import { emptyAiEmailBrief } from "@/lib/email-ai/defaults";
import type { BuilderDocument } from "./builder-types";
import { useEmailAiRequest } from "./useEmailAiRequest";
import { EmailHtmlPreview } from "./EmailHtmlPreview";
import { EmailTestSend } from "./EmailTestSend";

export function EmailSubjectFields({ document, onUpdate, onOpenAi }: { document: BuilderDocument; onUpdate: (patch: Partial<BuilderDocument>) => void; onOpenAi: () => void }) {
  const ai = useEmailAiRequest(); const [variants, setVariants] = useState<Array<{ subject: string; preheader: string }>>([]); const [open, setOpen] = useState(false);
  const current = useRef(document); useEffect(() => { current.current = document; }, [document]);
  const generate = async () => { const snapshot = document; const result = await ai.run("subject-variants", { document, brief: document.aiMetadata?.brief || { ...emptyAiEmailBrief(), description: `Предложи тему текущего письма: ${document.subject}` } }); if (current.current !== snapshot) { ai.setError("Письмо изменилось. Повторите подбор темы для текущей версии."); return; } if (result?.variants) { setVariants(result.variants); setOpen(true); } };
  return <div className="shrink-0 border-b border-border bg-surface px-4 py-3"><div className="grid gap-3 sm:grid-cols-2"><FormField label="Тема" htmlFor="email-studio-subject"><Input id="email-studio-subject" value={document.subject} onChange={e => onUpdate({ subject: e.target.value })} maxLength={300} /></FormField><FormField label="Прехедер" htmlFor="email-studio-preheader"><Input id="email-studio-preheader" value={document.previewText} onChange={e => onUpdate({ previewText: e.target.value })} maxLength={500} /></FormField></div><div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" variant="secondary" size="sm" disabled={ai.busy || !document.blocks.length || Boolean(document.rawHtml)} onClick={() => void generate()}>{ai.busy ? "Подбираем темы…" : "Ещё варианты темы"}</Button><EmailHtmlPreview document={document} /><EmailTestSend document={document} /><Button type="button" variant="secondary" size="sm" onClick={onOpenAi}>Изменить с ИИ</Button></div>{ai.error ? <p role="alert" className="mb-0 text-xs text-danger">{ai.error}</p> : null}<Modal open={open} onOpenChange={setOpen} title="Выберите тему и прехедер" size="lg"><div className="grid gap-3">{variants.map((variant, index) => <button type="button" key={index} className="rounded-xl border border-border p-4 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { onUpdate({ subject: variant.subject, previewText: variant.preheader }); setOpen(false); }}><strong className="block text-sm">{variant.subject}</strong><span className="mt-2 block text-sm text-text-muted">{variant.preheader}</span></button>)}</div></Modal></div>;
}
