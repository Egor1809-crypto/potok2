import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CircleDashed,
  Clock3,
  Copy,
  FileEdit,
  Mail,
  MessageCircle,
  RefreshCw,
  SearchX,
  Send,
  SendHorizontal,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, Badge, Button, buttonVariants, cn } from "@/components/ui";
import {
  deliveryChannelById,
  integrationProviderById,
  type DeliveryChannelId,
} from "@/config/integrations";
import type {
  CampaignEventRecord,
  CampaignRecord,
  CampaignStatus,
  DeliveryJobRecord,
  DeliveryPlanRecord,
} from "@/types/api";

export type CampaignDetailViewProps = {
  campaignId?: string;
  campaign?: CampaignRecord | null;
  deliveryPlans?: DeliveryPlanRecord[];
  events?: CampaignEventRecord[];
  deliveryJob?: DeliveryJobRecord | null;
  apiMode?: "loading" | "online" | "offline";
  onReload?: () => void;
  onDispatch?: () => void;
  onDelete?: () => void;
  dispatching?: boolean;
  deleting?: boolean;
  dispatchNotice?: string | null;
  timeZone?: string;
};

type DetailCampaign = {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  emailBodyText: string;
  messengerMessage: string;
  deliveryChannels: DeliveryChannelId[];
  audience: string;
  status: CampaignStatus;
  statusReason: string;
  senderName: string;
  senderEmail: string;
  metrics: {
    recipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replies: number;
    bounced: number;
    unsubscribed: number;
  };
  createdAt: string;
  updatedAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
};

const statusMeta: Record<CampaignStatus, {
  label: string;
  badge: "neutral" | "warning" | "success" | "info" | "accent";
  title: string;
  description: string;
}> = {
  draft: {
    label: "Черновик",
    badge: "neutral",
    title: "Кампания ещё настраивается",
    description: "Завершите четыре шага и проверьте готовность на сервере.",
  },
  blocked: {
    label: "Требует настройки",
    badge: "warning",
    title: "Проверка готовности выявила проблемы",
    description: "Исправьте причины ниже и повторите проверку. Сообщения не отправлены.",
  },
  ready: {
    label: "Готова",
    badge: "success",
    title: "Все проверки пройдены",
    description: "Аудитория, сообщения и подключения готовы к обработке.",
  },
  scheduled: {
    label: "Запланирована",
    badge: "info",
    title: "План сохранён по расписанию",
    description: "Маршруты проверены; отправка не запускалась.",
  },
  sending: {
    label: "Отправляется",
    badge: "accent",
    title: "Провайдеры обрабатывают получателей",
    description: "Задания передаются выбранным провайдерам.",
  },
  completed: {
    label: "Обработка завершена",
    badge: "success",
    title: "Обращения к провайдерам завершены",
    description: "Ниже учтены только принятые провайдерами сообщения; доставка и реакции не подтверждены.",
  },
  cancelled: {
    label: "Отменена",
    badge: "neutral",
    title: "Кампания отменена",
    description: "Чтобы использовать настройки повторно, создайте копию кампании.",
  },
};

