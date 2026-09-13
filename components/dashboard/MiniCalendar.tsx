"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { cn } from "@/components/ui/utils";
import { useCalendarTimeZone } from "@/lib/calendar-timezone";
import { calendarDayKey, calendarMonthDays, parseCalendarDate } from "@/lib/calendar/dates";
import type { CampaignRecord } from "@/types/api";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const weekdayNames = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

export function MiniCalendar({ campaigns }: { campaigns: Pick<CampaignRecord, "status" | "scheduledAt">[] }) {
  const { timeZone } = useCalendarTimeZone();
  const [now, setNow] = useState(() => new Date());
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  const today = calendarDayKey(now, timeZone);
  const current = parseCalendarDate(today)!;
  const month = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1, 12));
  const monthKey = month.toISOString().slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(month).replace(/\s*г\.$/, "");
  const days = calendarMonthDays(month);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const campaign of campaigns) {
      if (!campaign.scheduledAt || !["scheduled", "sending"].includes(campaign.status) || !Number.isFinite(Date.parse(campaign.scheduledAt))) continue;
      const key = calendarDayKey(campaign.scheduledAt, timeZone);
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  }, [campaigns, timeZone]);
  const total = [...counts].filter(([key]) => key.startsWith(monthKey)).reduce((sum, [, count]) => sum + count, 0);
  return <section aria-label="Мини-календарь рассылок" className="w-full max-w-[232px] min-w-0 rounded-xl border border-border bg-surface-subtle/60 p-2">
    <div className="flex items-center justify-between gap-1">
      <button type="button" aria-label="Предыдущий месяц" onClick={() => setOffset(value => value - 1)} className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft aria-hidden className="size-5" /></button>
      <Link href={`/calendar?date=${offset === 0 ? today : `${monthKey}-01`}`} aria-label={`Открыть календарь рассылок: ${monthLabel}`} className="min-w-0 rounded px-1 py-2 text-center text-xs font-semibold capitalize text-text-strong hover:text-primary"><span aria-live="polite">{monthLabel}</span></Link>
      <button type="button" aria-label="Следующий месяц" onClick={() => setOffset(value => value + 1)} className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ChevronRight aria-hidden className="size-5" /></button>
    </div>
    <table className="w-full table-fixed border-separate border-spacing-0 text-center text-xs" aria-label={monthLabel}>
      <thead><tr>{weekdays.map((day, index) => <th key={day} scope="col" aria-label={weekdayNames[index]} className="h-6 font-normal text-text-subtle">{day}</th>)}</tr></thead>
      <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(day => {
        const count = counts.get(day.key) ?? 0;
        const label = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parseCalendarDate(day.key)!);
        return <td key={day.key} className="p-0"><Link href={`/calendar?date=${day.key}`} aria-label={`${label}${count ? `, рассылок: ${count}` : ""}`} aria-current={day.key === today ? "date" : undefined} className={cn("relative mx-auto flex min-h-7 min-w-6 items-center justify-center rounded-md pb-0.5 tabular-nums hover:bg-primary-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", day.key === today ? "bg-primary font-semibold text-primary-foreground hover:bg-primary" : day.currentMonth ? "text-text-strong" : "text-text-subtle")}><span className={day.key === today ? "text-primary-foreground" : day.currentMonth ? "text-text-strong" : "text-text-subtle"}>{day.day}</span>{count > 0 && <span aria-hidden className={cn("absolute bottom-0.5 size-1 rounded-full", day.key === today ? "bg-white" : "bg-primary")} />}</Link></td>;
      })}</tr>)}</tbody>
    </table>
    <div className="mt-1 flex min-h-7 items-center justify-between gap-2 px-1 text-[10px] text-text-muted"><span>{total ? `Рассылок в месяце: ${total}` : "Нет рассылок"}</span><button type="button" className="shrink-0 rounded px-1 py-1 text-primary hover:underline" onClick={() => setOffset(0)}>Сегодня</button></div>
  </section>;
}
