"use client";

import { confirmAction } from "@/components/ui/confirm-action";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Mail, MessageCircle, PenTool, RefreshCw, SearchX, Send, Sparkles, Star, Upload } from "@/components/ui/icons";

import { importLetter, uploadImportedResources, type ImportedLetter } from "@/lib/email-import/import-letter";
import { importCodeLetter, type CodeImportInput } from "@/lib/email-import/code";
import { LetterPreview } from "./LetterPreview";
import { useRouter } from "next/navigation";
import { EmailImportDialog } from "./EmailImportDialog";
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
  Button,
  Modal,
  Input,
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
import styles from "./Templates.module.css";

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
type CollectionFilter = "studio" | "all" | "favorites";
type SortMode = "recent" | "name" | "blocks";
type StyleFilter = "all" | "minimal" | "editorial" | "bold";
type DensityFilter = "all" | "compact" | "balanced" | "rich";
type PaletteFilter = "all" | "light" | "dark" | "warm" | "cool" | "neutral";
type LoadState = "loading" | "ready" | "error";

const categoryIcons = { All: Sparkles, Business: Mail, Events: CalendarDays, Outreach: Send, Newsletter: Mail, "Follow-up": MessageCircle, Transactional: CheckCircle2 };
const categoryTitles = { All: "Все письма", Business: "Бизнес", Events: "События", Outreach: "Знакомство", Newsletter: "Рассылки", "Follow-up": "Диалог", Transactional: "Уведомления" };

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
  const router = useRouter();
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
  useEffect(() => {
    if (new URLSearchParams(browserSearch).get("scope") === "mine") {
      const frame = window.requestAnimationFrame(() => { setScope("mine"); setCollection("all"); });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [browserSearch]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [style, setStyle] = useState<StyleFilter>("all");
  const [density, setDensity] = useState<DensityFilter>("all");
  const [palette, setPalette] = useState<PaletteFilter>("all");
  const [busy, setBusy] = useState<{ id: string; action: "clone" | "delete" | "favorite" } | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplateRecord | null>(null);
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportedLetter | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const importResources = importPreview?.resources;
  useEffect(() => () => { importResources?.forEach(resource => URL.revokeObjectURL(resource.url)); }, [importResources]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    const frame = window.requestAnimationFrame(() => {
      importPromptedRef.current = true;
      setImportOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [browserSearch, loadState]);

  useEffect(() => {
    if (new URLSearchParams(browserSearch).get("director") !== "1") return;
    const frame = window.requestAnimationFrame(() => router.replace("/art-director?type=emails"));
    return () => window.cancelAnimationFrame(frame);
  }, [browserSearch, router]);

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return templates
      .filter((template) => scope === "all" || !template.isStarter)
      .filter((template) => scope === "mine" || collection !== "studio" || isStudioTemplate(template))
      .filter((template) => collection !== "favorites" || template.isFavorite)
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
        if (first.isFavorite !== second.isFavorite) return first.isFavorite ? -1 : 1;
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
      .filter((template) => scope === "mine" || collection !== "studio" || isStudioTemplate(template))
      .filter((template) => collection !== "favorites" || template.isFavorite),
    [collection, scope, templates],
  );

  const showFavorites = () => {
    setScope("all");
    setCollection("favorites");
    setCategory("All");
    setQuery("");
    setStyle("all");
    setPalette("all");
    setDensity("all");
    setSort("recent");
  };

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
    if (!await confirmAction(`Удалить шаблон «${template.name}»? Это действие нельзя отменить.`)) return;
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

  const toggleFavorite = async (template: EmailTemplateRecord) => {
    setBusy({ id: template.id, action: "favorite" });
    setError(null);
    try {
      const response = await fetch("/api/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: template.id, expectedUpdatedAt: template.updatedAt, isFavorite: !template.isFavorite }),
      });
      const body = await responseBody(response);
      if (!response.ok || !("template" in body)) throw new Error(mutationError(body, "Не удалось изменить избранное."));
      setTemplates((current) => current.map((item) => item.id === body.template.id ? body.template : item));
      setNotice(body.template.isFavorite ? `Шаблон «${body.template.name}» добавлен в избранное.` : `Шаблон «${body.template.name}» убран из избранного.`);
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : "Не удалось изменить избранное.");
    } finally {
      setBusy(null);
    }
  };

  const importTemplate = async (files: File[]) => {
    setImporting(true); setError(null); setNotice(null); setImportProgress("Читаем письмо…");
    try { setImportPreview(await importLetter(files, setImportProgress)); setImportOpen(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось прочитать письмо."); }
    finally { setImporting(false); setImportProgress(""); }
  };
  const importCode = async (input: CodeImportInput) => {
    setImporting(true); setError(null); setNotice(null); setImportProgress("Читаем код…");
    try { setImportPreview(await importCodeLetter(input, setImportProgress)); setImportOpen(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось создать письмо из кода."); }
    finally { setImporting(false); setImportProgress(""); }
  };
  const saveImportedTemplate = async () => {
    if (!importPreview) return;
    setImporting(true); setError(null);
    try {
      const document = await uploadImportedResources(importPreview, setImportProgress);
      const name = importPreview.name.trim() || "Импортированное письмо";
      const response = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({
        name, description: document.rawHtml ? "Импортированное письмо: исходный макет без пересборки." : "Импортирован из резервного файла Поток.", category: "Business",
        subject: document.subject || "Новое письмо", previewText: document.previewText || "", builderDocument: document,
      }) });
      const body = await responseBody(response);
      if (!response.ok || !("template" in body)) throw new Error(mutationError(body, "Письмо не импортировано."));
      setTemplates(current => [body.template, ...current]); setScope("mine"); setCategory("All"); setCollection("all");
      setQuery(""); setStyle("all"); setDensity("all"); setPalette("all");
      setNotice(`Письмо «${body.template.name}» сохранено в «Мои шаблоны». Его можно выбрать для рассылки.`);
      setImportPreview(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить письмо."); }
    finally { setImporting(false); setImportProgress(""); }
  };

  const returnPath = routeContext.returnTo ?? "/campaigns/new?step=message";
  const editTemplateHref = (template: EmailTemplateRecord) => routeContext.returnTo
    ? campaignBuilderHref({ campaignName: routeContext.campaignName, returnTo: returnPath, templateId: template.id })
    : `/email-builder?template=${encodeURIComponent(template.id)}`;
  const hasFilters = Boolean(query || category !== "All" || style !== "all" || palette !== "all" || density !== "all");
  const resetFilters = () => { setQuery(""); setCategory("All"); setStyle("all"); setPalette("all"); setDensity("all"); };
  const newTemplateHref = routeContext.returnTo
    ? campaignBuilderHref({ campaignName: routeContext.campaignName, returnTo: returnPath })
    : "/email-builder?new=1";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Шаблоны писем"
        description={routeContext.campaignName
          ? `Выберите макет для кампании «${routeContext.campaignName}». Аудитория и маршруты останутся в черновике.`
          : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {routeContext.backTo ? (
              <Link href={routeContext.backTo} className={buttonVariants({ variant: "secondary", size: "md" })}>
                <ArrowLeft aria-hidden="true" className="size-6" />
                Вернуться к кампании
              </Link>
            ) : null}
            <>
              <Button variant="secondary" onClick={() => { router.push("/art-director?type=emails"); }}><Sparkles aria-hidden className="size-6" />Арт-директор</Button>
              <button type="button" disabled={importing} onClick={() => { setError(null); setImportOpen(true); }} className={buttonVariants({ variant: "secondary", size: "md" })}>
                <Upload aria-hidden="true" className="size-6" />{importing ? "Импортируем…" : "Импортировать письмо"}
              </button>
            </>
            <Link href={newTemplateHref} className={buttonVariants({ variant: "primary", size: "md" })}>
              <PenTool aria-hidden="true" className="size-6" />
              {routeContext.returnTo ? "Начать с нуля" : "Открыть конструктор"}
            </Link>
          </div>
        }
      />

      <Modal open={Boolean(previewTemplate)} onOpenChange={open => { if (!open) setPreviewTemplate(null); }} title={previewTemplate?.name ?? "Просмотр письма"} description={previewTemplate?.subject} size="xl" footer={previewTemplate ? <div className="flex flex-wrap gap-2"><Link href={editTemplateHref(previewTemplate)} className={buttonVariants({ variant: "primary" })}>Редактировать письмо</Link><Link href={addTemplateToReturnPath(returnPath, previewTemplate.id)} className={buttonVariants({ variant: "secondary" })}>В кампанию</Link></div> : undefined}>
        {previewTemplate && <LetterPreview html={previewTemplate.emailBodyHtml} title={`Письмо: ${previewTemplate.name}`} className="h-[65vh] min-h-64" />}
      </Modal>

      <EmailImportDialog open={importOpen} onOpenChange={setImportOpen} busy={importing} progress={importProgress} error={error} onFiles={files => void importTemplate(files)} onCode={input => void importCode(input)} />
      {importProgress ? <p role="status" className="text-sm text-primary">{importProgress}</p> : null}
      <Modal open={Boolean(importPreview)} onOpenChange={open => { if (!open && !importing) setImportPreview(null); }} title="Проверьте импортированное письмо" size="xl" closeOnEscape={!importing} closeOnBackdrop={!importing} footer={<div className="flex flex-wrap gap-3"><Button variant="outline" disabled={importing} onClick={() => { setImportPreview(null); setImportOpen(true); }}>Назад к импорту</Button><Button loading={importing} disabled={importing || !importPreview?.name.trim()} onClick={() => void saveImportedTemplate()}>Добавить в шаблоны</Button></div>}>
        {importPreview ? <div className="space-y-4">
          {error ? <Alert tone="danger" title="Не удалось сохранить">{error}</Alert> : null}
          <ul className="space-y-2 text-sm leading-6 text-text-muted">{importPreview.notes.map(note => <li key={note}>{note}</li>)}</ul>
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="import-name" className="mb-1 block text-sm">Название шаблона</label><Input id="import-name" maxLength={160} disabled={importing} value={importPreview.name} onChange={event => setImportPreview(current => current ? { ...current, name: event.target.value } : current)} /></div><div><label htmlFor="import-subject" className="mb-1 block text-sm">Тема письма</label><Input id="import-subject" maxLength={300} disabled={importing} value={importPreview.document.subject} onChange={event => setImportPreview(current => current ? { ...current, document: { ...current.document, subject: event.target.value } } : current)} /></div></div>
          {importProgress ? <p role="status" className="text-sm text-primary">{importProgress}</p> : null}
          <LetterPreview document={importPreview.document} resources={importPreview.resources} title="Исходное оформление импортированного письма" />
        </div> : null}
      </Modal>
      {error ? <Alert tone="danger" title="Операция не выполнена">{error}</Alert> : null}
      {notice ? <Alert tone="success" title="Готово">{notice}</Alert> : null}

      {loadState === "loading" ? (
        <div className="card grid min-h-64 place-items-center p-8 text-center">
          <div><Spinner className="mx-auto size-5" label="Загрузка шаблонов" /><p className="mt-3 text-[12px] text-text-muted">Загружаем шаблоны…</p></div>
        </div>
      ) : loadState === "error" ? (
        <div className="card">
          <EmptyState
            icon={<RefreshCw aria-hidden="true" className="size-7" />}
            title="Библиотека не загружена"
            description="Без ответа сервера нельзя безопасно редактировать или удалять шаблоны."
            action={{ label: "Повторить", onClick: () => void loadTemplates() }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className={styles.collections} role="group" aria-label="Раздел шаблонов">
            <button type="button" aria-pressed={collection === "favorites"} onClick={showFavorites} className={styles.collection}>
              <Star aria-hidden="true" className="size-5" />Избранное <span>{templates.filter((template) => template.isFavorite).length}</span>
            </button>
            <button type="button" aria-pressed={scope === "all" && collection === "studio"} onClick={() => { setScope("all"); setCollection("studio"); }} className={styles.collection}>
              <Sparkles aria-hidden="true" className="size-5" />Подборка студии <span>{templates.filter(isStudioTemplate).length}</span>
            </button>
            <button type="button" aria-pressed={scope === "all" && collection === "all"} onClick={() => { setScope("all"); setCollection("all"); }} className={styles.collection}>
              Вся библиотека <span>{templates.length}</span>
            </button>
            <button type="button" aria-pressed={scope === "mine"} onClick={() => { setScope("mine"); setCollection("all"); }} className={styles.collection}>
              Мои шаблоны <span>{templates.filter((template) => !template.isStarter).length}</span>
            </button>
          </div>
        <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)} className="min-w-0">
          <TabsList className={styles.categories} aria-label="Категории писем">
            {categories.map((item, index) => {
              const Icon = categoryIcons[item];
              return <TabsTrigger key={item} value={item} className={styles.category} data-tone={index % 4} title={item === "All" ? "Все письма" : templateCategoryLabels[item]}>
                <span className={styles.categoryArt} aria-hidden="true"><Icon className="size-6" /></span>
                <span className={styles.categoryName}>{categoryTitles[item]}</span>
                <span className={styles.categoryCount}>{item === "All" ? scopedTemplates.length : scopedTemplates.filter(template => template.category === item).length}</span>
              </TabsTrigger>;
            })}
          </TabsList>

          <TabsContent value={category} className="pt-4">
            <div className={styles.filters}>
              <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Поиск по задаче, теме или названию…" aria-label="Поиск шаблонов" wrapperClassName={styles.filterSearch} />
              <Select value={style} onChange={(event) => setStyle(event.target.value as StyleFilter)} aria-label="Стиль шаблона" options={[{value:"all",label:"Любой стиль"},{value:"minimal",label:"Минималистичный"},{value:"editorial",label:"Редакционный"},{value:"bold",label:"Контрастный"}]} className={`${styles.filterControl} ${style !== "all" ? styles.filterActive : ""}`} />
              <Select value={palette} onChange={(event) => setPalette(event.target.value as PaletteFilter)} aria-label="Цветовая система" options={[{value:"all",label:"Любая палитра"},{value:"light",label:"Светлая"},{value:"dark",label:"Тёмная"},{value:"warm",label:"Тёплая"},{value:"cool",label:"Холодная"},{value:"neutral",label:"Нейтральная"}]} className={`${styles.filterControl} ${palette !== "all" ? styles.filterActive : ""}`} />
              <Select value={density} onChange={(event) => setDensity(event.target.value as DensityFilter)} aria-label="Насыщенность шаблона" options={[{value:"all",label:"Любая насыщенность"},{value:"compact",label:"Короткий · до 6 блоков"},{value:"balanced",label:"Средний · 7–8 блоков"},{value:"rich",label:"Подробный · 9+ блоков"}]} className={`${styles.filterControl} ${density !== "all" ? styles.filterActive : ""}`} />
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                aria-label="Сортировать шаблоны"
                options={[
                  { value: "recent", label: "Недавно обновлённые" },
                  { value: "name", label: "По названию" },
                  { value: "blocks", label: "По числу блоков" },
                ]}
                className={styles.filterControl}
              />
            </div>

            <div className={styles.results}>
              <p role="status" className="m-0 text-[11px] text-text-muted">Найдено: <span className="font-semibold text-text-strong">{filteredTemplates.length}</span>{category !== "All" ? ` · ${templateCategoryLabels[category]}` : ""}</p>
              {hasFilters && filteredTemplates.length > 0 && <Button variant="ghost" size="sm" onClick={resetFilters}>Сбросить фильтры</Button>}
            </div>

            {filteredTemplates.length ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    editHref={editTemplateHref(template)}
                    onPreview={() => setPreviewTemplate(template)}
                    editLabel={routeContext.returnTo ? "Настроить" : "Редактировать"}
                    applyHref={addTemplateToReturnPath(returnPath, template.id)}
                    onDirector={() => { router.push(`/art-director?type=emails&id=${encodeURIComponent(template.id)}`); }}
                    onClone={() => void cloneTemplate(template)}
                    onDelete={() => void deleteTemplate(template)}
                    onFavorite={() => void toggleFavorite(template)}
                    busyAction={busy?.id === template.id ? busy.action : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[14px] border border-border bg-surface">
                <EmptyState
                  icon={<SearchX aria-hidden="true" className="size-7" />}
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
