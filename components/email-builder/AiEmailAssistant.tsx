"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";

import { Button, FormField, Select, Textarea } from "@/components/ui";
import type { ApiError, EmailAiAction, EmailAiResponse, EmailAiSuggestion } from "@/types/api";

import type { BuilderBlock, BuilderDocument } from "./builder-types";

export function AiEmailAssistant({ block, document, onUpdateBlock, onUpdateDocument }: {
  block: BuilderBlock;
  document: BuilderDocument;
  onUpdateBlock: (patch: Partial<BuilderBlock>) => void;
  onUpdateDocument: (patch: Partial<BuilderDocument>) => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [action, setAction] = useState<EmailAiAction>("compose");
  const [tone, setTone] = useState("business");
  const [goal, setGoal] = useState("");
  const [suggestion, setSuggestion] = useState<EmailAiSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/email-assistant", { cache: "no-store" })
      .then((response) => response.json() as Promise<EmailAiResponse>)
      .then((body) => { if (active) setConfigured(body.configured); })
      .catch(() => { if (active) setConfigured(false); });
    return () => { active = false; };
  }, []);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/email-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, tone, goal, currentSubject: document.subject, currentPreviewText: document.previewText, currentText: block.content }),
      });
      const body = await response.json() as EmailAiResponse | ApiError;
      if (!response.ok || !("suggestion" in body) || !body.suggestion) throw new Error("error" in body ? body.error : "Предложение не подготовлено.");
      setSuggestion(body.suggestion);
      setConfigured(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Предложение не подготовлено.");
    } finally { setBusy(false); }
  };

  const apply = () => {
    if (!suggestion) return;
    onUpdateDocument({ subject: suggestion.subject, previewText: suggestion.previewText });
    if (block.type === "button" || block.type === "product") onUpdateBlock({ label: suggestion.cta, ...(block.type === "button" ? { content: suggestion.cta } : {}) });
    else if (block.type === "hero") onUpdateBlock({ content: `${suggestion.subject}|${suggestion.previewText || suggestion.body}` });
    else if (block.type === "quote") onUpdateBlock({ content: `${suggestion.body}|` });
    else if (block.type === "checklist") onUpdateBlock({ content: suggestion.body.split(/\n+/).map((line) => line.replace(/^[-•✓]\s*/, "").trim()).filter(Boolean).join("|") });
    else if (!["image", "logo", "divider", "spacer", "stats"].includes(block.type)) onUpdateBlock({ content: suggestion.body });
  };

  return (
    <details className="group border-b border-border bg-gradient-to-b from-primary-subtle/45 to-transparent" open>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[11px] font-semibold text-text-strong outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2"><Sparkles aria-hidden="true" className="size-4 text-primary" />ИИ-помощник</span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-medium text-text-subtle">{configured === null ? "Проверка" : configured ? "Подключён" : "Нужен ключ"}</span>
      </summary>
      <div className="grid gap-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Задача"><Select value={action} onChange={(event) => setAction(event.target.value as EmailAiAction)} options={[{ value: "compose", label: "Написать письмо" }, { value: "rewrite", label: "Переписать" }, { value: "shorten", label: "Сократить" }, { value: "subject", label: "Улучшить тему" }, { value: "cta", label: "Призыв к действию" }]} /></FormField>
          <FormField label="Тон"><Select value={tone} onChange={(event) => setTone(event.target.value)} options={[{ value: "business", label: "Деловой" }, { value: "friendly", label: "Дружелюбный" }, { value: "expert", label: "Экспертный" }, { value: "concise", label: "Краткий" }]} /></FormField>
        </div>
        <FormField label="Что нужно сообщить" hint="Укажите факты, предложение и желаемое действие."><Textarea rows={3} value={goal} maxLength={2000} onChange={(event) => setGoal(event.target.value)} placeholder="Например: пригласить руководителей на вебинар 25 сентября и попросить зарегистрироваться" className="resize-none text-[11px]" /></FormField>
        <Button type="button" variant="primary" size="sm" disabled={busy || goal.trim().length < 8} onClick={() => void generate()}>{busy ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <WandSparkles aria-hidden="true" className="size-3.5" />}{busy ? "Готовим текст…" : "Предложить текст"}</Button>
        {error ? <p role="alert" className="m-0 rounded-lg bg-danger-subtle px-2.5 py-2 text-[10px] leading-4 text-danger">{error}</p> : null}
        {suggestion ? (
          <div className="grid gap-2 rounded-xl border border-primary/15 bg-surface p-3 shadow-[var(--shadow-xs)]">
            <div><span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-subtle">Тема</span><p className="mb-0 mt-1 text-[11px] font-medium text-text-strong">{suggestion.subject}</p></div>
            <div><span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-subtle">Текст</span><p className="mb-0 mt-1 whitespace-pre-wrap text-[10px] leading-4 text-text-muted">{suggestion.body}</p></div>
            <Button type="button" variant="outline" size="sm" onClick={apply}>Применить к письму</Button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
