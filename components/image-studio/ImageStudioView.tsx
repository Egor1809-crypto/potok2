"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Image as ImageIcon,
  Images,
  Presentation,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import {
  Alert,
  Button,
  Card,
  FormField,
  Input,
  Select,
  Textarea,
  buttonVariants,
} from "@/components/ui";
import { cn } from "@/components/ui/utils";
import type {
  ApiError,
  EmailAssetRecord,
  ImageStudioAspect,
  ImageStudioGenerateResponse,
  ImageStudioStatusResponse,
  ImageStudioStyle,
} from "@/types/api";

const styles: Array<{ id: ImageStudioStyle; name: string; description: string; swatch: string }> = [
  { id: "editorial", name: "Редакционный", description: "Сетка, воздух и выразительная арт-дирекция", swatch: "from-[#17131d] via-[#5134c8] to-[#f5c7d8]" },
  { id: "minimal", name: "Минимализм", description: "Один акцент и чистая композиция", swatch: "from-[#f7f1e8] via-[#f7f1e8] to-[#ff5a36]" },
  { id: "photo", name: "Фотография", description: "Правдоподобный свет без стоковых клише", swatch: "from-[#193246] via-[#d9a56c] to-[#eae1d2]" },
  { id: "abstract", name: "Абстракция", description: "Цвет, геометрия и пластичный ритм", swatch: "from-[#3523c7] via-[#ef66ad] to-[#ffd23f]" },
  { id: "collage", name: "Коллаж", description: "Бумага, вырезки и тактильные слои", swatch: "from-[#eee2cf] via-[#de5543] to-[#163e73]" },
  { id: "three-dimensional", name: "3D", description: "Матовые объекты и студийный свет", swatch: "from-[#d9d2ff] via-[#7968ee] to-[#b8f2dc]" },
];

const promptIdeas = [
  "Обложка для отчёта о правовых технологиях: светлая бумага, тонкие кобальтовые линии и один алый акцент",
  "Премиальная абстрактная иллюстрация для приглашения на закрытую деловую встречу",
  "Натюрморт с ноутбуком и юридическими документами, мягкий утренний свет, без людей и текста",
];

const aspectLabels: Record<ImageStudioAspect, string> = {
  square: "Квадрат · 1024 × 1024",
  landscape: "Альбом · 1536 × 1024",
  portrait: "Портрет · 1024 × 1536",
  banner: "Баннер · 1536 × 1024",
};

