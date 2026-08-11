"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Plus, RefreshCw, SearchX } from "lucide-react";

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
type SortMode = "recent" | "name" | "blocks";
type LoadState = "loading" | "ready" | "error";

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [busy, setBusy] = useState<{ id: string; action: "clone" | "delete" } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return templates
      .filter((template) => category === "All" || template.category === category)
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
  }, [category, query, sort, templates]);

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
            <Link href={newTemplateHref} className={buttonVariants({ variant: "primary", size: "md" })}>
              <Plus aria-hidden="true" className="size-4" />
              {routeContext.returnTo ? "Начать с нуля" : "Создать шаблон"}
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
        <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)} className="min-w-0">
          <TabsList className="-mb-px">
            {categories.map((item) => (
              <TabsTrigger key={item} value={item}>
                {item === "All" ? "Все" : templateCategoryLabels[item]}
                <span className="ml-1.5 text-[10px] font-normal text-text-subtle">
                  {item === "All" ? templates.length : templates.filter((template) => template.category === (item as TemplateCategory)).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={category} className="pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Поиск шаблонов…" aria-label="Поиск шаблонов" wrapperClassName="w-full sm:max-w-sm" />
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                aria-label="Сортировать шаблоны"
                options={[
                  { value: "recent", label: "Недавно обновлённые" },
                  { value: "name", label: "По названию" },
                  { value: "blocks", label: "По числу блоков" },
                ]}
                wrapperClassName="w-52"
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
                  title={templates.length ? "Подходящих шаблонов нет" : "Библиотека пуста"}
                  description={templates.length ? "Измените запрос или категорию." : "Создайте первый шаблон в визуальном редакторе."}
                  action={templates.length ? { label: "Сбросить фильтры", onClick: () => { setQuery(""); setCategory("All"); } } : undefined}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
