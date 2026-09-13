"use client";
import { useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Paperclip, X } from "@/components/ui/icons";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import type { AiEmailBrief } from "@/types/email-ai";
import type { EmailAssetMutationResponse } from "@/types/api";
import { emptyAiEmailBrief } from "@/lib/email-ai/defaults";
import { parseAiEmailBrief } from "@/lib/email-ai/schema";
import { builderDocumentFromInput, type BuilderDocument } from "./builder-types";
import { useEmailAiRequest } from "./useEmailAiRequest";

const choices = (values: readonly (readonly [string, string])[]) => values.map(([value, label]) => ({ value, label }));
const goals = choices([["custom", "Своя задача"], ["sale", "Продать"], ["invite", "Пригласить"], ["announcement", "Рассказать новость"], ["reminder", "Напомнить"], ["welcome", "Welcome-письмо"], ["reactivation", "Вернуть клиента"], ["promo", "Промо"], ["education", "Обучение"]]);

export function AiEmailWizard({ document, onApply }: { document: BuilderDocument; onApply: (next: BuilderDocument) => void }) {
  const [brief, setBrief] = useState<AiEmailBrief>(() => document.aiMetadata?.brief || emptyAiEmailBrief());
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<"photo" | "logo">("photo");
  const files = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const ai = useEmailAiRequest();
  const update = <K extends keyof AiEmailBrief>(key: K, value: AiEmailBrief[K]) => setBrief(previous => ({ ...previous, [key]: value }));
  const submit = async () => {
    if (submitLock.current || uploading) return;
    submitLock.current = true;
    try {
      let input: AiEmailBrief;
      try { input = parseAiEmailBrief(brief); } catch (error) { ai.setError(error instanceof Error ? error.message : "Проверьте поля письма."); return; }
      const result = await ai.run("generate", { brief: input });
      if (result?.document) onApply(builderDocumentFromInput(result.document));
    } finally { submitLock.current = false; }
  };
  const upload = async (file: File) => {
    if (uploading) return;
    if (brief.assets.length >= 12) { ai.setError("Можно прикрепить до 12 изображений. Удалите лишнее перед загрузкой."); return; }
    if (file.type === "text/plain" || /\.txt$/i.test(file.name)) {
      if (file.size > 20000) { ai.setError("Текстовый материал должен быть не больше 20 КБ."); return; }
      const text = await file.text();
      if (text.length > 5000) { ai.setError("Сократите текстовый материал до 5 000 символов."); return; }
      update("requiredContent", [brief.requiredContent, text].filter(Boolean).join("\n\n")); return;
    }
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type) || file.size > 4 * 1024 * 1024) { ai.setError("Выберите PNG, JPEG, GIF или WebP до 4 МБ либо текстовый материал TXT."); return; }
    setUploading(true); ai.setError("");
    try {
      const form = new FormData(); form.set("file", file); form.set("kind", kind);
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const body = await response.json() as EmailAssetMutationResponse & { error?: string };
      if (!response.ok || !body.asset) throw new Error(body.error || "Не удалось загрузить файл.");
      const asset = { id: body.asset.id, filename: body.asset.filename, url: body.asset.url, kind };
      setBrief(previous => ({ ...previous, assets: [...previous.assets.filter(a => a.id !== asset.id), asset].slice(-12) }));
    } catch (error) { ai.setError(error instanceof Error ? error.message : "Файл не загружен."); }
    finally { setUploading(false); if (files.current) files.current.value = ""; }
  };
  return <section className="min-h-0 flex-1 overflow-y-auto bg-surface-subtle/40 px-4 py-8 sm:px-8" aria-labelledby="ai-email-title">
    <form className="mx-auto grid w-full max-w-3xl gap-6" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <header><p className="mb-2 text-xs font-medium text-primary">Создать письмо с ИИ</p><h2 id="ai-email-title" className="m-0 text-2xl font-semibold text-text-strong">Что хотите отправить?</h2><p className="mb-0 mt-2 text-sm leading-6 text-text-muted">Опишите задачу — ИИ подготовит структуру, текст и дизайн письма.</p></header>
      <fieldset disabled={ai.busy} className="grid min-w-0 gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <FormField label="Задача письма" htmlFor="ai-description"><Textarea id="ai-description" value={brief.description} onChange={e => update("description", e.target.value)} rows={6} maxLength={12000} required minLength={8} placeholder="Например: сделай письмо для продажи билетов на конференцию юристов по ИИ. Главное преимущество — реальные практические кейсы и 30+ спикеров. Нужно привести человека к покупке билета." className="text-base leading-7" /></FormField>
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Цель письма" htmlFor="ai-goal"><Select id="ai-goal" value={brief.goal} onChange={e => update("goal", e.target.value as AiEmailBrief["goal"])} options={goals} /></FormField><FormField label="Для кого письмо?" htmlFor="ai-audience"><Input id="ai-audience" value={brief.audience} onChange={e => update("audience", e.target.value)} placeholder="Юристы и руководители юридических отделов" maxLength={1500} /></FormField></div>
        <FormField label="Главное действие получателя" htmlFor="ai-action"><Select id="ai-action" value={brief.primaryAction} onChange={e => update("primaryAction", e.target.value)} options={choices([["", "Определить по задаче"], ["Купить", "Купить"], ["Зарегистрироваться", "Зарегистрироваться"], ["Перейти на сайт", "Перейти на сайт"], ["Записаться", "Записаться"], ["Посмотреть", "Посмотреть"], ["Скачать", "Скачать"], ["Ответить", "Ответить"], ["Своя цель", "Своя цель — опишите в задаче"]])} /></FormField>
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Текст кнопки" htmlFor="ai-cta"><Input id="ai-cta" value={brief.cta.text} onChange={e => update("cta", { ...brief.cta, text: e.target.value })} placeholder="Получить билет" maxLength={100} /></FormField><FormField label="Ссылка кнопки" htmlFor="ai-cta-url" hint="Если ссылки нет, ИИ сформулирует действие текстом."><Input id="ai-cta-url" value={brief.cta.url} onChange={e => update("cta", { ...brief.cta, url: e.target.value })} placeholder="https://example.ru/tickets" maxLength={2000} /></FormField></div>
      </fieldset>
      <details className="rounded-2xl border border-border bg-surface"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-text-strong">Дополнительные настройки</summary><fieldset disabled={ai.busy} className="grid min-w-0 gap-5 border-t border-border p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3"><FormField label="Тон" htmlFor="ai-tone"><Select id="ai-tone" value={brief.tone} onChange={e => update("tone", e.target.value as AiEmailBrief["tone"])} options={choices([["business", "Деловой"], ["friendly", "Дружелюбный"], ["premium", "Премиальный"], ["tech", "Технологичный"], ["energetic", "Энергичный"], ["minimal", "Минималистичный"], ["expert", "Экспертный"]])} /></FormField><FormField label="Длина" htmlFor="ai-length"><Select id="ai-length" value={brief.length} onChange={e => update("length", e.target.value as AiEmailBrief["length"])} options={choices([["short", "Короткое"], ["medium", "Среднее"], ["long", "Подробное"]])} /></FormField><FormField label="Стиль" htmlFor="ai-style"><Select id="ai-style" value={brief.designStyle} onChange={e => update("designStyle", e.target.value as AiEmailBrief["designStyle"])} options={choices([["auto", "Автоматически"], ["minimal", "Минималистичный"], ["premium", "Премиальный"], ["tech", "Технологичный"], ["bold", "Яркий"], ["corporate", "Корпоративный"], ["editorial", "Editorial"]])} /></FormField></div>
        <div className="grid gap-4 sm:grid-cols-2">{([['name','Название бренда'],['website','Сайт'],['companyName','Название компании'],['address','Адрес'],['privacyUrl','Политика конфиденциальности']] as const).map(([key,label]) => <FormField key={key} label={label} htmlFor={`ai-brand-${key}`}><Input id={`ai-brand-${key}`} value={brief.brand[key]} onChange={e => update("brand", { ...brief.brand, [key]: e.target.value })} /></FormField>)}</div>
        <FormField label="Социальные сети" htmlFor="ai-social" hint="Одна ссылка в строке: название | https://…"><Textarea id="ai-social" rows={2} value={(brief.brand.socialLinks || []).map(link => `${link.label}|${link.url}`).join("\n")} onChange={e => update("brand", { ...brief.brand, socialLinks: e.target.value.split("\n").map(line => { const [label, ...url] = line.split("|"); return { label, url: url.join("|") }; }) })} /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">{([['primaryColor','Основной цвет'],['accentColor','Акцентный цвет'],['textColor','Цвет текста'],['backgroundColor','Цвет фона']] as const).map(([key,label]) => <FormField key={key} label={label} htmlFor={`ai-brand-${key}`}><Input id={`ai-brand-${key}`} value={brief.brand[key]} placeholder="#RRGGBB · автоматически" onChange={e => update("brand", { ...brief.brand, [key]: e.target.value })} maxLength={7} /></FormField>)}</div>
        <FormField label="Что обязательно упомянуть?" htmlFor="ai-required"><Textarea id="ai-required" rows={3} value={brief.requiredContent} onChange={e => update("requiredContent", e.target.value)} maxLength={5000} /></FormField>
        <FormField label="Факты и цифры" htmlFor="ai-facts" hint="Каждый факт с новой строки. ИИ не добавляет статистику от себя."><Textarea id="ai-facts" rows={3} value={brief.requiredFacts.join("\n")} onChange={e => update("requiredFacts", e.target.value.split("\n"))} placeholder="30+ спикеров-практиков" /></FormField>
        <FormField label="Что нельзя писать?" htmlFor="ai-forbidden"><Textarea id="ai-forbidden" rows={2} value={brief.forbiddenClaims.join("\n")} onChange={e => update("forbiddenClaims", e.target.value.split("\n"))} /></FormField>
        <FormField label="Дедлайн / ограничение" htmlFor="ai-deadline"><Input id="ai-deadline" value={brief.deadline} onChange={e => update("deadline", e.target.value)} placeholder="Укажите только реальный срок или ограничение" maxLength={1000} /></FormField>
        <FormField label="Изображения и оформление" htmlFor="ai-visuals"><Select id="ai-visuals" value={brief.visuals} onChange={e => update("visuals", e.target.value as AiEmailBrief["visuals"])} options={choices([["auto", "Подобрать изображение и узор"], ["image", "Изображение без узора"], ["pattern", "Только узор"], ["none", "Без изображений и узоров"]])} /></FormField>
      </fieldset></details>
      <div className="rounded-2xl border border-border bg-surface p-5"><div className="flex flex-wrap items-center gap-3"><Select aria-label="Тип изображения" value={kind} onChange={e => setKind(e.target.value as "photo" | "logo")} options={choices([["photo", "Фото, продукт или баннер"], ["logo", "Логотип"]])} className="max-w-56" /><Button type="button" variant="secondary" disabled={uploading || ai.busy} onClick={() => files.current?.click()}><Paperclip className="size-4" aria-hidden="true" />{uploading ? "Загружаем…" : "Прикрепить файл"}</Button><input ref={files} type="file" accept="image/png,image/jpeg,image/gif,image/webp,text/plain,.txt" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }} /></div><p className="mb-0 mt-3 text-xs leading-5 text-text-muted">Изображения до 4 МБ или текстовый материал TXT. Ваши файлы используются вместо сгенерированной замены.</p>{brief.assets.length ? <ul className="mb-0 mt-3 grid gap-2">{brief.assets.map(asset => <li key={asset.id} className="flex min-w-0 items-center justify-between gap-3 text-sm"><span className="truncate">{asset.filename}</span><Button type="button" size="sm" variant="ghost" disabled={ai.busy} aria-label={`Убрать ${asset.filename}`} onClick={() => update("assets", brief.assets.filter(a => a.id !== asset.id))}><X className="size-4" aria-hidden="true" /></Button></li>)}</ul> : null}</div>
      {ai.error ? <p role="alert" className="m-0 rounded-xl border border-danger/30 bg-danger-subtle p-4 text-sm text-danger">{ai.error}</p> : null}
      <div role="status" aria-live="polite" className="text-sm text-text-muted">{ai.busy ? ai.stageLabel : ""}</div>
      <div className="flex flex-wrap items-center gap-3 pb-4"><Button type="submit" variant="primary" disabled={ai.busy || uploading}>{ai.busy ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}Создать письмо</Button>{ai.busy ? <Button type="button" variant="secondary" onClick={ai.cancel}>Остановить</Button> : <span className="text-xs text-text-muted">Результат откроется в редакторе. Любой блок можно изменить.</span>}</div>
    </form>
  </section>;
}
