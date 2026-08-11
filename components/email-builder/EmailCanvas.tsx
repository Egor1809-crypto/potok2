"use client";

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Globe2,
  Image as ImageIcon,
  Linkedin,
  Plus,
  Trash2,
} from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

import type {
  BuilderBlock,
  BuilderDocument,
  PreviewMode,
} from "./builder-types";
import { getBlockLabel } from "./BlockLibrary";

type EmailCanvasProps = {
  document: BuilderDocument;
  previewMode: PreviewMode;
  selectedBlockId: string;
  onSelect: (blockId: string) => void;
  onMove: (blockId: string, direction: -1 | 1) => void;
  onDuplicate: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onOpenBlocks: () => void;
  className?: string;
};

export function EmailCanvas({
  document,
  previewMode,
  selectedBlockId,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onOpenBlocks,
  className,
}: EmailCanvasProps) {
  const isMobile = previewMode === "mobile";

  return (
    <section
      aria-label={`${isMobile ? "Мобильный" : "Компьютерный"} предпросмотр письма`}
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden bg-surface-inset",
        className,
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/70 bg-surface/75 px-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" />
          <span className="text-[10px] font-medium text-text-muted">Предпросмотр в реальном времени</span>
        </div>
        <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[9px] text-text-subtle">
          {isMobile ? "360 пикс." : `${document.contentWidth} пикс.`}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 scrollbar-subtle sm:p-6 xl:p-8">
        <div
          className={cn(
            "mx-auto transition-[width,max-width] duration-200",
            isMobile ? "w-full max-w-[360px]" : "w-full",
          )}
          style={!isMobile ? { maxWidth: document.contentWidth } : undefined}
        >
          <div className="mb-3 overflow-hidden rounded-[11px] border border-border bg-surface px-3.5 py-3 shadow-[var(--shadow-xs)]">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-subtle text-[9px] font-bold text-primary">
                ЕС
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-text-strong">
                  Егор Сабалин
                  <span className="font-normal text-text-subtle">&lt;egor@mailflow.example&gt;</span>
                </span>
                <span className="block truncate text-[10px] text-text-muted">
                  {document.subject}
                </span>
              </span>
              <span className="text-[9px] text-text-subtle">Сейчас</span>
            </div>
          </div>

          <div
            className="overflow-visible rounded-[3px] border border-black/5 shadow-[0_18px_50px_rgba(28,32,44,0.12)]"
            style={{ backgroundColor: document.bodyBackground }}
          >
            {document.blocks.map((block, index) => (
              <CanvasBlock
                key={block.id}
                block={block}
                accentColor={document.accentColor}
                selected={block.id === selectedBlockId}
                first={index === 0}
                last={index === document.blocks.length - 1}
                compact={isMobile}
                onSelect={() => onSelect(block.id)}
                onMove={(direction) => onMove(block.id, direction)}
                onDuplicate={() => onDuplicate(block.id)}
                onDelete={() => onDelete(block.id)}
              />
            ))}

            <div className="px-6 py-5 text-center" style={{ backgroundColor: document.bodyBackground }}>
              <button
                type="button"
                onClick={onOpenBlocks}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 text-[10px] font-medium text-text-muted outline-none transition hover:border-primary/40 hover:bg-primary-subtle/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Добавить блок контента
              </button>
            </div>
          </div>

          <p className="m-0 px-4 pb-2 pt-4 text-center text-[9px] leading-4 text-text-subtle">
            Переменные показаны как метки. Перед запуском сервер проверит их и подставит данные каждого контакта.
          </p>
        </div>
      </div>
    </section>
  );
}

