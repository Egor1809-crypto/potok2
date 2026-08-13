"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  Info,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { postContactsBatch } from "@/components/imports/import-api";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Textarea,
  buttonVariants,
  cn,
} from "@/components/ui";
import type { ContactCreateInput } from "@/types/api";
import type {
  ContactFinderCandidate,
  ContactFinderMode,
  ContactFinderResponse,
} from "@/types/contact-finder";

type ImportState = {
  status: "idle" | "importing" | "success" | "error";
  message: string;
};

const emptyImportState: ImportState = { status: "idle", message: "" };

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; details?: string[] })
    | null;
  if (!response.ok) {
    throw new Error(
      [payload?.error, payload?.details?.join(" ")].filter(Boolean).join(" ") ||
        `Сервер вернул ошибку ${response.status}.`,
    );
  }
  if (!payload) throw new Error("Сервер вернул пустой ответ.");
  return payload;
}

function endpointHost(candidate: ContactFinderCandidate): string {
  if (candidate.sourceUrl) {
    try {
      return new URL(candidate.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      // Fall back to the email domain below.
    }
  }
  return candidate.type === "email" ? candidate.value.split("@")[1] ?? "" : "";
}

function sourceKey(candidate: ContactFinderCandidate): string {
  if (candidate.sourceUrl) {
    try {
      return new URL(candidate.sourceUrl).origin;
    } catch {
      // Use the visible source label below.
    }
  }
  return candidate.sourceLabel || "Вставленный текст";
}

function splitName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Найденный", lastName: "контакт" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "контакт" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function contactInputs(
  candidates: ContactFinderCandidate[],
  names: Record<string, string>,
): ContactCreateInput[] {
  const grouped = new Map<string, ContactCreateInput[]>();
  for (const candidate of candidates) {
    const displayName = names[candidate.id] ?? candidate.suggestedName;
    const { firstName, lastName } = splitName(displayName);
    const host = endpointHost(candidate);
    const key = `${sourceKey(candidate)}:${displayName.trim().toLocaleLowerCase("ru-RU")}`;
    const values = grouped.get(key) ?? [];
    let contact = values.find((item) =>
      candidate.type === "email" ? !item.email : !item.phone,
    );
    if (!contact) {
      contact = {
        firstName,
        lastName,
        category: "Лид",
        tags: ["Поиск контактов", ...(host ? [`Источник: ${host}`] : [])],
        companyName: host,
        emailConsent: false,
        status: "active",
      };
      values.push(contact);
      grouped.set(key, values);
    }
    if (candidate.type === "email") contact.email = candidate.value;
    else contact.phone = candidate.value;
    if (!contact.companyName && host) contact.companyName = host;
    if (host && !contact.tags?.includes(`Источник: ${host}`)) {
      contact.tags = [...(contact.tags ?? []), `Источник: ${host}`];
    }
  }
  return [...grouped.values()].flat();
}

function plural(count: number, forms: [string, string, string]): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const form = mod100 >= 11 && mod100 <= 14
    ? forms[2]
    : mod10 === 1
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4
        ? forms[1]
        : forms[2];
  return `${count} ${form}`;
}

