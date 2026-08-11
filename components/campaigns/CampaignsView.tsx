"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Mail,
  MailPlus,
  MessageCircle,
  RefreshCw,
  Send,
  SendHorizontal,
  UsersRound,
} from "lucide-react";

import type { CampaignDeliveryChannel } from "@/types";
import type {
  CampaignRecord,
  CampaignStatus,
  DeliveryPlanRecord,
  WorkspaceSnapshot,
} from "@/types/api";
import { PageHeader } from "@/components/shared";
import {
  Alert,
  Badge,
  EmptyState,
  SearchInput,
  buttonVariants,
  cn,
} from "@/components/ui";

export type CampaignsTab = "all" | CampaignStatus;

type CampaignListItem = {
  id: string;
  name: string;
  subject: string;
  messengerMessage: string;
  audience: string;
  deliveryChannels: CampaignDeliveryChannel[];
  status: CampaignStatus;
  statusReason: string;
  metrics: {
    recipients: number;
    sent: number;
    delivered: number;
    opened: number;
    replies: number;
  };
  createdAt: string;
  scheduledAt: string | null;
};

const tabs: { value: CampaignsTab; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "draft", label: "Черновики" },
  { value: "blocked", label: "Есть блокеры" },
  { value: "ready", label: "Готовы" },
  { value: "scheduled", label: "Запланированы" },
  { value: "sending", label: "Отправляются" },
  { value: "completed", label: "Завершены" },
  { value: "cancelled", label: "Отменены" },
];

const statusMeta: Record<CampaignStatus, {
  label: string;
  tone: "neutral" | "warning" | "success" | "info" | "accent";
  next: string;
  icon: typeof Clock3;
}> = {
  draft: { label: "Черновик", tone: "neutral", next: "Завершите аудиторию, сообщение и маршруты", icon: Clock3 },
  blocked: { label: "Есть блокеры", tone: "warning", next: "Исправьте блокеры и повторите проверку", icon: AlertTriangle },
  ready: { label: "Готова", tone: "success", next: "Проверки пройдены; внешняя отправка не выполнялась", icon: CheckCircle2 },
  scheduled: { label: "План по времени", tone: "info", next: "Расписание сохранено; адаптер не запускался", icon: CalendarClock },
  sending: { label: "Отправляется", tone: "accent", next: "Провайдеры обрабатывают получателей", icon: Send },
  completed: { label: "Обработка завершена", tone: "success", next: "Смотрите фактически принятые провайдером сообщения", icon: CheckCircle2 },
  cancelled: { label: "Отменена", tone: "neutral", next: "Создайте копию, чтобы повторить", icon: Clock3 },
};

const channelMeta: Record<CampaignDeliveryChannel, { label: string; icon: typeof Mail; className: string }> = {
  email: { label: "Email", icon: Mail, className: "bg-primary-subtle text-primary" },
  telegram: { label: "Telegram", icon: SendHorizontal, className: "bg-info-subtle text-info" },
  vk: { label: "ВКонтакте", icon: MessageCircle, className: "bg-[#eaf3ff] text-[#1671d9]" },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Не задано";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function fromApi(campaign: CampaignRecord): CampaignListItem {
  return {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject,
    messengerMessage: campaign.messengerMessage,
    audience: campaign.audienceLabel,
    deliveryChannels: campaign.deliveryChannels,
    status: campaign.status,
    statusReason: campaign.statusReason,
    metrics: campaign.metrics,
    createdAt: campaign.createdAt,
    scheduledAt: campaign.scheduledAt,
  };
}

export interface CampaignsViewProps {
  initialTab?: CampaignsTab;
}

