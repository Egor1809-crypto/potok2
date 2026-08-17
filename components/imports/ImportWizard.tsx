"use client";

import {
  MAX_TABLE_BYTES,
  mappingError,
  parseCsvFile,
  suggestMapping,
  targetFieldOptions,
  validateRows,
  type FieldMapping,
  type ParsedCsv,
  type RowIssue,
  type TargetField,
} from "@/components/imports/csv-import";
import {
  getExistingContactEndpoints,
  postContactsBatch,
  type ExistingContactEndpoints,
} from "@/components/imports/import-api";
import type { ContactCreateInput } from "@/types/api";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

const steps = ["Таблица", "Поля и проверка", "Импорт"];
const batchSize = 250;

type ImportRun = {
  status: "idle" | "importing" | "error" | "success";
  processed: number;
  created: number;
  skipped: number;
  updated: number;
  error: string | null;
};

const emptyImportRun: ImportRun = {
  status: "idle",
  processed: 0,
  created: 0,
  skipped: 0,
  updated: 0,
  error: null,
};

function emptyEndpoints(): ExistingContactEndpoints {
  return { emails: new Set(), phones: new Set(), telegramChatIds: new Set(), vkUserIds: new Set(), members: [] };
}

const issueLabels: Record<RowIssue, string> = {
  ready: "Готов",
  "column-count": "Сбита структура строки",
  "missing-endpoint": "Нет канала связи",
  "invalid-email": "Некорректный email",
  "duplicate-file": "Дубль в файле",
  "duplicate-existing": "Уже есть в базе",
  "missing-name": "Нет имени или фамилии",
  "invalid-status": "Неизвестный статус",
  "invalid-score": "Вовлечённость вне диапазона 0–100",
  "value-too-long": "Слишком длинное значение",
  "invalid-channel": "Проверьте идентификатор и согласие канала",
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} байт`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} КБ`;
  return `${(value / (1024 * 1024)).toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  })} МБ`;
}

function delimiterLabel(delimiter: ParsedCsv["delimiter"]): string {
  if (delimiter === ";") return "точка с запятой";
  if (delimiter === "\t") return "табуляция";
  return "запятая";
}

function tableFormatLabel(parsed: ParsedCsv): string {
  if (parsed.format === "XLSX" || parsed.format === "XLS") {
    if ((parsed.sheetNames?.length ?? 0) > 1) {
      return `${parsed.format} · листов: ${parsed.sheetNames?.length}`;
    }
    return `${parsed.format}${parsed.sheetName ? ` · лист «${parsed.sheetName}»` : ""}`;
  }
  return `${parsed.format} · ${parsed.encoding} · ${delimiterLabel(parsed.delimiter)}`;
}

