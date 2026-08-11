"use client";

import { useDrawerAccessibility } from "@/components/shared/useDrawerAccessibility";
import { BRAND_NAME } from "@/config/brand";
import { segments } from "@/data/mockSegments";
import type { Segment, SegmentRule } from "@/types";
import {
  ArrowRight,
  Clock3,
  Copy,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

const numberFormatter = new Intl.NumberFormat("ru-RU");
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const fieldLabels: Record<SegmentRule["field"], string> = {
  role: "Должность",
  city: "Город",
  status: "Статус",
  category: "Категория",
  tag: "Тег",
  company: "Компания",
  lastContactedAt: "Последний контакт",
  engagementScore: "Вовлечённость",
};

const operatorLabels: Record<SegmentRule["operator"], string> = {
  equals: "равно",
  not_equals: "не равно",
  contains: "содержит",
  greater_than: "больше",
  less_than: "меньше",
  before: "до",
  after: "после",
};

const ruleValueLabels: Record<string, string> = {
  Lawyer: "Юрист",
  Moscow: "Москва",
  Partner: "Партнёр",
  Conference: "Конференция",
  Client: "Клиент",
  Warm: "Тёплый",
  Hot: "Горячий",
  VIP: "Ключевой",
};

function formatRuleValue(rule: SegmentRule): string {
  if (Array.isArray(rule.value)) return rule.value.join(", ");
  if (rule.field === "status" && rule.value === "active") return "активен";
  if (rule.field === "lastContactedAt" && typeof rule.value === "string") {
    return dateFormatter.format(new Date(`${rule.value}T12:00:00Z`));
  }
  if (typeof rule.value === "string" && ruleValueLabels[rule.value]) {
    return ruleValueLabels[rule.value];
  }
  return String(rule.value);
}

function formatRuleCount(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "условие"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "условия"
        : "условий";
  return `${value} ${noun}`;
}

export function SegmentsView() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment | null>(null);
  const [mode, setMode] = useState<"grid" | "table">("grid");
  const visible = useMemo(
    () =>
      segments.filter((item) =>
        `${item.name} ${item.description}`
          .toLocaleLowerCase("ru-RU")
          .includes(search.toLocaleLowerCase("ru-RU")),
      ),
    [search],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">Динамические аудитории</p>
          <h1 className="mt-2 text-[28px] font-medium tracking-[-.04em]">
            Сегменты
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Сохранённые аудитории, которые обновляются вместе с базой контактов
          </p>
        </div>
        <button className="btn btn-primary w-fit gap-2">
          <Plus size={14} />
          Новый сегмент
        </button>
      </div>

      <section className="rounded-2xl border border-[#dddff8] bg-[linear-gradient(118deg,#f5f4ff,#fbfbff_60%,#f0faff)] p-5">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#625cf6] text-white shadow-[0_8px_18px_rgba(98,92,246,.22)]">
            <Sparkles size={17} />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold">
              Сегменты обновляются автоматически
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Когда контакт начинает соответствовать правилам или перестаёт им
              соответствовать, {BRAND_NAME} обновляет аудиторию автоматически.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Поиск сегментов</span>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input h-9 w-full pl-9 text-[11px]"
            placeholder="Поиск сегментов"
          />
        </label>
        <div className="flex rounded-lg bg-[var(--surface-subtle)] p-1">
          <button
            onClick={() => setMode("grid")}
            className={`rounded-md px-3 py-1.5 text-[9px] font-semibold ${
              mode === "grid"
                ? "bg-white shadow-sm"
                : "text-[var(--text-tertiary)]"
            }`}
          >
            Карточки
          </button>
          <button
            onClick={() => setMode("table")}
            className={`rounded-md px-3 py-1.5 text-[9px] font-semibold ${
              mode === "table"
                ? "bg-white shadow-sm"
                : "text-[var(--text-tertiary)]"
            }`}
          >
            Таблица
          </button>
        </div>
      </div>

      {mode === "grid" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <article
              key={item.id}
              className="card group p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <span
                  className="grid size-10 place-items-center rounded-xl"
                  style={{ backgroundColor: `${item.color}12`, color: item.color }}
                >
                  <UsersRound size={18} />
                </span>
                <button
                  aria-label={`Действия для сегмента ${item.name}`}
                  className="text-[var(--text-tertiary)]"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
              <button
                onClick={() => setSegment(item)}
                className="mt-5 block text-left"
              >
                <h2 className="text-[14px] font-semibold group-hover:text-[#625cf6]">
                  {item.name}
                </h2>
                <p className="mt-2 min-h-10 text-[10px] leading-5 text-[var(--text-tertiary)]">
                  {item.description}
                </p>
              </button>
              <div className="mt-5 flex items-end justify-between border-t border-[var(--border)] pt-4">
                <div>
                  <p className="text-[21px] font-semibold tracking-[-.04em]">
                    {numberFormatter.format(item.contactCount)}
                  </p>
                  <p className="text-[8px] text-[var(--text-tertiary)]">
                    контактов
                  </p>
                </div>
                <div className="text-right">
                  <span className="badge badge-success">
                    <Zap size={9} />
                    Динамический
                  </span>
                  <p className="mt-2 text-[8px] text-[var(--text-tertiary)]">
                    Обновлён сегодня
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setSegment(item)}
                  className="btn btn-secondary flex-1 justify-center"
                >
                  Правила
                </button>
                <a
                  href={`/campaigns/new?audience=${item.id}&count=${item.contactCount}`}
                  className="btn btn-primary flex-1 justify-center gap-1.5"
                >
                  Кампания
                  <ArrowRight size={12} />
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="bg-[var(--surface-subtle)] text-[9px] uppercase tracking-[.07em] text-[var(--text-tertiary)]">
                <th className="px-5 py-3">Сегмент</th>
                <th className="px-4 py-3">Контакты</th>
                <th className="px-4 py-3">Правила</th>
                <th className="px-4 py-3">Кампании</th>
                <th className="px-4 py-3">Обновлён</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setSegment(item)}
                      className="text-[10px] font-semibold hover:text-[#625cf6]"
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-[10px]">
                    {numberFormatter.format(item.contactCount)}
                  </td>
                  <td className="px-4 py-4 text-[10px] text-[var(--text-secondary)]">
                    {formatRuleCount(item.rules.length)}
                  </td>
                  <td className="px-4 py-4 text-[10px]">
                    {item.campaignsCount}
                  </td>
                  <td className="px-4 py-4 text-[9px] text-[var(--text-tertiary)]">
                    Сегодня
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {segment && (
        <SegmentDrawer segment={segment} onClose={() => setSegment(null)} />
      )}
    </div>
  );
}