const lifecycleSteps = ["Черновик", "Проверка", "Готовность", "Отправка", "Результат"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function campaignSummary(campaign: DetailCampaign) {
  const value = campaign.subject || campaign.messengerMessage || "Сообщение ещё не подготовлено";
  return value.length > 160 ? `${value.slice(0, 157).trimEnd()}…` : value;
}

function formatPercent(value: number, total: number) {
  if (!total) return "—";
  return `${((Math.min(Math.max(value, 0), total) / total) * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

function formatDateTime(value: string | null, timeZone: string) {
  if (!value) return "Не задано";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    }).format(new Date(value));
  }
}

function normalizeCampaign(campaign: CampaignRecord): DetailCampaign {
  return {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText,
    emailBodyText: campaign.emailBodyText,
    messengerMessage: campaign.messengerMessage,
    deliveryChannels: campaign.deliveryChannels,
    audience: campaign.audienceLabel,
    status: campaign.status,
    statusReason: campaign.statusReason,
    senderName: campaign.senderName,
    senderEmail: campaign.senderEmail,
    metrics: campaign.metrics,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    scheduledAt: campaign.scheduledAt,
    sentAt: campaign.sentAt,
  };
}

function lifecycleIndex(status: CampaignStatus) {
  if (status === "draft") return 0;
  if (status === "blocked") return 1;
  if (status === "ready" || status === "scheduled") return 2;
  if (status === "sending") return 3;
  if (status === "completed") return 4;
  return 0;
}

export function CampaignDetailView({
  campaignId,
  campaign,
  deliveryPlans = [],
  events = [],
  deliveryJob = null,
  apiMode = "online",
  onReload,
  onDispatch,
  onDelete,
  dispatching = false,
  deleting = false,
  dispatchNotice = null,
  timeZone = "Europe/Moscow",
}: CampaignDetailViewProps) {
  if (!campaign) {
    if (apiMode === "loading") return <CampaignLoading />;
    if (apiMode === "offline") return <CampaignLoadError onReload={onReload} />;
    return <CampaignNotFound campaignId={campaignId} onReload={onReload} />;
  }

  const item = normalizeCampaign(campaign);
  const meta = statusMeta[item.status];
  const blockedPlans = deliveryPlans.filter((plan) => plan.status === "blocked");
  const blockers = Array.from(new Set([
    ...(item.status === "blocked" && item.statusReason ? [item.statusReason] : []),
    ...blockedPlans.map((plan) => plan.statusReason).filter(Boolean),
  ]));
  const currentLifecycleIndex = lifecycleIndex(item.status);
  const editable = item.status === "draft" || item.status === "blocked" || item.status === "ready" || item.status === "scheduled";
  const canDispatch = item.status === "ready" && !deliveryJob && Boolean(onDispatch);
  const canDelete = !["sending", "completed"].includes(item.status) && Boolean(onDelete);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-strong">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Все кампании
      </Link>

      <PageHeader
        eyebrow="Кампания"
        title={item.name}
        description={campaignSummary(item)}
        meta={<Badge variant={meta.badge} dot>{meta.label}</Badge>}
        action={
          <>
            <Link href={`/campaigns/new?duplicate=${encodeURIComponent(item.id)}`} className={buttonVariants({ variant: "secondary" })}>
              <Copy aria-hidden="true" className="size-4" />
              Создать копию
            </Link>
            {canDelete ? (
              <Button
                variant="danger"
                onClick={onDelete}
                loading={deleting}
                loadingText="Удаляем…"
                leadingIcon={<Trash2 aria-hidden="true" className="size-4" />}
              >
                Удалить
              </Button>
            ) : null}
            {canDispatch ? (
              <Button
                onClick={onDispatch}
                loading={dispatching}
                loadingText="Запускаем…"
                leadingIcon={<SendHorizontal aria-hidden="true" className="size-4" />}
              >
                Начать отправку
              </Button>
            ) : null}
            {editable ? (
              <Link href={`/campaigns/new?campaign=${encodeURIComponent(item.id)}&step=${item.status === "blocked" ? "review" : "audience"}`} className={buttonVariants({ variant: "primary" })}>
                <FileEdit aria-hidden="true" className="size-4" />
                {item.status === "blocked" ? "Устранить причины" : "Редактировать"}
              </Link>
            ) : (
              <Link href={`/analytics?campaign=${encodeURIComponent(item.id)}`} className={buttonVariants({ variant: "primary" })}>
                <BarChart3 aria-hidden="true" className="size-4" />
                Открыть аналитику
              </Link>
            )}
          </>
        }
      />

      <Alert tone={item.status === "blocked" ? "warning" : item.status === "cancelled" ? "warning" : "info"} title={meta.title}>
        {item.statusReason || meta.description}
        {item.status === "scheduled" ? ` Время в плане: ${formatDateTime(item.scheduledAt, timeZone)}.` : ""}
      </Alert>

      <Lifecycle status={item.status} currentIndex={currentLifecycleIndex} />

      <DispatchPanel
        campaign={item}
        plans={deliveryPlans}
        deliveryJob={deliveryJob}
        canDispatch={canDispatch}
        dispatching={dispatching}
        dispatchNotice={dispatchNotice}
        onDispatch={onDispatch}
      />

      {blockers.length ? (
        <section className="rounded-xl border border-warning/30 bg-warning-subtle p-5" aria-labelledby="campaign-blockers-title">
          <div className="flex items-center gap-3">
            <AlertTriangle aria-hidden="true" className="size-5 text-warning" />
            <div>
              <h2 id="campaign-blockers-title" className="text-[15px] font-semibold text-text-strong">Что мешает готовности</h2>
              <p className="mt-1 text-[12px] text-text-muted">Исправьте каждый пункт и повторите серверную проверку.</p>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 text-[12px] leading-5 text-text sm:grid-cols-2">
            {blockers.map((blocker) => <li key={blocker} className="flex gap-2 rounded-lg bg-surface/70 p-3"><CircleDashed aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-warning" />{blocker}</li>)}
          </ul>
        </section>
      ) : null}

      <Metrics campaign={item} plans={deliveryPlans} deliveryJob={deliveryJob} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Content campaign={item} />
          <DeliveryRoutes campaign={item} plans={deliveryPlans} />
        </div>
        <aside className="space-y-5">
          <CampaignFacts campaign={item} timeZone={timeZone} />
          <Audience campaign={item} />
          <EventHistory events={events} timeZone={timeZone} />
        </aside>
      </div>
    </div>
  );
}

function Lifecycle({ status, currentIndex }: { status: CampaignStatus; currentIndex: number }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="lifecycle-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="lifecycle-title" className="text-[15px] font-semibold text-text-strong">Жизненный цикл</h2>
          <p className="mt-1 text-[12px] text-text-muted">Статус меняется только после выполненного бизнес-действия.</p>
        </div>
        {status === "blocked" ? <Badge variant="warning">Остановлена на проверке</Badge> : null}
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-5" aria-label="Жизненный цикл кампании">
        {lifecycleSteps.map((label, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={label} aria-current={current ? "step" : undefined} className={cn("flex items-center gap-2 rounded-xl border px-3 py-3 sm:flex-col sm:items-start", current ? "border-primary/40 bg-primary-subtle" : complete ? "border-success/25 bg-success-subtle" : "border-border bg-surface-subtle/40")}>
              <span className={cn("grid size-6 place-items-center rounded-full text-[10px] font-semibold", current ? "bg-primary text-white" : complete ? "bg-success text-white" : "bg-surface text-text-subtle")}>
                {complete ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
              </span>
              <span className="text-[12px] font-semibold text-text-strong">{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DispatchPanel({
  campaign,
  plans,
  deliveryJob,
  canDispatch,
  dispatching,
  dispatchNotice,
  onDispatch,
}: {
  campaign: DetailCampaign;
  plans: DeliveryPlanRecord[];
  deliveryJob: DeliveryJobRecord | null;
  canDispatch: boolean;
  dispatching: boolean;
  dispatchNotice: string | null;
  onDispatch?: () => void;
}) {
  if (campaign.status !== "ready" && !deliveryJob && !dispatchNotice) return null;
  const automatic = plans.filter(
    (plan) => integrationProviderById[plan.providerId].deliveryMode === "automatic",
  );
  const manual = plans.filter(
    (plan) => integrationProviderById[plan.providerId].deliveryMode === "manual_export",
  );
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="dispatch-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 id="dispatch-title" className="text-[16px] font-semibold text-text-strong">
            Явный запуск
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-text-muted">
            «Начать отправку» ещё раз проверит зафиксированную аудиторию, адреса,
            согласия и серверные подключения. Проверка готовности сама ничего не отправляет.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-subtle p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">Автоматически</p>
              <p className="mt-1 text-[12px] leading-5 text-text-strong">
                {automatic.length
                  ? automatic.map((plan) => integrationProviderById[plan.providerId].name).join(", ")
                  : "Нет автоматических маршрутов"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface-subtle p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">Вручную</p>
              <p className="mt-1 text-[12px] leading-5 text-text-strong">
                {manual.length
                  ? "VK WorkSpace: скачать CSV и завершить запуск в его интерфейсе"
                  : "Ручных маршрутов нет"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {canDispatch ? (
            <Button
              onClick={onDispatch}
              loading={dispatching}
              loadingText="Запускаем…"
              leadingIcon={<SendHorizontal aria-hidden="true" className="size-4" />}
            >
              Начать отправку
            </Button>
          ) : null}
          {manual.length ? (
            <a
              href={`/api/campaigns/export?id=${encodeURIComponent(campaign.id)}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Скачать CSV для VK WorkSpace
            </a>
          ) : null}
        </div>
      </div>
      {deliveryJob ? (
        <Alert
          tone={deliveryJob.status === "completed" ? "success" : deliveryJob.status === "failed" ? "danger" : "warning"}
          title="Результат задания"
          className="mt-5"
        >
          {deliveryJob.statusMessage} Принято: {formatNumber(deliveryJob.acceptedCount)};
          отклонено: {formatNumber(deliveryJob.rejectedCount)}; неопределённо: {formatNumber(deliveryJob.ambiguousCount)};
          вручную: {formatNumber(deliveryJob.manualCount)}.
        </Alert>
      ) : dispatchNotice ? (
        <Alert tone="warning" title="Запуск не завершён" className="mt-5">
          {dispatchNotice}
        </Alert>
      ) : null}
    </section>
  );
}

