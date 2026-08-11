"use client";

import { BRAND_NAME } from "@/config/brand";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Sheet,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const steps = ["Загрузка", "Сопоставление", "Проверка", "Готово"];
const mappings = [
  ["ФИО", "Полное имя", "Иван Петров"],
  ["Рабочая эл. почта", "Эл. почта", "ivan@lexbridge.example"],
  ["Компания", "Компания", "Лексбридж Лигал"],
  ["Должность", "Должность", "Старший партнёр"],
  ["Город", "Город", "Москва"],
  ["Категория", "Категория", "Юрист"],
];

export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState("юридическая_сеть_август.xlsx");
  const [validating, setValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sheetConnected, setSheetConnected] = useState(false);

  useEffect(() => {
    if (!validating) return;
    const timer = window.setInterval(
      () =>
        setProgress((current) => {
          if (current >= 100) {
            window.clearInterval(timer);
            setValidating(false);
            return 100;
          }
          return Math.min(100, current + 8);
        }),
      90,
    );
    return () => window.clearInterval(timer);
  }, [validating]);

  const next = () => {
    if (step === 1) {
      setStep(2);
      setProgress(0);
      setValidating(true);
    } else {
      setStep((current) => Math.min(3, current + 1));
    }
  };

  return (
    <div className="mx-auto max-w-[980px] space-y-6">
      <div>
        <p className="section-eyebrow">Перенесите данные</p>
        <h1 className="mt-2 text-[28px] font-medium tracking-[-.04em]">
          Импорт контактов
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          Добавьте контакты из таблицы и сопоставьте столбцы с полями рабочего
          пространства.
        </p>
      </div>

      <div className="card px-4 py-5 sm:px-8">
        <ol
          className="relative mx-auto flex max-w-[700px] items-start justify-between before:absolute before:left-[7%] before:right-[7%] before:top-4 before:h-px before:bg-[var(--border)]"
          aria-label="Ход импорта"
        >
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className="relative z-[1] flex w-24 flex-col items-center text-center"
            >
              <span
                className={`grid size-8 place-items-center rounded-full border text-[10px] font-semibold transition-colors ${
                  index < step
                    ? "border-[#625cf6] bg-[#625cf6] text-white"
                    : index === step
                      ? "border-[#625cf6] bg-white text-[#625cf6] shadow-[0_0_0_4px_rgba(98,92,246,.1)]"
                      : "border-[var(--border-strong)] bg-white text-[var(--text-tertiary)]"
                }`}
              >
                {index < step ? (
                  <>
                    <Check size={13} strokeWidth={3} />
                    <span className="sr-only">Готово</span>
                  </>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`mt-2 text-[9px] font-semibold ${
                  index <= step
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)]"
                }`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <section className="card min-h-[500px] overflow-hidden">
        {step === 0 && (
          <div className="p-5 sm:p-8">
            <div className="text-center">
              <h2 className="text-[18px] font-semibold tracking-[-.025em]">
                Загрузите файл с контактами
              </h2>
              <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                Перед добавлением данных мы покажем их предварительный просмотр.
              </p>
            </div>
            <label className="mx-auto mt-7 flex max-w-[720px] cursor-pointer flex-col items-center rounded-2xl border border-dashed border-[#cfd0db] bg-[#fafafd] px-6 py-12 text-center transition-colors hover:border-[#8a84f8] hover:bg-[#f8f7ff]">
              <input
                type="file"
                className="sr-only"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0];
                  if (selectedFile) setFile(selectedFile.name);
                }}
              />
              <span className="grid size-12 place-items-center rounded-2xl bg-[#eeedff] text-[#625cf6]">
                <UploadCloud size={21} />
              </span>
              <p className="mt-4 text-[12px] font-semibold">
                Перетащите сюда файл CSV или XLSX
              </p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                или нажмите, чтобы выбрать · до 25 МБ
              </p>
              {file && (
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#dcddf5] bg-white px-4 py-3 text-left shadow-sm">
                  <span className="grid size-8 place-items-center rounded-lg bg-[#edf8f1] text-[#3e8d5c]">
                    <FileSpreadsheet size={15} />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold">{file}</p>
                    <p className="mt-0.5 text-[8px] text-[var(--text-tertiary)]">
                      4 821 строка · 1,8 МБ
                    </p>
                  </div>
                  <CheckCircle2 size={15} className="ml-4 text-[#3e8d5c]" />
                </div>
              )}
            </label>
            <div className="mx-auto mt-5 flex max-w-[720px] items-center gap-3 text-[9px] uppercase tracking-[.08em] text-[var(--text-tertiary)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
              или импортируйте из
            </div>
            <button
              onClick={() => {
                setSheetConnected(true);
                setFile("Юридическая сеть · Google Таблицы");
              }}
              className="mx-auto mt-5 flex w-full max-w-[720px] items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white py-3 text-[11px] font-semibold hover:bg-[var(--surface-subtle)]"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-[#eaf8ef] text-[#2d9a58]">
                <Sheet size={14} />
              </span>
              {sheetConnected
                ? "Google Таблицы подключены"
                : "Подключить Google Таблицы"}
              {sheetConnected && (
                <CheckCircle2 size={14} className="text-[#3e8d5c]" />
              )}
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="border-b border-[var(--border)] px-5 py-5 sm:px-8">
              <h2 className="text-[18px] font-semibold tracking-[-.025em]">
                Сопоставьте столбцы
              </h2>
              <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">
                Укажите, какому полю соответствует каждый столбец. {BRAND_NAME}
                автоматически сопоставил шесть полей.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead>
                  <tr className="bg-[var(--surface-subtle)] text-[9px] font-semibold uppercase tracking-[.07em] text-[var(--text-tertiary)]">
                    <th className="px-6 py-3">Столбец в файле</th>
                    <th className="px-4 py-3">Поле контакта</th>
                    <th className="px-4 py-3">Пример значения</th>
                    <th className="px-4 py-3">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(([source, target, example]) => (
                    <tr key={source} className="border-t border-[var(--border)]">
                      <td className="px-6 py-3.5 text-[10px] font-semibold">
                        {source}
                      </td>
                      <td className="px-4 py-3.5">
                        <button className="flex w-full max-w-[210px] items-center justify-between rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[10px] font-medium">
                          {target}
                          <ChevronDown
                            size={12}
                            className="text-[var(--text-tertiary)]"
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-[9px] text-[var(--text-tertiary)]">
                        {example}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="badge badge-success">
                          <Check size={9} />
                          Сопоставлено
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mx-5 my-5 rounded-xl border border-[#dbe9f7] bg-[#f4f9fe] p-4 text-[10px] leading-5 text-[#4d6d88] sm:mx-8">
              <strong className="font-semibold text-[#315c7d]">
                Обработка дубликатов:
              </strong>{" "}
              существующие контакты будут обновлены при совпадении адреса
              электронной почты.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-5 sm:p-8">
            <div className="text-center" aria-live="polite">
              <span
                className={`mx-auto grid size-12 place-items-center rounded-2xl ${
                  validating
                    ? "bg-[#eeedff] text-[#625cf6]"
                    : "bg-[#eaf8ef] text-[#3e8d5c]"
                }`}
              >
                {validating ? (
                  <Loader2 size={21} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={22} />
                )}
              </span>
              <h2 className="mt-4 text-[18px] font-semibold tracking-[-.025em]">
                {validating ? "Проверяем данные…" : "Всё готово к импорту"}
              </h2>
              <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                {validating
                  ? "Проверяем адреса, дубликаты и обязательные поля."
                  : "Найден 4 701 корректный контакт. Проверьте исключения ниже."}
              </p>
            </div>
            <div className="mx-auto mt-7 max-w-[680px]">
              <div
                role="progressbar"
                aria-label="Ход проверки контактов"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
              >
                <div
                  className="h-full rounded-full bg-[#625cf6] transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-[var(--text-tertiary)]">
                <span>Проверено: {progress}%</span>
                <span>4 821 запись</span>
              </div>

              {progress === 100 && (
                <>
                  <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["4 701", "К импорту", "success"],
                      ["78", "Дубликаты", "info"],
                      ["32", "Некорректный адрес", "danger"],
                      ["10", "Без эл. почты", "warning"],
                    ].map(([value, label, tone]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-[var(--border)] p-4"
                      >
                        <p className="text-[20px] font-semibold tracking-[-.035em]">
                          {value}
                        </p>
                        <p className="mt-1 text-[9px] text-[var(--text-tertiary)]">
                          {label}
                        </p>
                        <span className={`badge badge-${tone} mt-3 inline-flex`}>
                          {tone === "success" ? (
                            <Check size={9} />
                          ) : (
                            <AlertTriangle size={9} />
                          )}
                          {tone === "success" ? "Импортировать" : "Проверить"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)]">
                    <div className="flex items-center justify-between bg-[var(--surface-subtle)] px-4 py-3">
                      <p className="text-[10px] font-semibold">
                        Предпросмотр исключений
                      </p>
                      <button className="text-[9px] font-semibold text-[#625cf6]">
                        Скачать отчёт
                      </button>
                    </div>
                    {[
                      [
                        "alexey@lexbridge",
                        "Некорректный формат адреса электронной почты",
                      ],
                      ["anna@prism.example", "Дубликат существующего контакта"],
                      ["Строка 4 776", "Не указан адрес электронной почты"],
                    ].map((row) => (
                      <div
                        key={row[0]}
                        className="flex justify-between border-t border-[var(--border)] px-4 py-3 text-[9px]"
                      >
                        <span className="font-medium">{row[0]}</span>
                        <span className="text-[var(--text-tertiary)]">
                          {row[1]}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-[#eaf8ef] text-[#3e8d5c] shadow-[0_0_0_7px_rgba(69,163,108,.08)]">
              <Check size={28} strokeWidth={2.5} />
            </span>
            <p className="section-eyebrow mt-7">Импорт завершён</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-.04em]">
              4 701 контакт готов к работе
            </h2>
            <p className="mt-3 max-w-md text-[11px] leading-5 text-[var(--text-tertiary)]">
              Новые контакты добавлены в рабочее пространство «Юридическая
              команда». Ещё 78 существующих записей безопасно обновлены.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <Link href="/contacts" className="btn btn-secondary gap-2">
                Открыть контакты
                <ArrowRight size={13} />
              </Link>
              <Link
                href="/campaigns/new?source=import&count=4701"
                className="btn btn-primary gap-2"
              >
                Создать кампанию
                <ArrowRight size={13} />
              </Link>
            </div>
            <button
              onClick={() => {
                setStep(0);
                setFile("");
                setProgress(0);
              }}
              className="mt-5 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-tertiary)]"
            >
              <RotateCcw size={12} />
              Импортировать другой файл
            </button>
          </div>
        )}
      </section>

      {step < 3 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
            className="btn btn-secondary gap-2"
          >
            <ArrowLeft size={13} />
            Назад
          </button>
          <button
            onClick={next}
            disabled={
              (step === 0 && !file) ||
              (step === 2 && (validating || progress < 100))
            }
            className="btn btn-primary gap-2"
          >
            {step === 2 ? "Импортировать 4 701 контакт" : "Продолжить"}
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
