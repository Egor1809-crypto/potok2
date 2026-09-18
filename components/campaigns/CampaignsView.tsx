"use client";

import * as React from "react";
import ui from "@/components/shared/workflow.module.css";
import styles from "./campaigns.module.css";
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
} from "@/components/ui/icons";

import type { CampaignDeliveryChannel } from "@/types";
import type {
  CampaignRecord,
  CampaignStatus,
  DeliveryPlanRecord,
  WorkspaceSnapshot,
} from "@/types/api";
import { DEFAULT_TIME_ZONE, detectBrowserTimeZone } from "@/lib/client-timezone";
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
  { value: "blocked", label: "Требуют настройки" },
  { value: "ready", label: "Готовы" },
  { value: "scheduled", label: "Запланированы" },
  { value: "sending", label: "Отправляются" },
  { value: "paused", label: "На паузе" },
  { value: "stopping", label: "Останавливаются" },
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
  blocked: { label: "Требует настройки", tone: "warning", next: "Устраните причины и повторите проверку", icon: AlertTriangle },
  ready: { label: "Готова", tone: "success", next: "Проверки пройдены; внешняя отправка не выполнялась", icon: CheckCircle2 },
  scheduled: { label: "План по времени", tone: "info", next: "Расписание сохранено; отправка не запускалась", icon: CalendarClock },
  sending: { label: "Отправляется", tone: "warning", next: "Провайдеры обрабатывают получателей", icon: Send },
  paused: { label: "На паузе", tone: "neutral", next: "Очередь сохранена; возобновите отправку вручную", icon: Clock3 },
  stopping: { label: "Останавливается", tone: "warning", next: "Новое письмо не запускается; завершается текущее", icon: Clock3 },
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

