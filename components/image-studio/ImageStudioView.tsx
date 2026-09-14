"use client";

import studioStyles from "./ImageConstructor.module.css";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Download,
  Image as ImageIcon,
  Presentation,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "@/components/ui/icons";

import { AppShell } from "@/components/layout/AppShell";
import { PhotoLibrary } from "./PhotoLibrary";
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
} from "@/types/api";

const promptIdeas = [
  "Обложка для отчёта о правовых технологиях: светлая бумага, тонкие кобальтовые линии и один алый акцент",
  "Премиальная абстрактная иллюстрация для приглашения на закрытую деловую встречу",
  "Натюрморт с ноутбуком и юридическими документами, мягкий утренний свет, без людей и текста",
  "Широкий кинематографический кадр для презентации стратегии: ночной город, один световой маршрут, свободная левая треть",
  "Ботаническая композиция для wellness-письма: шалфей, прозрачное стекло и известковая поверхность, рассеянный дневной свет",
  "Техническая иллюстрация экосистемы данных: четыре связанных модуля, кобальтовые линии, тёмный фон, без подписей",
  "Тихая премиальная обложка для частного предложения: тёмный камень, латунная деталь, мягкий боковой свет",
  "Архитектурный интерьер современной библиотеки: бетон, светлое дерево, ритм колонн, без людей",
  "Бумажная многослойная иллюстрация роста продукта: путь из трёх ступеней, коралловый и сливочный цвета",
  "Редакционный портрет предпринимателя в рабочем пространстве: естественная поза, боковой свет, без стоковой улыбки",
  "Абстрактный фон для квартального отчёта: графитовые плоскости, тонкий зелёный сигнал и много воздуха под заголовок",
  "Горизонтальная сцена конференции: светящаяся сцена вдали, силуэты аудитории, свободное пространство справа",
];

