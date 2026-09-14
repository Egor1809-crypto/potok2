"use client";

import { SegmentEditor } from "@/components/segments/SegmentEditor";
import {
  createSegment,
  getSegments,
  removeSegment,
  updateSegment,
} from "@/components/segments/segment-api";
import type {
  SegmentCreateInput,
  SegmentRecord,
  SegmentRule,
  SegmentRuleField,
  SegmentRuleOperator,
} from "@/types/api";
import {
  AlertTriangle,
  ArrowRight,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
} from "@/components/ui/icons";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./segments.module.css";

const numberFormatter = new Intl.NumberFormat("ru-RU");
const fieldLabels: Record<SegmentRuleField, string> = {
  jobTitle: "должность",
  city: "город",
  status: "статус",
  category: "категория",
  tag: "тег",
  companyName: "компания",
  lastContactedAt: "дата контакта",
  engagementScore: "вовлечённость",
};

const operatorLabels: Record<SegmentRuleOperator, string> = {
  equals: "=",
  not_equals: "≠",
  contains: "содержит",
  greater_than: ">",
  less_than: "<",
  before: "до",
  after: "после",
};

const valueLabels: Record<string, string> = {
  active: "активен",
  unsubscribed: "отписан",
  bounced: "не доставлено",
  invalid: "некорректен",
};

function formatUpdatedAt(value: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : formatter.format(date);
}