function formatBytes(value: number) {
  return value > 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(value / 1024))} КБ`;
}

function errorMessage(body: ApiError | undefined, fallback: string) {
  if (!body?.error) return fallback;
  return [body.error, ...(body.details ?? [])].join(" ");
}

export function ImageStudioView() {
  const [status, setStatus] = useState<ImageStudioStatusResponse | null>(null);
  const [assets, setAssets] = useState<EmailAssetRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState<ImageStudioStyle>("editorial");
  const [aspect, setAspect] = useState<ImageStudioAspect>("landscape");
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/image-studio", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as ImageStudioStatusResponse | ApiError;
        if (!response.ok || !("assets" in body)) {
          throw new Error(errorMessage("error" in body ? body : undefined, "Медиатека не загружена."));
        }
        setStatus(body);
        setAssets(body.assets);
        setSelectedId(body.assets[0]?.id ?? "");
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Медиатека не загружена.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedId) ?? assets[0],
    [assets, selectedId],
  );

  const generate = async () => {
    if (prompt.trim().length < 12) {
      setError("Опишите задачу хотя бы одним предложением.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/image-studio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ prompt: prompt.trim(), title: title.trim(), style, aspect, quality }),
      });
      const body = await response.json() as ImageStudioGenerateResponse | ApiError;
      if (!response.ok || !("asset" in body)) {
        throw new Error(errorMessage("error" in body ? body : undefined, "Изображение не создано."));
      }
      setAssets((current) => [body.asset, ...current.filter((asset) => asset.id !== body.asset.id)]);
      setSelectedId(body.asset.id);
      if (!title.trim()) setTitle(body.asset.filename.replace(/^ИИ · |\.png$/g, ""));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Изображение не создано.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell title="Студия изображений" contentWidth="full">
      <div className="grid gap-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-subtle px-3 py-1.5 text-[11px] font-semibold text-primary">
              <Sparkles aria-hidden="true" className="size-3.5" /> Визуальная студия
            </div>
            <h1 className="m-0 text-[32px] font-semibold tracking-[-0.035em] text-text-strong sm:text-[42px]">Создавайте изображения для писем и презентаций</h1>
            <p className="mb-0 mt-3 max-w-2xl text-[14px] leading-6 text-text-muted">Опишите замысел, выберите арт-направление и формат. Готовый файл сохраняется в общей медиатеке — его можно скачать, открыть в конструкторе письма или сразу поставить на первый слайд новой презентации.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-text-muted">
            <ShieldCheck aria-hidden="true" className="size-4 text-success" />
            {status?.configured ? `NavyAI подключён · ${status.model}` : "Провайдер не подключён"}
          </div>
        </header>

        {!loading && status && !status.configured ? (
          <Alert tone="warning" title="Генерация пока недоступна">
            Добавьте NAVYAI_API_KEY на сервере. Галерея и ранее сохранённые файлы остаются доступны.
          </Alert>
        ) : null}
        {error ? <Alert tone="danger" title="Не удалось выполнить действие">{error}</Alert> : null}

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(340px,0.8fr)_minmax(520px,1.2fr)]">
          <Card className="min-w-0 p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><h2 className="m-0 text-[17px] font-semibold">Новая работа</h2><p className="mb-0 mt-1 text-[12px] text-text-muted">Один запрос создаёт один долговечный файл.</p></div>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><WandSparkles aria-hidden="true" className="size-4.5" /></span>
            </div>
            <div className="grid gap-4">
              <FormField label="Что нужно создать" htmlFor="image-studio-prompt" required hint={`${prompt.length}/1600 · укажите сюжет, палитру, настроение и ограничения`}>
                <Textarea id="image-studio-prompt" value={prompt} maxLength={1600} onChange={(event) => setPrompt(event.target.value)} rows={7} placeholder="Например: обложка для приглашения на деловой форум. Молочный фон, кобальтовая сетка, тонкие контуры и один алый круг. Без людей, текста и логотипов." className="min-h-40 resize-y text-[13px] leading-6" />
              </FormField>
              <div className="flex flex-wrap gap-2">
                {promptIdeas.map((idea, index) => <button key={idea} type="button" onClick={() => setPrompt(idea)} className="rounded-full border border-border bg-surface-subtle px-3 py-1.5 text-left text-[10px] text-text-muted transition hover:border-primary/30 hover:text-primary">Идея {index + 1}</button>)}
              </div>
              <FormField label="Название файла" htmlFor="image-studio-title" hint="Необязательно — поможет найти работу в галерее">
                <Input id="image-studio-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Обложка форума 2026" />
              </FormField>
              <fieldset className="grid gap-2.5"><legend className="mb-1 text-[12px] font-medium">Арт-направление</legend><div className="grid gap-2 sm:grid-cols-2">{styles.map((item) => <button key={item.id} type="button" aria-pressed={style === item.id} onClick={() => setStyle(item.id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left outline-none transition hover:border-primary/30 aria-pressed:border-primary aria-pressed:bg-primary-subtle/40 focus-visible:ring-2 focus-visible:ring-primary/25"><span className={cn("size-9 shrink-0 rounded-lg bg-gradient-to-br", item.swatch)} /><span className="min-w-0"><strong className="block text-[11px]">{item.name}</strong><span className="mt-0.5 block text-[9px] leading-3.5 text-text-subtle">{item.description}</span></span></button>)}</div></fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Формат" htmlFor="image-studio-aspect"><Select id="image-studio-aspect" value={aspect} onChange={(event) => setAspect(event.target.value as ImageStudioAspect)} options={Object.entries(aspectLabels).map(([value, label]) => ({ value, label }))} /></FormField>
                <FormField label="Качество" htmlFor="image-studio-quality" hint={quality === "high" ? "Больше деталей, генерация дольше" : "Быстрее для черновых вариантов"}><Select id="image-studio-quality" value={quality} onChange={(event) => setQuality(event.target.value as "standard" | "high")} options={[{ value: "standard", label: "Стандартное" }, { value: "high", label: "Высокое" }]} /></FormField>
              </div>
              <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-3.5">
                <p className="m-0 text-[11px] font-semibold">Референс с компьютера</p>
                <p className="mb-0 mt-1 text-[10px] leading-4 text-text-muted">Активный NavyAI API пока не поддерживает image-to-image. Мы не показываем неработающую загрузку: опишите нужные черты референса в промпте.</p>
              </div>
              <Button onClick={() => void generate()} loading={generating} loadingText="NavyAI создаёт изображение…" disabled={!status?.configured || prompt.trim().length < 12} size="lg" className="w-full" leadingIcon={<Sparkles aria-hidden="true" className="size-4" />}>Создать и сохранить</Button>
              {generating ? <p role="status" className="m-0 text-center text-[10px] leading-4 text-text-muted">Обычно это занимает до двух минут. Не закрывайте вкладку — результат автоматически появится справа и в медиатеке.</p> : null}
            </div>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div><h2 className="m-0 text-[15px] font-semibold">Результат</h2><p className="mb-0 mt-0.5 text-[10px] text-text-muted">Файл хранится в MAILFLOW, а не по временной ссылке провайдера.</p></div>
              {selectedAsset ? <div className="flex flex-wrap gap-2"><a href={`${selectedAsset.url}?download=1`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download aria-hidden="true" className="size-3.5" />Скачать</a><Link href={`/email-builder?new=1&asset=${encodeURIComponent(selectedAsset.id)}&assetName=${encodeURIComponent(selectedAsset.filename)}`} className={buttonVariants({ variant: "primary", size: "sm" })}>Использовать в письме<ArrowRight aria-hidden="true" className="size-3.5" /></Link><Link href={`/presentations?new=1&asset=${encodeURIComponent(selectedAsset.id)}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Presentation aria-hidden="true" className="size-3.5" />Использовать в презентации</Link></div> : null}
            </div>
            <div className="grid min-h-[480px] place-items-center bg-[radial-gradient(circle_at_top,#f1eaff_0,transparent_42%),linear-gradient(135deg,#f7f4fa,#efe9e2)] p-5 sm:p-8">
              {selectedAsset ? <div className="grid max-h-[700px] max-w-full gap-3 text-center"><div className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(42,27,60,0.16)]"><img src={selectedAsset.url} alt={selectedAsset.filename} className="max-h-[610px] max-w-full object-contain" /></div><div><p className="m-0 text-[12px] font-semibold text-text-strong">{selectedAsset.filename}</p><p className="mb-0 mt-1 text-[10px] text-text-muted">{formatBytes(selectedAsset.size)} · сохранено {new Date(selectedAsset.createdAt).toLocaleDateString("ru-RU")}</p></div></div> : <div className="max-w-sm text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-white/80 text-primary shadow-sm"><ImageIcon aria-hidden="true" className="size-6" /></span><h3 className="mb-0 mt-4 text-[16px] font-semibold">Здесь появится первая работа</h3><p className="mb-0 mt-2 text-[12px] leading-5 text-text-muted">Заполните промпт слева или выберите ранее сохранённое изображение в галерее ниже.</p></div>}
            </div>
          </Card>
        </div>

        <section aria-labelledby="image-gallery-title" className="grid gap-4">
          <div className="flex items-end justify-between gap-4"><div><div className="flex items-center gap-2"><Images aria-hidden="true" className="size-4 text-primary" /><h2 id="image-gallery-title" className="m-0 text-[18px] font-semibold">Медиатека</h2></div><p className="mb-0 mt-1 text-[12px] text-text-muted">ИИ-работы и загруженные фотографии доступны всем редакторам MAILFLOW.</p></div><span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] tabular-nums text-text-muted">{assets.length} файлов</span></div>
          {loading ? <Card role="status" className="p-6 text-[12px] text-text-muted">Загружаем сохранённые изображения…</Card> : assets.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{assets.map((asset) => <Card key={asset.id} className={cn("group overflow-hidden border transition", selectedAsset?.id === asset.id ? "border-primary ring-2 ring-primary/15" : "hover:border-primary/30")}><button type="button" aria-label={`Выбрать ${asset.filename}`} aria-pressed={selectedAsset?.id === asset.id} onClick={() => setSelectedId(asset.id)} className="block aspect-[4/3] w-full overflow-hidden bg-surface-subtle"><img src={asset.url} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.02]" /></button><div className="grid gap-2 p-3"><button type="button" aria-pressed={selectedAsset?.id === asset.id} onClick={() => setSelectedId(asset.id)} className="truncate text-left text-[11px] font-semibold" title={asset.filename}>{asset.filename}</button><div className="flex items-center justify-between gap-2 text-[9px] text-text-subtle"><span>{formatBytes(asset.size)}</span><div className="flex gap-1"><a href={`${asset.url}?download=1`} aria-label={`Скачать ${asset.filename}`} className="grid size-7 place-items-center rounded-lg border border-border bg-surface hover:border-primary/30 hover:text-primary"><Download aria-hidden="true" className="size-3" /></a><Link href={`/email-builder?new=1&asset=${encodeURIComponent(asset.id)}&assetName=${encodeURIComponent(asset.filename)}`} aria-label={`Использовать ${asset.filename} в письме`} className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><ArrowRight aria-hidden="true" className="size-3" /></Link></div></div></div></Card>)}</div> : <Card className="grid min-h-40 place-items-center p-6 text-center"><div><ImageIcon aria-hidden="true" className="mx-auto size-5 text-text-subtle" /><p className="mb-0 mt-2 text-[12px] font-medium">Медиатека пока пуста</p><p className="mb-0 mt-1 text-[10px] text-text-muted">Первая успешная генерация сохранится здесь автоматически.</p></div></Card>}
        </section>
      </div>
    </AppShell>
  );
}
