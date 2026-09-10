"use client";

import * as React from "react";
import { CalendarReport } from "./CalendarReport";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter, Plus, X } from "lucide-react";

import { getCampaignChannelDefinition } from "@/components/campaigns/campaignChannels";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, Badge, Button, Input, Select, buttonVariants, cn } from "@/components/ui";
import { describeTimeZone, useBrowserTimeZone } from "@/lib/client-timezone";
import type { CampaignRecord, WorkspaceSnapshot } from "@/types/api";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function startOfGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayIndex);
  return first;
}

function formatMonth(month: Date) {
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(month);
  return label.charAt(0).toLocaleUpperCase("ru") + label.slice(1);
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

function dateKeyInTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function audienceLabel(campaign: CampaignRecord, snapshot: WorkspaceSnapshot) {
  if (campaign.audienceType === "segment") {
    return snapshot.segments.find((segment) => segment.id === campaign.segmentId)?.name ?? "Удалённая группа";
  }
  if (campaign.audienceType === "contacts") {
    const count = campaign.metrics.recipients;
    return `${count} ${count === 1 ? "получатель" : "получателей"}`;
  }
  return "Аудитория не выбрана";
}

const statusLabel: Record<CampaignRecord["status"], string> = {
  draft: "Черновик",
  ready: "Готова",
  blocked: "Нужно исправить",
  scheduled: "Запланирована",
  sending: "Отправляется",
  completed: "Завершена",
  cancelled: "Отменена",
};

export function CalendarView() {
  const params = useSearchParams();
  const targetCampaignId = params.get("campaign");
  const [view, setView] = React.useState<"calendar" | "report">("calendar");
  const [loading, setLoading] = React.useState(false);
  const inFlight = React.useRef(false);
  const [snapshot, setSnapshot] = React.useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const dayButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const dayPanel = React.useRef<HTMLElement>(null);
  const panelHeading = React.useRef<HTMLHeadingElement>(null);
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState("");
  const [status, setStatus] = React.useState("");
  const timeZone = useBrowserTimeZone();

  const load = React.useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch("/api/workspace?scope=calendar", { headers: { Accept: "application/json" } });
      const body = await response.json() as WorkspaceSnapshot | { error?: string };
      if (!response.ok || !("campaigns" in body)) throw new Error("error" in body ? body.error : "Календарь недоступен.");
      setSnapshot(body);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить календарь.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  React.useEffect(() => {
    const refresh = () => void load();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  const targetScheduledAt = snapshot?.campaigns.find((item) => item.id === targetCampaignId)?.scheduledAt;
  React.useEffect(() => {
    if (!targetScheduledAt) return;
    const key = dateKeyInTimezone(targetScheduledAt, timeZone);
    const [year, monthNumber] = key.split("-").map(Number);
    const frame = window.requestAnimationFrame(() => {
      setMonth(new Date(year, monthNumber - 1, 1));
      setSelectedDay(key);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [targetCampaignId, targetScheduledAt, timeZone]);

  React.useEffect(() => {
    if (!selectedDay) return;
    panelHeading.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 1023px)").matches) {
      panelHeading.current?.scrollIntoView({ block: "nearest" });
    }
    const panel = dayPanel.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dayButtons.current.get(selectedDay)?.focus({ preventScroll: true });
      setSelectedDay(null);
    };
    panel?.addEventListener("keydown", onKeyDown);
    return () => panel?.removeEventListener("keydown", onKeyDown);
  }, [selectedDay]);

  function closeDay() {
    if (selectedDay) dayButtons.current.get(selectedDay)?.focus({ preventScroll: true });
    setSelectedDay(null);
  }

  function changeMonth(delta: number) {
    setSelectedDay(null);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  const campaigns = React.useMemo(() => {
    if (!snapshot) return [];
    const normalized = query.trim().toLocaleLowerCase("ru");
    return snapshot.campaigns.filter((campaign) => {
      if (!campaign.scheduledAt || campaign.status === "completed") return false;
      const audience = audienceLabel(campaign, snapshot);
      if (group && audience !== group) return false;
      if (status && campaign.status !== status) return false;
      if (normalized && !`${campaign.name} ${campaign.subject} ${audience}`.toLocaleLowerCase("ru").includes(normalized)) return false;
      return true;
    });
  }, [group, query, snapshot, status]);

  const groups = React.useMemo(() => snapshot
    ? Array.from(new Set(snapshot.campaigns.map((campaign) => audienceLabel(campaign, snapshot)))).sort()
    : [], [snapshot]);
  const days = React.useMemo(() => {
    const first = startOfGrid(month);
    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(first);
      value.setDate(first.getDate() + index);
      return value;
    });
  }, [month]);
  const campaignsByDay = React.useMemo(() => {
    const map = new Map<string, CampaignRecord[]>();
    for (const campaign of campaigns) {
      const key = dateKeyInTimezone(campaign.scheduledAt!, timeZone);
      map.set(key, [...(map.get(key) ?? []), campaign]);
    }
    for (const items of map.values()) {
      items.sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!) || a.id.localeCompare(b.id));
    }
    return map;
  }, [campaigns, timeZone]);
  const selectedItems = selectedDay ? campaignsByDay.get(selectedDay) ?? [] : [];
  const selectedDateLabel = selectedDay
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${selectedDay}T12:00:00`))
    : "";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Расписание"
        title="Календарь рассылок"
        description="Планируйте рассылки и проверяйте результаты отправки за последние 24 часа."
        action={<Link href={`/campaigns/new?scheduledDate=${dateKey(new Date())}`} className={buttonVariants()}><Plus className="size-4" />Запланировать</Link>}
      />
      {error ? <Alert tone="danger" title="Календарь недоступен">{error}</Alert> : null}
      <Alert tone="info" title="Часовой пояс определён автоматически">
        Все даты календаря и время отправки показаны по вашему устройству: {describeTimeZone(timeZone)}. На сервере расписание хранится в UTC без сдвига.
      </Alert>

      <div className="flex flex-wrap gap-3" aria-label="Представление календаря">
        <Button variant={view === "calendar" ? "primary" : "outline"} aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>Календарь</Button>
        <Button variant={view === "report" ? "primary" : "outline"} aria-pressed={view === "report"} onClick={() => setView("report")}>Отчёт за 24 часа{snapshot?.calendarReport ? ` · ${snapshot.calendarReport.rows.length}` : ""}</Button>
      </div>
      {view === "report" ? <CalendarReport report={snapshot?.calendarReport} timeZone={timeZone} loading={loading} refresh={() => void load()} /> : <>
      <section className="card p-4 sm:p-5" aria-label="Фильтры календаря">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_240px_200px_auto]">
          <div className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" /><Input className="input-with-leading-icon" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тема, название или группа" aria-label="Поиск по теме" /></div>
          <Select value={group} onChange={(event) => setGroup(event.target.value)} aria-label="Группа получателей" options={[{ value: "", label: "Все группы" }, ...groups.map((value) => ({ value, label: value }))]} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Статус рассылки" options={[{ value: "", label: "Все статусы" }, { value: "scheduled", label: "Запланированные" }, { value: "sending", label: "Отправляются" }, { value: "blocked", label: "Нужно исправить" }]} />
          <Button variant="ghost" onClick={() => { setQuery(""); setGroup(""); setStatus(""); }}>Сбросить</Button>
        </div>
      </section>

      <div className={cn("grid min-w-0 grid-cols-1 items-start gap-5", selectedDay && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <section className="card min-w-0 overflow-hidden" aria-label="Месячный календарь">
          <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-5">
            <Button size="icon" variant="ghost" aria-label="Предыдущий месяц" onClick={() => changeMonth(-1)}><ChevronLeft aria-hidden="true" className="size-5" /></Button>
            <h2 className="text-center text-[18px] font-semibold text-text-strong">{formatMonth(month)}</h2>
            <Button size="icon" variant="ghost" aria-label="Следующий месяц" onClick={() => changeMonth(1)}><ChevronRight aria-hidden="true" className="size-5" /></Button>
          </header>
          <div className="grid grid-cols-7 border-b border-border bg-surface-subtle">
            {weekdays.map((day) => <div key={day} className="py-2 text-center text-[12px] font-semibold text-text-muted">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dateKey(day);
              const items = campaignsByDay.get(key) ?? [];
              const outside = day.getMonth() !== month.getMonth();
              const today = key === dateKey(new Date());
              const selected = selectedDay === key;
              const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(day);
              return (
                <button
                  key={key}
                  ref={(element) => { if (element) dayButtons.current.set(key, element); else dayButtons.current.delete(key); }}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  aria-label={`${dayLabel}. Рассылок на этот день: ${items.length}`}
                  aria-pressed={selected}
                  aria-controls={selectedDay ? "calendar-day-details" : undefined}
                  aria-current={today ? "date" : undefined}
                  className={cn(
                    "flex min-h-24 min-w-0 flex-col items-start gap-2 border-b border-e border-border p-1.5 text-start hover:bg-primary/5 focus-visible:relative focus-visible:z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:min-h-28 sm:p-3",
                    outside && "bg-surface-subtle/60",
                    items.length > 0 && !outside && "bg-primary/[0.035]",
                    selected && "bg-primary/10 ring-2 ring-inset ring-primary",
                  )}
                >
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold", today ? "bg-primary text-white" : outside ? "text-text-subtle" : "text-text-strong")}>{day.getDate()}</span>
                  {items.length > 0 ? (
                    <span aria-hidden="true" className="inline-flex max-w-full items-center justify-center gap-0.5 rounded-full bg-primary px-0.5 py-1 text-[10px] font-semibold leading-none text-white sm:gap-1.5 sm:px-2 sm:text-[14px]">
                      <span className="size-1 shrink-0 rounded-full bg-white sm:size-1.5" />
                      {items.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {selectedDay ? (
          <aside ref={dayPanel} id="calendar-day-details" className="card min-w-0 p-4 sm:p-5" aria-labelledby="calendar-day-title">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 ref={panelHeading} id="calendar-day-title" tabIndex={-1} className="rounded text-[18px] font-semibold text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{selectedDateLabel}</h2>
                <p className="mt-1 text-[12px] text-text-muted" role="status">Рассылок: {selectedItems.length}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Закрыть сведения о дне" onClick={closeDay}><X aria-hidden="true" className="size-4" /></Button>
            </div>
            <p className="mt-3 text-[12px] text-text-muted">Время: {describeTimeZone(timeZone)}</p>
            <div className="mt-5 space-y-4">
              {selectedItems.map((campaign) => (
                <article key={campaign.id} className={cn("min-w-0 rounded-xl border border-border p-4", campaign.id === targetCampaignId && "border-primary bg-primary/[0.035]")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <time dateTime={campaign.scheduledAt!} className="inline-flex items-center gap-1.5 text-[15px] font-semibold tabular-nums text-primary"><Clock3 aria-hidden="true" className="size-4" />{formatTime(campaign.scheduledAt!, timeZone)}</time>
                    <Badge variant={campaign.status === "blocked" ? "warning" : "neutral"}>{statusLabel[campaign.status]}</Badge>
                  </div>
                  <h3 className="mt-3 break-words text-[14px] font-semibold text-text-strong">{campaign.name}</h3>
                  <dl className="mt-4 space-y-3 text-[13px]">
                    <CalendarDetail label="Тема" value={campaign.subject || "Не указана"} />
                    <CalendarDetail label="Аудитория" value={snapshot ? audienceLabel(campaign, snapshot) : ""} />
                    <CalendarDetail label="Получателей" value={campaign.metrics.recipients.toLocaleString("ru-RU")} />
                    <CalendarDetail label="Отправитель" value={[campaign.senderName, campaign.senderEmail].filter(Boolean).join(" · ") || "Не указан"} />
                    <CalendarDetail label="Каналы" value={campaign.deliveryChannels.map((channel) => getCampaignChannelDefinition(channel).label).join(", ") || "Не выбраны"} />
                  </dl>
                  {campaign.statusReason ? <p className="mt-4 break-words rounded-lg bg-surface-subtle p-3 text-[12px] leading-5 text-text-muted">{campaign.statusReason}</p> : null}
                  <Link href={`/campaigns/${campaign.id}`} aria-label={`Открыть рассылку «${campaign.name}»`} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>Открыть рассылку</Link>
                </article>
              ))}
              {selectedItems.length === 0 ? <p className="rounded-xl bg-surface-subtle p-4 text-[14px] leading-6 text-text-muted">{query || group || status ? "На этот день нет рассылок по выбранным фильтрам." : "На этот день нет запланированных рассылок."}</p> : null}
            </div>
            <Link href={`/campaigns/new?scheduledDate=${selectedDay}`} className={buttonVariants({ className: "mt-5 w-full" })}><Plus aria-hidden="true" className="size-4" />Запланировать</Link>
          </aside>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="success"><CalendarDays className="size-3" />Запланировано: {campaigns.filter((item) => item.status === "scheduled").length}</Badge>
        {Object.entries(statusLabel).filter(([key]) => campaigns.some((item) => item.status === key)).map(([key, label]) => <Badge key={key}>{label}: {campaigns.filter((item) => item.status === key).length}</Badge>)}
      </div>
      </>}
    </div>
  );
}

function CalendarDetail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[12px] text-text-muted">{label}</dt><dd className="mt-1 break-words font-medium text-text-strong">{value}</dd></div>;
}
