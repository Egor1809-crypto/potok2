"use client";

import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  Copy,
  Image as ImageIcon,
  PencilLine,
  Sparkles,
  Trash2,
} from "lucide-react";

import type { EmailTemplateRecord } from "@/types/api";
import { BRAND_NAME } from "@/config/brand";
import { Badge, Button, buttonVariants } from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { emailFrameCss } from "@/components/email-builder/frame-presets";
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
  const isDesignerCollection = template.id.startsWith("template-v3-");
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
            <Badge variant={isDesignerCollection || !template.isStarter ? "accent" : "neutral"}>
              {isDesignerCollection ? "Новая коллекция" : template.isStarter ? "Из библиотеки" : "Мой шаблон"}
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
  const accentColor = template.builderDocument.accentColor;
  const frameStyle = template.builderDocument.frameStyle ?? "none";
  const frameColor = template.builderDocument.frameColor ?? accentColor;
  const frameRadius = template.builderDocument.frameRadius ?? 0;

  return (
    <div
      className="relative grid h-[300px] place-items-center overflow-hidden p-4 sm:h-[320px]"
      style={{ backgroundColor: template.builderDocument.workspaceBackground }}
    >
      <span aria-hidden="true" className="absolute -right-12 -top-14 size-40 rounded-full opacity-[0.09]" style={{ backgroundColor: accentColor }} />
      <span aria-hidden="true" className="absolute -bottom-14 -left-12 size-32 rounded-full bg-white/30" />
      {template.id.startsWith("template-v3-") ? (
        <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/85 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#312a3b] shadow-sm backdrop-blur">
          <Sparkles aria-hidden="true" className="size-2.5" />
          Дизайнерский
        </span>
      ) : null}

      <div
        className="relative h-[266px] w-[204px] overflow-hidden bg-white shadow-[0_18px_45px_rgba(30,25,38,0.18)] ring-1 ring-black/[0.04] transition-transform duration-300 group-hover:scale-[1.025] sm:h-[280px] sm:w-[216px]"
        style={{
          backgroundColor: template.builderDocument.bodyBackground,
          ...emailFrameCss(frameStyle, frameColor, Math.min(frameRadius, 14)),
        }}
      >
        <div className="absolute left-1/2 top-0 w-[340px] origin-top -translate-x-1/2 scale-[0.6] sm:scale-[0.64]">
          {blocks.slice(0, 9).map((block) => (
            <TemplateMiniBlock key={block.id} block={block} accentColor={accentColor} />
          ))}
        </div>
      </div>
    </div>
  );
}

type TemplateMiniBlockValue = EmailTemplateRecord["builderDocument"]["blocks"][number];

function cleanMiniText(value: string) {
  return value.replace(/{{([^}]+)}}/g, "$1").trim();
}

