"use client";

import * as React from "react";
import ui from "@/components/shared/workflow.module.css";
import styles from "./calendar.module.css";
import Link from "next/link";
import { RefreshCw } from "@/components/ui/icons";
import { Badge, Button, Input, buttonVariants } from "@/components/ui";
import { reportLabels, type CalendarReport as Report, type ReportState } from "@/lib/calendar/report";

export function CalendarReport({ report, timeZone, refresh, loading }: {
  report: Report | undefined; timeZone: string; refresh: () => void; loading: boolean;
}) {
  const [filter, setFilter] = React.useState<ReportState | "">("");
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(20);
  const format = (value: string) => new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone,
  }).format(new Date(value));
  if (!report) return <section className="card p-5" aria-label="Отчёт за 24 часа"><p role="status">Загружаем историю отправок…</p></section>;
  const search = query.trim().toLocaleLowerCase("ru");
  const rows = report.rows.filter(row => (!filter || row.state === filter) && (!search || `${row.name} ${row.subject} ${row.sender} ${row.reason}`.toLocaleLowerCase("ru").includes(search)));
  const variant = (state: ReportState) => state === "sent" ? "success" as const : state === "not_sent" ? "danger" as const : state === "partial" ? "warning" as const : "neutral" as const;
  return <section className="space-y-5" aria-labelledby="calendar-report-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="calendar-report-title" className="text-lg font-semibold text-text-strong">История за последние 24 часа</h2><p className="mt-1 text-sm text-text-muted">{format(report.from)} — {format(report.to)}</p></div>
      <Button variant="outline" loading={loading} onClick={refresh}><RefreshCw className="size-6" aria-hidden="true"/>Обновить отчёт</Button>
    </div>
    <p className="text-sm leading-6 text-text-muted">Рассылки, срок которых наступил за этот период, а также запущенные, заблокированные и отменённые рассылки. Показатели отражают их текущее состояние и обновляются каждые 30 секунд. Передача провайдеру ещё не означает доставку получателю.</p>
    <div className={styles.reportFilters}>
      {(Object.entries(reportLabels) as [ReportState, string][]).map(([state, label]) => <button key={state} type="button" aria-pressed={filter === state} data-tone={variant(state)} onClick={() => { setFilter(filter === state ? "" : state); setLimit(20); }} className={`${ui.metric} ${styles.reportFilter}`}><span className={ui.value}>{report.counts[state]}</span><span className="text-sm text-text-muted">{label}</span></button>)}
    </div>
    <div className="flex flex-wrap items-center gap-3"><Input className="min-w-0 flex-1 sm:max-w-md" aria-label="Поиск в отчёте" placeholder="Название, тема, отправитель или причина" value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }}/><Button variant="ghost" onClick={() => { setFilter(""); setQuery(""); setLimit(20); }}>Показать все</Button><span className="text-sm text-text-muted" role="status">Рассылок: {rows.length} из {report.rows.length}</span></div>
    {!rows.length ? <div className="card p-5 text-sm text-text-muted">{report.rows.length ? "Нет рассылок по выбранным условиям. Сбросьте фильтр или измените запрос." : "За последние 24 часа отправок, остановок и рассылок с наступившим сроком не было."}</div> : null}
    <div className="space-y-3">{rows.slice(0, limit).map(row => <article key={row.id} className={ui.record} data-tone={variant(row.state)}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><time dateTime={row.activityAt} className="text-xs tabular-nums text-text-muted">{format(row.activityAt)}</time><h3 className="mt-1 break-words font-semibold text-text-strong">{row.name}</h3><p className="mt-1 break-words text-sm text-text-muted">{row.subject || "Тема не указана"}</p></div><Badge variant={variant(row.state)}>{row.label}</Badge></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Получателей", row.recipients], ["Передано провайдеру", row.sent], ["Доставлено", row.delivered], ["Ошибки", row.errors]].map(([label, value]) => <div key={label}><dt className="text-xs text-text-muted">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl>
      <p className="mt-4 break-words rounded-lg bg-surface-subtle p-3 text-sm leading-6 text-text-muted">{row.reason}</p>
      <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-primary">Сведения об отправке</summary><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-text-muted">Плановое время</dt><dd>{row.scheduledAt ? format(row.scheduledAt) : "Без расписания"}</dd></div><div><dt className="text-text-muted">Передано провайдеру</dt><dd>{row.sentAt ? format(row.sentAt) : "Не зафиксировано"}</dd></div><div><dt className="text-text-muted">Отправитель</dt><dd className="break-words">{row.sender || "Не указан"}</dd></div><div><dt className="text-text-muted">Неопределённых результатов / ручных отправок</dt><dd>{row.uncertain} / {row.manual}</dd></div></dl></details>
      <Link href={`/campaigns/${row.id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })} aria-label={`Открыть рассылку «${row.name}»`}>Открыть рассылку</Link>
    </article>)}</div>
    {rows.length > limit ? <Button variant="outline" onClick={() => setLimit(value => value + 20)}>Показать ещё {Math.min(20, rows.length - limit)}</Button> : null}
  </section>;
}