export function CampaignsView({
  initialTab = "all",
}: CampaignsViewProps) {
  const [campaigns, setCampaigns] = React.useState<CampaignListItem[]>([]);
  const [deliveryPlans, setDeliveryPlans] = React.useState<DeliveryPlanRecord[]>([]);
  const [apiMode, setApiMode] = React.useState<"loading" | "online" | "offline">("loading");
  const [activeTab, setActiveTab] = React.useState<CampaignsTab>(initialTab);
  const [search, setSearch] = React.useState("");

  const loadCampaigns = React.useCallback(async () => {
    setApiMode("loading");
    try {
      const response = await fetch("/api/workspace", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Кампании недоступны");
      const body = await response.json() as WorkspaceSnapshot;
      setCampaigns(body.campaigns.map(fromApi));
      setDeliveryPlans(body.deliveryPlans);
      setApiMode("online");
    } catch {
      setCampaigns([]);
      setDeliveryPlans([]);
      setApiMode("offline");
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadCampaigns());
    return () => window.cancelAnimationFrame(frame);
  }, [loadCampaigns]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return campaigns.filter((campaign) => {
      const tabMatches = activeTab === "all" || campaign.status === activeTab;
      const searchMatches = !query || [campaign.name, campaign.subject, campaign.messengerMessage, campaign.audience]
        .join(" ")
        .toLocaleLowerCase("ru-RU")
        .includes(query);
      return tabMatches && searchMatches;
    });
  }, [activeTab, campaigns, search]);

  const counts = React.useMemo(() => campaigns.reduce<Record<CampaignsTab, number>>(
    (result, campaign) => {
      result.all += 1;
      result[campaign.status] += 1;
      return result;
    },
    { all: 0, draft: 0, ready: 0, blocked: 0, scheduled: 0, sending: 0, completed: 0, cancelled: 0 },
  ), [campaigns]);

  const delivered = campaigns.reduce((total, campaign) => total + campaign.metrics.delivered, 0);
  const active = counts.ready + counts.scheduled + counts.sending;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <PageHeader
        eyebrow="Полный цикл коммуникации"
        title="Кампании"
        description="Каждая кампания проходит понятный путь: черновик → проверка → готовность → отправка → результат."
        action={
          <Link href="/campaigns/new" className={buttonVariants({ variant: "primary" })}>
            <MailPlus aria-hidden="true" className="size-4" />
            Новая кампания
          </Link>
        }
      />

      {apiMode === "offline" ? (
        <Alert tone="danger" title="Кампании не загружены">
          Не удалось получить данные рабочего пространства. Список очищен, чтобы не показывать устаревшие или вымышленные записи.
          <button
            type="button"
            onClick={() => void loadCampaigns()}
            className="mt-3 inline-flex items-center gap-2 text-[12px] font-semibold text-danger underline underline-offset-4"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Повторить загрузку
          </button>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Сводка по кампаниям">
        <SummaryCard icon={Send} label="Активный цикл" value={formatNumber(active)} text="Готовы, запланированы или отправляются" />
        <SummaryCard icon={AlertTriangle} label="Требуют внимания" value={formatNumber(counts.blocked + counts.draft)} text="Черновики и кампании с блокерами" tone="warning" />
        <SummaryCard icon={BarChart3} label="Доставлено" value={formatNumber(delivered)} text="По всем завершённым и активным кампаниям" tone="success" />
      </section>

      <section className="card overflow-hidden" aria-labelledby="campaign-list-title">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="campaign-list-title" className="text-[16px] font-semibold text-text-strong">Рабочий список</h2>
              <p className="mt-1 text-[12px] text-text-muted">Статус показывает, что уже сделано и какое действие нужно следующим.</p>
            </div>
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Название или аудитория"
              aria-label="Поиск кампаний"
              wrapperClassName="w-full lg:w-72"
            />
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Статус кампании">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  activeTab === tab.value
                    ? "border-primary/30 bg-primary-subtle text-primary"
                    : "border-border bg-surface text-text-muted hover:border-border-strong",
                )}
              >
                {tab.label}
                <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px]">{counts[tab.value]}</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length ? (
          <div className="divide-y divide-border">
            {filtered.map((campaign) => {
              const meta = statusMeta[campaign.status];
              const StatusIcon = meta.icon;
              const blockedPlans = deliveryPlans.filter((plan) => plan.campaignId === campaign.id && plan.status === "blocked");
              const editHref = `/campaigns/new?campaign=${encodeURIComponent(campaign.id)}&step=${campaign.status === "blocked" ? "review" : "audience"}`;
              return (
                <article key={campaign.id} className="grid gap-4 p-5 transition-colors hover:bg-surface-subtle/35 lg:grid-cols-[minmax(0,1.3fr)_minmax(170px,.6fr)_minmax(190px,.75fr)_auto] lg:items-center lg:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.tone} dot>{meta.label}</Badge>
                      <span className="text-[11px] text-text-subtle">Создана {formatDate(campaign.createdAt)}</span>
                    </div>
                    <Link href={`/campaigns/${campaign.id}`} className="mt-2 block truncate text-[15px] font-semibold text-text-strong hover:text-primary">
                      {campaign.name}
                    </Link>
                    <p className="mt-1 line-clamp-1 text-[12px] text-text-muted">{campaign.subject || campaign.messengerMessage || "Сообщение ещё не подготовлено"}</p>
                  </div>

                  <div>
                    <p className="flex items-center gap-2 text-[12px] font-medium text-text-strong"><UsersRound aria-hidden="true" className="size-4 text-text-subtle" />{campaign.audience}</p>
                    <p className="mt-1 text-[11px] text-text-muted">Получателей: {formatNumber(campaign.metrics.recipients)}</p>
                    <div className="mt-2 flex gap-1.5">
                      {campaign.deliveryChannels.map((channel) => {
                        const item = channelMeta[channel];
                        const Icon = item.icon;
                        return <span key={channel} title={item.label} aria-label={item.label} className={`grid size-7 place-items-center rounded-lg ${item.className}`}><Icon aria-hidden="true" className="size-3.5" /></span>;
                      })}
                    </div>
                  </div>

                  <div className={cn("rounded-xl border p-3", campaign.status === "blocked" ? "border-warning/25 bg-warning-subtle" : "border-border bg-surface-subtle/50")}>
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-text-strong"><StatusIcon aria-hidden="true" className="size-4" />Следующий шаг</p>
                    <p className="mt-1 text-[11px] leading-4.5 text-text-muted">
                      {campaign.statusReason || blockedPlans[0]?.statusReason || meta.next}
                    </p>
                    {blockedPlans.length > 1 ? <p className="mt-1 text-[10px] font-medium text-warning">Заблокировано каналов: {blockedPlans.length}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {(campaign.status === "draft" || campaign.status === "blocked") ? (
                      <Link href={editHref} className={buttonVariants({ variant: "primary", size: "sm" })}>
                        {campaign.status === "blocked" ? "Исправить" : "Продолжить"}
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    ) : (
                      <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                        Открыть
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    )}
                    <Link href={`/campaigns/new?duplicate=${encodeURIComponent(campaign.id)}`} aria-label={`Дублировать кампанию «${campaign.name}»`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      <Copy aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Send className="size-5" />}
            title="Кампании не найдены"
            description={search ? "Измените поисковый запрос." : "В этом статусе пока нет кампаний."}
            action={search ? { label: "Очистить поиск", onClick: () => setSearch("") } : { label: "Создать кампанию", onClick: () => window.location.assign("/campaigns/new") }}
          />
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  text,
  tone = "primary",
}: {
  icon: typeof Send;
  label: string;
  value: string;
  text: string;
  tone?: "primary" | "warning" | "success";
}) {
  const classes = {
    primary: "bg-primary-subtle text-primary",
    warning: "bg-warning-subtle text-warning",
    success: "bg-success-subtle text-success",
  }[tone];
  return (
    <article className="card flex items-start gap-3 p-4 sm:p-5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${classes}`}><Icon aria-hidden="true" className="size-4" /></span>
      <div>
        <p className="text-[12px] font-medium text-text-muted">{label}</p>
        <p className="mt-0.5 text-[22px] font-semibold tracking-[-0.04em] text-text-strong">{value}</p>
        <p className="mt-1 text-[11px] leading-4.5 text-text-subtle">{text}</p>
      </div>
    </article>
  );
}