function CanvasBlock({
  block,
  accentColor,
  selected,
  first,
  last,
  compact,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: BuilderBlock;
  accentColor: string;
  selected: boolean;
  first: boolean;
  last: boolean;
  compact: boolean;
  onSelect: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const horizontalPadding = compact ? 24 : 46;
  const backgroundColor =
    block.backgroundColor === "transparent"
      ? undefined
      : block.backgroundColor;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${getBlockLabel(block.type)}${selected ? ", выбран" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative cursor-pointer outline-none transition-shadow",
        selected
          ? "z-10 shadow-[inset_0_0_0_2px_var(--primary)]"
          : "hover:shadow-[inset_0_0_0_1px_rgba(91,85,231,0.38)] focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]",
      )}
      style={{
        paddingTop: block.paddingTop,
        paddingBottom: block.paddingBottom,
        paddingLeft: horizontalPadding,
        paddingRight: horizontalPadding,
        backgroundColor,
        color: block.textColor,
        textAlign: block.alignment ?? "left",
      }}
    >
      {selected ? (
        <div
          role="toolbar"
          aria-label="Действия с выбранным блоком"
          className="absolute -top-4 right-2 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-[var(--shadow-md)]"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <IconButton
            label="Переместить блок вверх"
            size="sm"
            variant="ghost"
            disabled={first}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden="true" className="size-3.5" />
          </IconButton>
          <IconButton
            label="Переместить блок вниз"
            size="sm"
            variant="ghost"
            disabled={last}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden="true" className="size-3.5" />
          </IconButton>
          <IconButton
            label="Дублировать блок"
            size="sm"
            variant="ghost"
            onClick={onDuplicate}
          >
            <Copy aria-hidden="true" className="size-3.5" />
          </IconButton>
          <IconButton
            label="Удалить блок"
            size="sm"
            variant="ghost"
            className="hover:!bg-danger-subtle hover:!text-danger"
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </IconButton>
        </div>
      ) : null}

      <BlockContent block={block} accentColor={accentColor} compact={compact} selected={selected} />
    </div>
  );
}

