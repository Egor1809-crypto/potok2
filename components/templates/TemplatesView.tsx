"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Heart, Plus, SearchX } from "lucide-react";

import { templates } from "@/data/templates";
import type { TemplateCategory } from "@/types";
import { PageHeader } from "@/components/shared";
import {
  EmptyState,
  SearchInput,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  buttonVariants,
} from "@/components/ui";
import { cn } from "@/components/ui/utils";

import { TemplateCard } from "./TemplatePreview";

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
type SortMode = "popular" | "recent" | "name";

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
  if (!value || !value.startsWith("/campaigns/new") || value.startsWith("//")) {
    return undefined;
  }
  return value;
}

function addTemplateToReturnPath(path: string, templateId?: string) {
  const target = new URL(path, "https://mailflow.local");
  if (templateId) target.searchParams.set("template", templateId);
  else target.searchParams.delete("template");
  return `${target.pathname}${target.search}`;
}

function builderHref({
  templateId,
  campaignName,
  returnTo,
}: {
  templateId?: string;
  campaignName?: string;
  returnTo?: string;
}) {
  const query = new URLSearchParams();
  if (templateId) query.set("template", templateId);
  if (campaignName) query.set("campaign", campaignName);
  if (returnTo) query.set("returnTo", addTemplateToReturnPath(returnTo, templateId));
  const serialized = query.toString();
  return serialized ? `/email-builder?${serialized}` : "/email-builder";
}

export function TemplatesView() {
  const browserSearch = useSyncExternalStore(
    subscribeToLocation,
    getBrowserSearch,
    getServerSearch,
  );
  const routeContext = useMemo(() => {
    const params = new URLSearchParams(browserSearch);
    return {
      campaignName: params.get("campaign")?.trim() || undefined,
      returnTo: safeCampaignPath(params.get("returnTo")),
      backTo: safeCampaignPath(params.get("backTo")),
    };
  }, [browserSearch]);
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("popular");
  const [favorites, setFavorites] = useState(
    () => new Set(templates.filter((template) => template.isFavorite).map((template) => template.id)),
  );

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return templates
      .filter((template) => category === "All" || template.category === category)
      .filter((template) => !favoritesOnly || favorites.has(template.id))
      .filter((template) =>
        !normalized
          ? true
          : [
              template.name,
              template.category,
              template.description,
              template.subject,
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalized),
      )
      .sort((first, second) => {
        if (sort === "name") return first.name.localeCompare(second.name);
        if (sort === "recent") {
          return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
        }
        return second.usageCount - first.usageCount;
      });
  }, [category, favorites, favoritesOnly, query, sort]);

  const toggleFavorite = (templateId: string, favorite: boolean) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (favorite) next.add(templateId);
      else next.delete(templateId);
      return next;
    });
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("All");
    setFavoritesOnly(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Design library"
        title="Templates"
        description={routeContext.campaignName
          ? `Choose a starting point for ${routeContext.campaignName}; your audience and setup will stay attached.`
          : "Start with a polished structure, then make every detail your own."}
        meta={`${templates.length} designs`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {routeContext.backTo ? (
              <Link
                href={routeContext.backTo}
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back to campaign
              </Link>
            ) : null}
            <Link
              href={builderHref({
                campaignName: routeContext.campaignName,
                returnTo: routeContext.returnTo,
              })}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              <Plus aria-hidden="true" className="size-4" />
              Start from scratch
            </Link>
          </div>
        }
      />

      <Tabs
        value={category}
        onValueChange={(value) => setCategory(value as CategoryFilter)}
        className="min-w-0"
      >
        <TabsList className="-mb-px">
          {categories.map((item) => (
            <TabsTrigger key={item} value={item}>
              {item}
              <span className="ml-1.5 text-[10px] font-normal text-text-subtle">
                {item === "All"
                  ? templates.length
                  : templates.filter((template) => template.category === (item as TemplateCategory)).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={category} className="pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              placeholder="Search templates…"
              aria-label="Search templates"
              wrapperClassName="w-full sm:max-w-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly((current) => !current)}
                className={cn(
                  "btn btn-outline btn-sm gap-1.5",
                  favoritesOnly && "border-primary/25 bg-primary-subtle text-primary",
                )}
              >
                <Heart aria-hidden="true" className={cn("size-3.5", favoritesOnly && "fill-current")} />
                Favorites
              </button>
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                aria-label="Sort templates"
                options={[
                  { value: "popular", label: "Most used" },
                  { value: "recent", label: "Recently updated" },
                  { value: "name", label: "Name" },
                ]}
                wrapperClassName="w-40"
                className="h-8 min-h-8 text-[11px]"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="m-0 text-[11px] text-text-muted">
              <span className="font-semibold text-text-strong">{filteredTemplates.length}</span>{" "}
              {filteredTemplates.length === 1 ? "template" : "templates"}
              {category !== "All" ? ` in ${category}` : ""}
            </p>
            <span className="hidden items-center gap-1.5 text-[10px] text-text-subtle sm:flex">
              <FileText aria-hidden="true" className="size-3" />
              Every design is fully editable
            </span>
          </div>

          {filteredTemplates.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  favorite={favorites.has(template.id)}
                  onFavoriteChange={(favorite) => toggleFavorite(template.id, favorite)}
                  builderHref={builderHref({
                    templateId: template.id,
                    campaignName: routeContext.campaignName,
                    returnTo: routeContext.returnTo,
                  })}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[14px] border border-border bg-surface">
              <EmptyState
                icon={<SearchX aria-hidden="true" className="size-5" />}
                title="No templates match"
                description="Try another search, category, or show all designs."
                action={{ label: "Clear filters", onClick: clearFilters }}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
