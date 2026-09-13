"use client";

import { Check, LayoutTemplate, Sparkles, WandSparkles } from "@/components/ui/icons";

import { cn } from "@/components/ui/utils";

export type AiCreationSource = "original" | "library";

export function AiCreationModePicker({
  value,
  onChange,
  libraryCount,
  artifact,
  className,
}: {
  value: AiCreationSource;
  onChange: (value: AiCreationSource) => void;
  libraryCount: number;
  artifact: "письмо" | "презентацию";
  className?: string;
}) {
  const options = [
    {
      id: "original" as const,
      icon: WandSparkles,
      eyebrow: "Библиотека отключена",
      title: "Спроектировать полностью с нуля",
      description: `ИИ не получает ни одного готового макета и самостоятельно режиссирует ${artifact}: структуру, дизайн-токены, типографику, изображение и уникальный орнамент.`,
      badge: "Чистая генерация",
    },
    {
      id: "library" as const,
      icon: LayoutTemplate,
      eyebrow: "Быстрее и предсказуемее",
      title: "Взять систему из библиотеки",
      description: `ИИ выберет или адаптирует один из ${libraryCount} готовых макетов: сохранит композиционный принцип, но перепишет смысл и визуал под задачу.`,
      badge: `${libraryCount} систем`,
    },
  ];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/15 bg-[linear-gradient(145deg,rgba(124,53,242,.08),rgba(255,255,255,.96)_44%,rgba(40,120,199,.07))] p-1.5",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-2.5 pb-2 pt-1.5">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-white shadow-[var(--shadow-xs)]">
          <Sparkles aria-hidden="true" className="size-3.5" />
        </span>
        <div>
          <strong className="block text-[11px] text-text-strong">
            Откуда взять дизайн-систему
          </strong>
          <span className="block text-[9px] text-text-muted">
            Выбор влияет на композицию, а не только на текст
          </span>
        </div>
      </div>
      <div
        className="grid gap-1.5 md:grid-cols-2"
        role="radiogroup"
        aria-label="Источник композиции для ИИ"
      >
        {options.map((option) => {
          const Icon = option.icon;
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-4 text-left outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)] focus-visible:ring-2 focus-visible:ring-primary/30",
                selected
                  ? "border-primary/45 bg-surface shadow-[var(--shadow-sm)]"
                  : "border-transparent bg-surface/72 hover:border-primary/20 hover:bg-surface",
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-xl transition",
                  selected
                    ? "bg-primary text-white"
                    : "bg-surface-subtle text-text-muted group-hover:bg-primary-subtle group-hover:text-primary",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="mt-3 block text-[8px] font-semibold uppercase tracking-[.13em] text-primary">
                {option.eyebrow}
              </span>
              <strong className="mt-1 block pr-7 text-[12px] leading-5 text-text-strong">
                {option.title}
              </strong>
              <span className="mt-1.5 block text-[9px] leading-4 text-text-muted">
                {option.description}
              </span>
              <span className="mt-3 inline-flex rounded-full bg-surface-subtle px-2 py-1 text-[8px] font-medium text-text-subtle">
                {option.badge}
              </span>
              {selected ? (
                <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-primary text-white shadow-[var(--shadow-xs)]">
                  <Check aria-hidden="true" className="size-3.5" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
