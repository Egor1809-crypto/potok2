"use client";

import { useRef } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Braces,
  Copy,
  Link2,
  Palette,
  SlidersHorizontal,
  Trash2,
  Type,
} from "lucide-react";

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FormField,
  IconButton,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { cn } from "@/components/ui/utils";

import type { BuilderBlock, BuilderDocument } from "./builder-types";
import { getBlockLabel } from "./BlockLibrary";
import { ImageAssetPicker } from "./ImageAssetPicker";
import { AiEmailAssistant } from "./AiEmailAssistant";

const personalizationFields = [
  { label: "Имя", token: "{{first_name}}", example: "Иван" },
  { label: "Фамилия", token: "{{last_name}}", example: "Петров" },
  { label: "Компания", token: "{{company}}", example: "Лекс Групп" },
  { label: "Должность", token: "{{position}}", example: "Старший партнёр" },
  { label: "Город", token: "{{city}}", example: "Москва" },
];

type PropertiesPanelProps = {
  block: BuilderBlock;
  document: BuilderDocument;
  onUpdateBlock: (patch: Partial<BuilderBlock>) => void;
  onUpdateDocument: (patch: Partial<BuilderDocument>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  className?: string;
};

export function PropertiesPanel({
  block,
  document,
  onUpdateBlock,
  onUpdateDocument,
  onDuplicate,
  onDelete,
  className,
}: PropertiesPanelProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const canEditContent = !["divider", "spacer"].includes(block.type);
  const supportsTypography = !["image", "divider", "spacer"].includes(block.type);
  const supportsAlignment = !["divider", "spacer"].includes(block.type);
  const supportsRadius = ["button", "image", "columns", "hero", "quote", "stats", "product", "signature", "pattern"].includes(block.type);

  const updateContent = (content: string) => {
    onUpdateBlock(
      block.type === "button" ? { content, label: content } : { content },
    );
  };

  const insertToken = (token: string) => {
    const input = contentRef.current;
    const start = input?.selectionStart ?? block.content.length;
    const end = input?.selectionEnd ?? block.content.length;
    const spacer = start > 0 && !/\s$/.test(block.content.slice(0, start)) ? " " : "";
    const next = `${block.content.slice(0, start)}${spacer}${token}${block.content.slice(end)}`;
    updateContent(next);
    window.requestAnimationFrame(() => {
      const cursor = start + spacer.length + token.length;
      contentRef.current?.focus();
      contentRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <aside
      aria-label="Свойства блока"
      className={cn("flex min-h-0 flex-col bg-surface", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="size-4 text-primary" />
            <h2 className="m-0 text-[13px] font-semibold text-text-strong">Свойства</h2>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge variant="accent" className="capitalize">
              {getBlockLabel(block.type)}
            </Badge>
            <span className="truncate text-[9px] text-text-subtle">Выбранный блок</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Дублировать выбранный блок" variant="ghost" size="sm" onClick={onDuplicate}>
            <Copy aria-hidden="true" className="size-3.5" />
          </IconButton>
          <IconButton
            label="Удалить выбранный блок"
            variant="ghost"
            size="sm"
            className="hover:!bg-danger-subtle hover:!text-danger"
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle">
        <AiEmailAssistant block={block} document={document} onUpdateBlock={onUpdateBlock} onUpdateDocument={onUpdateDocument} />
        {canEditContent ? (
          <PropertySection
            icon={Type}
            title={block.type === "image" ? "Альтернативный текст" : "Контент"}
            action={
              block.type !== "image" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]">
                      <Braces aria-hidden="true" className="size-3.5" />
                      Персонализировать
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" minWidth={235}>
                    <DropdownMenuLabel>Поля контакта</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {personalizationFields.map((field) => (
                      <DropdownMenuItem key={field.token} onSelect={() => insertToken(field.token)}>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-medium">{field.label}</span>
                          <span className="block font-mono text-[9px] text-text-subtle">{field.token}</span>
                        </span>
                        <span className="text-[9px] text-text-subtle">{field.example}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : undefined
            }
          >
            <FormField
              htmlFor="builder-block-content"
              hint={
                block.type === "columns"
                  ? "Разделите столбцы вертикальной чертой (|)."
                  : block.type === "image"
                    ? "Опишите изображение для получателей, использующих экранные дикторы."
                    : ["hero", "quote", "checklist", "stats", "product", "signature"].includes(block.type)
                      ? "Разделяйте части блока вертикальной чертой (|)."
                    : "Изменения сразу появятся в предпросмотре."
              }
            >
              <Textarea
                ref={contentRef}
                id="builder-block-content"
                rows={block.type === "heading" || block.type === "button" || block.type === "logo" ? 2 : 4}
                value={block.type === "button" ? block.label || block.content : block.content}
                onChange={(event) => updateContent(event.target.value)}
                className="resize-none text-[12px] leading-5"
              />
            </FormField>

            {block.type === "button" || block.type === "product" ? (
              <FormField label="Целевая ссылка" htmlFor="builder-button-link">
                <div className="relative">
                  <Link2 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-subtle" />
                  <Input
                    id="builder-button-link"
                    type="url"
                    value={block.href ?? ""}
                    onChange={(event) => onUpdateBlock({ href: event.target.value })}
                    className="pl-8 text-[11px]"
                  />
                </div>
              </FormField>
            ) : null}
            {block.type === "image" || block.type === "logo" ? (
              <ImageAssetPicker
                kind={block.type === "logo" ? "logo" : "photo"}
                value={block.href}
                onSelect={(href, filename) => onUpdateBlock({ href, ...(block.content ? {} : { content: filename }) })}
              />
            ) : null}
            {block.type === "image" || block.type === "logo" ? (
              <FormField
                label="Или HTTPS-ссылка"
                htmlFor="builder-image-link"
                hint="Можно использовать уже размещённое изображение."
              >
                <div className="relative">
                  <Link2 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-subtle" />
                  <Input
                    id="builder-image-link"
                    type="url"
                    required={block.type === "image"}
                    value={block.href ?? ""}
                    placeholder="https://example.ru/image.jpg"
                    onChange={(event) => onUpdateBlock({ href: event.target.value })}
                    className="pl-8 text-[11px]"
                  />
                </div>
              </FormField>
            ) : null}
          </PropertySection>
        ) : null}

        {supportsAlignment || supportsTypography ? (
          <PropertySection icon={Type} title="Типографика">
            {supportsAlignment ? (
              <FormField label="Выравнивание">
                <div className="grid grid-cols-3 rounded-[9px] bg-surface-subtle p-1">
                  {(
                    [
                      ["left", AlignLeft],
                      ["center", AlignCenter],
                      ["right", AlignRight],
                    ] as const
                  ).map(([alignment, Icon]) => (
                    <button
                      key={alignment}
                      type="button"
                      aria-label={alignment === "left" ? "Выровнять по левому краю" : alignment === "center" ? "Выровнять по центру" : "Выровнять по правому краю"}
                      aria-pressed={block.alignment === alignment}
                      onClick={() => onUpdateBlock({ alignment })}
                      className="grid h-8 place-items-center rounded-[7px] text-text-muted outline-none transition hover:text-text-strong focus-visible:ring-2 focus-visible:ring-primary/30 aria-pressed:bg-surface aria-pressed:text-primary aria-pressed:shadow-[var(--shadow-xs)]"
                    >
                      <Icon aria-hidden="true" className="size-4" />
                    </button>
                  ))}
                </div>
              </FormField>
            ) : null}
            {supportsTypography ? (
              <FormField label="Размер текста" htmlFor="builder-font-size">
                <Select
                  id="builder-font-size"
                  value={String(block.fontSize)}
                  onChange={(event) => onUpdateBlock({ fontSize: Number(event.target.value) })}
                  options={fontSizeOptions(block.type)}
                  className="text-[12px]"
                />
              </FormField>
            ) : null}
          </PropertySection>
        ) : null}

        <PropertySection icon={SlidersHorizontal} title="Отступы">
          <RangeField
            label="Сверху"
            value={block.paddingTop}
            min={0}
            max={64}
            onChange={(value) => onUpdateBlock({ paddingTop: value })}
          />
          <RangeField
            label="Снизу"
            value={block.paddingBottom}
            min={0}
            max={64}
            onChange={(value) => onUpdateBlock({ paddingBottom: value })}
          />
          {supportsRadius ? (
            <RangeField
              label="Скругление"
              value={block.borderRadius}
              min={0}
              max={24}
              onChange={(value) => onUpdateBlock({ borderRadius: value })}
            />
          ) : null}
        </PropertySection>

        <PropertySection icon={Palette} title="Цвета">
          {block.type !== "spacer" ? (
            <ColorField
              label={block.type === "divider" ? "Линия" : "Текст"}
              value={block.textColor}
              onChange={(textColor) => onUpdateBlock({ textColor })}
            />
          ) : null}
          <ColorField
            label="Фон блока"
            value={block.backgroundColor}
            allowTransparent
            onChange={(backgroundColor) => onUpdateBlock({ backgroundColor })}
          />
        </PropertySection>

        <details className="group border-t border-border/70" open>
          <summary className="flex min-h-11 list-none items-center justify-between px-4 text-[11px] font-semibold text-text-strong outline-none transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
            Дизайн письма
            <span className="text-[9px] font-normal text-text-subtle group-open:hidden">Показать</span>
            <span className="hidden text-[9px] font-normal text-text-subtle group-open:inline">Скрыть</span>
          </summary>
          <div className="grid gap-3 px-4 pb-4">
            <FormField label="Тема" htmlFor="builder-email-subject">
              <Input
                id="builder-email-subject"
                value={document.subject}
                onChange={(event) => onUpdateDocument({ subject: event.target.value })}
                className="text-[11px]"
              />
            </FormField>
            <FormField label="Текст предпросмотра" htmlFor="builder-preview-text">
              <Textarea
                id="builder-preview-text"
                rows={2}
                value={document.previewText}
                onChange={(event) => onUpdateDocument({ previewText: event.target.value })}
                className="resize-none text-[11px]"
              />
            </FormField>
            <ColorField
              label="Акцент"
              value={document.accentColor}
              onChange={(accentColor) => onUpdateDocument({ accentColor })}
            />
            <ColorField
              label="Фон письма"
              value={document.bodyBackground}
              onChange={(bodyBackground) => onUpdateDocument({ bodyBackground })}
            />
          </div>
        </details>
      </div>
    </aside>
  );
}

function PropertySection({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Type;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border/70 px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 flex items-center gap-2 text-[11px] font-semibold text-text-strong">
          <Icon aria-hidden="true" className="size-3.5 text-text-subtle" />
          {title}
        </h3>
        {action}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[72px_1fr_38px] items-center gap-2 text-[10px] text-text-muted">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-inset accent-primary"
      />
      <span className="rounded-md border border-border bg-surface-subtle px-1 py-0.5 text-center font-mono text-[9px] text-text-muted">
        {value}
      </span>
    </label>
  );
}

function ColorField({
  label,
  value,
  allowTransparent = false,
  onChange,
}: {
  label: string;
  value: string;
  allowTransparent?: boolean;
  onChange: (value: string) => void;
}) {
  const pickerValue = value === "transparent" ? "#ffffff" : value;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        {allowTransparent ? (
          <button
            type="button"
            aria-pressed={value === "transparent"}
            onClick={() => onChange("transparent")}
            className={cn(
              "h-7 rounded-md border px-2 text-[9px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30",
              value === "transparent"
                ? "border-primary/30 bg-primary-subtle text-primary"
                : "border-border bg-surface text-text-subtle hover:text-text",
            )}
          >
            Нет
          </button>
        ) : null}
        <label className="relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-md border border-border shadow-[var(--shadow-xs)]">
          <span className="sr-only">Выбрать цвет: {label.toLowerCase()}</span>
          <span className="absolute inset-1 rounded-[3px]" style={{ backgroundColor: pickerValue }} />
          <input
            type="color"
            value={pickerValue}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <span className="w-[66px] truncate rounded-md border border-border bg-surface-subtle px-1.5 py-1 font-mono text-[9px] uppercase text-text-muted">
          {value === "transparent" ? "Нет" : value}
        </span>
      </div>
    </div>
  );
}

function fontSizeOptions(type: BuilderBlock["type"]) {
  if (type === "heading") {
    return [28, 32, 38, 44, 52].map((size) => ({ value: String(size), label: `${size} пикс.` }));
  }
  if (type === "footer" || type === "logo" || type === "social") {
    return [10, 11, 12, 13, 14].map((size) => ({ value: String(size), label: `${size} пикс.` }));
  }
  return [12, 13, 14, 15, 16, 18, 20].map((size) => ({ value: String(size), label: `${size} пикс.` }));
}
