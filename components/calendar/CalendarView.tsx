"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter, Play, Plus, UsersRound } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, Badge, Button, Input, Select, buttonVariants, cn } from "@/components/ui";
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
    return `${campaign.contactIds.length} ${campaign.contactIds.length === 1 ? "получатель" : "получателей"}`;
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
  const [snapshot, setSnapshot] = React.useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch("/api/workspace", { headers: { Accept: "application/json" } });
      const body = await response.json() as WorkspaceSnapshot | { error?: string };
      if (!response.ok || !("campaigns" in body)) throw new Error("error" in body ? body.error : "Календарь недоступен.");
      setSnapshot(body);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить календарь.");
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const campaigns = React.useMemo(() => {
    if (!snapshot) return [];
    const normalized = query.trim().toLocaleLowerCase("ru");
    return snapshot.campaigns.filter((campaign) => {
      if (!campaign.scheduledAt) return false;
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
    const timezone = snapshot?.workspace.timezone ?? "Europe/Moscow";
    for (const campaign of campaigns) {
      const key = dateKeyInTimezone(campaign.scheduledAt!, timezone);
      map.set(key, [...(map.get(key) ?? []), campaign]);
    }
    return map;
  }, [campaigns, snapshot?.workspace.timezone]);

  const runQueue = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const response = await fetch("/api/scheduler", { method: "POST", headers: { Accept: "application/json" } });
      const body = await response.json() as { dueCount?: number; dispatched?: unknown[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Не удалось проверить очередь.");
      setNotice(body.dueCount ? `Обработано запланированных рассылок: ${body.dueCount}.` : "Просроченных заданий нет — очередь актуальна.");
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось проверить очередь.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Расписание"
        title="Календарь рассылок"
        description="Планируйте одно письмо человеку или серию для группы. Тема, аудитория и время остаются видны в одном календаре."
        action={<>
          <Button variant="secondary" onClick={() => void runQueue()} loading={running} loadingText="Проверяем…" leadingIcon={<Play className="size-4" />}>Проверить очередь</Button>
          <Link href={`/campaigns/new?scheduledDate=${dateKey(new Date())}`} className={buttonVariants()}><Plus className="size-4" />Запланировать</Link>
        </>}
      />
      {error ? <Alert tone="danger" title="Календарь недоступен">{error}</Alert> : null}
      {notice ? <Alert tone="success" title="Очередь проверена">{notice}</Alert> : null}

      <section className="card p-4 sm:p-5" aria-label="Фильтры календаря">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_240px_200px_auto]">
          <div className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тема, название или группа" aria-label="Поиск по теме" /></div>
          <Select value={group} onChange={(event) => setGroup(event.target.value)} aria-label="Группа получателей" options={[{ value: "", label: "Все группы" }, ...groups.map((value) => ({ value, label: value }))]} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Статус рассылки" options={[{ value: "", label: "Все статусы" }, { value: "scheduled", label: "Запланированные" }, { value: "completed", label: "Завершённые" }, { value: "blocked", label: "Нужно исправить" }]} />
          <Button variant="ghost" onClick={() => { setQuery(""); setGroup(""); setStatus(""); }}>Сбросить</Button>
        </div>
      </section>

      <section className="card overflow-hidden" aria-label="Месячный календарь">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <Button size="icon" variant="ghost" aria-label="Предыдущий месяц" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft className="size-5" /></Button>
          <h2 className="text-[18px] font-semibold text-text-strong">{formatMonth(month)}</h2>
          <Button size="icon" variant="ghost" aria-label="Следующий месяц" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight className="size-5" /></Button>
        </header>
        <div className="grid grid-cols-7 border-b border-border bg-surface-subtle">
          {weekdays.map((day) => <div key={day} className="px-2 py-2 text-center text-[12px] font-semibold text-text-muted">{day}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dateKey(day);
            const items = campaignsByDay.get(key) ?? [];
            const outside = day.getMonth() !== month.getMonth();
            const today = key === dateKey(new Date());
            return (
              <div key={key} className={cn("min-h-[118px] border-b border-r border-border p-1.5 sm:min-h-[138px] sm:p-2", outside && "bg-surface-subtle/60")}>
                <div className="flex items-center justify-between">
                  <span className={cn("grid size-7 place-items-center rounded-full text-[12px] font-semibold", today ? "bg-primary text-white" : outside ? "text-text-subtle" : "text-text-strong")}>{day.getDate()}</span>
                  {!outside ? <Link href={`/campaigns/new?scheduledDate=${key}`} aria-label={`Запланировать на ${key}`} className="grid size-7 place-items-center rounded-full text-text-subtle hover:bg-primary/10 hover:text-primary"><Plus className="size-3.5" /></Link> : null}
                </div>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 3).map((campaign) => (
                    <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block rounded-lg border border-primary/15 bg-primary/[0.06] p-1.5 hover:border-primary/40">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-primary"><Clock3 className="size-3" />{formatTime(campaign.scheduledAt!, snapshot?.workspace.timezone ?? "Europe/Moscow")}</div>
                      <div className="mt-0.5 truncate text-[11px] font-semibold text-text-strong">{campaign.subject || campaign.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-text-muted"><UsersRound className="size-3 shrink-0" />{snapshot ? audienceLabel(campaign, snapshot) : ""}</div>
                    </Link>
                  ))}
                  {items.length > 3 ? <div className="text-[10px] font-medium text-text-muted">Ещё {items.length - 3}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Badge variant="success"><CalendarDays className="size-3" />Запланировано: {campaigns.filter((item) => item.status === "scheduled").length}</Badge>
        {Object.entries(statusLabel).filter(([key]) => campaigns.some((item) => item.status === key)).map(([key, label]) => <Badge key={key}>{label}: {campaigns.filter((item) => item.status === key).length}</Badge>)}
      </div>
    </div>
  );
}
