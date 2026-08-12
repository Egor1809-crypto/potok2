"use client";

import { useDrawerAccessibility } from "@/components/shared/useDrawerAccessibility";
import type {
  SegmentCreateInput,
  SegmentRecord,
  SegmentRule,
  SegmentRuleField,
  SegmentRuleOperator,
} from "@/types/api";
import { AlertTriangle, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type RuleDraft = Omit<SegmentRule, "value"> & {
  value: string;
  valueIsList: boolean;
};

type FieldOption = {
  value: SegmentRuleField;
  label: string;
  input: "text" | "status" | "date" | "number";
};

const fieldOptions: FieldOption[] = [
  { value: "city", label: "Город", input: "text" },
  { value: "status", label: "Статус", input: "status" },
  { value: "tag", label: "Тег", input: "text" },
  { value: "category", label: "Категория", input: "text" },
  { value: "jobTitle", label: "Должность", input: "text" },
  { value: "companyName", label: "Компания", input: "text" },
  {
    value: "lastContactedAt",
    label: "Дата контакта",
    input: "date",
  },
  {
    value: "engagementScore",
    label: "Вовлечённость",
    input: "number",
  },
];

const operatorLabels: Record<SegmentRuleOperator, string> = {
  equals: "равно",
  not_equals: "не равно",
  contains: "содержит",
  greater_than: "больше",
  less_than: "меньше",
  before: "до",
  after: "после",
};

const statusOptions = [
  { value: "active", label: "Активен" },
  { value: "unsubscribed", label: "Отписан" },
  { value: "bounced", label: "Не доставлено" },
  { value: "invalid", label: "Некорректен" },
];

function allowedOperators(field: SegmentRuleField): SegmentRuleOperator[] {
  if (field === "status") return ["equals", "not_equals"];
  if (field === "lastContactedAt") return ["before", "after"];
  if (field === "engagementScore") {
    return ["greater_than", "less_than", "equals"];
  }
  return ["equals", "not_equals", "contains"];
}

function makeRule(): RuleDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    field: "city",
    operator: "equals",
    value: "",
    valueIsList: false,
    join: "and",
  };
}

function ruleToDraft(rule: SegmentRule): RuleDraft {
  const unsupportedDateEquality =
    rule.field === "lastContactedAt" && rule.operator === "equals";
  return {
    ...rule,
    operator: unsupportedDateEquality ? "after" : rule.operator,
    value: unsupportedDateEquality
      ? ""
      : Array.isArray(rule.value)
        ? rule.value.join(", ")
        : String(rule.value),
    valueIsList: Array.isArray(rule.value),
  };
}

function fieldOption(field: SegmentRuleField): FieldOption {
  return fieldOptions.find((option) => option.value === field) ?? fieldOptions[0];
}

function prepareRules(rules: RuleDraft[]): SegmentRule[] {
  return rules.map((rule, index) => ({
    ...rule,
    join: index === 0 ? "and" : rule.join,
    value:
      rule.field === "engagementScore"
        ? Number(rule.value)
        : rule.valueIsList
          ? rule.value
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : rule.value.trim(),
  }));
}