function Metrics({
  campaign,
  plans,
  deliveryJob,
}: {
  campaign: DetailCampaign;
  plans: DeliveryPlanRecord[];
  deliveryJob: DeliveryJobRecord | null;
}) {
  const actualJobs = deliveryJob
    ? deliveryJob.acceptedCount + deliveryJob.rejectedCount + deliveryJob.ambiguousCount + deliveryJob.manualCount
    : plans.reduce((total, plan) => total + plan.eligibleCount, 0);
  const problemJobs = deliveryJob
    ? deliveryJob.rejectedCount + deliveryJob.ambiguousCount
    : 0;
  const metrics = [
    { label: "Получатели", value: formatNumber(campaign.metrics.recipients), meta: "Уникальные контакты аудитории", icon: UsersRound },
    { label: deliveryJob ? "Заданий" : "Плановых заданий", value: actualJobs ? formatNumber(actualJobs) : "—", meta: "По всем выбранным каналам", icon: Mail },
    { label: "Принято заданий", value: deliveryJob?.acceptedCount ? formatNumber(deliveryJob.acceptedCount) : "—", meta: "Ответ адаптера провайдера", icon: Send },
    { label: "Уникально принято", value: campaign.metrics.sent ? formatNumber(campaign.metrics.sent) : "—", meta: formatPercent(campaign.metrics.sent, campaign.metrics.recipients), icon: ShieldCheck },
    { label: "С проблемой", value: problemJobs ? formatNumber(problemJobs) : "—", meta: "Отклонено или статус неопределён", icon: AlertTriangle },
    { label: "Строк CSV", value: deliveryJob?.manualCount ? formatNumber(deliveryJob.manualCount) : "—", meta: "Для ручного запуска в VK WorkSpace", icon: FileEdit },
  ];
  return (
    <div className="space-y-3">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Показатели кампании">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="card p-4">
              <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-medium text-text-muted">{metric.label}</span><Icon aria-hidden="true" className="size-4 text-text-subtle" /></div>
              <p className="mt-2 text-[21px] font-semibold tracking-[-0.04em] text-text-strong">{metric.value}</p>
              <p className="mt-1 text-[10px] text-text-subtle">{metric.meta}</p>
            </article>
          );
        })}
      </section>
      <Alert tone="info" title="Показаны только проверяемые факты">
        Поток пока не получает от провайдеров события доставки, открытий, переходов и ответов, поэтому эти метрики не имитируются нулями.
      </Alert>
    </div>
  );
}

