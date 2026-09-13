/** Calendar dates are civil dates, independent of the browser's time zone. */
export function parseCalendarDate(value: string | null) {
  if (!value || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function calendarDayKey(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function calendarMonthDays(month: Date) {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 12));
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 12));
  return Array.from({ length: Math.ceil((offset + last.getUTCDate()) / 7) * 7 }, (_, index) => {
    const day = new Date(first);
    day.setUTCDate(index + 1 - offset);
    return { key: day.toISOString().slice(0, 10), day: day.getUTCDate(), currentMonth: day.getUTCMonth() === month.getUTCMonth() };
  });
}