function BlockContent({
  block,
  accentColor,
  compact,
  selected,
}: {
  block: BuilderBlock;
  accentColor: string;
  compact: boolean;
  selected: boolean;
}) {
  if (block.type === "logo") {
    if (block.href) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.href} alt={block.content} className="inline-block max-h-20 max-w-[220px] object-contain" />
      );
    }
    return (
      <div
        className="inline-flex items-center gap-2 font-semibold tracking-[0.12em]"
        style={{ fontSize: block.fontSize }}
      >
        <span className="grid size-6 place-items-center rounded-md text-[9px] font-bold text-white" style={{ backgroundColor: accentColor }}>
          M
        </span>
        {renderTokens(block.content)}
      </div>
    );
  }

  if (block.type === "heading") {
    return (
      <h2
        className="m-0 font-semibold tracking-[-0.035em]"
        style={{
          fontSize: compact ? Math.min(block.fontSize, 31) : block.fontSize,
          lineHeight: 1.08,
        }}
      >
        {renderTokens(block.content)}
      </h2>
    );
  }

  if (block.type === "text") {
    return (
      <p
        className="m-0 whitespace-pre-wrap"
        style={{ fontSize: block.fontSize, lineHeight: 1.65 }}
      >
        {renderTokens(block.content)}
      </p>
    );
  }

  if (block.type === "button") {
    return (
      <span
        className="inline-flex min-h-10 items-center justify-center px-5 font-semibold text-white shadow-[0_4px_12px_rgba(30,32,60,0.14)]"
        style={{
          borderRadius: block.borderRadius,
          backgroundColor: accentColor,
          color: block.textColor,
          fontSize: block.fontSize,
        }}
      >
        {renderTokens(block.label || block.content)}
      </span>
    );
  }

  if (block.type === "image") {
    if (block.href) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.href}
          alt={block.content}
          className="block h-auto w-full object-cover"
          style={{ borderRadius: block.borderRadius }}
        />
      );
    }
    return (
      <div
        className="relative overflow-hidden border border-black/5 p-4 text-left"
        style={{
          minHeight: compact ? 150 : 210,
          borderRadius: block.borderRadius,
          backgroundColor: "#f4f5f8",
        }}
      >
        <div className="absolute inset-0 opacity-70" style={{ backgroundColor: `${accentColor}10` }} />
        <div className="relative mx-auto flex h-full max-w-sm flex-col overflow-hidden rounded-lg border border-white/80 bg-white shadow-[0_12px_30px_rgba(32,37,52,0.12)]">
          <div className="flex h-7 items-center gap-1 border-b border-[#eceef3] px-2">
            <span className="size-1.5 rounded-full bg-[#f3a5aa]" />
            <span className="size-1.5 rounded-full bg-[#f0c46b]" />
            <span className="size-1.5 rounded-full bg-[#76c9a7]" />
          </div>
          <div className="grid flex-1 grid-cols-[27%_1fr]">
            <div className="border-r border-[#eceef3] bg-[#f8f9fb] p-2">
              <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: `${accentColor}30` }} />
              <span className="mt-3 block h-1.5 w-10 rounded-full bg-[#dfe2e9]" />
              <span className="mt-2 block h-1.5 w-8 rounded-full bg-[#e6e8ed]" />
              <span className="mt-2 block h-1.5 w-11 rounded-full bg-[#e6e8ed]" />
            </div>
            <div className="p-3">
              <span className="block h-2 w-24 rounded-full bg-[#cfd3dc]" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((item) => (
                  <span key={item} className="h-9 rounded border border-[#eceef3] bg-[#fafbfc]" />
                ))}
              </div>
              <span className="mt-3 block h-1.5 w-full rounded-full bg-[#e5e7ec]" />
              <span className="mt-2 block h-1.5 w-4/5 rounded-full bg-[#eceef2]" />
            </div>
          </div>
        </div>
        <span className="sr-only">
          <ImageIcon aria-hidden="true" />
          {block.content}
        </span>
      </div>
    );
  }

  if (block.type === "columns") {
    const columns = block.content.split("|");
    return (
      <div className="grid grid-cols-2 gap-3 text-left">
        {[columns[0] || "Первый столбец", columns[1] || "Второй столбец"].map((column, index) => (
          <div
            key={`${column}-${index}`}
            className="rounded-lg border border-black/5 bg-black/[0.025] p-3"
            style={{ borderRadius: block.borderRadius, fontSize: block.fontSize }}
          >
            <span className="mb-2 block size-5 rounded-md text-center text-[10px] font-bold leading-5 text-white" style={{ backgroundColor: accentColor }}>
              {index + 1}
            </span>
            <span className="font-medium leading-5">{renderTokens(column)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "divider") {
    return <hr className="m-0 border-0 border-t" style={{ borderColor: block.textColor }} />;
  }

  if (block.type === "spacer") {
    return selected ? (
      <div className="rounded border border-dashed border-primary/30 py-1 text-center text-[9px] font-medium text-primary/70">
        Отступ · {block.paddingTop + block.paddingBottom} пикс.
      </div>
    ) : (
      <span className="block" aria-hidden="true" />
    );
  }

  if (block.type === "social") {
    const items = block.content.split("|");
    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <span key={`${item}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-1.5 font-medium" style={{ fontSize: block.fontSize }}>
            {index === 0 ? <Linkedin aria-hidden="true" className="size-3" /> : <Globe2 aria-hidden="true" className="size-3" />}
            {item}
          </span>
        ))}
      </div>
    );
  }

  if (block.type === "hero") {
    const [title, subtitle] = block.content.split("|");
    return (
      <div className="rounded-2xl p-6" style={{ backgroundColor: block.backgroundColor === "transparent" ? `${accentColor}12` : block.backgroundColor, borderRadius: block.borderRadius }}>
        <h2 className="m-0 font-bold tracking-[-0.035em]" style={{ fontSize: compact ? Math.min(block.fontSize, 29) : block.fontSize, lineHeight: 1.1 }}>{renderTokens(title || "Главная идея письма")}</h2>
        <p className="mb-0 mt-3 whitespace-pre-wrap opacity-75" style={{ fontSize: 16, lineHeight: 1.55 }}>{renderTokens(subtitle || "Коротко объясните ценность предложения")}</p>
      </div>
    );
  }

  if (block.type === "quote") {
    const [quote, author] = block.content.split("|");
    return (
      <blockquote className="m-0 rounded-xl border-l-4 p-5 text-left" style={{ borderLeftColor: accentColor, backgroundColor: block.backgroundColor === "transparent" ? "#f8f8fb" : block.backgroundColor, borderRadius: block.borderRadius }}>
        <p className="m-0 italic" style={{ fontSize: block.fontSize, lineHeight: 1.55 }}>“{renderTokens(quote || "Цитата клиента или важная мысль")}”</p>
        <footer className="mt-2 text-[12px] font-semibold opacity-70">{renderTokens(author || "Имя, должность")}</footer>
      </blockquote>
    );
  }

  if (block.type === "checklist") {
    return (
      <ul className="m-0 grid list-none gap-2 p-0 text-left">
        {block.content.split("|").filter(Boolean).map((item, index) => (
          <li key={`${item}-${index}`} className="flex items-start gap-2" style={{ fontSize: block.fontSize }}>
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: accentColor }}>✓</span>
            <span className="leading-5">{renderTokens(item.trim())}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "stats") {
    const items = block.content.split("|");
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 2].map((index) => (
          <div key={index} className="rounded-xl p-4 text-center" style={{ backgroundColor: block.backgroundColor === "transparent" ? "#f7f8fc" : block.backgroundColor, borderRadius: block.borderRadius }}>
            <strong className="block text-[26px]" style={{ color: accentColor }}>{renderTokens(items[index] || "—")}</strong>
            <span className="mt-1 block opacity-70" style={{ fontSize: block.fontSize }}>{renderTokens(items[index + 1] || "Показатель")}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "product") {
    const [name, description, price] = block.content.split("|");
    return (
      <div className="rounded-xl border border-black/10 p-5 text-left" style={{ backgroundColor: block.backgroundColor === "transparent" ? "#fff" : block.backgroundColor, borderRadius: block.borderRadius }}>
        <strong className="block text-[19px]">{renderTokens(name || "Название предложения")}</strong>
        <p className="mb-0 mt-2 opacity-75" style={{ fontSize: block.fontSize, lineHeight: 1.55 }}>{renderTokens(description || "Короткое описание пользы")}</p>
        <strong className="mt-3 block text-[17px]">{renderTokens(price || "Цена")}</strong>
        <span className="mt-4 inline-flex rounded-lg px-4 py-2 text-[12px] font-semibold text-white" style={{ backgroundColor: accentColor }}>{renderTokens(block.label || "Узнать подробнее")}</span>
      </div>
    );
  }

  if (block.type === "signature") {
    const [name, position, contact] = block.content.split("|");
    return (
      <div className="inline-flex items-center gap-3 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>{(name || "М").slice(0, 1)}</span>
        <span><strong className="block">{renderTokens(name || "Имя отправителя")}</strong><span className="block opacity-70">{renderTokens(position || "Должность")}</span><span className="block text-[11px] opacity-55">{renderTokens(contact || "Контакты")}</span></span>
      </div>
    );
  }

  return (
    <p className="m-0 leading-5" style={{ fontSize: block.fontSize }}>
      {renderTokens(block.content)}
    </p>
  );
}

function renderTokens(value: string) {
  return value.split(/({{[^}]+}})/g).map((part, index) =>
    /^{{[^}]+}}$/.test(part) ? (
      <span
        key={`${part}-${index}`}
        className="rounded bg-primary-subtle px-1 py-0.5 font-medium text-primary"
      >
        {part}
      </span>
    ) : (
      part
    ),
  );
}