function splitIntoBatches<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function downloadSampleCsv() {
  const rows = [
    [
      "Имя",
      "Фамилия",
      "Email",
      "Согласие Email",
      "Компания",
      "Категория",
      "Город",
      "Статус",
      "Вовлечённость",
      "Идентификатор чата Telegram",
      "Согласие Telegram",
      "Идентификатор пользователя ВКонтакте",
      "Согласие ВКонтакте",
      "Теги",
    ],
    [
      "Анна",
      "Петрова",
      "anna@example.ru",
      "да",
      "Альфа",
      "Клиент",
      "Москва",
      "Активен",
      "70",
      "",
      "нет",
      "",
      "нет",
      "клиент, приоритет",
    ],
  ];
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const content = rows.map((row) => row.map(escape).join(";")).join("\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mailflow-import-example.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>([]);
  const [existingEndpoints, setExistingEndpoints] =
    useState<ExistingContactEndpoints>(emptyEndpoints);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importRun, setImportRun] = useState<ImportRun>(emptyImportRun);
  const [emailConsentConfirmed, setEmailConsentConfirmed] = useState(false);
  const selectionRef = useRef(0);
  const importingRef = useRef(false);

  const mappingProblem = mappingError(mapping);
  const validation = useMemo(
    () =>
      parsed && !mappingProblem
        ? validateRows(parsed.rows, mapping, existingEndpoints, parsed.headers)
        : null,
    [existingEndpoints, mapping, mappingProblem, parsed],
  );

  const previewRows = useMemo(() => {
    if (!validation) return [];
    const invalid = validation.rows.filter((row) => row.issue !== "ready");
    const ready = validation.rows.filter((row) => row.issue === "ready");
    return [...invalid.slice(0, 6), ...ready.slice(0, 4)].slice(0, 8);
  }, [validation]);

  const chooseFile = async (selectedFile: File) => {
    const selectionId = selectionRef.current + 1;
    selectionRef.current = selectionId;
    setReading(true);
    setFileError(null);
    setFile(selectedFile);
    setParsed(null);
    setMapping([]);
    setImportRun(emptyImportRun);
    setEmailConsentConfirmed(false);

    try {
      const [csv, endpoints] = await Promise.all([
        parseCsvFile(selectedFile),
        getExistingContactEndpoints(),
      ]);
      if (selectionRef.current !== selectionId) return;
      setParsed(csv);
      setExistingEndpoints(endpoints);
      setMapping(suggestMapping(csv.headers));
      setStep(1);
    } catch (error) {
      if (selectionRef.current !== selectionId) return;
      setFileError(
        error instanceof Error
          ? error.message
          : "Не удалось прочитать таблицу.",
      );
      setParsed(null);
    } finally {
      if (selectionRef.current === selectionId) setReading(false);
    }
  };

  const reset = () => {
    selectionRef.current += 1;
    setStep(0);
    setFile(null);
    setParsed(null);
    setMapping([]);
    setExistingEndpoints(emptyEndpoints());
    setReading(false);
    setFileError(null);
    setImportRun(emptyImportRun);
    setEmailConsentConfirmed(false);
  };

  const changeMapping = (index: number, field: TargetField) => {
    setImportRun(emptyImportRun);
    setMapping((current) =>
      current.map((currentField, currentIndex) => {
        if (currentIndex === index) return field;
        if (field !== "ignore" && currentField === field) return "ignore";
        return currentField;
      }),
    );
  };

  const startImport = async () => {
    if (!validation || !file || importingRef.current) return;
    const hasMappedEmailConsent = mapping.includes("emailConsent");
    const importSheetTag = `Импорт: ${file.name.trim().slice(0, 140)}`;
    const contacts = validation.rows
      .map((row) => row.input)
      .filter((input): input is ContactCreateInput => input !== null)
      .map((input) => ({
        ...input,
        // Одна загрузка всегда получает собственный ярлык, чтобы её можно было
        // открыть отдельным листом в базе контактов.
        tags: Array.from(new Set([...(input.tags ?? []), importSheetTag])),
        emailConsent:
          Boolean(input.email) &&
          emailConsentConfirmed &&
          (!hasMappedEmailConsent || Boolean(input.emailConsent)),
      }));
    if (contacts.length === 0) return;

    const resumeAt = importRun.status === "error" ? importRun.processed : 0;
    let processed = resumeAt;
    let created = importRun.status === "error" ? importRun.created : 0;
    let skipped = importRun.status === "error" ? importRun.skipped : 0;
    let updated = importRun.status === "error" ? importRun.updated : 0;
    importingRef.current = true;
    setStep(2);
    setImportRun({
      status: "importing",
      processed,
      created,
      skipped,
      updated,
      error: null,
    });

    const remainingBatches = splitIntoBatches(
      contacts.slice(resumeAt),
      batchSize,
    );
    try {
      for (const batch of remainingBatches) {
        const result = await postContactsBatch(batch);
        processed += batch.length;
        created += result.createdCount;
        skipped += result.skippedCount;
        updated += result.updatedCount;
        setImportRun({
          status: "importing",
          processed,
          created,
          skipped,
          updated,
          error: null,
        });
      }
      setImportRun({
        status: "success",
        processed,
        created,
        skipped,
        updated,
        error: null,
      });
    } catch (error) {
      setImportRun({
        status: "error",
        processed,
        created,
        skipped,
        updated,
        error:
          error instanceof Error
            ? error.message
            : "Импорт остановлен из-за ошибки.",
      });
    } finally {
      importingRef.current = false;
    }
  };

  const readyCount = validation?.summary.ready ?? 0;
  const readyEmailCount =
    validation?.rows.filter((row) => row.input?.email).length ?? 0;
  const duplicateCount = validation
    ? validation.summary.duplicateExisting + validation.summary.duplicateFile
    : 0;
  const importProgress =
    readyCount > 0
      ? Math.min(100, Math.round((importRun.processed / readyCount) * 100))
      : 0;
  const hasMappedEmailConsent = mapping.includes("emailConsent");

  return (
    <div className="mx-auto max-w-[1040px] space-y-5">
      <header>
        <p className="section-eyebrow">Перенос данных</p>
        <h1 className="mt-2 text-[28px] font-medium tracking-[-.04em]">
          Импорт контактов
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-secondary)]">
          Загрузите CSV, TSV, XLSX или XLS, сверьте столбцы и импортируйте
          все корректные записи из таблицы.
        </p>
      </header>

      <nav className="card px-4 py-4 sm:px-6" aria-label="Ход импорта">
        <ol className="grid grid-cols-3 gap-2">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[9px] font-semibold sm:px-3 sm:text-[10px] ${
                index === step
                  ? "bg-primary-subtle text-primary"
                  : index < step
                    ? "text-[#3f805b]"
                    : "text-[var(--text-tertiary)]"
              }`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                  index < step
                    ? "border-[#59a676] bg-[#59a676] text-white"
                    : index === step
                      ? "border-primary bg-surface text-primary"
                      : "border-[var(--border-strong)] bg-white"
                }`}
              >
                {index < step ? <Check size={11} /> : index + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 && (
        <section className="card p-5 sm:p-8" aria-labelledby="upload-title">
          <div className="mx-auto max-w-[760px] text-center">
                <h2 id="upload-title" className="text-lg font-semibold">
                  Выберите таблицу с контактами
                </h2>
                <p className="mt-2 text-[10px] leading-5 text-[var(--text-tertiary)]">
                  Первая строка — заголовки. Нужны ФИО и хотя бы один канал:
                  адрес электронной почты, идентификатор чата Telegram или идентификатор пользователя ВКонтакте.
                  После импорта эта таблица появится в контактах отдельным листом с её названием.
                </p>
          </div>

          <label
            className={`mx-auto mt-6 flex max-w-[760px] cursor-pointer flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
              reading
                ? "cursor-wait border-primary/50 bg-primary-subtle/45"
                : "border-border-strong bg-surface hover:border-primary/60 hover:bg-primary-subtle/35"
            }`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const droppedFile = event.dataTransfer.files[0];
              if (droppedFile && !reading) void chooseFile(droppedFile);
            }}
          >
            <input
              type="file"
              className="sr-only"
              accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              disabled={reading}
              onChange={(event) => {
                const selectedFile = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (selectedFile) void chooseFile(selectedFile);
              }}
            />
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-subtle text-primary">
              {reading ? (
                <Loader2 size={21} className="animate-spin" />
              ) : (
                <UploadCloud size={21} />
              )}
            </span>
            <p className="mt-4 text-xs font-semibold">
              {reading ? "Читаем таблицу и сверяем базу…" : "Перетащите таблицу сюда"}
            </p>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
              {reading
                ? file?.name
                : `или нажмите, чтобы выбрать · CSV, TSV, XLSX или XLS · до ${Math.round(MAX_TABLE_BYTES / 1024 / 1024)} МБ`}
            </p>
          </label>

          <div aria-live="polite" aria-atomic="true">
            {fileError && (
              <div
                role="alert"
                className="mx-auto mt-4 flex max-w-[760px] gap-2 rounded-xl border border-[#efd0d0] bg-[#fff7f7] p-3 text-[10px] leading-5 text-[#8d3f3f]"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          <div className="mx-auto mt-5 grid max-w-[760px] gap-3 sm:grid-cols-3">
            {[
              ["Форматы", "CSV, TSV, XLSX и XLS"],
              ["Строки", "Все корректные строки"],
              ["Дубликаты", "Будут показаны и пропущены"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-[var(--surface-subtle)] p-3 text-left"
              >
                <p className="text-[9px] text-[var(--text-tertiary)]">{label}</p>
                <p className="mt-1 text-[10px] font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="btn btn-secondary mx-auto mt-5 gap-2"
          >
            <Download size={13} />
            Скачать пример CSV
          </button>
        </section>
      )}

      {step === 1 && parsed && file && (
        <>
          <section className="card overflow-hidden" aria-labelledby="mapping-title">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div>
                <h2 id="mapping-title" className="text-base font-semibold">
                  Сопоставьте столбцы
                </h2>
                <p className="mt-1 text-[10px] leading-4 text-[var(--text-tertiary)]">
                  Автоматическое сопоставление можно изменить перед импортом.
                </p>
              </div>
              <div className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2 text-[9px] leading-4 text-[var(--text-secondary)]">
                <span className="font-semibold">{file.name}</span>
                <br />
                {formatBytes(file.size)} · {tableFormatLabel(parsed)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="bg-[var(--surface-subtle)] text-[9px] uppercase tracking-[.06em] text-[var(--text-tertiary)]">
                    <th scope="col" className="px-5 py-3 sm:px-6">
                      Столбец таблицы
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Поле контакта
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Пример
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map((header, index) => {
                    const sample =
                      parsed.rows.find((row) => row.values[index]?.trim())?.values[
                        index
                      ] ?? "";
                    return (
                      <tr key={`${header}-${index}`} className="border-t border-[var(--border)]">
                        <th
                          scope="row"
                          className="px-5 py-3 text-[10px] font-semibold sm:px-6"
                        >
                          {header}
                        </th>
                        <td className="px-4 py-3">
                          <label>
                            <span className="sr-only">
                              Поле для столбца {header}
                            </span>
                            <select
                              value={mapping[index] ?? "ignore"}
                              onChange={(event) =>
                                changeMapping(
                                  index,
                                  event.target.value as TargetField,
                                )
                              }
                              className="input w-full max-w-60 bg-white"
                            >
                              {targetFieldOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </td>
                        <td
                          className="max-w-72 truncate px-4 py-3 text-[9px] text-[var(--text-tertiary)]"
                          title={sample}
                        >
                          {sample || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {mappingProblem && (
              <div
                role="alert"
                className="m-5 flex gap-2 rounded-xl border border-[#ecdcae] bg-[#fffaf0] p-3 text-[10px] leading-5 text-[#80652a] sm:mx-6"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{mappingProblem}</span>
              </div>
            )}
          </section>

          {validation && (
            <section className="card overflow-hidden" aria-labelledby="validation-title">
              <div className="border-b border-[var(--border)] p-5 sm:px-6">
                <h2 id="validation-title" className="text-base font-semibold">
                  Проверка перед импортом
                </h2>
                <p className="mt-1 text-[10px] leading-4 text-[var(--text-tertiary)]">
                  Дубликаты сравниваются по адресу электронной почты, идентификатору чата Telegram и идентификатору пользователя ВКонтакте.
                  Существующие контакты не изменятся и будут пропущены.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
                {[
                  [validation.summary.total, "Всего строк", "text-[var(--text-primary)]"],
                  [validation.summary.ready, "К импорту", "text-[#3f805b]"],
                  [duplicateCount, "Дубликаты", "text-[#7b65a5]"],
                  [validation.summary.invalidEmail, "Неверный email", "text-[#a94b43]"],
                  [validation.summary.missingEndpoint, "Без канала", "text-[#a36a2d]"],
                  [
                    validation.summary.missingName +
                      validation.summary.columnCount +
                      validation.summary.invalidStatus +
                      validation.summary.invalidScore +
                      validation.summary.valueTooLong +
                      validation.summary.invalidChannel,
                    "Другие ошибки",
                    "text-[#a36a2d]",
                  ],
                ].map(([value, label, tone]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[var(--border)] p-3"
                  >
                    <p className={`text-lg font-semibold ${tone}`}>
                      {Number(value).toLocaleString("ru-RU")}
                    </p>
                    <p className="mt-1 text-[9px] leading-4 text-[var(--text-tertiary)]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto border-t border-[var(--border)]">
                <table className="w-full min-w-[650px] text-left">
                  <caption className="px-5 py-3 text-left text-[10px] font-semibold sm:px-6">
                    Пример строк: сначала проблемные
                  </caption>
                  <thead>
                    <tr className="bg-[var(--surface-subtle)] text-[9px] uppercase tracking-[.06em] text-[var(--text-tertiary)]">
                      <th scope="col" className="px-5 py-3 sm:px-6">
                        Строка
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Контакт
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Канал
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Результат
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={`${row.sheetName ?? "table"}-${row.rowNumber}`} className="border-t border-[var(--border)]">
                        <td className="px-5 py-3 text-[9px] sm:px-6">
                          {row.sheetName ? `${row.sheetName} · ${row.rowNumber}` : row.rowNumber}
                        </td>
                        <td className="px-4 py-3 text-[10px] font-medium">
                          {row.displayName || "—"}
                        </td>
                        <td className="px-4 py-3 text-[9px] text-[var(--text-secondary)]">
                          {row.endpointLabel || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[8px] font-semibold ${
                              row.issue === "ready"
                                ? "bg-[#eaf8ef] text-[#3e7d58]"
                                : row.issue.startsWith("duplicate")
                                  ? "bg-[#f1edfa] text-[#765e9e]"
                                  : "bg-[#fff2ed] text-[#9a5144]"
                            }`}
                          >
                            {issueLabels[row.issue]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {readyEmailCount > 0 && (
              <div className="border-t border-[var(--border)] p-5 sm:px-6">
                <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                  <input
                    id="import-email-consent"
                    type="checkbox"
                    aria-describedby="import-email-consent-help"
                    checked={emailConsentConfirmed}
                    onChange={(event) => {
                      setEmailConsentConfirmed(event.target.checked);
                      setImportRun(emptyImportRun);
                    }}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span>
                    <label
                      htmlFor="import-email-consent"
                      className="block cursor-pointer text-[10px] font-semibold"
                    >
                      {hasMappedEmailConsent
                        ? "Подтверждаю достоверность email-согласий из таблицы"
                        : "У всех импортируемых контактов с email есть согласие на email-рассылку"}
                    </label>
                    <span
                      id="import-email-consent-help"
                      className="mt-1 block text-[9px] leading-4 text-[var(--text-tertiary)]"
                    >
                      {hasMappedEmailConsent
                        ? "Согласие будет записано только у строк со значением «да» или «1». Без подтверждения все контакты сохранятся без email-согласия."
                        : "Отмечайте только если согласие уже получено. Без отметки контакты сохранятся без email-согласия."}
                    </span>
                  </span>
                </div>
              </div>
              )}
            </section>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={reset} className="btn btn-secondary">
              Выбрать другую таблицу
            </button>
            <button
              type="button"
              onClick={() => void startImport()}
              disabled={!validation || readyCount === 0}
              className="btn btn-primary justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Импортировать {readyCount.toLocaleString("ru-RU")}
              <ArrowRight size={13} />
            </button>
          </div>
        </>
      )}

      {step === 2 && validation && (
        <section className="card p-5 sm:p-8" aria-labelledby="import-result-title">
          <div className="mx-auto max-w-[720px] text-center" aria-live="polite">
            <span
              className={`mx-auto grid size-14 place-items-center rounded-2xl ${
                importRun.status === "success"
                  ? "bg-[#eaf8ef] text-[#3f805b]"
                  : importRun.status === "error"
                    ? "bg-[#fff0ed] text-[#a94b43]"
                    : "bg-primary-subtle text-primary"
              }`}
            >
              {importRun.status === "importing" ? (
                <Loader2 size={23} className="animate-spin" />
              ) : importRun.status === "success" ? (
                <CheckCircle2 size={24} />
              ) : (
                <AlertTriangle size={23} />
              )}
            </span>
            <h2
              id="import-result-title"
              className="mt-4 text-xl font-semibold tracking-[-.025em]"
            >
              {importRun.status === "success"
                ? `Добавлено ${importRun.created.toLocaleString("ru-RU")} контактов`
                : importRun.status === "error"
                  ? "Импорт приостановлен"
                  : "Добавляем контакты…"}
            </h2>
            <p className="mt-2 text-[10px] leading-5 text-[var(--text-tertiary)]">
              {importRun.status === "success"
                ? "Сервер подтвердил запись всех пакетов. Исключённые строки не отправлялись."
                : importRun.status === "error"
                  ? importRun.error
                  : `Сохранено ${importRun.processed.toLocaleString("ru-RU")} из ${readyCount.toLocaleString("ru-RU")} подготовленных записей.`}
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-[720px]">
            <div
              role="progressbar"
              aria-label="Ход импорта контактов"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={importProgress}
              className="h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
            >
              <div
                className={`h-full rounded-full transition-[width] ${
                  importRun.status === "error" ? "bg-[#cf6658]" : "bg-primary"
                }`}
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-[var(--text-tertiary)]">
              <span>{importProgress}%</span>
              <span>
                {importRun.processed.toLocaleString("ru-RU")} /{" "}
                {readyCount.toLocaleString("ru-RU")}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [importRun.created, "Добавлено"],
                [importRun.skipped, "Пропущено сервером"],
                [duplicateCount, "Дубли до отправки"],
                [validation.summary.total - readyCount, "Всего исключено"],
              ].map(([value, label]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-[var(--border)] p-3 text-left"
                >
                  <p className="text-lg font-semibold">
                    {Number(value).toLocaleString("ru-RU")}
                  </p>
                  <p className="mt-1 text-[9px] leading-4 text-[var(--text-tertiary)]">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {readyEmailCount > 0 && (
            <p className="mt-3 text-left text-[9px] leading-4 text-[var(--text-tertiary)]">
              {emailConsentConfirmed
                ? hasMappedEmailConsent
                  ? "Email-согласие записано только для подтверждённых строк таблицы."
                  : "Email-согласие записано для созданных контактов с email."
                : "Контакты с email созданы без email-согласия."}
            </p>
            )}

            {importRun.status === "error" && (
              <div className="mt-5 rounded-xl border border-[#efd0d0] bg-[#fff7f7] p-4 text-left">
                <p className="text-[10px] leading-5 text-[#8d3f3f]">
                  Уже сохранённые контакты останутся в базе. Повтор начнётся с
                  первого необработанного пакета.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void startImport()}
                    className="btn btn-primary justify-center gap-1.5"
                  >
                    <RotateCcw size={12} />
                    Повторить оставшиеся
                  </button>
                  {importRun.processed === 0 && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="btn btn-secondary justify-center"
                    >
                      Вернуться к проверке
                    </button>
                  )}
                </div>
              </div>
            )}

            {importRun.status === "success" && (
              <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={reset}
                  className="btn btn-secondary justify-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  Другая таблица
                </button>
                <Link
                  href="/contacts"
                  className="btn btn-primary justify-center gap-1.5"
                >
                  <UsersRound size={13} />
                  Открыть контакты
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      <aside className="flex gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 text-[9px] leading-4 text-[var(--text-tertiary)]">
        <FileText size={14} className="mt-0.5 shrink-0" />
        <p>
          Email-согласие записывается только после явного подтверждения
          перед импортом. Для Telegram и ВКонтакте сопоставьте идентификатор и столбец
          согласия со значениями «да/нет» или «1/0».
        </p>
      </aside>
    </div>
  );
}
