"use client";

import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  Copy,
  Image as ImageIcon,
  PencilLine,
  Trash2,
} from "lucide-react";

import type { EmailTemplateRecord } from "@/types/api";
import { BRAND_NAME } from "@/config/brand";
import { Badge, Button, buttonVariants } from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { templateCategoryLabels } from "./templateLabels";

export function TemplateCard({
  template,
  editHref,
  editLabel = "Редактировать",
  applyHref,
  onClone,
  onDelete,
  busyAction,
}: {
  template: EmailTemplateRecord;
  editHref: string;
  editLabel?: string;
  applyHref: string;
  onClone: () => void;
  onDelete: () => void;
  busyAction?: "clone" | "delete";
}) {
  return (
    <article className="group min-w-0 overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-xs)] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-[var(--shadow-md)]">
      <Link
        href={editHref}
        aria-label={`${editLabel} шаблон «${template.name}»`}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <TemplateThumbnail template={template} />
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-[14px] font-semibold tracking-[-0.015em] text-text-strong">
              {template.name}
            </h2>
            <p className="mt-1 line-clamp-2 min-h-9 text-[11px] leading-[18px] text-text-muted">
              {template.description || "Без описания"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={template.isStarter ? "neutral" : "accent"}>
              {template.isStarter ? "Из библиотеки" : "Мой шаблон"}
            </Badge>
            <span className="text-[9px] text-text-subtle">{templateCategoryLabels[template.category]}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3.5">
          <span className="flex items-center gap-1.5 text-[10px] text-text-subtle">
            <Blocks aria-hidden="true" className="size-3" />
            Блоков: {template.builderDocument.blocks.length.toLocaleString("ru-RU")}
          </span>
          <span className="text-[10px] text-text-subtle">
            {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(template.updatedAt))}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={editHref}
            className={buttonVariants({ variant: "secondary", size: "sm", className: "min-w-0 px-2" })}
          >
            <PencilLine aria-hidden="true" className="size-3.5" />
            {editLabel}
          </Link>
          <Link
            href={applyHref}
            className={buttonVariants({ variant: "primary", size: "sm", className: "min-w-0 px-2" })}
          >
            В кампанию
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>

        <div className="mt-2 flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClone}
            loading={busyAction === "clone"}
            loadingText="Копируем…"
            disabled={Boolean(busyAction)}
            aria-label={`Дублировать шаблон «${template.name}»`}
            className="h-7 px-2 text-[10px]"
          >
            <Copy aria-hidden="true" className="size-3" />
            Дублировать
          </Button>
          {!template.isStarter ? <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            loading={busyAction === "delete"}
            loadingText="Удаляем…"
            disabled={Boolean(busyAction)}
            aria-label={`Удалить шаблон «${template.name}»`}
            className="h-7 px-2 text-[10px] text-danger hover:text-danger"
          >
            <Trash2 aria-hidden="true" className="size-3" />
            Удалить
          </Button> : null}
        </div>
      </div>
    </article>
  );
}

export function TemplateThumbnail({ template }: { template: EmailTemplateRecord }) {
  const blocks = template.builderDocument.blocks;
  const logo = blocks.find((block) => block.type === "logo")?.content ?? BRAND_NAME;
  const heading = blocks.find((block) => block.type === "heading")?.content ?? template.name;
  const text = blocks.find((block) => block.type === "text")?.content ?? template.previewText;
  const button = blocks.find((block) => block.type === "button")?.label;
  const hasImage = blocks.some((block) => block.type === "image");
  const centered = blocks.find((block) => block.type === "heading")?.alignment === "center";
  const accentColor = template.builderDocument.accentColor;

  return (
    <div
      className="relative grid h-[255px] place-items-center overflow-hidden p-5 sm:h-[270px]"
      style={{ backgroundColor: template.builderDocument.workspaceBackground }}
    >
      <span aria-hidden="true" className="absolute -right-10 -top-12 size-36 rounded-full opacity-[0.08]" style={{ backgroundColor: accentColor }} />
      <span aria-hidden="true" className="absolute -bottom-10 -left-12 size-28 rounded-full bg-white/55" />

      <div
        className={cn(
          "relative h-[218px] w-[174px] overflow-hidden rounded-[3px] border border-black/[0.055] bg-white px-5 py-4 shadow-[0_15px_35px_rgba(30,35,50,0.13)] transition-transform duration-300 group-hover:scale-[1.025] sm:h-[230px] sm:w-[184px]",
          centered ? "text-center" : "text-left",
        )}
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accentColor }} />
        <div className={cn("flex items-center gap-1.5 text-[5px] font-bold tracking-[0.13em] text-[#323745]", centered && "justify-center")}>
          <span className="grid size-3 place-items-center rounded-[3px] text-[5px] text-white" style={{ backgroundColor: accentColor }}>M</span>
          <span className="max-w-[110px] truncate">{logo}</span>
        </div>

        <div className="mt-5">
          <span className="mb-2 block text-[5px] font-semibold uppercase tracking-[0.16em]" style={{ color: accentColor }}>
            {templateCategoryLabels[template.category]}
          </span>
          <p className="m-0 line-clamp-2 text-[13px] leading-[1.08] font-semibold tracking-[-0.04em] text-[#171923]">{heading}</p>
          <p className="mt-3 line-clamp-3 text-[6px] leading-[1.6] text-[#747987]">{text.replace(/{{([^}]+)}}/g, "$1")}</p>
        </div>

        {hasImage ? (
          <div className="mt-3 grid h-11 place-items-center rounded-[5px] border border-[#e8eaf0] bg-[#f4f5f8]">
            <ImageIcon aria-hidden="true" className="size-3 text-[#9ba0ad]" />
          </div>
        ) : button ? (
          <span className={cn("mt-4 inline-flex rounded-[4px] px-2.5 py-1.5 text-[5px] font-semibold text-white", centered && "mx-auto")} style={{ backgroundColor: accentColor }}>{button}</span>
        ) : (
          <div className="mt-4">
            <span className="block h-1 w-full rounded-full bg-[#e8eaf0]" />
            <span className="mt-1.5 block h-1 w-3/4 rounded-full bg-[#eef0f3]" />
          </div>
        )}

        <div className="absolute inset-x-5 bottom-4 border-t border-[#eceef2] pt-2">
          <span className={cn("block h-1 w-2/3 rounded-full bg-[#eceef2]", centered && "mx-auto")} />
        </div>
      </div>
    </div>
  );
}