function formatDate(value: string | null, timeZone: string) {
  if (!value) return "Не задано";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Moscow",
    }).format(new Date(value));
  }
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
  const [timeZone, setTimeZone] = React.useState(DEFAULT_TIME_ZONE);
  const [activeTab, setActiveTab] = React.useState<CampaignsTab>(initialTab);
  const [search, setSearch] = React.useState("");

  const loadCampaigns = React.useCallback(async () => {
    setApiMode("loading");
    try {
      const response = await fetch("/api/workspace?scope=campaign-list", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Кампании недоступны");
      const body = await response.json() as WorkspaceSnapshot;
      setCampaigns(body.campaigns.map(fromApi));
      setDeliveryPlans(body.deliveryPlans);
      setTimeZone(detectBrowserTimeZone(body.workspace.timezone || DEFAULT_TIME_ZONE));
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
    { all: 0, draft: 0, ready: 0, blocked: 0, scheduled: 0, sending: 0, paused: 0, stopping: 0, completed: 0, cancelled: 0 },
  ), [campaigns]);

  const acceptedRecipients = campaigns.reduce((total, campaign) => total + campaign.metrics.sent, 0);
  const active = counts.ready + counts.scheduled + counts.sending + counts.paused + counts.stopping;

  return (
    <div className={cn(ui.page, styles.page)}>
      <PageHeader
        title="Рассылка писем"
        action={
          <Link href="/campaigns/new" className={buttonVariants({ variant: "primary" })}>
            <MailPlus aria-hidden="true" className="size-6" />
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
            <RefreshCw aria-hidden="true" className="size-5" />
            Повторить загрузку
          </button>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Сводка по кампаниям">
        <SummaryCard icon={Send} label="Активный цикл" value={formatNumber(active)} text="Готовы, запланированы или отправляются" />
        <SummaryCard icon={AlertTriangle} label="Требуют внимания" value={formatNumber(counts.blocked + counts.draft)} text="Черновики и кампании, которым нужна настройка" tone="warning" />
        <SummaryCard icon={BarChart3} label="Принято провайдерами" value={formatNumber(acceptedRecipients)} text="Уникальные получатели; это ещё не подтверждение доставки" tone="success" />
      </section>

      <section className={styles.library} aria-labelledby="campaign-list-title">
        <div className={cn(ui.toolbar, styles.toolbar)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="campaign-list-title" className="sr-only">Список рассылок</h2>
              <p className={styles.resultCount} role="status">{apiMode === "loading" ? "Загружаем рассылки…" : `Найдено: ${formatNumber(filtered.length)}`}</p>
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
          <div className={ui.filters} role="group" aria-label="Статус кампании">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
                <span>{counts[tab.value]}</span>
              </button>
            ))}
          </div>
        </div>

        {apiMode === "loading" ? <div className={styles.loading} role="status"><RefreshCw aria-hidden="true" className="size-7 animate-spin text-primary" />Загружаем рассылки…</div> : filtered.length ? (
          <div className={styles.list}>
            {filtered.map((campaign) => {
              const meta = statusMeta[campaign.status];
              const StatusIcon = meta.icon;
              const blockedPlans = deliveryPlans.filter((plan) => plan.campaignId === campaign.id && plan.status === "blocked");
              const editHref = `/campaigns/new?campaign=${encodeURIComponent(campaign.id)}&step=${campaign.status === "blocked" ? "review" : "audience"}`;
              return (
                <article key={campaign.id} className={cn(ui.record, styles.campaign)} data-tone={meta.tone}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.tone} dot>{meta.label}</Badge>
                      <span className="text-[11px] text-text-subtle">Создана {formatDate(campaign.createdAt, timeZone)}</span>
                    </div>
                    <Link href={`/campaigns/${campaign.id}`} className={styles.name}>
                      {campaign.name}
                    </Link>
                    <p className="mt-1 line-clamp-1 text-[12px] text-text-muted">{campaign.subject || campaign.messengerMessage || "Сообщение ещё не подготовлено"}</p>
                  </div>

                  <div className={styles.audience}>
                    <p className="flex items-center gap-2 text-[12px] font-medium text-text-strong"><UsersRound aria-hidden="true" className="size-6 text-text-subtle" />{campaign.audience}</p>
                    <p className="mt-1 text-[11px] text-text-muted">Получателей: {formatNumber(campaign.metrics.recipients)}</p>
                    <div className="mt-2 flex gap-1.5">
                      {campaign.deliveryChannels.map((channel) => {
                        const item = channelMeta[channel];
                        const Icon = item.icon;
                        return <span key={channel} title={item.label} aria-label={item.label} className={`grid size-7 place-items-center rounded-lg ${item.className}`}><Icon aria-hidden="true" className="size-5" /></span>;
                      })}
                    </div>
                  </div>

                  <div className={styles.nextStep}>
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-text-strong"><StatusIcon aria-hidden="true" className="size-6" />Следующий шаг</p>
                    <p className="mt-1 text-[11px] leading-4.5 text-text-muted">
                      {campaign.statusReason || blockedPlans[0]?.statusReason || meta.next}
                    </p>
                    {blockedPlans.length > 1 ? <p className="mt-1 text-[10px] font-medium text-warning">Заблокировано каналов: {blockedPlans.length}</p> : null}
                  </div>

                  <div className={styles.actions}>
                    {(campaign.status === "draft" || campaign.status === "blocked") ? (
                      <Link href={editHref} className={buttonVariants({ variant: "primary", size: "sm" })}>
                        {campaign.status === "blocked" ? "Исправить" : "Продолжить"}
                        <ArrowRight aria-hidden="true" className="size-5" />
                      </Link>
                    ) : (
                      <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                        Открыть
                        <ArrowRight aria-hidden="true" className="size-5" />
                      </Link>
                    )}
                    <Link href={`/campaigns/new?duplicate=${encodeURIComponent(campaign.id)}`} aria-label={`Дублировать кампанию «${campaign.name}»`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      <Copy aria-hidden="true" className="size-5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Send className="size-7" />}
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
    <article className={cn(ui.metric, styles.summary)} data-tone={tone}>
      <span className={cn(ui.metricIcon, classes)}><Icon aria-hidden="true" className="size-6" /></span>
      <div>
        <p className="text-[12px] font-medium text-text-muted">{label}</p>
        <p className={ui.value}>{value}</p>
        <p className="mt-1 text-[11px] leading-4.5 text-text-subtle">{text}</p>
      </div>
    </article>
  );
}