function Content({ campaign }: { campaign: DetailCampaign }) {
  const hasEmail = campaign.deliveryChannels.includes("email");
  const messengerChannels = campaign.deliveryChannels.filter((channel) => channel !== "email");
  return (
    <section className="card overflow-hidden" aria-labelledby="campaign-content-title">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 id="campaign-content-title" className="text-[16px] font-semibold text-text-strong">Сообщения</h2>
        <p className="mt-1 text-[12px] text-text-muted">Фактический контент, сохранённый в кампании.</p>
      </div>
      <div className={cn("grid gap-4 p-5 sm:p-6", hasEmail && messengerChannels.length ? "lg:grid-cols-2" : "grid-cols-1")}>
        {hasEmail ? (
          <article className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-primary-subtle text-primary"><Mail aria-hidden="true" className="size-4" /></span><div><h3 className="text-[14px] font-semibold text-text-strong">Email</h3><p className="mt-0.5 text-[11px] text-text-muted">{campaign.subject || "Без темы"}</p></div></div>
            {campaign.previewText ? <p className="mt-4 text-[11px] text-text-muted"><strong>Прехедер:</strong> {campaign.previewText}</p> : null}
            <p className="mt-4 whitespace-pre-wrap text-[13px] leading-6 text-text">{campaign.emailBodyText || "Текст письма не добавлен."}</p>
            <div className="mt-5 border-t border-border pt-4 text-[11px] text-text-muted"><strong className="font-semibold text-text-strong">От:</strong> {campaign.senderName} · {campaign.senderEmail}</div>
          </article>
        ) : null}
        {messengerChannels.length ? (
          <article className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-info-subtle text-info"><MessageCircle aria-hidden="true" className="size-4" /></span><div><h3 className="text-[14px] font-semibold text-text-strong">Мессенджеры</h3><p className="mt-0.5 text-[11px] text-text-muted">{messengerChannels.map((channel) => deliveryChannelById[channel].shortLabel).join(" · ")}</p></div></div>
            <div className="mt-5 flex justify-end"><p className="max-w-[92%] whitespace-pre-wrap rounded-[16px_16px_4px_16px] bg-primary px-4 py-3 text-[13px] leading-6 text-white">{campaign.messengerMessage || "Текст сообщения не добавлен."}</p></div>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function DeliveryRoutes({ campaign, plans }: { campaign: DetailCampaign; plans: DeliveryPlanRecord[] }) {
  return (
    <section className="card overflow-hidden" aria-labelledby="delivery-routes-title">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 id="delivery-routes-title" className="text-[16px] font-semibold text-text-strong">Маршруты доставки</h2>
        <p className="mt-1 text-[12px] text-text-muted">Отдельный план, охват и статус для каждого канала.</p>
      </div>
      <div className="divide-y divide-border">
        {campaign.deliveryChannels.map((channel) => {
          const plan = plans.find((item) => item.channel === channel);
          const provider = plan ? integrationProviderById[plan.providerId] : null;
          const Icon = channel === "email" ? Mail : channel === "telegram" ? SendHorizontal : MessageCircle;
          return (
            <article key={channel} className="grid gap-3 px-5 py-4 sm:grid-cols-[40px_minmax(0,1fr)_140px_140px] sm:items-center sm:px-6">
              <span className="grid size-9 place-items-center rounded-xl bg-primary-subtle text-primary"><Icon aria-hidden="true" className="size-4" /></span>
              <div><h3 className="text-[13px] font-semibold text-text-strong">{deliveryChannelById[channel].shortLabel}</h3><p className="mt-1 text-[11px] text-text-muted">{provider?.name ?? "Провайдер будет выбран при настройке"}</p>{plan?.statusReason ? <p className="mt-1 text-[11px] leading-4 text-warning">{plan.statusReason}</p> : null}</div>
              <div><p className="text-[10px] uppercase tracking-[0.08em] text-text-subtle">Охват</p><p className="mt-1 text-[13px] font-semibold text-text-strong">{plan ? `${formatNumber(plan.eligibleCount)} доступно` : "Не рассчитан"}</p></div>
              <Badge variant={plan?.status === "ready" ? "success" : plan?.status === "blocked" ? "warning" : "neutral"} dot className="w-fit sm:justify-self-end">{plan?.status === "ready" ? "Готов" : plan?.status === "blocked" ? "Заблокирован" : "Черновик"}</Badge>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CampaignFacts({ campaign, timeZone }: { campaign: DetailCampaign; timeZone: string }) {
  const rows = [
    ["Статус", statusMeta[campaign.status].label],
    ["Создана", formatDateTime(campaign.createdAt, timeZone)],
    ["Обновлена", formatDateTime(campaign.updatedAt, timeZone)],
    [campaign.sentAt ? "Отправлена" : "Запланирована", formatDateTime(campaign.sentAt ?? campaign.scheduledAt, timeZone)],
  ];
  return (
    <section className="card p-5" aria-labelledby="campaign-facts-title">
      <h2 id="campaign-facts-title" className="text-[15px] font-semibold text-text-strong">Данные кампании</h2>
      <dl className="mt-4 divide-y divide-border">
        {rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-5 py-3 text-[12px]"><dt className="text-text-muted">{label}</dt><dd className="text-right font-semibold text-text-strong">{value}</dd></div>)}
      </dl>
    </section>
  );
}

function Audience({ campaign }: { campaign: DetailCampaign }) {
  return (
    <section className="card p-5" aria-labelledby="campaign-audience-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary"><UsersRound aria-hidden="true" className="size-4" /></span>
        <div><h2 id="campaign-audience-title" className="text-[14px] font-semibold text-text-strong">{campaign.audience}</h2><p className="mt-1 text-[12px] text-text-muted">Получателей: {formatNumber(campaign.metrics.recipients)}</p><Link href="/segments" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:text-primary-hover">Открыть аудитории <ArrowRight aria-hidden="true" className="size-3.5" /></Link></div>
      </div>
    </section>
  );
}

function EventHistory({ events, timeZone }: { events: CampaignEventRecord[]; timeZone: string }) {
  const recent = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5);
  return (
    <section className="card p-5" aria-labelledby="campaign-history-title">
      <h2 id="campaign-history-title" className="text-[15px] font-semibold text-text-strong">История действий</h2>
      {recent.length ? (
        <ol className="mt-4 space-y-4">
          {recent.map((event) => <li key={event.id} className="flex gap-3"><span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-surface-subtle text-text-muted"><Clock3 aria-hidden="true" className="size-3" /></span><div><p className="text-[12px] leading-5 text-text-strong">{event.message}</p><time className="mt-0.5 block text-[10px] text-text-subtle">{formatDateTime(event.occurredAt, timeZone)}</time></div></li>)}
        </ol>
      ) : <p className="mt-3 text-[12px] leading-5 text-text-muted">События появятся после сохранения и проверки кампании.</p>}
      <p className="mt-4 border-t border-border pt-3 text-[10px] leading-4 text-text-subtle">
        Показано до 5 событий этой кампании из окна последних 100 событий рабочего пространства. Это не полный архив.
      </p>
    </section>
  );
}

function CampaignLoading() {
  return (
    <div className="mx-auto max-w-6xl py-16 text-center">
      <RefreshCw aria-hidden="true" className="mx-auto size-6 animate-spin text-primary" />
      <p className="mt-3 text-[13px] text-text-muted">Загружаем кампанию…</p>
    </div>
  );
}

function CampaignLoadError({ onReload }: { onReload?: () => void }) {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <section className="card p-8 text-center sm:p-12">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-danger-subtle text-danger"><AlertTriangle aria-hidden="true" className="size-5" /></span>
        <h1 className="mt-5 text-[22px] font-semibold text-text-strong">Не удалось загрузить кампанию</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-text-muted">Сервер рабочего пространства не ответил. Поток не подменяет кампанию локальной копией.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/campaigns" className={buttonVariants({ variant: "secondary" })}>Все кампании</Link>
          {onReload ? <Button onClick={onReload} leadingIcon={<RefreshCw className="size-4" />}>Повторить загрузку</Button> : null}
        </div>
      </section>
    </div>
  );
}

function CampaignNotFound({ campaignId, onReload }: { campaignId?: string; onReload?: () => void }) {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <section className="card p-8 text-center sm:p-12">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-subtle text-text-muted"><SearchX aria-hidden="true" className="size-5" /></span>
        <h1 className="mt-5 text-[22px] font-semibold text-text-strong">Кампания не найдена</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-text-muted">{campaignId ? `Кампания «${campaignId}» отсутствует в рабочем пространстве.` : "В ссылке не указан идентификатор кампании."}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/campaigns" className={buttonVariants({ variant: "primary" })}>Все кампании</Link>
          {onReload ? <Button variant="secondary" onClick={onReload} leadingIcon={<RefreshCw className="size-4" />}>Повторить загрузку</Button> : null}
        </div>
      </section>
    </div>
  );
}