function russianPlural(value: number, one: string, few: string, many: string) {
  const absolute = Math.abs(value) % 100;
  const last = absolute % 10;
  if (absolute > 10 && absolute < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function formatRuleValue(rule: SegmentRule): string {
  if (Array.isArray(rule.value)) return rule.value.join(", ");
  const rawValue = String(rule.value);
  return valueLabels[rawValue] ?? rawValue;
}

function ruleSummary(rule: SegmentRule, index: number): string {
  const join = index === 0 ? "" : rule.join === "and" ? "И " : "ИЛИ ";
  return `${join}${fieldLabels[rule.field]} ${operatorLabels[rule.operator]} ${formatRuleValue(rule)}`;
}

function campaignHref(segment: SegmentRecord): string {
  const params = new URLSearchParams({
    audienceType: "segment",
    audience: segment.id,
    segment: segment.id,
    count: String(segment.contactCount),
  });
  return `/campaigns/new?${params.toString()}`;
}

export function SegmentsView() {
  const [segments, setSegments] = useState<SegmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<SegmentRecord | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Europe/Moscow");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const snapshot = await getSegments(signal);
      setSegments(snapshot.segments);
      setTimezone(snapshot.timezone);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить сегменты.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => void load(controller.signal));
    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [load]);

  const visibleSegments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    if (!query) return segments;
    return segments.filter((segment) =>
      [
        segment.name,
        segment.description,
        ...segment.rules.map((rule) => ruleSummary(rule, 0)),
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU")
        .includes(query),
    );
  }, [search, segments]);

  const dateFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: timezone,
      });
    } catch {
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Moscow",
      });
    }
  }, [timezone]);

  const saveSegment = async (input: SegmentCreateInput) => {
    if (editor === null) return;
    const saved =
      editor === "new"
        ? await createSegment(input)
        : await updateSegment({ id: editor.id, ...input });

    setSegments((current) => {
      const exists = current.some((segment) => segment.id === saved.id);
      return exists
        ? current.map((segment) => (segment.id === saved.id ? saved : segment))
        : [saved, ...current];
    });
    setNotice(
      editor === "new"
        ? `Сегмент «${saved.name}» создан.`
        : `Сегмент «${saved.name}» сохранён.`,
    );
    setEditor(null);
  };

  const deleteCurrentSegment = async () => {
    if (!editor || editor === "new") return;
    const deletedId = await removeSegment(editor.id);
    setSegments((current) =>
      current.filter((segment) => segment.id !== deletedId),
    );
    setNotice(`Сегмент «${editor.name}» удалён.`);
    setEditor(null);
  };

  return (
    <div className={styles.page}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-2 text-[28px] font-medium tracking-[-.04em]">
            Сегменты
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-secondary)]">
            Соберите контакты по городу, статусу, тегу и другим
            полям, затем используйте аудиторию в кампании.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {segments.length > 0 && (
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="btn btn-secondary w-fit gap-2 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              Пересчитать охват
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setEditor("new");
            }}
            disabled={loading}
            className="btn btn-primary w-fit gap-2 disabled:cursor-wait disabled:opacity-60"
          >
            <Plus size={20} />
            Новый сегмент
          </button>
        </div>
      </header>

      <div aria-live="polite" aria-atomic="true">
        {notice && (
          <div className="rounded-xl border border-[#cfe7d8] bg-[#f3fbf6] px-4 py-3 text-[10px] text-[#397454]">
            {notice}
          </div>
        )}
      </div>

      <section className={styles.library} aria-labelledby="segments-list-title">
        <div className={styles.toolbar}>
          <div>
            <h2 id="segments-list-title" className="sr-only">
              Сохранённые сегменты
            </h2>
            <p className={styles.total} role="status">
              <UsersRound size={24} aria-hidden="true" />
              {loading
                ? "Загружаем…"
                : search.trim() ? `Найдено: ${numberFormatter.format(visibleSegments.length)} из ${numberFormatter.format(segments.length)}` : `${numberFormatter.format(segments.length)} ${russianPlural(segments.length, "сегмент", "сегмента", "сегментов")}`}
            </p>
          </div>
          <label className={styles.search}>
            <span className="sr-only">Поиск сегментов</span>
            <Search
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input input-with-leading-icon h-9 w-full text-[11px]"
              placeholder="Название или правило"
            />
          </label>
        </div>

        {loading ? (
          <div
            className="flex min-h-52 items-center justify-center gap-2 p-8 text-xs text-[var(--text-tertiary)]"
            role="status"
          >
            <RefreshCw size={24} className="animate-spin" />
            Загружаем сегменты…
          </div>
        ) : loadError ? (
          <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
            <AlertTriangle size={32} className="text-[#b65a4a]" />
            <p className="mt-3 text-sm font-semibold">
              Сегменты не загрузились
            </p>
            <p className="mt-1 max-w-md text-[10px] leading-5 text-[var(--text-tertiary)]">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="btn btn-secondary mt-4 gap-1.5"
            >
              <RefreshCw size={13} />
              Повторить
            </button>
          </div>
        ) : visibleSegments.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-subtle text-primary">
              <UsersRound size={28} />
            </span>
            <p className="mt-3 text-sm font-semibold">
              {segments.length === 0
                ? "Пока нет сегментов"
                : "Ничего не найдено"}
            </p>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
              {segments.length === 0
                ? "Создайте аудиторию из контактов по правилам."
                : "Измените поисковый запрос."}
            </p>
            {segments.length === 0 && (
              <button
                type="button"
                onClick={() => setEditor("new")}
                className="btn btn-primary mt-4 gap-1.5"
              >
                <Plus size={13} />
                Создать сегмент
              </button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleSegments.map((segment) => (
              <article key={segment.id} className={styles.segment} style={{ "--segment-accent": segment.color } as CSSProperties}>
                <div className="flex items-start gap-3">
                  <span
                    className={styles.segmentIcon}
                  >
                    <UsersRound size={28} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className={styles.segmentName}>
                      {segment.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-[var(--text-tertiary)]">
                      {segment.description || "Без описания"}
                    </p>
                  </div>
                </div>

                <div className={styles.metrics}>
                  <div>
                    <p className={styles.contactCount}>
                      {numberFormatter.format(segment.contactCount)}
                    </p>
                    <p className="text-[9px] text-[var(--text-tertiary)]">
                      {russianPlural(
                        segment.contactCount,
                        "контакт сейчас",
                        "контакта сейчас",
                        "контактов сейчас",
                      )}
                    </p>
                  </div>
                  <p className="text-right text-[9px] leading-4 text-[var(--text-tertiary)]">
                    {segment.rules.length}{" "}
                    {russianPlural(
                      segment.rules.length,
                      "условие",
                      "условия",
                      "условий",
                    )}
                    <br />
                    правила: {formatUpdatedAt(segment.updatedAt, dateFormatter)}
                  </p>
                </div>

                <ul className={styles.rules} aria-label="Правила">
                  {segment.rules.slice(0, 3).map((rule, index) => (
                    <li
                      key={rule.id}
                      className={styles.rule}
                      title={ruleSummary(rule, index)}
                    >
                      {ruleSummary(rule, index)}
                    </li>
                  ))}
                  {segment.rules.length > 3 && (
                    <li className="px-2.5 text-[9px] text-[var(--text-tertiary)]">
                      Ещё {segment.rules.length - 3}
                    </li>
                  )}
                </ul>

                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setEditor(segment);
                    }}
                    className="btn btn-secondary justify-center gap-1.5"
                  >
                    <PencilLine size={16} />
                    Изменить
                  </button>
                  <Link
                    href={campaignHref(segment)}
                    className="btn btn-primary justify-center gap-1.5"
                  >
                    В кампанию
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editor && (
        <SegmentEditor
          key={editor === "new" ? "new" : editor.id}
          segment={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={saveSegment}
          onDelete={editor === "new" ? undefined : deleteCurrentSegment}
        />
      )}
    </div>
  );
}
