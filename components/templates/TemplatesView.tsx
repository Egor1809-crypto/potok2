"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, PenTool, RefreshCw, SearchX, Sparkles, Upload } from "lucide-react";

import type { TemplateCategory } from "@/types";
import type {
  ApiError,
  EmailTemplateDeleteResponse,
  EmailTemplateMutationResponse,
  EmailTemplateRecord,
  EmailTemplatesListResponse,
} from "@/types/api";
import { PageHeader } from "@/components/shared";
import {
  Alert,
  EmptyState,
  SearchInput,
  Select,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  buttonVariants,
} from "@/components/ui";
import { TemplateCard } from "./TemplatePreview";
import { templateCategoryLabels } from "./templateLabels";

const categories = [
  "All",
  "Business",
  "Events",
  "Outreach",
  "Newsletter",
  "Follow-up",
  "Transactional",
] as const;

type CategoryFilter = (typeof categories)[number];
type ScopeFilter = "all" | "mine";
type CollectionFilter = "studio" | "all";
type SortMode = "recent" | "name" | "blocks";
type StyleFilter = "all" | "minimal" | "editorial" | "bold";
type DensityFilter = "all" | "compact" | "balanced" | "rich";
type PaletteFilter = "all" | "light" | "dark" | "warm" | "cool" | "neutral";
type LoadState = "loading" | "ready" | "error";

function isStudioTemplate(template: EmailTemplateRecord) {
  return template.id.startsWith("template-v7-studio-") || template.id.startsWith("template-v8-creative-");
}

function paletteOf(template: EmailTemplateRecord): Exclude<PaletteFilter, "all"> {
  const dark = [template.builderDocument.bodyBackground, template.builderDocument.workspaceBackground]
    .some((value) => /^#(?:0|1|2|3)/i.test(value));
  if (dark) return "dark";
  const value = template.builderDocument.accentColor.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(value)) return "neutral";
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta < 0.12) return "neutral";
  let hue = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue <= 70 || hue >= 325) return "warm";
  if (hue >= 155 && hue <= 300) return "cool";
  return "light";
}

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getBrowserSearch() {
  return window.location.search;
}

function getServerSearch() {
  return "";
}

function safeCampaignPath(value: string | null) {
  if (!value || !value.startsWith("/campaigns/new") || value.startsWith("//")) return undefined;
  return value;
}

function addTemplateToReturnPath(path: string, templateId?: string) {
  const target = new URL(path, "https://mailflow.local");
  if (templateId) target.searchParams.set("template", templateId);
  else target.searchParams.delete("template");
  if (!target.searchParams.has("step")) target.searchParams.set("step", "message");
  return `${target.pathname}${target.search}`;
}

function campaignBuilderHref({
  campaignName,
  returnTo,
  templateId,
}: {
  campaignName?: string;
  returnTo: string;
  templateId?: string;
}) {
  const returnTarget = new URL(
    addTemplateToReturnPath(returnTo, templateId),
    "https://mailflow.local",
  );
  returnTarget.searchParams.set("builderDraft", "1");
  const normalizedReturnTo = `${returnTarget.pathname}${returnTarget.search}`;
  const query = new URLSearchParams({ returnTo: normalizedReturnTo });
  const handoffToken = returnTarget.searchParams.get("handoff");
  if (handoffToken) query.set("handoff", handoffToken);
  if (templateId) query.set("template", templateId);
  else query.set("new", "1");
  if (campaignName) query.set("campaign", campaignName);
  return `/email-builder?${query.toString()}`;
}

async function responseBody(response: Response) {
  return await response.json() as
    | EmailTemplateMutationResponse
    | EmailTemplateDeleteResponse
    | EmailTemplatesListResponse
    | ApiError;
}

function mutationError(
  body: EmailTemplateMutationResponse | EmailTemplateDeleteResponse | EmailTemplatesListResponse | ApiError,
  fallback: string,
) {
  if (!("error" in body)) return fallback;
  const details = body.details?.filter(Boolean) ?? [];
  return details.length ? `${body.error} ${details.join(" ")}` : body.error;
}

