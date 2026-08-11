"use client";

import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Users } from "lucide-react";

import type { EmailTemplate } from "@/types";
import { BRAND_NAME } from "@/config/brand";
import { Badge, buttonVariants } from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { templateCategoryLabels } from "./templateLabels";

export function TemplateCard({
  template,
  builderHref,
}: {
  template: EmailTemplate;
  builderHref?: string;
}) {
  const resolvedBuilderHref =
    builderHref ?? `/email-builder?template=${encodeURIComponent(template.id)}`;

  return (
    <article className="group min-w-0 overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-xs)] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-[var(--shadow-md)]">
      <div className="relative">
        <Link
          href={resolvedBuilderHref}
          aria-label={`Открыть шаблон «${template.name}» в редакторе писем`}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
        >
          <TemplateThumbnail template={template} />
        </Link>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-[14px] font-semibold tracking-[-0.015em] text-text-strong">
              {template.name}
            </h2>
            <p className="mt-1 line-clamp-2 min-h-9 text-[11px] leading-[18px] text-text-muted">
              {template.description}
            </p>
          </div>
          <Badge variant="neutral" className="shrink-0">
            {templateCategoryLabels[template.category]}
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3.5">
          <div className="flex items-center gap-1.5 text-[10px] text-text-subtle">
            <Users aria-hidden="true" className="size-3" />
            Использований: {template.usageCount.toLocaleString("ru-RU")}
          </div>
          <Link
            href={resolvedBuilderHref}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "-mr-1 h-7 px-2 text-[10px] text-primary hover:text-primary",
            })}
          >
            Использовать
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function TemplateThumbnail({ template }: { template: EmailTemplate }) {
  const logo = template.blocks.find((block) => block.type === "logo")?.content ?? BRAND_NAME;
  const heading = template.blocks.find((block) => block.type === "heading")?.content ?? template.name;
  const text = template.blocks.find((block) => block.type === "text")?.content ?? template.previewText;
  const button = template.blocks.find((block) => block.type === "button")?.label;
  const hasImage = template.blocks.some((block) => block.type === "image");
  const centered =
    template.blocks.find((block) => block.type === "heading")?.alignment ===
    "center";

  return (
    <div
      className="relative grid h-[255px] place-items-center overflow-hidden p-5 sm:h-[270px]"
      style={{ backgroundColor: template.backgroundColor }}
    >
      <span
        aria-hidden="true"
        className="absolute -right-10 -top-12 size-36 rounded-full opacity-[0.08]"
        style={{ backgroundColor: template.accentColor }}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-10 -left-12 size-28 rounded-full bg-white/55"
      />

      <div
        className={cn(
          "relative h-[218px] w-[174px] overflow-hidden rounded-[3px] border border-black/[0.055] bg-white px-5 py-4 shadow-[0_15px_35px_rgba(30,35,50,0.13)] transition-transform duration-300 group-hover:scale-[1.025] sm:h-[230px] sm:w-[184px]",
          centered ? "text-center" : "text-left",
        )}
      >
        {template.thumbnailVariant === "bold" ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1"
            style={{ backgroundColor: template.accentColor }}
          />
        ) : null}
        <div
          className={cn(
            "flex items-center gap-1.5 text-[5px] font-bold tracking-[0.13em] text-[#323745]",
            centered && "justify-center",
          )}
        >
          <span className="grid size-3 place-items-center rounded-[3px] text-[5px] text-white" style={{ backgroundColor: template.accentColor }}>
            M
          </span>
          <span className="max-w-[110px] truncate">{logo}</span>
        </div>

        <div className={cn("mt-5", template.thumbnailVariant === "minimal" && "mt-7")}>
          <span
            className="mb-2 block text-[5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: template.accentColor }}
          >
            {templateCategoryLabels[template.category]}
          </span>
          <p
            className={cn(
              "m-0 line-clamp-2 text-[13px] leading-[1.08] font-semibold tracking-[-0.04em] text-[#171923]",
              template.thumbnailVariant === "classic" && "font-serif",
            )}
          >
            {heading}
          </p>
          <p className="mt-3 line-clamp-3 text-[6px] leading-[1.6] text-[#747987]">
            {text.replace(/{{([^}]+)}}/g, "$1")}
          </p>
        </div>

        {hasImage ? (
          <div className="mt-3 grid h-11 place-items-center rounded-[5px] border border-[#e8eaf0] bg-[#f4f5f8]">
            <ImageIcon aria-hidden="true" className="size-3 text-[#9ba0ad]" />
          </div>
        ) : button ? (
          <span
            className={cn(
              "mt-4 inline-flex rounded-[4px] px-2.5 py-1.5 text-[5px] font-semibold text-white",
              centered && "mx-auto",
            )}
            style={{ backgroundColor: template.accentColor }}
          >
            {button}
          </span>
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
