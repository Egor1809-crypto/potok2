"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, LoaderCircle, Sparkles, Upload, WandSparkles } from "lucide-react";

import { Badge, Button, FormField, Input, Modal, Select, Textarea } from "@/components/ui";
import type { ApiError, EmailAiResponse, EmailAiSuggestion, EmailAssetMutationResponse, EmailAssetRecord } from "@/types/api";
import type { BuilderDocument } from "./builder-types";

type Stage = "prompt" | "questions";
type ComparisonView = "ai" | "current" | "split";

function nextPromptSuggestion(value: string) {
  if (!value.trim()) return "";
  const normalized = value.toLocaleLowerCase("ru-RU");
  if (value.trim().length < 12) return " для конкретной аудитории и с одним главным действием";
  if (!/(для кого|аудитор|юрист|руководител|клиент|партн[её]р|участник)/.test(normalized)) return ". Получатели — укажите должности или тип компаний";
  if (!/(цель|регистрац|купить|заказ|ответ|встреч|скачать|перейти|приглас)/.test(normalized)) return ". Цель письма — укажите одно действие читателя";
  if (!/(до \d|срок|дат|сентябр|октябр|ноябр|декабр|январ|феврал|март|апрел|ма[йя]|июн|июл|август)/.test(normalized)) return ". Срок или дата — укажите, если они важны";
  if (!/https:\/\//.test(normalized)) return ". Ссылка главной кнопки — https://…";
  return ". Если нужен необычный стиль, укажите его отдельно; иначе будет чистый современный email";
}

export function AiEmailAssistant({ document, onApply }: { document: BuilderDocument; onApply: (document: BuilderDocument) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("prompt");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<EmailAiResponse["provider"]>();
  const [goal, setGoal] = useState("");
  const [useLinkedContext, setUseLinkedContext] = useState(true);
  const [questions, setQuestions] = useState<Array<{ id: string; question: string; placeholder: string; required: boolean }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assetKind, setAssetKind] = useState<"photo" | "logo">("photo");
  const [assets, setAssets] = useState<EmailAssetRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [suggestion, setSuggestion] = useState<EmailAiSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonView, setComparisonView] = useState<ComparisonView>("ai");
  const [previewHtml, setPreviewHtml] = useState<{ current: string; ai: string } | null>(null);
  const detectedUrl = goal.match(/https:\/\/[^\s]+/)?.[0] ?? "";
  const promptSuggestion = nextPromptSuggestion(goal);

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/email-assistant", { cache: "no-store" })
      .then((response) => response.json() as Promise<EmailAiResponse>)
      .then((body) => { if (active) { setConfigured(body.configured); setProvider(body.provider); } })
      .catch(() => { if (active) setConfigured(false); });
    return () => { active = false; };
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const preparedFile = await prepareImageFile(file);
      const form = new FormData();
      form.set("file", preparedFile);
      form.set("kind", assetKind);
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const raw = await response.text();
      const body = (() => { try { return JSON.parse(raw) as EmailAssetMutationResponse | ApiError; } catch { return { error: response.status === 413 ? "Файл слишком большой. Выберите изображение до 4 МБ." : "Сервер не принял изображение." }; } })();
      if (!response.ok || !("asset" in body)) throw new Error("error" in body ? body.error : "Файл не загружен.");
      setAssets((current) => [...current, body.asset]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Файл не загружен.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const prepareQuestions = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/email-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "brief", goal: useLinkedContext ? goal : goal.replace(/https:\/\/[^\s]+/g, ""), tone: "expert" }) });
      const body = await response.json() as EmailAiResponse | ApiError;
      if (!response.ok || !("suggestion" in body)) throw new Error("error" in body ? body.error : "Не удалось подготовить вопросы.");
      setQuestions(body.suggestion?.questions ?? []);
      setAnswers({});
      setStage("questions");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось подготовить вопросы.");
    } finally { setBusy(false); }
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/email-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "design",
          goal: useLinkedContext ? goal : goal.replace(/https:\/\/[^\s]+/g, ""),
          tone: "expert",
          websiteUrl: [...goal.matchAll(/https:\/\/[^\s]+/g)].map((item) => item[0])[0],
          includeLogo: assets.some((asset) => asset.kind === "logo"),
          imageSource: /без (?:фото|изображений)|только узор/i.test(goal)
            ? "none"
            : assets.some((asset) => asset.kind === "photo")
              ? "none"
              : "generate",
          availableAssets: assets.map(({ id, filename, kind, url }) => ({ id, filename, kind, url })),
          briefAnswers: questions.map((question) => ({ question: question.question, answer: answers[question.id]?.trim() ?? "" })).filter((item) => item.answer),
        }),
      });
      const body = await response.json() as EmailAiResponse | ApiError;
      if (!response.ok || !("suggestion" in body) || !body.suggestion?.document) throw new Error("error" in body ? body.error : "Дизайн не подготовлен.");
      setSuggestion(body.suggestion);
      const [currentPreview, aiPreview] = await Promise.all([document, body.suggestion.document].map(async (value) => { const result = await fetch("/api/email-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); return (await result.json() as { html: string }).html; }));
      setPreviewHtml({ current: currentPreview, ai: aiPreview });
      setConfigured(true);
      setProvider(body.provider);
      setComparisonView("ai");
      setComparisonOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Дизайн не подготовлен.");
    } finally { setBusy(false); }
  };

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-6 p-5 sm:p-8">
      <Modal open={comparisonOpen} onOpenChange={setComparisonOpen} title="Сравнение редакций" description="Проверяйте письмо целиком или переключайтесь между версиями. Ваш макет не изменится без подтверждения." size="full" contentClassName="!p-4 sm:!p-5" footer={<><Button variant="ghost" onClick={() => setComparisonOpen(false)}>Продолжить с моим</Button><Button variant="primary" disabled={!suggestion?.document} onClick={() => { if (suggestion?.document) onApply(suggestion.document as BuilderDocument); setComparisonOpen(false); }}>Заменить на вариант ИИ</Button></>}>
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-subtle p-2">
          {([['ai','Вариант ИИ'],['current','Мой макет'],['split','Рядом']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={comparisonView === value} onClick={() => setComparisonView(value)} className="rounded-lg px-3 py-2 text-[11px] font-semibold text-text-muted outline-none transition hover:bg-surface aria-pressed:bg-surface aria-pressed:text-primary aria-pressed:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30">{label}</button>)}
          <span className="ml-auto text-[10px] text-text-subtle">Предпросмотр настоящего HTML · 640 пикс.</span>
        </div>
        <details className="mb-4 rounded-xl border border-border bg-surface" open>
          <summary className="cursor-pointer px-4 py-3 text-[11px] font-semibold text-text-strong">Что изменил ИИ и какой контекст использовал</summary>
          <div className="grid gap-3 border-t border-border p-3 lg:grid-cols-2">
            <DesignReport title="Моя редакция" document={document} />
            <DesignReport title="Редакция ИИ" document={suggestion?.document as BuilderDocument | undefined} accent artDirection={suggestion?.artDirection} strategy={suggestion?.contentStrategy} />
          </div>
          <div className="border-t border-border px-4 py-3"><strong className="text-[10px] uppercase tracking-wide text-text-subtle">Исходная задача</strong><p className="mb-0 mt-1 whitespace-pre-wrap text-[11px] leading-5 text-text-strong">{goal}</p>{questions.some((question) => answers[question.id]?.trim()) ? <div className="mt-3 flex flex-wrap gap-1.5">{questions.filter((question) => answers[question.id]?.trim()).map((question) => <Badge key={question.id} variant="neutral" title={question.question}>{answers[question.id]}</Badge>)}</div> : null}</div>
        </details>
        <div className={comparisonView === "split" ? "grid gap-4 xl:grid-cols-2" : "mx-auto max-w-[760px]"}>
          {comparisonView === "current" || comparisonView === "split" ? <EmailPreview label="Мой макет" html={previewHtml?.current} /> : null}
          {comparisonView === "ai" || comparisonView === "split" ? <EmailPreview label="Вариант ИИ" html={previewHtml?.ai} accent /> : null}
        </div>
      </Modal>

      <header className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-lg"><Sparkles aria-hidden="true" className="size-5" /></span>
        <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-text-strong">{stage === "prompt" ? "Что нужно создать?" : "Уточним детали"}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-6 text-text-muted">{stage === "prompt" ? "Опишите задачу письма, аудиторию и главное действие. Если стиль не указан, Поток создаст аккуратный современный SaaS-email." : "Ответьте на вопросы по смыслу и предложению. Визуальную систему ИИ подберёт автоматически, если вы не задали её в описании."}</p>
        <span className="mt-3 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[10px] font-medium text-text-muted">{configured === null ? "Проверяем подключение" : configured ? `${provider === "navyai" ? "NavyAI" : "OpenAI"} подключён` : "ИИ не подключён"}</span>
      </header>

      {stage === "prompt" ? (
        <div className="card grid gap-4 p-5 sm:p-7">
          <div className="relative overflow-hidden rounded-xl">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-4 py-3 text-[16px] font-medium leading-7"><span className="text-transparent">{goal}</span><span className="text-text-subtle/70">{promptSuggestion}</span></div>
            <Textarea aria-describedby="ai-inline-suggestion-help" rows={9} maxLength={2000} value={goal} onChange={(event) => setGoal(event.target.value)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey && promptSuggestion) { event.preventDefault(); setGoal((value) => `${value}${promptSuggestion}`); } }} placeholder="Например: письмо о запуске нового продукта для действующих клиентов. Коротко объяснить пользу и привести к странице продукта…" className="relative z-10 resize-y !bg-transparent font-medium text-text-strong caret-primary" style={{ fontSize: 16, lineHeight: "28px", color: "var(--text-strong)" }} />
            <span id="ai-inline-suggestion-help" className="sr-only">Серый текст рядом с курсором — предлагаемое продолжение. Нажмите Enter или Tab, чтобы принять его.</span>
          </div>
          {detectedUrl ? <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/40 px-3 py-2.5 text-[11px]"><input id="ai-use-linked-context" type="checkbox" checked={useLinkedContext} onChange={(event) => setUseLinkedContext(event.target.checked)} className="accent-primary" /><label htmlFor="ai-use-linked-context" className="min-w-0"><strong className="block">Изучить страницу по ссылке</strong><span className="block truncate text-text-muted">{detectedUrl}</span></label></div> : null}
          <Button type="button" variant="primary" size="lg" disabled={busy || goal.trim().length < 8} onClick={() => void prepareQuestions()}>{busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}{busy ? "Анализируем задачу…" : "Продолжить — уточнить детали"}</Button>
        </div>
      ) : (
        <div className="card grid gap-5 p-5 sm:p-7">
          <nav className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-text-muted"><span className="rounded-full bg-primary px-2.5 py-1 text-white">1 · Идея</span><span>→</span><span className="rounded-full bg-primary px-2.5 py-1 text-white">2 · Уточнения</span><span>→</span><span className="rounded-full bg-surface-subtle px-2.5 py-1">3 · Вариант</span>{detectedUrl ? <span className="ml-auto inline-flex items-center gap-1 text-success"><Check className="size-3" />{useLinkedContext ? "Ссылка учитывается" : "Ссылка не учитывается"}</span> : null}</nav>
          <div className="grid gap-4 md:grid-cols-2">
            {questions.map((question) => <FormField key={question.id} label={question.question}><Input required={question.required} value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder={question.placeholder} /></FormField>)}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3"><strong className="text-[13px]">Свои изображения</strong><Select aria-label="Тип загружаемого изображения" value={assetKind} onChange={(event) => setAssetKind(event.target.value as "photo" | "logo")} options={[{value:"photo",label:"Фотография"},{value:"logo",label:"Логотип"}]} className="max-w-44" /></div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            <button type="button" onClick={() => fileInput.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void upload(file); }} className={`grid min-h-32 w-full place-items-center rounded-2xl border-2 border-dashed p-5 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 ${dragging ? "border-primary bg-primary-subtle" : "border-border-strong bg-surface-subtle hover:border-primary/45"}`}>
              <span><span className="mx-auto grid size-10 place-items-center rounded-xl bg-surface text-primary shadow-sm">{uploading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Upload aria-hidden="true" className="size-5" />}</span><strong className="mt-3 block text-[13px] text-text-strong">Перетащите изображение сюда</strong><span className="mt-1 block text-[11px] text-text-muted">или нажмите и выберите файл с компьютера · PNG, JPEG, GIF до 4 МБ</span></span>
            </button>
            {assets.length ? <div className="mt-3 flex flex-wrap gap-2">{assets.map((asset) => <span key={asset.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-[10px]"><ImagePlus aria-hidden="true" className="size-3 text-primary" />{asset.filename}<span className="text-text-subtle">· {asset.kind === "logo" ? "логотип" : "фото"}</span></span>)}</div> : <p className="mt-2 text-[10px] text-text-subtle">Необязательно. Если в исходном запросе не сказано «без изображений», ИИ создаст одну предметную иллюстрацию по смыслу письма.</p>}
          </div>

          {error ? <p role="alert" className="m-0 rounded-xl bg-danger-subtle px-4 py-3 text-[12px] text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => setStage("prompt")}><ArrowLeft aria-hidden="true" className="size-4" />Изменить описание</Button><Button type="button" variant="primary" size="lg" className="min-w-52 flex-1" disabled={busy || uploading || questions.some((question) => question.required && !answers[question.id]?.trim())} onClick={() => void generate()}>{busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <WandSparkles aria-hidden="true" className="size-4" />}{busy ? "ИИ проектирует письмо…" : "Создать дизайнерскую редакцию"}</Button></div>
        </div>
      )}
    </section>
  );
}

function DesignReport({ title, document, accent = false, artDirection, strategy }: { title: string; document?: BuilderDocument; accent?: boolean; artDirection?: string; strategy?: string }) {
  const expressive = document?.blocks.filter((block) => ["hero", "banner", "pattern", "quote", "columns", "stats", "coupon", "notice", "comparison", "document", "compliance"].includes(block.type)).map((block) => block.type) ?? [];
  const actions = document?.blocks.filter((block) => block.type === "button").length ?? 0;
  const personalized = new Set(document?.blocks.flatMap((block) => block.content.match(/{{[^}]+}}/g) ?? []) ?? []).size;
  return <section className={`rounded-xl border p-4 ${accent ? "border-primary/30 bg-primary-subtle/30" : "border-border bg-surface-subtle"}`}><div className="flex items-center justify-between gap-3"><strong className="text-[13px] text-text-strong">{title}</strong><div className="flex gap-1"><span className="size-4 rounded-full border border-black/10" style={{backgroundColor:document?.accentColor}} /><span className="size-4 rounded-full border border-black/10" style={{backgroundColor:document?.bodyBackground}} /><span className="size-4 rounded-full border border-black/10" style={{backgroundColor:document?.workspaceBackground}} /></div></div><p className="mb-0 mt-2 text-[10px] leading-4 text-text-muted">{artDirection ?? (expressive.length ? `Композиция: ${[...new Set(expressive)].join(", ")}` : "Базовая линейная композиция без выраженного арт-направления.")}</p>{strategy ? <p className="mb-0 mt-1 text-[10px] leading-4 text-text-muted">{strategy}</p> : null}<div className="mt-3 grid grid-cols-3 gap-2 text-center"><MetricValue label="Акценты" value={String(new Set(expressive).size)} /><MetricValue label="Действия" value={String(actions)} /><MetricValue label="Персонализация" value={String(personalized)} /></div><p className="mb-0 mt-3 line-clamp-2 text-[10px] font-medium text-text-strong">{document?.subject ?? "Версия не готова"}</p></section>;
}

function MetricValue({ label, value }: { label: string; value: string }) {
  return <span className="rounded-lg border border-border/70 bg-surface/70 px-2 py-1.5"><strong className="block text-[12px] text-text-strong">{value}</strong><span className="text-[8px] uppercase tracking-wide text-text-subtle">{label}</span></span>;
}

function EmailPreview({ label, html, accent = false }: { label: string; html?: string; accent?: boolean }) {
  return <section className={`overflow-hidden rounded-2xl border ${accent ? "border-primary/40 ring-2 ring-primary/10" : "border-border"}`}><div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-3"><strong className="text-[13px]">{label}</strong><span className="text-[9px] text-text-subtle">Реальный HTML письма</span></div>{html ? <iframe title={label} srcDoc={html} sandbox="" className="h-[520px] w-full bg-white" /> : <div className="grid h-[520px] place-items-center text-[11px] text-text-muted">Готовим предпросмотр…</div>}</section>;
}

async function prepareImageFile(file: File) {
  if (!["image/png", "image/jpeg", "image/gif"].includes(file.type)) throw new Error("Поддерживаются PNG, JPEG и GIF.");
  if (file.size <= 900_000 || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не смог подготовить изображение.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) throw new Error("Браузер не смог уменьшить изображение.");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}