export function TemplatesView() {
  const browserSearch = useSyncExternalStore(subscribeToLocation, getBrowserSearch, getServerSearch);
  const routeContext = useMemo(() => {
    const params = new URLSearchParams(browserSearch);
    return {
      campaignName: params.get("campaign")?.trim() || undefined,
      returnTo: safeCampaignPath(params.get("returnTo")),
      backTo: safeCampaignPath(params.get("backTo")),
    };
  }, [browserSearch]);
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [scope, setScope] = useState<ScopeFilter>(() => new URLSearchParams(browserSearch).get("scope") === "mine" ? "mine" : "all");
  const [collection, setCollection] = useState<CollectionFilter>(() => new URLSearchParams(browserSearch).get("scope") === "mine" ? "all" : "studio");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [style, setStyle] = useState<StyleFilter>("all");
  const [density, setDensity] = useState<DensityFilter>("all");
  const [palette, setPalette] = useState<PaletteFilter>("all");
  const [busy, setBusy] = useState<{ id: string; action: "clone" | "delete" } | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const importPromptedRef = useRef(false);

  const loadTemplates = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const response = await fetch("/api/templates", { headers: { Accept: "application/json" } });
      const body = await responseBody(response);
      if (!response.ok || !("templates" in body)) {
        throw new Error(mutationError(body, "Сервер не вернул библиотеку шаблонов."));
      }
      setTemplates(body.templates);
      setLoadState("ready");
    } catch (loadError) {
      setTemplates([]);
      setLoadState("error");
      setError(loadError instanceof Error ? loadError.message : "Библиотека шаблонов недоступна.");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadTemplates());
    return () => window.cancelAnimationFrame(frame);
  }, [loadTemplates]);

  useEffect(() => {
    if (loadState !== "ready" || importPromptedRef.current || new URLSearchParams(browserSearch).get("import") !== "1") return;
    importPromptedRef.current = true;
    importRef.current?.click();
  }, [browserSearch, loadState]);

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return templates
      .filter((template) => scope === "all" || !template.isStarter)
      .filter((template) => scope === "mine" || collection === "all" || isStudioTemplate(template))
      .filter((template) => category === "All" || template.category === category)
      .filter((template) => {
        if (style === "all") return true;
        const blocks = template.builderDocument.blocks;
        if (style === "editorial") return blocks.some((block) => block.fontFamily === "Georgia");
        if (style === "bold") return blocks.some((block) => block.type === "hero" || block.type === "banner");
        return blocks.length <= 7 && !blocks.some((block) => block.type === "hero" || block.type === "banner");
      })
      .filter((template) => palette === "all" || paletteOf(template) === palette)
      .filter((template) => {
        const count = template.builderDocument.blocks.length;
        if (density === "compact") return count <= 6;
        if (density === "balanced") return count >= 7 && count <= 8;
        if (density === "rich") return count >= 9;
        return true;
      })
      .filter((template) => !normalized || [
        template.name,
        template.category,
        templateCategoryLabels[template.category],
        template.description,
        template.subject,
      ].join(" ").toLocaleLowerCase("ru-RU").includes(normalized))
      .sort((first, second) => {
        if (sort === "name") return first.name.localeCompare(second.name, "ru-RU");
        if (sort === "blocks") {
          return second.builderDocument.blocks.length - first.builderDocument.blocks.length || first.name.localeCompare(second.name, "ru-RU");
        }
        return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
      });
  }, [category, collection, density, palette, query, scope, sort, style, templates]);

  const scopedTemplates = useMemo(
    () => templates
      .filter((template) => scope === "all" || !template.isStarter)
      .filter((template) => scope === "mine" || collection === "all" || isStudioTemplate(template)),
    [collection, scope, templates],
  );

  const cloneTemplate = async (template: EmailTemplateRecord) => {
    setBusy({ id: template.id, action: "clone" });
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "clone", id: template.id }),
      });
      const body = await responseBody(response);
      if (!response.ok || !("template" in body)) {
        throw new Error(mutationError(body, "Шаблон не продублирован."));
      }
      setTemplates((current) => [body.template, ...current]);
      setNotice(`Создан шаблон «${body.template.name}».`);
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : "Шаблон не продублирован.");
    } finally {
      setBusy(null);
    }
  };

  const deleteTemplate = async (template: EmailTemplateRecord) => {
    if (!window.confirm(`Удалить шаблон «${template.name}»? Это действие нельзя отменить.`)) return;
    setBusy({ id: template.id, action: "delete" });
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/templates?id=${encodeURIComponent(template.id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const body = await responseBody(response);
      if (!response.ok || !("deletedId" in body)) {
        throw new Error(mutationError(body, "Шаблон не удалён."));
      }
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      const detachedNames = body.detachedCampaignNames ?? [];
      setNotice(body.detachedCampaignCount > 0
        ? `Шаблон «${template.name}» удалён и отвязан от кампаний: ${detachedNames.join(", ")}. Снимки писем в кампаниях сохранены.`
        : `Шаблон «${template.name}» удалён.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Шаблон не удалён.");
    } finally {
      setBusy(null);
    }
  };

  const importTemplate = async (file: File) => {
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Файл шаблона больше 2 МБ.");
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("В файле нет макета MAILFLOW.");
      const source = parsed as Record<string, unknown>;
      const nestedTemplate = source.template && typeof source.template === "object" && !Array.isArray(source.template) ? source.template as Record<string, unknown> : undefined;
      const document = nestedTemplate?.builderDocument ?? source.builderDocument ?? parsed;
      if (!document || typeof document !== "object" || Array.isArray(document) || !Array.isArray((document as { blocks?: unknown }).blocks)) throw new Error("Не найдены блоки письма. Выберите файл .mailflow.json, скачанный из конструктора.");
      const documentRecord = document as Record<string, unknown>;
      const rawName = typeof nestedTemplate?.name === "string" ? nestedTemplate.name : file.name.replace(/\.mailflow\.json$|\.json$/i, "");
      const name = `${rawName || "Импортированный шаблон"} · импорт ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name,
          description: "Импортирован из резервного файла MAILFLOW.",
          category: "Business",
          subject: typeof documentRecord.subject === "string" ? documentRecord.subject : "Новое письмо",
          previewText: typeof documentRecord.previewText === "string" ? documentRecord.previewText : "",
          builderDocument: { ...documentRecord, templateId: "" },
        }),
      });
      const body = await responseBody(response);
      if (!response.ok || !("template" in body)) throw new Error(mutationError(body, "Шаблон не импортирован."));
      setTemplates((current) => [body.template, ...current]);
      setScope("mine");
      setCategory("All");
      setNotice(`Шаблон «${body.template.name}» импортирован и открыт в разделе «Мои шаблоны».`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Шаблон не импортирован.");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const returnPath = routeContext.returnTo ?? "/campaigns/new?step=message";
  const newTemplateHref = routeContext.returnTo
    ? campaignBuilderHref({ campaignName: routeContext.campaignName, returnTo: returnPath })
    : "/email-builder?new=1";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Серверная библиотека"
        title="Email-шаблоны"
        description={routeContext.campaignName
          ? `Выберите макет для кампании «${routeContext.campaignName}». Аудитория и маршруты останутся в черновике.`
          : "Создавайте, редактируйте и повторно используйте макеты. HTML и текстовая версия собираются на сервере."}
        meta={loadState === "ready" ? `Шаблонов: ${templates.length}` : "Данные с сервера"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {routeContext.backTo ? (
              <Link href={routeContext.backTo} className={buttonVariants({ variant: "secondary", size: "md" })}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Вернуться к кампании
              </Link>
            ) : null}
            {!routeContext.returnTo ? <>
              <input ref={importRef} type="file" accept=".json,.mailflow.json,application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importTemplate(file); }} />
              <button type="button" disabled={importing} onClick={() => importRef.current?.click()} className={buttonVariants({ variant: "secondary", size: "md" })}>
                <Upload aria-hidden="true" className="size-4" />{importing ? "Импортируем…" : "Импортировать шаблон"}
              </button>
            </> : null}
            <Link href={newTemplateHref} className={buttonVariants({ variant: "primary", size: "md" })}>
              <PenTool aria-hidden="true" className="size-4" />
              {routeContext.returnTo ? "Начать с нуля" : "Открыть конструктор"}
            </Link>
          </div>
        }
      />

      {error ? <Alert tone="danger" title="Операция не выполнена">{error}</Alert> : null}
      {notice ? <Alert tone="success" title="Готово">{notice}</Alert> : null}

      {loadState === "loading" ? (
        <div className="card grid min-h-64 place-items-center p-8 text-center">
          <div><Spinner className="mx-auto size-5" label="Загрузка шаблонов" /><p className="mt-3 text-[12px] text-text-muted">Загружаем библиотеку с сервера…</p></div>
        </div>
      ) : loadState === "error" ? (
        <div className="card">
          <EmptyState
            icon={<RefreshCw aria-hidden="true" className="size-5" />}
            title="Библиотека не загружена"
            description="Без ответа сервера нельзя безопасно редактировать или удалять шаблоны."
            action={{ label: "Повторить", onClick: () => void loadTemplates() }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface p-1" role="group" aria-label="Раздел шаблонов">
            <button type="button" aria-pressed={scope === "all" && collection === "studio"} onClick={() => { setScope("all"); setCollection("studio"); }} className="rounded-lg px-4 py-2 text-[12px] font-semibold text-text-muted outline-none transition hover:text-text-strong aria-pressed:bg-primary aria-pressed:text-white focus-visible:ring-2 focus-visible:ring-primary/30">
              <Sparkles aria-hidden="true" className="mr-1.5 inline size-3.5" />Подборка студии <span className="ml-1 opacity-70">{templates.filter(isStudioTemplate).length}</span>
            </button>
            <button type="button" aria-pressed={scope === "all" && collection === "all"} onClick={() => { setScope("all"); setCollection("all"); }} className="rounded-lg px-4 py-2 text-[12px] font-semibold text-text-muted outline-none transition hover:text-text-strong aria-pressed:bg-primary aria-pressed:text-white focus-visible:ring-2 focus-visible:ring-primary/30">
              Вся библиотека <span className="ml-1 opacity-70">{templates.length}</span>
            </button>
            <button type="button" aria-pressed={scope === "mine"} onClick={() => { setScope("mine"); setCollection("all"); }} className="rounded-lg px-4 py-2 text-[12px] font-semibold text-text-muted outline-none transition hover:text-text-strong aria-pressed:bg-primary aria-pressed:text-white focus-visible:ring-2 focus-visible:ring-primary/30">
              Мои шаблоны <span className="ml-1 opacity-70">{templates.filter((template) => !template.isStarter).length}</span>
            </button>
          </div>
          {scope === "all" && collection === "studio" ? (
            <div className="overflow-hidden rounded-[18px] border border-[#28231F] bg-[#211D1A] p-5 text-[#F8F2E8] shadow-[0_18px_46px_rgba(35,28,23,0.12)] sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)] lg:items-end">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C7FF65]">MAILFLOW DESIGN STUDIO / 01</span>
                  <h2 className="mb-0 mt-3 max-w-3xl text-balance text-[28px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[38px]">Не шаблоны по палитрам, а разные арт-направления</h2>
                </div>
                <p className="m-0 max-w-xl text-[12px] leading-6 text-[#C9C0B7]">Больше 150 студийных макетов: Swiss Grid, Memphis, Bauhaus, cinema noir, botanical, neo‑Tokyo, postal, gallery, ceramic, festival и другие. Они различаются композицией, ритмом и задачей, а не только цветом.</p>
              </div>
            </div>
          ) : null}
        <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)} className="min-w-0">
          <TabsList className="-mb-px">
            {categories.map((item) => (
              <TabsTrigger key={item} value={item}>
                {item === "All" ? "Все" : templateCategoryLabels[item]}
                <span className="ml-1.5 text-[10px] font-normal text-text-subtle">
                  {item === "All" ? scopedTemplates.length : scopedTemplates.filter((template) => template.category === (item as TemplateCategory)).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={category} className="pt-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_170px_170px_190px_200px]">
              <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Поиск по задаче, теме или названию…" aria-label="Поиск шаблонов" wrapperClassName="w-full" />
              <Select value={style} onChange={(event) => setStyle(event.target.value as StyleFilter)} aria-label="Стиль шаблона" options={[{value:"all",label:"Любой стиль"},{value:"minimal",label:"Минималистичный"},{value:"editorial",label:"Редакционный"},{value:"bold",label:"Контрастный"}]} className="h-8 min-h-8 text-[11px]" />
              <Select value={palette} onChange={(event) => setPalette(event.target.value as PaletteFilter)} aria-label="Цветовая система" options={[{value:"all",label:"Любая палитра"},{value:"light",label:"Светлая"},{value:"dark",label:"Тёмная"},{value:"warm",label:"Тёплая"},{value:"cool",label:"Холодная"},{value:"neutral",label:"Нейтральная"}]} className="h-8 min-h-8 text-[11px]" />
              <Select value={density} onChange={(event) => setDensity(event.target.value as DensityFilter)} aria-label="Насыщенность шаблона" options={[{value:"all",label:"Любая насыщенность"},{value:"compact",label:"Короткий · до 6 блоков"},{value:"balanced",label:"Средний · 7–8 блоков"},{value:"rich",label:"Подробный · 9+ блоков"}]} className="h-8 min-h-8 text-[11px]" />
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                aria-label="Сортировать шаблоны"
                options={[
                  { value: "recent", label: "Недавно обновлённые" },
                  { value: "name", label: "По названию" },
                  { value: "blocks", label: "По числу блоков" },
                ]}
                className="h-8 min-h-8 text-[11px]"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="m-0 text-[11px] text-text-muted">Найдено: <span className="font-semibold text-text-strong">{filteredTemplates.length}</span>{category !== "All" ? ` · ${templateCategoryLabels[category]}` : ""}</p>
              <span className="hidden items-center gap-1.5 text-[10px] text-text-subtle sm:flex"><FileText aria-hidden="true" className="size-3" />Каждый макет хранится в рабочем пространстве</span>
            </div>

            {filteredTemplates.length ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    editHref={routeContext.returnTo
                      ? campaignBuilderHref({
                          campaignName: routeContext.campaignName,
                          returnTo: returnPath,
                          templateId: template.id,
                        })
                      : `/email-builder?template=${encodeURIComponent(template.id)}`}
                    editLabel={routeContext.returnTo ? "Настроить" : "Редактировать"}
                    applyHref={addTemplateToReturnPath(returnPath, template.id)}
                    onClone={() => void cloneTemplate(template)}
                    onDelete={() => void deleteTemplate(template)}
                    busyAction={busy?.id === template.id ? busy.action : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[14px] border border-border bg-surface">
                <EmptyState
                  icon={<SearchX aria-hidden="true" className="size-5" />}
                  title={scope === "mine" && !scopedTemplates.length ? "У вас пока нет своих шаблонов" : templates.length ? "Подходящих шаблонов нет" : "Библиотека пуста"}
                  description={scope === "mine" && !scopedTemplates.length ? "Создайте макет с нуля или откройте стартовый шаблон и сохраните свой вариант." : templates.length ? "Измените запрос или категорию." : "Создайте первый шаблон в визуальном редакторе."}
                  action={templates.length ? { label: scope === "mine" && !scopedTemplates.length ? "Показать библиотеку" : "Сбросить фильтры", onClick: () => { setQuery(""); setCategory("All"); setStyle("all"); setPalette("all"); setDensity("all"); if (scope === "mine" && !scopedTemplates.length) setScope("all"); } } : undefined}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>
      )}
    </div>
  );
}
