"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";

import { Button, FormField, Modal, Select, Textarea } from "@/components/ui";
import type { ApiError, EmailAiAction, EmailAiResponse, EmailAiSuggestion, EmailAssetsListResponse } from "@/types/api";

import type { BuilderBlock, BuilderDocument } from "./builder-types";

export function AiEmailAssistant({ block, document, onUpdateBlock, onUpdateDocument }: {
  block: BuilderBlock;
  document: BuilderDocument;
  onUpdateBlock: (patch: Partial<BuilderBlock>) => void;
  onUpdateDocument: (patch: Partial<BuilderDocument>) => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<EmailAiResponse["provider"]>();
  const [action, setAction] = useState<EmailAiAction>("compose");
  const [tone, setTone] = useState("business");
  const [goal, setGoal] = useState("");
  const [suggestion, setSuggestion] = useState<EmailAiSuggestion | null>(null);
  const [assets, setAssets] = useState<EmailAssetsListResponse["assets"]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/email-assistant", { cache: "no-store" })
      .then((response) => response.json() as Promise<EmailAiResponse>)
      .then((body) => { if (active) { setConfigured(body.configured); setProvider(body.provider); } })
      .catch(() => { if (active) setConfigured(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (action !== "design") return;
    let active = true;
    void fetch("/api/assets", { cache: "no-store" })
      .then((response) => response.json() as Promise<EmailAssetsListResponse>)
      .then((body) => { if (active && Array.isArray(body.assets)) setAssets(body.assets); })
      .catch(() => { if (active) setAssets([]); });
    return () => { active = false; };
  }, [action]);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/email-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action,
          tone,
          goal,
          currentSubject: document.subject,
          currentPreviewText: document.previewText,
          currentText: block.content,
          websiteUrl: websiteUrl.trim() || undefined,
          availableAssets: assets.map(({ id, filename, kind, url }) => ({ id, filename, kind, url })),
        }),
      });
      const body = await response.json() as EmailAiResponse | ApiError;
      if (!response.ok || !("suggestion" in body) || !body.suggestion) throw new Error("error" in body ? body.error : "Предложение не подготовлено.");
      setSuggestion(body.suggestion);
      setConfigured(true);
      setProvider(body.provider);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Предложение не подготовлено.");
    } finally { setBusy(false); }
  };

  const apply = () => {
    if (!suggestion) return;
    if (suggestion.document) {
      onUpdateDocument(suggestion.document as BuilderDocument);
      setSuggestion(null);
      return;
    }
    onUpdateDocument({ subject: suggestion.subject, previewText: suggestion.previewText });
    if (block.type === "button" || block.type === "product") onUpdateBlock({ label: suggestion.cta, ...(block.type === "button" ? { content: suggestion.cta } : {}) });
    else if (block.type === "hero") onUpdateBlock({ content: `${suggestion.subject}|${suggestion.previewText || suggestion.body}` });
    else if (block.type === "quote") onUpdateBlock({ content: `${suggestion.body}|` });
    else if (block.type === "checklist") onUpdateBlock({ content: suggestion.body.split(/\n+/).map((line) => line.replace(/^[-•✓]\s*/, "").trim()).filter(Boolean).join("|") });
    else if (!["image", "logo", "divider", "spacer", "stats"].includes(block.type)) onUpdateBlock({ content: suggestion.body });
  };

  return (
    <details className="group border-b border-border bg-gradient-to-b from-primary-subtle/45 to-transparent" open>
      <Modal
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
        title="Сравнение двух версий письма"
        description="Слева остаётся ваш текущий макет, справа — отдельный вариант ИИ. Ничего не заменится без вашего решения."
        size="xl"
        footer={<><Button variant="ghost" onClick={() => setComparisonOpen(false)}>Оставить мой вариант</Button><Button variant="primary" disabled={!suggestion?.document} onClick={() => { apply(); setComparisonOpen(false); }}>Использовать вариант ИИ</Button></>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <DesignComparisonCard label="Мой вариант" document={document} />
          {suggestion?.document ? <DesignComparisonCard label="Вариант ИИ" document={suggestion.document as BuilderDocument} accent /> : null}
        </div>
      </Modal>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[11px] font-semibold text-text-strong outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2"><Sparkles aria-hidden="true" className="size-4 text-primary" />ИИ-помощник</span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-medium text-text-subtle">{configured === null ? "Проверка" : configured ? provider === "navyai" ? "NavyAI подключён" : "OpenAI подключён" : "Нужен ключ"}</span>
      </summary>
      <div className="grid gap-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Задача"><Select value={action} onChange={(event) => setAction(event.target.value as EmailAiAction)} options={[{ value: "design", label: "Собрать всё письмо" }, { value: "compose", label: "Написать текст" }, { value: "rewrite", label: "Переписать" }, { value: "shorten", label: "Сократить" }, { value: "subject", label: "Улучшить тему" }, { value: "cta", label: "Призыв к действию" }]} /></FormField>
          <FormField label="Тон"><Select value={tone} onChange={(event) => setTone(event.target.value)} options={[{ value: "business", label: "Деловой" }, { value: "friendly", label: "Дружелюбный" }, { value: "expert", label: "Экспертный" }, { value: "concise", label: "Краткий" }]} /></FormField>
        </div>
        <FormField label="Что нужно сообщить" hint="Укажите факты, предложение и желаемое действие."><Textarea rows={3} value={goal} maxLength={2000} onChange={(event) => setGoal(event.target.value)} placeholder="Например: пригласить руководителей на вебинар 25 сентября и попросить зарегистрироваться" className="resize-none text-[11px]" /></FormField>
        {action === "design" ? <>
          <FormField label="Ссылка основной кнопки" hint="Только https://. Если оставить пустой, ИИ не добавит кнопку."><input className="input text-[11px]" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.ru/action" /></FormField>
          <div className="rounded-xl border border-primary/15 bg-surface p-3 text-[10px] leading-4 text-text-muted">
            <p className="m-0 font-semibold text-text-strong">Медиатека: {assets.length} файлов</p>
            <p className="mb-0 mt-1">ИИ использует только загруженные вами фото и логотипы — ничего не выдумывает. Добавить файлы можно в свойствах блока «Изображение» или «Логотип».</p>
          </div>
        </> : null}
        <Button type="button" variant="primary" size="sm" disabled={busy || goal.trim().length < 8} onClick={() => void generate()}>{busy ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <WandSparkles aria-hidden="true" className="size-3.5" />}{busy ? "Собираем…" : action === "design" ? "Создать дизайн письма" : "Предложить текст"}</Button>
        {error ? <p role="alert" className="m-0 rounded-lg bg-danger-subtle px-2.5 py-2 text-[10px] leading-4 text-danger">{error}</p> : null}
        {suggestion ? (
          <div className="grid gap-2 rounded-xl border border-primary/15 bg-surface p-3 shadow-[var(--shadow-xs)]">
            <div><span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-subtle">Тема</span><p className="mb-0 mt-1 text-[11px] font-medium text-text-strong">{suggestion.subject}</p></div>
            <div><span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-subtle">{suggestion.document ? "Макет" : "Текст"}</span><p className="mb-0 mt-1 whitespace-pre-wrap text-[10px] leading-4 text-text-muted">{suggestion.document ? `${suggestion.document.blocks.length} блоков · готовые цвета, тексты и изображения` : suggestion.body}</p></div>
            {suggestion.document ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setComparisonOpen(true)}><GitCompareArrows aria-hidden="true" className="size-3.5" />Сравнить с моим письмом</Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={apply}>Применить к письму</Button>
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function DesignComparisonCard({ label, document, accent = false }: { label: string; document: BuilderDocument; accent?: boolean }) {
  return (
    <section className={`overflow-hidden rounded-2xl border ${accent ? "border-primary/35" : "border-border"}`}>
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-3">
        <strong className="text-[13px] text-text-strong">{label}</strong>
        <span className="text-[10px] text-text-muted">{document.blocks.length} блоков</span>
      </div>
      <div className="p-4" style={{ background: document.workspaceBackground }}>
        <div className="mx-auto overflow-hidden rounded-lg shadow-sm" style={{ background: document.bodyBackground, maxWidth: 380 }}>
          <div className="border-b border-black/5 p-4">
            <p className="m-0 text-[13px] font-semibold" style={{ color: document.accentColor }}>{document.subject}</p>
            <p className="mb-0 mt-1 line-clamp-2 text-[10px] text-text-muted">{document.previewText || "Без текста предпросмотра"}</p>
          </div>
          <div className="grid gap-2 p-4">
            {document.blocks.slice(0, 10).map((block) => (
              <div key={block.id} className="rounded-md border border-black/5 px-3 py-2" style={{ background: block.backgroundColor === "transparent" ? "transparent" : block.backgroundColor, color: block.textColor }}>
                <span className="block text-[9px] font-semibold uppercase tracking-wide opacity-50">{block.type}</span>
                <span className="mt-1 block line-clamp-2 text-[11px]">{block.label || block.content || "Декоративный блок"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