export function SegmentEditor({
  segment,
  onClose,
  onSave,
  onDelete,
}: {
  segment?: SegmentRecord;
  onClose: () => void;
  onSave: (input: SegmentCreateInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const [color, setColor] = useState(segment?.color ?? "#7c35f2");
  const [rules, setRules] = useState<RuleDraft[]>(() =>
    segment?.rules.length ? segment.rules.map(ruleToDraft) : [makeRule()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useDrawerAccessibility(panelRef, () => {
    if (!busy) onClose();
  });

  const invalidMessage = useMemo(() => {
    if (name.trim().length < 2) {
      return "Название должно содержать не менее двух символов.";
    }
    if (rules.length === 0) return "Добавьте хотя бы одно правило.";
    if (rules.some((rule) => !rule.value.trim())) {
      return "Заполните значения всех правил.";
    }
    const invalidScore = rules.some(
      (rule) =>
        rule.field === "engagementScore" &&
        (!Number.isInteger(Number(rule.value)) ||
          Number(rule.value) < 0 ||
          Number(rule.value) > 100),
    );
    if (invalidScore) {
      return "Вовлечённость должна быть числом от 0 до 100.";
    }
    return null;
  }, [name, rules]);

  const updateRule = (id: string, patch: Partial<RuleDraft>) => {
    setError(null);
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );
  };

  const changeField = (rule: RuleDraft, field: SegmentRuleField) => {
    const operators = allowedOperators(field);
    updateRule(rule.id, {
      field,
      operator: operators.includes(rule.operator) ? rule.operator : operators[0],
      value: field === "status" ? "active" : "",
      valueIsList: false,
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (invalidMessage) {
      setError(invalidMessage);
      return;
    }

    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        color,
        isDynamic: true,
        rules: prepareRules(rules),
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить сегмент.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteSegment = async () => {
    if (!onDelete) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить сегмент.",
      );
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const askToDelete = () => {
    setConfirmDelete(true);
    window.requestAnimationFrame(() => deleteCancelRef.current?.focus());
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-[#171823]/25 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="segment-editor-title"
        className="flex h-full w-full max-w-[620px] flex-col border-l border-[var(--border)] bg-white shadow-[-22px_0_60px_rgba(30,31,46,.16)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div>
            <p className="section-eyebrow">
              {segment ? "Настройка аудитории" : "Новая аудитория"}
            </p>
            <h2
              id="segment-editor-title"
              className="mt-1 text-lg font-semibold tracking-[-.02em]"
            >
              {segment ? "Изменить сегмент" : "Создать сегмент"}
            </h2>
          </div>
          <button
            type="button"
            data-autofocus="true"
            onClick={onClose}
            disabled={busy}
            className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-subtle)] disabled:opacity-50"
            aria-label="Закрыть редактор сегмента"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold">
                  Название
                </span>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  className="input w-full"
                  placeholder="Например, Клиенты из Москвы"
                  maxLength={100}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold">
                  Цвет
                </span>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-10 w-full min-w-20 cursor-pointer rounded-lg border border-[var(--border)] bg-white p-1"
                  aria-label="Цвет сегмента"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold">
                Описание
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="input min-h-20 w-full resize-y py-2.5"
                placeholder="Кого включает этот сегмент"
                maxLength={300}
              />
            </label>

            <fieldset>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <legend className="text-xs font-semibold">Правила</legend>
                  <p className="mt-1 text-[10px] leading-4 text-[var(--text-tertiary)]">
                    Условия считаются сверху вниз; «И» и «ИЛИ» связывают
                    новое условие с уже полученным результатом.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRules((current) => [...current, makeRule()])}
                  disabled={rules.length >= 20}
                  className="btn btn-secondary shrink-0 gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                  title={rules.length >= 20 ? "Не более 20 условий" : undefined}
                >
                  <Plus size={13} />
                  Условие
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {rules.map((rule, index) => {
                  const option = fieldOption(rule.field);
                  const operators = allowedOperators(rule.field);
                  const visibleOperators = operators.includes(rule.operator)
                    ? operators
                    : [rule.operator, ...operators];
                  return (
                    <div
                      key={rule.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        {index === 0 ? (
                          <span className="text-[9px] font-semibold uppercase tracking-[.08em] text-primary">
                            Где
                          </span>
                        ) : (
                          <label>
                            <span className="sr-only">
                              Связь с предыдущим условием
                            </span>
                            <select
                              value={rule.join}
                              onChange={(event) =>
                                updateRule(rule.id, {
                                  join: event.target.value as "and" | "or",
                                })
                              }
                              className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[9px] font-semibold"
                            >
                              <option value="and">И</option>
                              <option value="or">ИЛИ</option>
                            </select>
                          </label>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setRules((current) =>
                              current.filter((item) => item.id !== rule.id),
                            )
                          }
                          disabled={rules.length === 1}
                          className="grid size-7 place-items-center rounded-md text-[var(--text-tertiary)] hover:bg-white hover:text-[#b24343] disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label={`Удалить условие ${index + 1}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[1.05fr_.85fr_1.2fr]">
                        <label>
                          <span className="sr-only">Поле условия</span>
                          <select
                            value={rule.field}
                            onChange={(event) =>
                              changeField(
                                rule,
                                event.target.value as SegmentRuleField,
                              )
                            }
                            className="input w-full bg-white"
                          >
                            {fieldOptions.map((field) => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span className="sr-only">Оператор условия</span>
                          <select
                            value={rule.operator}
                            onChange={(event) =>
                              updateRule(rule.id, {
                                operator: event.target
                                  .value as SegmentRuleOperator,
                              })
                            }
                            className="input w-full bg-white"
                          >
                            {visibleOperators.map((operator) => (
                              <option key={operator} value={operator}>
                                {operatorLabels[operator]}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span className="sr-only">Значение условия</span>
                          {option.input === "status" ? (
                            <select
                              value={rule.value}
                              onChange={(event) =>
                                updateRule(rule.id, { value: event.target.value })
                              }
                              className="input w-full bg-white"
                            >
                              {statusOptions.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={option.input}
                              value={rule.value}
                              onChange={(event) =>
                                updateRule(rule.id, { value: event.target.value })
                              }
                              className="input w-full bg-white"
                              min={option.input === "number" ? 0 : undefined}
                              max={option.input === "number" ? 100 : undefined}
                              step={option.input === "number" ? 1 : undefined}
                              maxLength={option.input === "text" ? 200 : undefined}
                              placeholder={
                                option.input === "text" ? option.label : undefined
                              }
                            />
                          )}
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {error && (
              <div
                role="alert"
                className="flex gap-2 rounded-xl border border-[#efd0d0] bg-[#fff7f7] p-3 text-[10px] leading-5 text-[#8d3f3f]"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {confirmDelete && (
              <div
                role="alert"
                className="rounded-xl border border-[#efd0d0] bg-[#fff7f7] p-4"
              >
                <p className="text-xs font-semibold text-[#8d3f3f]">
                  Удалить сегмент безвозвратно?
                </p>
                <p className="mt-1 text-[10px] leading-4 text-[#9c5a5a]">
                  Контакты не изменятся. Сам сегмент и его правила
                  будут удалены.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    ref={deleteCancelRef}
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={deleteSegment}
                    disabled={busy}
                    className="btn bg-[#b24343] text-white hover:bg-[#963838] disabled:opacity-60"
                  >
                    {busy ? "Удаляем…" : "Удалить"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-white px-5 py-4 sm:px-6">
            {segment && onDelete ? (
              <button
                type="button"
                onClick={askToDelete}
                disabled={busy || confirmDelete}
                className="btn btn-secondary gap-1.5 text-[#a44242] disabled:opacity-50"
              >
                <Trash2 size={13} />
                Удалить
              </button>
            ) : (
              <span />
            )}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="btn btn-secondary"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={busy || confirmDelete}
                className="btn btn-primary gap-1.5 disabled:opacity-60"
              >
                <Save size={13} />
                {busy
                  ? "Сохраняем…"
                  : segment
                    ? "Сохранить"
                    : "Создать"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