function SegmentDrawer({
  segment,
  onClose,
}: {
  segment: Segment;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useDrawerAccessibility(panelRef, onClose);

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-[#171823]/25 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${segment.name}: правила сегмента`}
        className="h-full w-full max-w-[520px] overflow-y-auto border-l border-[var(--border)] bg-white shadow-[-22px_0_60px_rgba(30,31,46,.16)]"
      >
        <div className="sticky top-0 z-10 flex justify-between border-b border-[var(--border)] bg-white/90 px-5 py-3 backdrop-blur-xl">
          <span className="text-[10px] text-[var(--text-tertiary)]">
            Сведения о сегменте
          </span>
          <button
            data-autofocus="true"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface-subtle)]"
            aria-label="Закрыть сведения о сегменте"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-6">
          <span
            className="grid size-11 place-items-center rounded-xl"
            style={{ backgroundColor: `${segment.color}12`, color: segment.color }}
          >
            <UsersRound size={19} />
          </span>
          <h2 className="mt-4 text-[22px] font-semibold tracking-[-.035em]">
            {segment.name}
          </h2>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
            {segment.description}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
              <p className="text-[9px] text-[var(--text-tertiary)]">
                Размер аудитории
              </p>
              <p className="mt-1 text-[21px] font-semibold">
                {numberFormatter.format(segment.contactCount)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
              <p className="text-[9px] text-[var(--text-tertiary)]">Кампании</p>
              <p className="mt-1 text-[21px] font-semibold">
                {segment.campaignsCount}
              </p>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold">Правила аудитории</h3>
            <span className="badge badge-success">
              <Zap size={9} />
              Активен
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-[9px] text-[var(--text-tertiary)]">
              Включать контакты, если
            </p>
            <div className="mt-4 space-y-2">
              {segment.rules.map((rule, index) => (
                <div key={rule.id} className="flex items-center gap-2">
                  <span className="w-10 text-[8px] font-semibold text-[#625cf6]">
                    {index === 0 ? "ГДЕ" : rule.join === "and" ? "И" : "ИЛИ"}
                  </span>
                  <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-[10px]">
                    <span className="font-semibold">
                      {fieldLabels[rule.field]}
                    </span>
                    <span className="mx-2 text-[var(--text-tertiary)]">
                      {operatorLabels[rule.operator]}
                    </span>
                    <span className="font-medium">{formatRuleValue(rule)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button className="btn btn-secondary flex-1 justify-center gap-2">
              <Copy size={13} />
              Дублировать
            </button>
            <a
              href={`/campaigns/new?audience=${segment.id}&count=${segment.contactCount}`}
              className="btn btn-primary flex-1 justify-center gap-2"
            >
              Создать кампанию
              <ArrowRight size={13} />
            </a>
          </div>
          <p className="mt-5 flex items-center gap-1.5 text-[9px] text-[var(--text-tertiary)]">
            <Clock3 size={12} />
            Автоматически обновлён сегодня в 08:42
          </p>
        </div>
      </section>
    </div>
  );
}
