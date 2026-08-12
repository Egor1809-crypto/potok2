"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, LoaderCircle, Sparkles, Upload, WandSparkles } from "lucide-react";

import { Button, FormField, Input, Modal, Select, Textarea } from "@/components/ui";
import type { ApiError, EmailAiResponse, EmailAiSuggestion, EmailAssetMutationResponse, EmailAssetRecord } from "@/types/api";
import type { BuilderDocument } from "./builder-types";

type Stage = "prompt" | "questions";

export function AiEmailAssistant({ document, onApply }: { document: BuilderDocument; onApply: (document: BuilderDocument) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("prompt");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<EmailAiResponse["provider"]>();
  const [goal, setGoal] = useState("");
  const [brandName, setBrandName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [audience, setAudience] = useState("");
  const [visualStyle, setVisualStyle] = useState("minimal");
  const [primaryColor, setPrimaryColor] = useState(document.accentColor);
  const [secondaryColor, setSecondaryColor] = useState(document.workspaceBackground);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [assetKind, setAssetKind] = useState<"photo" | "logo">("photo");
  const [assets, setAssets] = useState<EmailAssetRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
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

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", assetKind);
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const body = await response.json() as EmailAssetMutationResponse | ApiError;
      if (!response.ok || !("asset" in body)) throw new Error("error" in body ? body.error : "Файл не загружен.");
      setAssets((current) => [...current, body.asset]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Файл не загружен.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
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
          goal: `${goal}\n${deadline ? `Срок или дата: ${deadline}.` : ""}`,
          audience,
          tone: "expert",
          visualStyle,
          primaryColor,
          secondaryColor,
          websiteUrl: websiteUrl.trim() || undefined,
          brandName: brandName.trim() || undefined,
          includeLogo: assets.some((asset) => asset.kind === "logo"),
          imageSource: "none",
          availableAssets: assets.map(({ id, filename, kind, url }) => ({ id, filename, kind, url })),
        }),
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
    <section className="mx-auto grid w-full max-w-4xl gap-6 p-5 sm:p-8">
      <Modal open={comparisonOpen} onOpenChange={setComparisonOpen} title="Мой макет и вариант ИИ" description="ИИ подготовил отдельную версию. Текущий макет не изменится без подтверждения." size="xl" footer={<><Button variant="ghost" onClick={() => setComparisonOpen(false)}>Оставить мой</Button><Button variant="primary" disabled={!suggestion?.document} onClick={() => { if (suggestion?.document) onApply(suggestion.document as BuilderDocument); setComparisonOpen(false); }}>Использовать вариант ИИ</Button></>}>
        <div className="grid gap-4 md:grid-cols-2"><DesignCard label="Мой макет" document={document} /><DesignCard label="Вариант ИИ" document={(suggestion?.document ?? document) as BuilderDocument} accent /></div>
      </Modal>

      <header className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-lg"><Sparkles aria-hidden="true" className="size-5" /></span>
        <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-text-strong">{stage === "prompt" ? "Что нужно создать?" : "Уточним детали"}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-6 text-text-muted">{stage === "prompt" ? "Сначала опишите идею своими словами. Настройки появятся только после отправки." : "Ответьте на короткие вопросы. Если изображения не загрузить, письмо будет оформлено цветами, типографикой и узорами."}</p>
        <span className="mt-3 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[10px] font-medium text-text-muted">{configured === null ? "Проверяем подключение" : configured ? `${provider === "navyai" ? "NavyAI" : "OpenAI"} подключён` : "ИИ не подключён"}</span>
      </header>

      {stage === "prompt" ? (
        <div className="card grid gap-4 p-5 sm:p-7">
          <Textarea rows={9} maxLength={2000} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Например: сделай премиальное приглашение на конференцию для юристов. Нужны программа, преимущества участия и кнопка регистрации. Без случайных фотографий." className="resize-y text-[14px] leading-6" />
          <Button type="button" variant="primary" size="lg" disabled={goal.trim().length < 8} onClick={() => setStage("questions")}><Sparkles aria-hidden="true" className="size-4" />Продолжить — уточнить детали</Button>
        </div>
      ) : (
        <div className="card grid gap-5 p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Как называется компания?"><Input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Tech‑Pravo" /></FormField>
            <FormField label="Какой срок или дата?"><Input value={deadline} onChange={(event) => setDeadline(event.target.value)} placeholder="До 20 сентября или без срока" /></FormField>
            <FormField label="Для кого письмо?"><Input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Руководители юридических компаний" /></FormField>
            <FormField label="Какой стиль?"><Select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)} options={[{value:"minimal",label:"Чистый и минималистичный"},{value:"editorial",label:"Редакционный"},{value:"bold",label:"Яркий"},{value:"premium",label:"Премиальный"}]} /></FormField>
            <ColorInput label="Основной цвет" value={primaryColor} onChange={setPrimaryColor} />
            <ColorInput label="Фоновый цвет" value={secondaryColor} onChange={setSecondaryColor} />
            <FormField label="Куда ведёт кнопка?"><Input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://tech-pravo.ru/" /></FormField>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3"><strong className="text-[13px]">Свои изображения</strong><Select aria-label="Тип загружаемого изображения" value={assetKind} onChange={(event) => setAssetKind(event.target.value as "photo" | "logo")} options={[{value:"photo",label:"Фотография"},{value:"logo",label:"Логотип"}]} className="max-w-44" /></div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            <button type="button" onClick={() => fileInput.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void upload(file); }} className={`grid min-h-32 w-full place-items-center rounded-2xl border-2 border-dashed p-5 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 ${dragging ? "border-primary bg-primary-subtle" : "border-border-strong bg-surface-subtle hover:border-primary/45"}`}>
              <span><span className="mx-auto grid size-10 place-items-center rounded-xl bg-surface text-primary shadow-sm">{uploading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Upload aria-hidden="true" className="size-5" />}</span><strong className="mt-3 block text-[13px] text-text-strong">Перетащите изображение сюда</strong><span className="mt-1 block text-[11px] text-text-muted">или нажмите и выберите файл с компьютера · PNG, JPEG, GIF до 8 МБ</span></span>
            </button>
            {assets.length ? <div className="mt-3 flex flex-wrap gap-2">{assets.map((asset) => <span key={asset.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-[10px]"><ImagePlus aria-hidden="true" className="size-3 text-primary" />{asset.filename}<span className="text-text-subtle">· {asset.kind === "logo" ? "логотип" : "фото"}</span></span>)}</div> : <p className="mt-2 text-[10px] text-text-subtle">Необязательно. Без файлов ИИ использует только узоры, цветовые плашки и типографику.</p>}
          </div>

          {error ? <p role="alert" className="m-0 rounded-xl bg-danger-subtle px-4 py-3 text-[12px] text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => setStage("prompt")}><ArrowLeft aria-hidden="true" className="size-4" />Изменить описание</Button><Button type="button" variant="primary" size="lg" className="min-w-52 flex-1" disabled={busy || uploading || !brandName.trim() || !audience.trim()} onClick={() => void generate()}>{busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <WandSparkles aria-hidden="true" className="size-4" />}{busy ? "ИИ собирает письмо…" : "Создать вариант письма"}</Button></div>
        </div>
      )}
    </section>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <FormField label={label}><label className="flex h-10 items-center gap-3 rounded-lg border border-border bg-surface px-3"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-6 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-[11px] uppercase text-text-muted">{value}</span></label></FormField>;
}

/* eslint-disable @next/next/no-img-element -- email designs use user-uploaded image URLs. */
function DesignCard({ label, document, accent = false }: { label: string; document: BuilderDocument; accent?: boolean }) {
  return <section className={`overflow-hidden rounded-2xl border ${accent ? "border-primary/40" : "border-border"}`}><div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-3"><strong className="text-[13px]">{label}</strong><span className="text-[10px] text-text-muted">{document.blocks.length} блоков</span></div><div className="p-4" style={{background:document.workspaceBackground}}><div className="mx-auto grid gap-2 rounded-lg p-4 shadow-sm" style={{background:document.bodyBackground}}><strong className="text-[12px]" style={{color:document.accentColor}}>{document.subject}</strong>{document.blocks.slice(0,10).map((block)=><div key={block.id} className="rounded-md border border-black/5 px-3 py-2" style={{background:block.backgroundColor === "transparent" ? "transparent" : block.backgroundColor,color:block.textColor}}><span className="block text-[8px] uppercase opacity-45">{block.type}</span><span className="mt-1 block line-clamp-2 text-[10px]">{block.label || block.content || "Декоративный блок"}</span>{(block.type === "image" || block.type === "logo") && block.href ? <img src={block.href} alt="" className="mt-2 max-h-36 w-full rounded object-contain" /> : null}</div>)}</div></div></section>;
}