const aspectLabels: Record<ImageStudioAspect, string> = {
  square: "Квадрат",
  landscape: "Альбом",
  portrait: "Портрет",
  banner: "Баннер",
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
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const [status, setStatus] = useState<ImageStudioStatusResponse | null>(null);
  const [assets, setAssets] = useState<EmailAssetRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [aspect, setAspect] = useState<ImageStudioAspect>("landscape");
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [purpose, setPurpose] = useState<"illustration" | "email-background">(
    "illustration",
  );
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
        const body = (await response.json()) as
          ImageStudioStatusResponse | ApiError;
        if (!response.ok || !("assets" in body)) {
          throw new Error(
            errorMessage(
              "error" in body ? body : undefined,
              "Медиатека не загружена.",
            ),
          );
        }
        setStatus(body);
        setAssets(body.assets);
        setSelectedId(body.assets[0]?.id ?? "");
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(
          caught instanceof Error ? caught.message : "Медиатека не загружена.",
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (requestedView === "library") return;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById("image-constructor")?.scrollIntoView({ block: "start" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [requestedView]);

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
        body: JSON.stringify({
          prompt:
            purpose === "email-background"
              ? `${prompt.trim()}\n\nЭто фон email-письма: спокойный низкий контраст, много свободного пространства для читаемого текста поверх, без текста, логотипов, центрального лица и мелких шумных деталей.`
              : prompt.trim(),
          title: title.trim(),
          style: "editorial",
          aspect: purpose === "email-background" ? "portrait" : aspect,
          quality,
        }),
      });
      const body = (await response.json()) as
        ImageStudioGenerateResponse | ApiError;
      if (!response.ok || !("asset" in body)) {
        throw new Error(
          errorMessage(
            "error" in body ? body : undefined,
            "Изображение не создано.",
          ),
        );
      }
      setAssets((current) => [
        body.asset,
        ...current.filter((asset) => asset.id !== body.asset.id),
      ]);
      setSelectedId(body.asset.id);
      if (!title.trim())
        setTitle(body.asset.filename.replace(/^ИИ · |\.png$/g, ""));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Изображение не создано.",
      );
    } finally {
      setGenerating(false);
    }
  };

  if (requestedView === "library") return <AppShell title="Шаблоны фотографий" contentWidth="full" viewportLocked desktopSidebarCollapsible contentClassName="!py-3"><PhotoLibrary assets={assets} selectedId={selectedId} onSelect={setSelectedId} loading={loading} error={error} /></AppShell>;

  return (
    <AppShell
      title="Студия изображений"
      contentWidth="full"
      viewportLocked
      contentClassName="!py-4"
    >
      <div className={studioStyles.workspace}>
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <h1 className="m-0 text-[24px] font-semibold tracking-[-0.035em] text-text-strong sm:text-[28px]">
              Конструктор изображений
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-text-muted">
            <ShieldCheck aria-hidden="true" className={cn("size-6", status?.configured ? "text-success" : "text-text-muted")} />
            {status?.configured
              ? "Готов к созданию"
              : "Провайдер не подключён"}
          </div>
        </header>

        {!loading && status && !status.configured ? (
          <Alert tone="warning" title="Генерация пока недоступна">
            Подключите генерацию изображений в настройках платформы.
          </Alert>
        ) : null}
        {error ? (
          <Alert tone="danger" title="Не удалось выполнить действие">
            {error}
          </Alert>
        ) : null}

        <div
          id="image-constructor"
          className={studioStyles.layout}
        >
          <Card className={studioStyles.prompt}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-[17px] font-semibold">Новая работа</h2>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <WandSparkles aria-hidden="true" className="size-7" />
              </span>
            </div>
            <div className="grid gap-3">
              <fieldset className="grid gap-2">
                <legend className="text-[12px] font-medium">Назначение</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={purpose === "illustration"}
                    onClick={() => setPurpose("illustration")}
                    className="rounded-xl border border-border p-3 text-left outline-none transition hover:border-primary/30 aria-pressed:border-primary aria-pressed:bg-primary-subtle/40"
                  >
                    <strong className="block text-[11px]">Иллюстрация</strong>
                    <span className="mt-1 block text-[9px] leading-4 text-text-muted">
                      Отдельное изображение или обложка
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={purpose === "email-background"}
                    onClick={() => {
                      setPurpose("email-background");
                      setAspect("portrait");
                    }}
                    className="rounded-xl border border-border p-3 text-left outline-none transition hover:border-primary/30 aria-pressed:border-primary aria-pressed:bg-primary-subtle/40"
                  >
                    <strong className="block text-[11px]">
                      Фон для письма
                    </strong>
                    <span className="mt-1 block text-[9px] leading-4 text-text-muted">
                      Подложка под текст и блоки письма
                    </span>
                  </button>
                </div>
              </fieldset>
              <FormField
                label={
                  purpose === "email-background"
                    ? "Каким должен быть фон"
                    : "Что нужно создать"
                }
                htmlFor="image-studio-prompt"
                required
                hint={`${prompt.length}/1600`}
              >
                <Textarea
                  id="image-studio-prompt"
                  value={prompt}
                  maxLength={1600}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={5}
                  placeholder="Например: обложка для приглашения на деловой форум. Молочный фон, кобальтовая сетка, тонкие контуры и один алый круг. Без людей, текста и логотипов."
                  className="min-h-32 resize-y text-[13px] leading-5"
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                {promptIdeas.slice(0, 4).map((idea, index) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setPrompt(idea)}
                    className="rounded-full border border-border bg-surface-subtle px-3 py-1.5 text-left text-[10px] text-text-muted transition hover:border-primary/30 hover:text-primary"
                  >
                    {["Обложка отчёта", "Приглашение", "Натюрморт", "Город ночью"][index]}
                  </button>
                ))}
              </div>
              <FormField
                label="Название файла"
                htmlFor="image-studio-title"
                hint="Необязательно"
              >
                <Input
                  id="image-studio-title"
                  value={title}
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Обложка форума 2026"
                />
              </FormField>
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <FormField
                  label="Формат"
                  htmlFor="image-studio-aspect"
                  hint={
                    purpose === "email-background"
                      ? "Для фона письма используется вертикальный формат"
                      : undefined
                  }
                >
                  <Select
                    id="image-studio-aspect"
                    value={purpose === "email-background" ? "portrait" : aspect}
                    disabled={purpose === "email-background"}
                    onChange={(event) =>
                      setAspect(event.target.value as ImageStudioAspect)
                    }
                    options={Object.entries(aspectLabels).map(
                      ([value, label]) => ({ value, label }),
                    )}
                  />
                </FormField>
                <FormField
                  label="Качество"
                  htmlFor="image-studio-quality"
                  hint={
                    quality === "high"
                      ? "Больше деталей, генерация дольше"
                      : "Быстрее для черновых вариантов"
                  }
                >
                  <Select
                    id="image-studio-quality"
                    value={quality}
                    onChange={(event) =>
                      setQuality(event.target.value as "standard" | "high")
                    }
                    options={[
                      { value: "standard", label: "Стандартное" },
                      { value: "high", label: "Высокое" },
                    ]}
                  />
                </FormField>
              </div>
              <Button
                onClick={() => void generate()}
                loading={generating}
                loadingText="Создаём изображение…"
                disabled={!status?.configured || prompt.trim().length < 12}
                size="lg"
                className="w-full"
                leadingIcon={<Sparkles aria-hidden="true" className="size-6" />}
              >
                Создать и сохранить
              </Button>
              {generating ? (
                <p
                  role="status"
                  className="m-0 text-center text-[10px] leading-4 text-text-muted"
                >
                  Обычно это занимает до двух минут. Не закрывайте вкладку —
                  результат автоматически появится справа и в медиатеке.
                </p>
              ) : null}
            </div>
          </Card>

          <Card className={studioStyles.result}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="m-0 text-[15px] font-semibold">Результат</h2>
              </div>
              {selectedAsset ? (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${selectedAsset.url}?download=1`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    <Download aria-hidden="true" className="size-5" />
                    Скачать
                  </a>
                  <Link
                    href={`/email-builder?new=1&asset=${encodeURIComponent(selectedAsset.id)}&assetName=${encodeURIComponent(selectedAsset.filename)}${purpose === "email-background" ? "&assetMode=background" : ""}`}
                    className={buttonVariants({
                      variant: "primary",
                      size: "sm",
                    })}
                  >
                    {purpose === "email-background"
                      ? "Поставить фоном письма"
                      : "Добавить в письмо"}
                    <ArrowRight aria-hidden="true" className="size-5" />
                  </Link>
                  <Link
                    href={`/presentations?new=1&asset=${encodeURIComponent(selectedAsset.id)}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    <Presentation aria-hidden="true" className="size-5" />
                    Использовать в презентации
                  </Link>
                </div>
              ) : null}
            </div>
            <div className={studioStyles.stage} data-generating={generating}>
              {selectedAsset ? (
                <div className="grid max-h-[700px] max-w-full gap-3 text-center">
                  <div className={studioStyles.artwork}>
                    <img
                      src={selectedAsset.url}
                      alt={selectedAsset.filename}
                      className={studioStyles.preview}
                    />
                  </div>
                  <div>
                    <p className="m-0 text-[12px] font-semibold text-text-strong">
                      {selectedAsset.filename}
                    </p>
                    <p className="mb-0 mt-1 text-[10px] text-text-muted">
                      {formatBytes(selectedAsset.size)} · сохранено{" "}
                      {new Date(selectedAsset.createdAt).toLocaleDateString(
                        "ru-RU",
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="max-w-sm text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-white/80 text-primary shadow-sm">
                    <ImageIcon aria-hidden="true" className="size-8" />
                  </span>
                  <h3 className="mb-0 mt-4 text-[16px] font-semibold">
                    Здесь появится первая работа
                  </h3>
                  <p className="mb-0 mt-2 text-[12px] leading-5 text-text-muted">
                    Опишите сюжет и выберите формат. Готовое изображение появится на этом холсте.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>


      </div>
    </AppShell>
  );
}
