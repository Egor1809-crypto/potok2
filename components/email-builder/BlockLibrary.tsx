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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { EmailBlockType } from "@/types";
import { cn } from "@/components/ui/utils";

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
  { type: "pattern", label: "Узор", description: "Декоративная полоса", icon: Shapes },
  { type: "banner", label: "Баннер", description: "Яркое объявление", icon: Megaphone },
  { type: "timeline", label: "Этапы", description: "Путь или программа", icon: ListTree },
  { type: "faq", label: "Вопросы", description: "Вопросы и ответы", icon: CircleHelp },
  { type: "coupon", label: "Промокод", description: "Купон или бонус", icon: TicketPercent },
  { type: "video", label: "Видео", description: "Обложка со ссылкой", icon: PlaySquare },
];

export const getBlockLabel = (type: EmailBlockType) =>
  blockLibrary.find((item) => item.type === type)?.label ?? "Блок";

export function BlockLibrary({
  onAdd,
  className,
}: {
  onAdd: (type: EmailBlockType) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"content" | "layout">("content");
  const visibleItems = useMemo(() => {
    const layoutTypes = new Set<EmailBlockType>(["columns", "hero", "banner", "timeline", "product", "stats"]);
    const normalized = query.trim().toLowerCase();
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
        <div className="mt-3 grid grid-cols-2 rounded-lg bg-surface-subtle p-1" role="tablist" aria-label="Тип элементов">
          <LibraryTab active={tab === "content"} onClick={() => setTab("content")} icon={AlignJustify}>Контент</LibraryTab>
          <LibraryTab active={tab === "layout"} onClick={() => setTab("layout")} icon={LayoutTemplate}>Структуры</LibraryTab>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-subtle">
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

        {visibleItems.length === 0 ? <p className="py-8 text-center text-[11px] text-text-muted">Подходящих элементов нет</p> : null}

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