function TemplateMiniBlock({ block, accentColor }: { block: TemplateMiniBlockValue; accentColor: string }) {
  const alignment = block.alignment ?? "left";
  const background = block.backgroundColor === "transparent" ? "transparent" : block.backgroundColor;
  const commonStyle = {
    backgroundColor: background,
    color: block.textColor,
    textAlign: alignment,
    padding: `${Math.max(7, (block.paddingTop ?? 16) * 0.62)}px ${Math.max(18, (block.paddingRight ?? 24) * 0.72)}px ${Math.max(7, (block.paddingBottom ?? 16) * 0.62)}px ${Math.max(18, (block.paddingLeft ?? 24) * 0.72)}px`,
    fontFamily: block.fontFamily,
  } as const;
  const parts = cleanMiniText(block.content).split("|");

  if (block.type === "pattern") {
    return <div aria-hidden="true" className="whitespace-pre-line text-center text-[12px] font-semibold leading-4" style={{ ...commonStyle, letterSpacing: Math.min(block.letterSpacing ?? 0, 4) }}>{block.content}</div>;
  }
  if (block.type === "logo") {
    return <div className="truncate text-[8px] font-bold uppercase tracking-[0.16em]" style={commonStyle}>{cleanMiniText(block.content) || BRAND_NAME}</div>;
  }
  if (block.type === "hero" || block.type === "banner") {
    return <div style={commonStyle}><div className="text-[22px] font-bold leading-[1.05] tracking-[-0.035em]">{parts[0]}</div>{parts[1] ? <div className="mt-3 text-[8px] leading-[1.5] opacity-75">{parts[1]}</div> : null}</div>;
  }
  if (block.type === "heading") {
    return <div className="text-[22px] font-bold leading-[1.05] tracking-[-0.04em]" style={commonStyle}>{cleanMiniText(block.content)}</div>;
  }
  if (block.type === "text") {
    return <div className="line-clamp-3 text-[8px] leading-[1.55]" style={commonStyle}>{cleanMiniText(block.content)}</div>;
  }
  if (block.type === "image") {
    return <div style={commonStyle}><div className="grid h-24 place-items-center rounded-lg bg-gradient-to-br from-black/[0.04] to-black/[0.12]"><ImageIcon aria-hidden="true" className="size-5 opacity-35" /></div></div>;
  }
  if (block.type === "stats") {
    return <div className="grid grid-cols-2 gap-2" style={commonStyle}>{[0, 2].map((index) => <div key={index} className="rounded-md border border-black/[0.06] p-3 text-center"><strong className="block text-[16px]" style={{ color: accentColor }}>{parts[index]}</strong><span className="text-[7px] opacity-65">{parts[index + 1]}</span></div>)}</div>;
  }
  if (block.type === "columns") {
    return <div className="grid grid-cols-2 gap-2" style={commonStyle}>{parts.slice(0, 2).map((part, index) => <div key={index} className="whitespace-pre-line rounded-md border border-black/10 p-3 text-[8px] leading-[1.45]">{part}</div>)}</div>;
  }
  if (block.type === "quote") {
    return <div style={commonStyle}><div className="border-l-[3px] pl-3 text-[9px] italic leading-[1.45]" style={{ borderColor: accentColor }}>{parts[0]}<span className="mt-2 block text-[7px] not-italic opacity-65">{parts[1]}</span></div></div>;
  }
  if (block.type === "checklist" || block.type === "timeline" || block.type === "faq") {
    return <div className="space-y-1.5 text-[8px] leading-[1.35]" style={commonStyle}>{parts.slice(0, block.type === "checklist" ? 3 : 4).map((part, index) => <div key={index} className="flex gap-2"><span className="font-bold" style={{ color: accentColor }}>{block.type === "checklist" ? "✓" : `${Math.floor(index / 2) + 1}`}</span><span className={cn(index % 2 === 0 && block.type !== "checklist" && "font-semibold")}>{part}</span></div>)}</div>;
  }
  if (block.type === "coupon") {
    return <div style={commonStyle}><div className="rounded-lg border-2 border-dashed p-3 text-center" style={{ borderColor: accentColor }}><span className="text-[7px] uppercase tracking-wider">{parts[0]}</span><strong className="my-1 block text-[18px] tracking-widest" style={{ color: accentColor }}>{parts[1]}</strong><span className="text-[7px] opacity-65">{parts[2]}</span></div></div>;
  }
  if (block.type === "video") {
    return <div style={commonStyle}><div className="grid h-24 place-items-center rounded-lg bg-black/80 text-white"><span className="grid size-8 place-items-center rounded-full bg-white/20 text-[12px]">▶</span><span className="text-[8px] font-semibold">{parts[0]}</span></div></div>;
  }
  if (block.type === "notice" || block.type === "document" || block.type === "compliance") {
    return <div style={commonStyle}><div className="rounded-lg border border-black/10 p-3"><span className="text-[7px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>{parts[0]}</span><strong className="mt-1 block text-[10px]">{parts[1]}</strong><span className="mt-1 block text-[7px] opacity-60">{parts[2]}</span></div></div>;
  }
  if (block.type === "comparison") {
    return <div className="grid grid-cols-2 gap-2" style={commonStyle}>{[0, 2].map((index) => <div key={index} className="rounded-md border border-black/10 p-3"><strong className="text-[8px]" style={{ color: accentColor }}>{parts[index]}</strong><p className="mb-0 mt-1 text-[7px] opacity-70">{parts[index + 1]}</p></div>)}</div>;
  }
  if (block.type === "product") {
    return <div style={commonStyle}><div className="rounded-lg border border-black/10 p-3"><strong className="text-[10px]">{parts[0]}</strong><p className="my-1 text-[7px] opacity-65">{parts[1]}</p><strong className="text-[9px]">{parts[2]}</strong></div></div>;
  }
  if (block.type === "button") {
    return <div style={commonStyle}><span className="inline-flex rounded-md px-4 py-2 text-[8px] font-bold" style={{ backgroundColor: block.buttonStyle === "outline" ? "transparent" : accentColor, border: block.buttonStyle === "outline" ? `2px solid ${accentColor}` : undefined, color: block.buttonStyle === "solid" ? block.textColor : accentColor }}>{block.label || block.content}</span></div>;
  }
  if (block.type === "divider") {
    return <div style={commonStyle}><div className="border-t" style={{ borderColor: block.textColor }} /></div>;
  }
  if (block.type === "footer" || block.type === "signature") {
    return <div className="line-clamp-2 text-[7px] leading-[1.45] opacity-65" style={commonStyle}>{cleanMiniText(block.content).replaceAll("|", " · ")}</div>;
  }
  return null;
}
