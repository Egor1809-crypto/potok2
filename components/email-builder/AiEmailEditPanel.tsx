"use client";
import { useEffect, useRef, useState } from "react";
import { Button, FormField, Select, Textarea } from "@/components/ui";
import { emptyAiEmailBrief } from "@/lib/email-ai/defaults";
import type { AiEmailReview } from "@/types/email-ai";
import { builderDocumentFromInput, type BuilderBlock, type BuilderDocument } from "./builder-types";
import { useEmailAiRequest } from "./useEmailAiRequest";
import { EmailReviewReport } from "./EmailReviewReport";
import { emailReviewFingerprint } from "@/lib/email-ai/review";

const commands = ["Сделать короче", "Сделать более продающим", "Сделать более деловым", "Сделать более премиальным", "Сделать технологичнее", "Сделать дружелюбнее", "Упростить текст", "Сделать CTA сильнее", "Предложить другой заголовок", "Убрать повторы", "Добавить преимущества", "Сгенерировать другой вариант"];
export function AiEmailEditPanel({ document, block, onApply, onSelectBlock }: { document: BuilderDocument; block?: BuilderBlock; onApply: (next: BuilderDocument) => void; onSelectBlock: (id: string) => void }) {
  const [scope, setScope] = useState("block"); const [instruction, setInstruction] = useState("");
  const [report, setReport] = useState<AiEmailReview | undefined>();
  const latest = useRef(document);
  useEffect(() => { latest.current = document; }, [document]);
  const ai = useEmailAiRequest();
  const brief = document.aiMetadata?.brief || { ...emptyAiEmailBrief(), description: `Редактирование письма: ${document.subject}. Сохрани существующие факты, ссылки и содержание.` };
  const run = async (action: string, command = instruction) => {
    const snapshot = document;
    const result = await ai.run(action, { brief, document, blockId: block?.id, instruction: command });
    if (latest.current !== snapshot) { ai.setError("Письмо изменилось во время работы ИИ. Повторите команду для текущей версии."); return; }
    if (result?.document) onApply(builderDocumentFromInput(result.document));
    if (result?.review) {
      setReport(result.review);
      if (!result.document) onApply({ ...snapshot, aiMetadata: { ...(snapshot.aiMetadata || { brief, generationId: crypto.randomUUID(), generatedAt: new Date().toISOString(), model: "review" }), review: result.review } });
    }
  };
  const fingerprint = emailReviewFingerprint(document, brief);
  const review = [report, document.aiMetadata?.review].find(r => r?.fingerprint === fingerprint) || report || document.aiMetadata?.review;
  const currentReview = review?.fingerprint === fingerprint;
  return <aside className="min-h-0 overflow-y-auto p-4" aria-label="Изменить письмо с ИИ">
    <h3 className="m-0 text-sm font-semibold text-text-strong">Изменить с ИИ</h3>
    <p className="mt-2 text-xs leading-5 text-text-muted">ИИ учитывает текущее письмо. Изменение можно отменить кнопкой Undo.</p>
    {document.rawHtml ? <p className="text-sm text-text-muted">Этот макет импортирован как HTML. AI-редактирование доступно для писем из блоков.</p> : <form className="grid gap-4" onSubmit={e => { e.preventDefault(); void run(scope === "block" ? "rewrite-block" : "rewrite"); }}>
      <FormField label="Что изменить" htmlFor="ai-edit-scope"><Select id="ai-edit-scope" value={scope} onChange={e => setScope(e.target.value)} disabled={ai.busy} options={[{ value: "block", label: block ? "Выбранный блок" : "Выберите блок на холсте" }, { value: "email", label: "Всё письмо" }]} /></FormField>
      {scope === "block" && block ? <p className="m-0 truncate rounded-lg bg-surface-subtle p-2 text-xs">{block.content.slice(0, 90) || block.type}</p> : null}
      <FormField label="Быстрая команда" htmlFor="ai-quick-command"><Select id="ai-quick-command" value={commands.includes(instruction) ? instruction : ""} onChange={e => setInstruction(e.target.value)} disabled={ai.busy} options={[{ value: "", label: "Выбрать команду" }, ...commands.map(value => ({ value, label: value }))]} /></FormField>
      <FormField label="Что изменить?" htmlFor="ai-edit-instruction"><Textarea id="ai-edit-instruction" rows={5} value={instruction} onChange={e => setInstruction(e.target.value)} disabled={ai.busy} required maxLength={2500} placeholder="Например: сократи первый экран, сохрани факты и кнопку" /></FormField>
      <Button type="button" variant="secondary" disabled={ai.busy} onClick={() => void run("rewrite", "Сгенерировать другой вариант всего письма: предложи новую композицию и подачу, сохрани все исходные факты, ссылки и смысл.")}>Другой вариант всего письма</Button>
      {block?.type === "pattern" ? <Button type="button" variant="secondary" disabled={ai.busy} onClick={() => void run("rewrite-block", "Пересоздай выбранный узор с настоящим прозрачным фоном: новый image.prompt вместо существующего assetId. Сохрани мотив и палитру, тонкие чёткие линии, широкая горизонтальная композиция. Без подложки и теней.")}>Пересоздать узор без фона</Button> : null}
      <Button type="submit" variant="primary" disabled={ai.busy || scope === "block" && !block}>{ai.busy ? "Вносим изменения…" : "Применить команду"}</Button>
      {ai.busy ? <Button type="button" variant="secondary" onClick={ai.cancel}>Остановить</Button> : <Button type="button" variant="secondary" onClick={() => void run("review")}>Проверить письмо</Button>}
    </form>}
    <div role="status" className="mt-3 text-xs text-text-muted">{ai.busy ? ai.stageLabel : ""}</div>
    {ai.error ? <p role="alert" className="rounded-lg bg-danger-subtle p-3 text-xs leading-5 text-danger">{ai.error}</p> : null}
    {review ? <EmailReviewReport review={review} current={currentReview} onSelectBlock={onSelectBlock} onFix={(id, command) => { if (id) onSelectBlock(id); setScope(id ? "block" : "email"); setInstruction(command); }} /> : null}
  </aside>;
}
