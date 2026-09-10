// Russia's 11 current time zones, represented by IANA identifiers.
// Source: Federal Law 107-FZ, article 5.
export const russianTimeZones = [
  { value: "Europe/Kaliningrad", label: "Калининград · UTC+2" },
  { value: "Europe/Moscow", label: "Москва · UTC+3" },
  { value: "Europe/Samara", label: "Самара, Саратов · UTC+4" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург · UTC+5" },
  { value: "Asia/Omsk", label: "Омск · UTC+6" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск, Новосибирск · UTC+7" },
  { value: "Asia/Irkutsk", label: "Иркутск · UTC+8" },
  { value: "Asia/Yakutsk", label: "Якутск, Чита · UTC+9" },
  { value: "Asia/Vladivostok", label: "Владивосток · UTC+10" },
  { value: "Asia/Magadan", label: "Магадан, Сахалин · UTC+11" },
  { value: "Asia/Kamchatka", label: "Камчатка, Анадырь · UTC+12" },
];
export function validTimeZone(value: string | null | undefined): value is string {
  if (!value || value.length > 100) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}
export function zonedInputValue(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const p = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}
export function zonedInputToIso(value: string, timeZone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validTimeZone(timeZone)) return null;
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) return null;
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const displayed = Date.parse(`${zonedInputValue(new Date(instant).toISOString(), timeZone)}:00Z`);
    instant += target - displayed;
  }
  const iso = new Date(instant).toISOString();
  return zonedInputValue(iso, timeZone) === value ? iso : null;
}
