"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";

import { Button, FormField, Input, Modal, Select, Textarea } from "@/components/ui";
import type { ApiError, EmailAiResponse, EmailAiSuggestion } from "@/types/api";
import type { BuilderDocument } from "./builder-types";

export function AiEmailAssistant({ document, onApply }: { document: BuilderDocument; onApply: (document: BuilderDocument) => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<EmailAiResponse["provider"]>();
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("expert");
  const [visualStyle, setVisualStyle] = useState("editorial");
  const [primaryColor, setPrimaryColor] = useState(document.accentColor);
  const [secondaryColor, setSecondaryColor] = useState(document.workspaceBackground);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brandName, setBrandName] = useState("MAILFLOW");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [imageSource, setImageSource] = useState<"internet" | "generate" | "none">("generate");
  const [suggestion, setSuggestion] = useState<EmailAiSuggestion | null>(null);
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

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/email-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "design", goal, audience, tone, visualStyle, primaryColor, secondaryColor, websiteUrl: websiteUrl.trim() || undefined, brandName: brandName.trim() || undefined, includeLogo, imageSource }),
      });
      const body = await response.json() as EmailAiResponse | ApiError;
      if (!response.ok || !("suggestion" in body) || !body.suggestion?.document) throw new Error("error" in body ? body.error : "Дизайн не подготовлен.");
      setSuggestion(body.suggestion);
      setConfigured(true);
      setProvider(body.provider);
      setComparisonOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Дизайн не подготовлен.");
    } finally { setBusy(false); }
  };

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 p-5 sm:p-8">
      <Modal open={comparisonOpen} onOpenChange={setComparisonOpen} title="Мой макет и вариант ИИ" description="ИИ подготовил отдельную версию. Текущий макет не изменится без вашего подтверждения." size="xl" footer={<><Button variant="ghost" onClick={() => setComparisonOpen(false)}>Оставить мой</Button><Button variant="primary" disabled={!suggestion?.document} onClick={() => { if (suggestion?.document) onApply(suggestion.document as BuilderDocument); setComparisonOpen(false); }}>Использовать вариант ИИ</Button></>}>
        <div className="grid gap-4 md:grid-cols-2"><DesignCard label="Мой макет" document={document} /><DesignCard label="Вариант ИИ" document={(suggestion?.document ?? document) as BuilderDocument} accent /></div>
      </Modal>

      <header className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-lg"><Sparkles aria-hidden="true" className="size-5" /></span>
        <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-text-strong">Опишите письмо — ИИ соберёт всё</h2>
        <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-6 text-text-muted">Тексты, композиция, цвета, кнопки и новые изображения создаются по одному описанию. Затем вы сравниваете результат со своим макетом.</p>
        <span className="mt-3 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[10px] font-medium text-text-muted">{configured === null ? "Проверяем подключение" : configured ? `${provider === "navyai" ? "NavyAI" : "OpenAI"} подключён` : "ИИ не подключён"}</span>
      </header>

      <div className="card grid gap-5 p-5 sm:p-7">
        <FormField label="Какое письмо нужно?" hint="Опишите содержание, настроение, желаемые блоки, изображения и результат для читателя.">
          <Textarea rows={7} maxLength={2000} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Например: приглашение юристов на конференцию. Светлый премиальный дизайн, фиолетовые акценты, обложка с современной конференцией, программа в виде этапов, кнопка регистрации и спокойный деловой тон." className="resize-y text-[13px] leading-6" />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Для кого письмо"><Input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Руководители юридических компаний" /></FormField>
          <FormField label="Ссылка основной кнопки"><Input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://tech-pravo.ru/" /></FormField>
          <FormField label="Название бренда"><Input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Tech‑Pravo" /></FormField>
          <FormField label="Логотип"><Select value={includeLogo ? "yes" : "no"} onChange={(event) => setIncludeLogo(event.target.value === "yes")} options={[{value:"yes",label:"Создать новый логотип под письмо"},{value:"no",label:"Не добавлять логотип"}]} /></FormField>
          <FormField label="Тон"><Select value={tone} onChange={(event) => setTone(event.target.value)} options={[{value:"business",label:"Деловой"},{value:"friendly",label:"Дружелюбный"},{value:"expert",label:"Экспертный"},{value:"concise",label:"Краткий"}]} /></FormField>
          <FormField label="Стиль"><Select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)} options={[{value:"editorial",label:"Редакционный"},{value:"minimal",label:"Минималистичный"},{value:"bold",label:"Яркий"},{value:"premium",label:"Премиальный"}]} /></FormField>
          <ColorInput label="Основной цвет" value={primaryColor} onChange={setPrimaryColor} />
          <ColorInput label="Фоновый цвет" value={secondaryColor} onChange={setSecondaryColor} />
          <FormField label="Изображения"><Select value={imageSource} onChange={(event) => setImageSource(event.target.value as "internet" | "generate" | "none")} options={[{value:"generate",label:"Лучшее качество — создать новые"},{value:"internet",label:"Найти релевантные с открытой лицензией"},{value:"none",label:"Без изображений"}]} /></FormField>
        </div>
        {error ? <p role="alert" className="m-0 rounded-xl bg-danger-subtle px-4 py-3 text-[12px] text-danger">{error}</p> : null}
        <Button type="button" variant="primary" size="lg" disabled={busy || goal.trim().length < 8} onClick={() => void generate()}>{busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <WandSparkles aria-hidden="true" className="size-4" />}{busy ? "ИИ создаёт письмо и изображения…" : "Создать готовое письмо"}</Button>
      </div>
    </section>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <FormField label={label}><label className="flex h-10 items-center gap-3 rounded-lg border border-border bg-surface px-3"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-6 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-[11px] uppercase text-text-muted">{value}</span></label></FormField>;
}

/* eslint-disable @next/next/no-img-element -- email designs use dynamic external and generated image URLs. */
function DesignCard({ label, document, accent = false }: { label: string; document: BuilderDocument; accent?: boolean }) {
  return <section className={`overflow-hidden rounded-2xl border ${accent ? "border-primary/40" : "border-border"}`}><div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-3"><strong className="text-[13px]">{label}</strong><span className="text-[10px] text-text-muted">{document.blocks.length} блоков</span></div><div className="p-4" style={{background:document.workspaceBackground}}><div className="mx-auto grid gap-2 rounded-lg p-4 shadow-sm" style={{background:document.bodyBackground}}><strong className="text-[12px]" style={{color:document.accentColor}}>{document.subject}</strong>{document.blocks.slice(0,10).map((block)=><div key={block.id} className="rounded-md border border-black/5 px-3 py-2" style={{background:block.backgroundColor === "transparent" ? "transparent" : block.backgroundColor,color:block.textColor}}><span className="block text-[8px] uppercase opacity-45">{block.type}</span><span className="mt-1 block line-clamp-2 text-[10px]">{block.label || block.content || "Декоративный блок"}</span>{block.type === "image" && block.href ? <img src={block.href} alt="" className="mt-2 aspect-video w-full rounded object-cover" /> : null}</div>)}</div></div></section>;
}
