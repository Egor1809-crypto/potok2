"use client";

import { useMemo, useState } from "react";

import {
  AlignJustify,
  Columns3,
  GalleryHorizontal,
  Heading2,
  Image as ImageIcon,
  Link2,
  Minus,
  MousePointerClick,
  PanelBottom,
  Share2,
  Space,
  Type,
  BadgeCheck,
  ChartNoAxesColumnIncreasing,
  ContactRound,
  PackageOpen,
  Quote,
  Sparkles,
  Shapes,
  TicketPercent,
  ListTree,
  CircleHelp,
  Megaphone,
  PlaySquare,
  Search,
  LayoutTemplate,
  BellRing,
  FileCheck2,
  GitCompareArrows,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { EmailBlockType } from "@/types";
import { cn } from "@/components/ui/utils";
import type { BuilderDocument } from "./builder-types";
import { emailFrameCss, emailFramePresets } from "./frame-presets";
import { emailPatternCategoryLabels, emailPatternPresets } from "./pattern-presets";

export type BlockLibraryItem = {
  type: EmailBlockType;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const blockLibrary: BlockLibraryItem[] = [
  { type: "text", label: "Текст", description: "Абзац текста", icon: Type },
  { type: "heading", label: "Заголовок", description: "Название раздела", icon: Heading2 },
  { type: "image", label: "Изображение", description: "Графика или фото", icon: ImageIcon },
  { type: "button", label: "Кнопка", description: "Основное действие", icon: MousePointerClick },
  { type: "columns", label: "Столбцы", description: "Два блока рядом", icon: Columns3 },
  { type: "divider", label: "Разделитель", description: "Визуальная граница", icon: Minus },
  { type: "spacer", label: "Отступ", description: "Вертикальный интервал", icon: Space },
  { type: "social", label: "Соцсети", description: "Ссылки на соцсети", icon: Share2 },
  { type: "logo", label: "Логотип", description: "Знак бренда", icon: GalleryHorizontal },
  { type: "footer", label: "Подвал", description: "Служебный текст", icon: PanelBottom },
  { type: "hero", label: "Обложка", description: "Главный экран письма", icon: Sparkles },
  { type: "quote", label: "Цитата", description: "Отзыв или мнение", icon: Quote },
  { type: "checklist", label: "Список", description: "Преимущества по пунктам", icon: BadgeCheck },
  { type: "stats", label: "Показатели", description: "Цифры и результаты", icon: ChartNoAxesColumnIncreasing },
  { type: "product", label: "Карточка", description: "Продукт или услуга", icon: PackageOpen },
  { type: "signature", label: "Подпись", description: "Отправитель и контакты", icon: ContactRound },
  { type: "pattern", label: "Узор", description: "32 орнамента и контура", icon: Shapes },
  { type: "banner", label: "Баннер", description: "Яркое объявление", icon: Megaphone },
  { type: "timeline", label: "Этапы", description: "Путь или программа", icon: ListTree },
  { type: "faq", label: "Вопросы", description: "Вопросы и ответы", icon: CircleHelp },
  { type: "coupon", label: "Промокод", description: "Купон или бонус", icon: TicketPercent },
  { type: "video", label: "Видео", description: "Обложка со ссылкой", icon: PlaySquare },
  { type: "notice", label: "Уведомление", description: "Срок и важный статус", icon: BellRing },
  { type: "comparison", label: "Что изменилось", description: "До и после рядом", icon: GitCompareArrows },
  { type: "document", label: "Документ", description: "Файл, срок и действие", icon: FileCheck2 },
  { type: "compliance", label: "Согласие", description: "Статус и настройка", icon: ShieldCheck },
];

export const getBlockLabel = (type: EmailBlockType) =>
  blockLibrary.find((item) => item.type === type)?.label ?? "Блок";

export function BlockLibrary({
  onAdd,
  document,
  onUpdateDocument,
  className,
}: {
  onAdd: (type: EmailBlockType, patch?: { content?: string; fontSize?: number; letterSpacing?: number }) => void;
  document: BuilderDocument;
  onUpdateDocument: (patch: Partial<BuilderDocument>) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"content" | "layout" | "decor" | "frame">("content");
  const visibleItems = useMemo(() => {
    const layoutTypes = new Set<EmailBlockType>(["columns", "hero", "banner", "timeline", "product", "stats", "comparison", "document", "notice", "compliance"]);
    const normalized = query.trim().toLowerCase();
    if (tab === "frame" || tab === "decor") return [];
    return blockLibrary.filter((item) => (tab === "layout" ? layoutTypes.has(item.type) : !layoutTypes.has(item.type)) && (!normalized || `${item.label} ${item.description}`.toLowerCase().includes(normalized)));
  }, [query, tab]);
  return (
    <aside
      aria-label="Блоки контента"
      className={cn("flex min-h-0 flex-col bg-surface", className)}
    >
      <div className="border-b border-border/70 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <AlignJustify aria-hidden="true" className="size-4 text-primary" />
          <h2 className="m-0 text-[13px] font-semibold text-text-strong">Добавить в письмо</h2>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-text-muted">
          Выберите элемент — он появится после выделенного блока.
        </p>
        <label className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          <Search aria-hidden="true" className="size-3.5 text-text-subtle" />
          <span className="sr-only">Найти блок</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти блок" className="min-w-0 flex-1 border-0 bg-transparent text-[11px] text-text-strong outline-none placeholder:text-text-subtle" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-subtle p-1" role="tablist" aria-label="Тип элементов">
          <LibraryTab active={tab === "content"} onClick={() => setTab("content")} icon={AlignJustify}>Контент</LibraryTab>
          <LibraryTab active={tab === "layout"} onClick={() => setTab("layout")} icon={LayoutTemplate}>Структуры</LibraryTab>
          <LibraryTab active={tab === "decor"} onClick={() => setTab("decor")} icon={Sparkles}>Декор</LibraryTab>
          <LibraryTab active={tab === "frame"} onClick={() => setTab("frame")} icon={Shapes}>Окантовки</LibraryTab>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-subtle">
        {tab === "frame" ? (
          <div>
            <p className="mb-3 mt-0 text-[10px] leading-4 text-text-muted">Окантовка применяется ко всему письму и сохраняется в итоговом HTML.</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2" role="radiogroup" aria-label="Окантовка письма">
              {emailFramePresets.map((preset) => (
                <button key={preset.id} type="button" role="radio" aria-checked={document.frameStyle === preset.id} onClick={() => onUpdateDocument({ frameStyle: preset.id, frameRadius: preset.radius })} className="rounded-[9px] border border-border bg-surface p-2 text-left outline-none transition hover:border-primary/40 hover:bg-primary-subtle/30 focus-visible:ring-2 focus-visible:ring-primary/30 aria-checked:border-primary aria-checked:bg-primary-subtle/60">
                  <span aria-hidden="true" className="block h-12 bg-white" style={emailFrameCss(preset.id, document.frameColor, preset.radius)} />
                  <span className="mt-2 block text-[10px] font-semibold text-text-strong">{preset.name}</span>
                  <span className="mt-0.5 block text-[9px] text-text-subtle">{preset.description}</span>
                </button>
              ))}
            </div>
            <label className="mt-4 block text-[10px] font-semibold text-text-strong">Цвет окантовки
              <span className="mt-1.5 flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2">
                <input type="color" value={document.frameColor} onChange={(event) => onUpdateDocument({ frameColor: event.target.value })} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="font-mono text-[9px] text-text-muted">{document.frameColor.toUpperCase()}</span>
              </span>
            </label>
          </div>
        ) : tab === "decor" ? (
          <div className="space-y-4">
            <p className="m-0 text-[10px] leading-4 text-text-muted">Орнамент добавится отдельным редактируемым блоком. Его можно поставить в шапку, между секциями или в финал письма.</p>
            {(Object.keys(emailPatternCategoryLabels) as Array<keyof typeof emailPatternCategoryLabels>).map((category) => (
              <section key={category} aria-labelledby={`pattern-${category}`}>
                <h3 id={`pattern-${category}`} className="mb-2 mt-0 text-[10px] font-semibold text-text-strong">{emailPatternCategoryLabels[category]}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {emailPatternPresets.filter((preset) => preset.category === category).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onAdd("pattern", { content: preset.content, fontSize: preset.fontSize, letterSpacing: preset.letterSpacing })}
                      className="min-w-0 rounded-[9px] border border-border bg-surface p-2 text-left outline-none transition hover:border-primary/40 hover:bg-primary-subtle/35 focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <span aria-hidden="true" className="block h-9 overflow-hidden whitespace-pre-line rounded-md bg-primary-subtle/70 px-1 py-1 text-center text-[7px] leading-3 text-primary">{preset.content}</span>
                      <span className="mt-1.5 block truncate text-[9px] font-semibold text-text-strong">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => onAdd(item.type)}
                className="group min-w-0 rounded-[9px] border border-border bg-surface p-2.5 text-left outline-none transition hover:border-primary/40 hover:bg-primary-subtle/35 focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <span className="grid size-8 place-items-center rounded-[9px] bg-surface-subtle text-text-muted transition-colors group-hover:bg-primary-subtle group-hover:text-primary">
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                </span>
                <span className="mt-2 block truncate text-[11px] font-semibold text-text-strong">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-[9px] text-text-subtle">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
        )}

        {tab !== "frame" && tab !== "decor" && visibleItems.length === 0 ? <p className="py-8 text-center text-[11px] text-text-muted">Подходящих элементов нет</p> : null}

        <div className="mt-4 rounded-[11px] border border-primary/15 bg-primary-subtle/55 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-primary">
            <Link2 aria-hidden="true" className="size-3.5" />
            Персонализация настроена
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-text-muted">
            Добавляйте поля контакта на панели свойств, чтобы каждое письмо было персональным.
          </p>
        </div>
      </div>
    </aside>
  );
}

function LibraryTab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: LucideIcon; children: string }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className="flex h-7 items-center justify-center gap-1.5 rounded-md text-[10px] font-semibold text-text-muted outline-none aria-selected:bg-surface aria-selected:text-primary aria-selected:shadow-[var(--shadow-xs)] focus-visible:ring-2 focus-visible:ring-primary/30"><Icon aria-hidden="true" className="size-3" />{children}</button>;
}