export function ContactFinderView() {
  const [mode, setMode] = useState<ContactFinderMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [includeSameSitePages, setIncludeSameSitePages] = useState(true);
  const [responsibleUse, setResponsibleUse] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContactFinderResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [importState, setImportState] = useState<ImportState>(emptyImportState);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const selectedCandidates = useMemo(
    () => result?.candidates.filter((candidate) => selected.has(candidate.id)) ?? [],
    [result, selected],
  );

  const canAnalyze =
    responsibleUse && (mode === "url" ? url.trim().length > 0 : text.trim().length >= 3);

  const clearResults = () => {
    setError(null);
    setResult(null);
    setSelected(new Set());
    setNames({});
    setImportConfirmed(false);
    setImportState(emptyImportState);
  };

  const chooseMode = (nextMode: ContactFinderMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    clearResults();
    window.requestAnimationFrame(() => {
      document.getElementById(`contact-finder-tab-${nextMode}`)?.focus();
    });
  };

  useEffect(() => {
    if (!result) return;
    const frame = window.requestAnimationFrame(() => resultHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [result]);

  const analyze = async () => {
    if (!canAnalyze || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setNames({});
    setImportConfirmed(false);
    setImportState(emptyImportState);
    try {
      const response = await fetch("/api/contact-finder", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "url"
            ? { mode, url, includeSameSitePages, acknowledgedResponsibleUse: true }
            : { mode, text, acknowledgedResponsibleUse: true },
        ),
      });
      const payload = await readResponse<ContactFinderResponse>(response);
      setResult(payload);
      setNames(
        Object.fromEntries(
          payload.candidates.map((candidate) => [candidate.id, candidate.suggestedName]),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось выполнить анализ.",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleCandidate = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setImportConfirmed(false);
    setImportState(emptyImportState);
  };

  const toggleAll = (checked: boolean) => {
    setSelected(
      checked && result ? new Set(result.candidates.map((candidate) => candidate.id)) : new Set(),
    );
    setImportConfirmed(false);
    setImportState(emptyImportState);
  };

  const importSelected = async () => {
    if (!importConfirmed || selectedCandidates.length === 0) return;
    setImportState({ status: "importing", message: "" });
    const contacts = contactInputs(selectedCandidates, names);
    try {
      const response = await postContactsBatch(contacts);
      setImportState({
        status: "success",
        message: `Добавлено: ${response.createdCount}. Пропущено как дубликаты: ${response.skippedCount}.`,
      });
    } catch (requestError) {
      setImportState({
        status: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Не удалось добавить выбранные контакты.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Контакты → проверка → база"
        title="Поиск публичных контактов"
        description="Найдите деловые email и телефоны на указанном сайте или в тексте. MAILFLOW показывает источник каждого результата и ничего не сохраняет без вашего выбора."
        action={
          <Link href="/contacts" className={buttonVariants({ variant: "outline" })}>
            <UsersRound aria-hidden="true" className="size-4" />
            Открыть контакты
          </Link>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {[
          [Globe2, "1. Укажите источник", "HTTPS-страница или вставленный текст"],
          [ShieldCheck, "2. Проверьте находки", "Источник, контекст и тип контакта"],
          [UsersRound, "3. Выберите для импорта", "Только отмеченные записи попадут в базу"],
        ].map(([Icon, title, description]) => {
          const StepIcon = Icon as typeof Globe2;
          return (
            <Card key={String(title)} className="flex items-start gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-subtle text-primary">
                <StepIcon aria-hidden="true" className="size-4" />
              </span>
              <div>
                <p className="m-0 text-[13px] font-semibold text-text-strong">{String(title)}</p>
                <p className="mt-1 mb-0 text-[12px] leading-4 text-text-muted">{String(description)}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-5 sm:p-6">
            <div className="inline-flex rounded-[10px] bg-surface-subtle p-1" role="tablist" aria-label="Источник поиска">
              <button
                id="contact-finder-tab-url"
                type="button"
                role="tab"
                aria-selected={mode === "url"}
                aria-controls="contact-finder-source-panel"
                tabIndex={mode === "url" ? 0 : -1}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-[8px] px-3 text-[12px] font-semibold transition-colors",
                  mode === "url" ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text-strong",
                )}
                onClick={() => chooseMode("url")}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    chooseMode("text");
                  }
                }}
              >
                <Globe2 aria-hidden="true" className="size-3.5" /> Сайт
              </button>
              <button
                id="contact-finder-tab-text"
                type="button"
                role="tab"
                aria-selected={mode === "text"}
                aria-controls="contact-finder-source-panel"
                tabIndex={mode === "text" ? 0 : -1}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-[8px] px-3 text-[12px] font-semibold transition-colors",
                  mode === "text" ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text-strong",
                )}
                onClick={() => chooseMode("text")}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    chooseMode("url");
                  }
                }}
              >
                <FileText aria-hidden="true" className="size-3.5" /> Текст
              </button>
            </div>
          </div>

          <div
            id="contact-finder-source-panel"
            role="tabpanel"
            aria-labelledby={`contact-finder-tab-${mode}`}
            className="space-y-5 p-5 sm:p-6"
          >
            {mode === "url" ? (
              <>
                <FormField
                  label="HTTPS-адрес страницы"
                  htmlFor="contact-finder-url"
                  hint="Например, https://company.ru/contacts"
                  required
                >
                  <Input
                    id="contact-finder-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://company.ru/contacts"
                    value={url}
                    onChange={(event) => {
                      setUrl(event.target.value);
                      clearResults();
                    }}
                    onBlur={() => {
                      const trimmed = url.trim();
                      if (trimmed && !trimmed.includes("://")) setUrl(`https://${trimmed}`);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void analyze();
                    }}
                  />
                </FormField>
                <Checkbox
                  checked={includeSameSitePages}
                  onChange={(event) => {
                    setIncludeSameSitePages(event.target.checked);
                    clearResults();
                  }}
                  label={
                    <span>
                      Проверить до 5 страниц этого сайта всего
                      <span className="block text-[11px] text-text-muted">Исходная страница и до четырёх связанных: «Контакты», «О компании» или «Поддержка», с учётом robots.txt.</span>
                    </span>
                  }
                />
              </>
            ) : (
              <FormField
                label="Текст для анализа"
                htmlFor="contact-finder-text"
                hint={`${text.length.toLocaleString("ru-RU")} из 100 000 символов`}
                required
              >
                <Textarea
                  id="contact-finder-text"
                  className="min-h-40 resize-y"
                  maxLength={100_000}
                  placeholder="Вставьте подпись письма, страницу контактов или другой текст…"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    clearResults();
                  }}
                />
              </FormField>
            )}

            <div className="rounded-[11px] border border-border bg-surface-subtle p-4">
              <Checkbox
                checked={responsibleUse}
                onChange={(event) => setResponsibleUse(event.target.checked)}
                label="Я использую только открытые деловые контакты и самостоятельно проверю законное основание перед коммуникацией."
              />
            </div>

            {error ? <Alert tone="danger" title="Анализ не выполнен">{error}</Alert> : null}

            <Button
              size="lg"
              loading={loading}
              loadingText="Проверяем источник…"
              disabled={!canAnalyze}
              leadingIcon={<Search aria-hidden="true" className="size-4" />}
              onClick={() => void analyze()}
            >
              Найти публичные контакты
            </Button>
          </div>
        </Card>

        <Card className="h-fit p-5 sm:p-6">
          <div className="flex items-center gap-2 text-text-strong">
            <ShieldCheck aria-hidden="true" className="size-4 text-success" />
            <h2 className="m-0 text-[14px] font-semibold">Без скрытого сбора</h2>
          </div>
          <ul className="mt-4 mb-0 space-y-3 pl-0 text-[12px] leading-5 text-text-muted">
            {[
              "Только указанный HTTPS-сайт или вставленный текст.",
              "До пяти релевантных страниц на том же домене.",
              "robots.txt и запреты сайта учитываются.",
              "Результаты не сохраняются до явного импорта.",
              "Согласие на email-рассылку не назначается автоматически.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Alert tone="info" className="mt-5" title="Важно">
            Наличие адреса в открытом доступе не означает согласие на маркетинговую рассылку.
          </Alert>
        </Card>
      </div>

      {result ? (
        <section className="space-y-4" aria-labelledby="contact-finder-results">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2
                  ref={resultHeadingRef}
                  id="contact-finder-results"
                  tabIndex={-1}
                  className="m-0 text-[20px] font-semibold tracking-[-0.025em] text-text-strong outline-none"
                >
                  Результаты проверки
                </h2>
                <Badge variant="accent">{result.candidates.length}</Badge>
              </div>
              <p className="m-0 text-[12px] text-text-muted">
                {plural(result.summary.emailCount, ["email", "email", "email"])} · {plural(result.summary.phoneCount, ["телефон", "телефона", "телефонов"])} · {plural(result.summary.scannedPageCount, ["страница", "страницы", "страниц"])}
              </p>
              <p className="sr-only" role="status" aria-live="polite">
                Анализ завершён. Найдено {plural(result.candidates.length, ["результат", "результата", "результатов"])}.
              </p>
            </div>
            {result.candidates.length > 0 ? (
              <Checkbox
                checked={selected.size === result.candidates.length}
                indeterminate={selected.size > 0 && selected.size < result.candidates.length}
                onChange={(event) => toggleAll(event.target.checked)}
                label="Выбрать все результаты"
              />
            ) : null}
          </div>

          {result.candidates.length === 0 ? (
            <Card className="grid min-h-52 place-items-center p-8 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-surface-subtle text-text-muted">
                  <Search aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-4 mb-0 text-[16px] font-semibold text-text-strong">Публичные контакты не найдены</h3>
                <p className="mt-2 mb-0 text-[13px] leading-5 text-text-muted">
                  Попробуйте страницу «Контакты» или вставьте текст вручную. MAILFLOW не подбирает и не угадывает адреса.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3">
              {result.candidates.map((candidate) => {
                const checked = selected.has(candidate.id);
                const EndpointIcon = candidate.type === "email" ? Mail : Phone;
                return (
                  <Card
                    key={candidate.id}
                    className={cn(
                      "grid gap-4 p-4 transition-[border-color,box-shadow] md:grid-cols-[auto_minmax(220px,0.8fr)_minmax(260px,1.2fr)] md:items-start",
                      checked && "border-primary/35 shadow-[0_0_0_1px_rgba(101,88,232,0.12)]",
                    )}
                  >
                    <Checkbox
                      aria-label={`Выбрать ${candidate.value}`}
                      checked={checked}
                      onChange={(event) => toggleCandidate(candidate.id, event.target.checked)}
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary-subtle text-primary">
                          <EndpointIcon aria-hidden="true" className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 truncate text-[13px] font-semibold text-text-strong">{candidate.value}</p>
                          <p className="mt-0.5 mb-0 text-[11px] text-text-muted">
                            {candidate.type === "email" ? "Email" : "Телефон"} · {candidate.confidence === "high" ? "прямая ссылка" : "найден в тексте"}
                          </p>
                        </div>
                      </div>
                      <FormField className="mt-3" label="Имя в базе" htmlFor={`candidate-name-${candidate.id}`}>
                        <Input
                          id={`candidate-name-${candidate.id}`}
                          value={names[candidate.id] ?? candidate.suggestedName}
                          onChange={(event) => {
                            setNames((current) => ({ ...current, [candidate.id]: event.target.value }));
                            setImportConfirmed(false);
                            setImportState(emptyImportState);
                          }}
                        />
                      </FormField>
                    </div>
                    <div className="min-w-0 rounded-[9px] bg-surface-subtle p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-text-strong">{candidate.sourceLabel}</span>
                        {candidate.sourceUrl ? (
                          <a
                            href={candidate.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                          >
                            Источник <ExternalLink aria-hidden="true" className="size-3" />
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-2 mb-0 line-clamp-3 text-[11px] leading-4 text-text-muted">
                        {candidate.context || "Контекст рядом с контактом отсутствует."}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {result.pages.length > 0 ? (
            <details className="rounded-[11px] border border-border bg-surface px-4 py-3">
              <summary className="cursor-pointer text-[12px] font-semibold text-text-strong">
                Отчёт по страницам ({result.pages.length})
              </summary>
              <div className="mt-3 divide-y divide-border">
                {result.pages.map((page) => (
                  <div key={page.url} className="flex flex-col gap-1 py-2 text-[11px] sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 truncate text-text-muted">{page.url}</span>
                    <span className={page.status === "scanned" ? "text-success" : "text-warning"}>
                      {page.status === "scanned" ? `Проверено · найдено ${page.foundCount}` : `Пропущено · ${page.reason}`}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {selectedCandidates.length > 0 ? (
            <Card className="overflow-hidden border-primary/20">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2">
                    <Sparkles aria-hidden="true" className="size-4 text-primary" />
                    <h3 className="m-0 text-[15px] font-semibold text-text-strong">
                      Добавить выбранные: {selectedCandidates.length}
                    </h3>
                  </div>
                  <p className="mt-2 mb-0 text-[12px] leading-5 text-text-muted">
                    Записи получат категорию «Лид» и тег источника. Для email согласие останется выключенным — его можно отметить позже в карточке контакта при наличии основания.
                  </p>
                  <Checkbox
                    className="mt-4"
                    checked={importConfirmed}
                    onChange={(event) => setImportConfirmed(event.target.checked)}
                    label="Я проверил выбранные данные и хочу сохранить их в рабочей базе."
                  />
                </div>
                <Button
                  className="shrink-0"
                  loading={importState.status === "importing"}
                  loadingText="Добавляем…"
                  disabled={!importConfirmed || importState.status === "success"}
                  trailingIcon={<ArrowRight aria-hidden="true" className="size-4" />}
                  onClick={() => void importSelected()}
                >
                  Добавить выбранные в контакты
                </Button>
              </div>
              {importState.status === "success" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-success/15 bg-success-subtle px-5 py-3 text-[12px] sm:px-6">
                  <span className="inline-flex items-center gap-2 text-success" role="status" aria-live="polite">
                    <CheckCircle2 aria-hidden="true" className="size-4" /> {importState.message}
                  </span>
                  <Link href="/contacts" className="font-semibold text-primary hover:underline">Перейти к контактам</Link>
                </div>
              ) : importState.status === "error" ? (
                <div className="border-t border-danger/15 bg-danger-subtle px-5 py-3 text-[12px] text-danger sm:px-6" role="alert">
                  {importState.message}
                </div>
              ) : null}
            </Card>
          ) : (
            result.candidates.length > 0 && (
              <Alert tone="info" icon={<Info aria-hidden="true" className="size-4" />} title="Выберите нужные записи">
                Ничего не импортируется автоматически. Отметьте контакты, которые хотите сохранить.
              </Alert>
            )
          )}
        </section>
      ) : null}
    </div>
  );
}
