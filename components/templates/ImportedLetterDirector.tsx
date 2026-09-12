"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Textarea } from "@/components/ui";
import type { BuilderDocument } from "@/components/email-builder/builder-types";
import { importedSource, addImportViewport, type ImportDirection } from "@/lib/email-import/director";
import type { ImportResource } from "@/lib/email-import/import-letter";
import { prepareDirectorCrops, publishDirectorCrops } from "@/lib/email-import/director-crops";
import { LetterPreview } from "./LetterPreview";

export function ImportedLetterDirector({ document, onApply }: { document: BuilderDocument; onApply: (document: BuilderDocument, message: string) => void }) {
  const html = document.rawHtml || "", source = importedSource(html), commandId = useId();
  const [command, setCommand] = useState("");
  const [result, setResult] = useState<(ImportDirection & { sourceHtml: string; resources: ImportResource[] }) | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<"original" | "proposal">("original");
  const [mobile, setMobile] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const resources = useRef<ImportResource[]>([]);
  const current = result?.sourceHtml === html ? result : null;
  useEffect(() => () => { operation.current?.abort(); for (const resource of resources.current) URL.revokeObjectURL(resource.url); resources.current = []; }, [html]);
  async function run(action: "review" | "revise" | "rebuild") {
    operation.current?.abort();
    const controller = new AbortController(); operation.current = controller;
    setBusy(action === "review" ? "Читаем письмо и разбираем оформление…" : source.imageOnly ? "Восстанавливаем текст и оформление по изображению…" : "Готовим правки исходного HTML…"); setError("");
    try {
      const response = await fetch("/api/email-import/director", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, action, command }) });
      const body = await response.json() as ImportDirection & { error?: string };
      if (!response.ok) throw new Error(body.error || "Не удалось разобрать письмо.");
      const prepared = body.html ? await prepareDirectorCrops(body.html, body.crops, controller.signal) : { html: "", resources: [] };
      if (controller.signal.aborted) { for (const resource of prepared.resources) URL.revokeObjectURL(resource.url); return; }
      for (const resource of resources.current) URL.revokeObjectURL(resource.url);
      resources.current = prepared.resources;
      setResult({ ...body, ...prepared, sourceHtml: html }); setPreview(prepared.html ? "proposal" : "original");
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось разобрать письмо."); }
    finally { if (!controller.signal.aborted) setBusy(""); }
  }
  async function apply() {
    if (!current?.html) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy("Подготавливаем копию письма…"); setError("");
    try {
      const nextHtml = await publishDirectorCrops(current.html, current.resources, controller.signal);
      if (!controller.signal.aborted) { setBusy(""); setResult(null); setPreview("original"); onApply({ ...document, rawHtml: nextHtml }, "Предложение применено. Сохраните отдельную копию в библиотеку."); }
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось применить правки."); }
    finally { if (!controller.signal.aborted) setBusy(""); }
  }
  return <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
    <div className="min-w-0 space-y-4">
      <div><h3 className="font-semibold">{source.imageOnly ? "Письмо из изображения" : "Импортированное письмо"}</h3><p className="mt-2 text-sm leading-6 text-text-muted">{source.imageOnly ? "ИИ прочитает изображения и предложит правки. Можно восстановить письмо как HTML с редактируемым текстом." : "ИИ проверит исходный HTML и внесёт точечные правки по вашему заданию."} Исходник останется в библиотеке.</p></div>
      <Button className="w-full" variant="secondary" disabled={Boolean(busy)} onClick={() => void run("review")}>Разобрать письмо</Button>
      <div className="space-y-2"><label className="text-sm font-semibold" htmlFor={commandId}>Что изменить?</label><Textarea id={commandId} rows={4} maxLength={3000} value={command} disabled={Boolean(busy)} onChange={event => setCommand(event.target.value)} placeholder={source.imageOnly ? "Например: восстанови это письмо с живым текстом, сохрани цвета и фото. Сделай заголовок компактнее." : "Например: увеличь основной текст до 16 px и сократи отступ перед кнопкой. Остальное сохрани."} /><Button className="w-full" disabled={Boolean(busy) || !command.trim()} onClick={() => void run(source.imageOnly ? "rebuild" : "revise")}>{source.imageOnly ? "Подготовить редактируемую версию" : "Подготовить правки"}</Button></div>
      {busy && <p role="status" className="text-sm leading-6 text-brand">{busy}</p>}
      {error && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}
      {current && <section className="space-y-4 rounded-xl border border-border p-4" aria-label="Разбор импортированного письма"><h4 className="font-semibold">{current.html ? "Предлагаемые изменения" : "Разбор арт-директора"}</h4><p className="text-sm leading-6">{current.summary}</p><p className="text-xs text-text-muted">По исходному HTML{current.imagesTotal ? ` и изображениям: ${current.imagesSeen} из ${current.imagesTotal}` : ""}. Оценка оформления — рекомендация, без условных баллов.</p>{current.findings.length > 0 && <ul className="space-y-4 text-sm leading-6">{current.findings.map((item, index) => <li key={index}><span className="text-xs font-semibold text-text-muted">{item.severity === "issue" ? "Замечание" : "Предложение"}</span><p>{item.evidence}</p><p className="mt-1 text-text-muted">{item.recommendation}</p><Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => setCommand(item.recommendation)}>Взять в задание</Button></li>)}</ul>}{current.notes.length > 0 && <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-text-muted">{current.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}{current.html && <><p className="text-sm leading-6 text-text-muted">{source.imageOnly ? "Сверьте распознанный текст и иллюстрации с исходником. Адрес кнопки можно указать в задании: по картинке его определить нельзя." : "Сравните результат с исходником перед применением."}</p><Button className="w-full" disabled={Boolean(busy)} onClick={() => void apply()}>Применить предложение</Button></>}</section>}
      <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-semibold">Проверка исходника{source.findings.length ? ` · ${source.findings.length}` : ""}</summary><ul className="mt-3 space-y-4 text-sm">{source.findings.map((item, index) => <li key={index}><p>{item.evidence}</p><p className="mt-1 text-text-muted">{item.recommendation}</p></li>)}</ul>{!source.findings.length && <p className="mt-2 text-sm text-text-muted">В базовой проверке замечаний нет.</p>}{addImportViewport(html) !== html && <Button size="sm" className="mt-3" variant="secondary" disabled={Boolean(busy)} onClick={() => onApply({ ...document, rawHtml: addImportViewport(html) }, "Добавлены настройки мобильного просмотра")}>Добавить viewport</Button>}</details>
    </div>
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div role="group" aria-label="Сравнение письма" className="flex gap-1 rounded-lg bg-surface-subtle p-1"><Button size="sm" variant={preview === "original" ? "primary" : "ghost"} aria-pressed={preview === "original"} onClick={() => setPreview("original")}>Исходник</Button><Button size="sm" disabled={!current?.html} variant={preview === "proposal" ? "primary" : "ghost"} aria-pressed={preview === "proposal"} onClick={() => setPreview("proposal")}>Предложение</Button></div><Button size="sm" variant="secondary" aria-pressed={mobile} onClick={() => setMobile(value => !value)}>{mobile ? "На компьютере" : "На телефоне"}</Button></div>
      <div className={mobile ? "mx-auto w-full max-w-[390px]" : "w-full"}><LetterPreview html={preview === "proposal" && current?.html ? current.html : html} resources={preview === "proposal" ? current?.resources : undefined} title={preview === "proposal" ? "Предложение арт-директора" : "Исходное импортированное письмо"} className="h-[68vh] min-h-96" /></div>
    </div>
  </div>;
}
