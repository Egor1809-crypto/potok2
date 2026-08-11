import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CircleDashed,
  Copy,
  FileEdit,
  Mail,
  MailCheck,
  MousePointerClick,
  Reply,
  SearchX,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge, type StatusTone } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { campaigns } from "@/data/mockCampaigns";
import {
  getCampaignById,
  getSegmentById,
  getTemplateById,
} from "@/data/selectors";
import type { Campaign, EmailBlock, EmailTemplate } from "@/types";
import { BRAND_NAME } from "@/config/brand";
import { campaignStatusLabels } from "./campaignLabels";

export type CampaignDetailViewProps = {
  campaignId?: string;
  campaign?: Campaign;
};

const numberFormatter = new Intl.NumberFormat("ru-RU");

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const statusTones: Record<Campaign["status"], StatusTone> = {
  draft: "draft",
  scheduled: "scheduled",
  sending: "sending",
  completed: "active",
};

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Не задано";
}

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Не задано";
}

/**
 * Campaign reporting and launch context in one view. Supplying a campaign is
 * useful for previews/tests; supplying an id resolves against the shared mock
 * dataset. With neither prop, the primary demo campaign is shown.
 */
export function CampaignDetailView({
  campaignId,
  campaign,
}: CampaignDetailViewProps) {
  const currentCampaign =
    campaign ??
    (campaignId === undefined
      ? campaigns[0]
      : getCampaignById(campaignId));

  if (!currentCampaign) {
    return <CampaignNotFound />;
  }

  const template = currentCampaign.templateId
    ? getTemplateById(currentCampaign.templateId)
    : undefined;
  const segment = currentCampaign.segmentId
    ? getSegmentById(currentCampaign.segmentId)
    : undefined;
  const hasPerformance = currentCampaign.metrics.sent > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <ArrowLeft
          aria-hidden="true"
          className="size-3.5 transition-transform group-hover:-translate-x-0.5"
        />
        Все кампании
      </Link>

      <PageHeader
        eyebrow="Обзор кампании"
        title={currentCampaign.name}
        meta={
          <StatusBadge
            status={statusTones[currentCampaign.status]}
            label={campaignStatusLabels[currentCampaign.status]}
          />
        }
        description={
          <span>
            <span className="text-text-subtle">Тема:</span>{" "}
            <span className="font-medium text-text">{currentCampaign.subject}</span>
          </span>
        }
        action={<CampaignActions campaign={currentCampaign} />}
      />

      <CampaignStatusNotice campaign={currentCampaign} />

      <section aria-labelledby="campaign-performance-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="campaign-performance-heading"
              className="m-0 text-[15px] font-semibold tracking-[-0.015em] text-text-strong"
            >
              Эффективность
            </h2>
            <p className="mt-1 mb-0 text-[12px] text-text-muted">
              {hasPerformance
                ? "Актуальные данные о качестве доставки и вовлечённости аудитории."
                : "Отчёт начнёт заполняться после отправки первых сообщений."}
            </p>
          </div>
          {currentCampaign.sentAt ? (
            <span className="text-[11px] text-text-subtle">
              Отправлено {formatDateTime(currentCampaign.sentAt)}
            </span>
          ) : null}
        </div>

        <PerformanceSummary campaign={currentCampaign} />

        {hasPerformance ? (
          <PerformanceVisuals campaign={currentCampaign} />
        ) : (
          <PreSendPerformance campaign={currentCampaign} />
        )}
      </section>

      <section
        aria-label="Контент и настройки кампании"
        className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <ContentPreview campaign={currentCampaign} template={template} />

        <aside className="space-y-4">
          <CampaignDetails campaign={currentCampaign} />
          <AudienceDetails campaign={currentCampaign} segmentName={segment?.name} />
          <SenderDetails campaign={currentCampaign} />
        </aside>
      </section>
    </div>
  );
}

function CampaignActions({ campaign }: { campaign: Campaign }) {
  const isDemoCampaign = campaign.id.startsWith("campaign-demo-");
  const analyticsHref = `/analytics?campaign=${encodeURIComponent(campaign.id)}&demoName=${encodeURIComponent(campaign.name)}`;
  const primaryAction = {
    draft: {
      label: "Продолжить редактирование",
      href: `/campaigns/new?draft=${campaign.id}`,
      icon: <FileEdit aria-hidden="true" className="size-3.5" />,
    },
    scheduled: {
      label: isDemoCampaign ? "Открыть аналитику" : "Проверить расписание",
      href: isDemoCampaign ? analyticsHref : `/campaigns/new?campaign=${campaign.id}&step=review`,
      icon: isDemoCampaign
        ? <ArrowRight aria-hidden="true" className="size-3.5" />
        : <CalendarClock aria-hidden="true" className="size-3.5" />,
    },
    sending: {
      label: "Открыть текущий отчёт",
      href: analyticsHref,
      icon: <ArrowRight aria-hidden="true" className="size-3.5" />,
    },
    completed: {
      label: "Открыть полный отчёт",
      href: analyticsHref,
      icon: <ArrowRight aria-hidden="true" className="size-3.5" />,
    },
  }[campaign.status];

  return (
    <>
      <Link
        href={isDemoCampaign
          ? `/campaigns/new?count=${campaign.metrics.recipients}&name=${encodeURIComponent(`${campaign.name} — копия`)}${campaign.templateId ? `&template=${encodeURIComponent(campaign.templateId)}` : ""}`
          : `/campaigns/new?duplicate=${campaign.id}`}
        className="btn btn-secondary"
      >
        <Copy aria-hidden="true" className="size-3.5" />
        Дублировать
      </Link>
      <Link href={primaryAction.href} className="btn btn-primary">
        {primaryAction.icon}
        {primaryAction.label}
      </Link>
    </>
  );
}

function CampaignStatusNotice({ campaign }: { campaign: Campaign }) {
  if (campaign.status === "completed") return null;

  if (campaign.status === "sending") {
    const sendProgress = campaign.metrics.recipients
      ? (campaign.metrics.sent / campaign.metrics.recipients) * 100
      : 0;

    return (
      <Alert tone="info" title="Кампания отправляется" className="items-center">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <p className="m-0 flex-1">
            Обработано получателей: {formatNumber(campaign.metrics.sent)} из{" "}
            {formatNumber(campaign.metrics.recipients)}.
          </p>
          <Progress
            aria-label="Ход отправки кампании"
            value={campaign.metrics.sent}
            max={campaign.metrics.recipients}
            className="w-full min-w-48 sm:w-56"
            size="sm"
          />
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-info">
            {Math.round(sendProgress)}%
          </span>
        </div>
      </Alert>
    );
  }

  if (campaign.status === "scheduled") {
    return (
      <Alert tone="info" title="Готова и запланирована">
        Получателей: <strong>{formatNumber(campaign.metrics.recipients)}</strong>. Отправка
        начнётся {formatDateTime(campaign.scheduledAt)}.
      </Alert>
    );
  }

  return (
    <Alert tone="warning" title="Черновик сохранён">
      Аудитория и контент письма сохранены. Когда будете готовы запланировать или начать
      отправку, завершите этап проверки.
    </Alert>
  );
}

function PerformanceSummary({ campaign }: { campaign: Campaign }) {
  const { metrics } = campaign;
  const hasPerformance = metrics.sent > 0;

  const items = [
    {
      label: "Аудитория",
      value: formatNumber(metrics.recipients),
      change: metrics.sent > 0 ? `Отправлено: ${formatNumber(metrics.sent)}` : "Готово",
      icon: <UsersRound aria-hidden="true" className="size-4" />,
    },
    {
      label: "Доставлено",
      value: hasPerformance ? formatNumber(metrics.delivered) : "—",
      change: hasPerformance ? formatPercent(metrics.deliveryRate) : undefined,
      icon: <ShieldCheck aria-hidden="true" className="size-4" />,
    },
    {
      label: "Открыто",
      value: hasPerformance ? formatNumber(metrics.opened) : "—",
      change: hasPerformance ? formatPercent(metrics.openRate) : undefined,
      icon: <MailCheck aria-hidden="true" className="size-4" />,
    },
    {
      label: "Переходы",
      value: hasPerformance ? formatNumber(metrics.clicked) : "—",
      change: hasPerformance ? formatPercent(metrics.clickRate) : undefined,
      icon: <MousePointerClick aria-hidden="true" className="size-4" />,
    },
    {
      label: "Ответы",
      value: hasPerformance ? formatNumber(metrics.replies) : "—",
      change: hasPerformance ? formatPercent(metrics.replyRate) : undefined,
      icon: <Reply aria-hidden="true" className="size-4" />,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <MetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          change={item.change}
          icon={item.icon}
          className="p-4 sm:p-5"
        />
      ))}
    </div>
  );
}

function PerformanceVisuals({ campaign }: { campaign: Campaign }) {
  const { metrics } = campaign;
  const stages = [
    {
      label: "Отправлено",
      value: metrics.sent,
      rate: "100%",
      tone: "primary" as const,
    },
    {
      label: "Доставлено",
      value: metrics.delivered,
      rate: formatPercent(metrics.deliveryRate),
      tone: "success" as const,
    },
    {
      label: "Открыто",
      value: metrics.opened,
      rate: formatPercent(metrics.openRate),
      tone: "primary" as const,
    },
    {
      label: "Переходы",
      value: metrics.clicked,
      rate: formatPercent(metrics.clickRate),
      tone: "primary" as const,
    },
    {
      label: "Ответы",
      value: metrics.replies,
      rate: formatPercent(metrics.replyRate),
      tone: "success" as const,
    },
  ];

  const deliveredShare = Math.min(100, metrics.deliveryRate);
  const bouncedShare = metrics.sent
    ? Math.min(100 - deliveredShare, (metrics.bounced / metrics.sent) * 100)
    : 0;
  const pending = Math.max(0, metrics.sent - metrics.delivered - metrics.bounced);
  const deliveryRing = `conic-gradient(var(--success) 0 ${deliveredShare}%, var(--danger) ${deliveredShare}% ${deliveredShare + bouncedShare}%, var(--surface-inset) ${deliveredShare + bouncedShare}% 100%)`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>Путь вовлечения</CardTitle>
          <CardDescription>
            Конверсия от доставленного письма до содержательного ответа.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {stages.map((stage) => (
            <div key={stage.label}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="text-[12px] font-medium text-text-strong">
                  {stage.label}
                </span>
                <span className="text-[11px] tabular-nums text-text-muted">
                  <strong className="font-semibold text-text-strong">
                    {formatNumber(stage.value)}
                  </strong>{" "}
                  · {stage.rate}
                </span>
              </div>
              <Progress
                label={`${stage.label}: ${formatNumber(stage.value)}`}
                aria-label={`${stage.label}: ${formatNumber(stage.value)}`}
                value={stage.value}
                max={metrics.sent}
                tone={stage.tone}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>Качество доставки</CardTitle>
          <CardDescription>Попадание обработанных сообщений во входящие.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-2">
            <div
              role="img"
              aria-label={`Доля доставленных писем: ${formatPercent(metrics.deliveryRate)}`}
              className="grid size-40 place-items-center rounded-full"
              style={{ background: deliveryRing }}
            >
              <div className="grid size-[118px] place-items-center rounded-full bg-surface text-center shadow-[inset_0_0_0_1px_var(--border)]">
                <div>
                  <p className="m-0 text-[27px] leading-none font-semibold tracking-[-0.04em] text-text-strong">
                    {formatPercent(metrics.deliveryRate)}
                  </p>
                  <p className="mt-1.5 mb-0 text-[10px] text-text-muted">Доставлено</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <DeliveryLegendItem
              label="Доставлено"
              value={metrics.delivered}
              dotClassName="bg-success"
            />
            <DeliveryLegendItem
              label="Возвраты"
              value={metrics.bounced}
              dotClassName="bg-danger"
            />
            <DeliveryLegendItem
              label="В ожидании"
              value={pending}
              dotClassName="bg-surface-inset ring-1 ring-border-strong"
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-[10px] bg-surface-subtle px-3 py-2.5 text-[11px]">
            <span className="text-text-muted">Отписались</span>
            <span className="font-semibold tabular-nums text-text-strong">
              {formatNumber(metrics.unsubscribed)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeliveryLegendItem({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: number;
  dotClassName: string;
}) {
  return (
    <div className="rounded-[10px] bg-surface-subtle p-3">
      <span className={`block size-1.5 rounded-full ${dotClassName}`} />
      <p className="mt-2 mb-0 text-[13px] font-semibold tabular-nums text-text-strong">
        {formatNumber(value)}
      </p>
      <p className="mt-0.5 mb-0 text-[9px] text-text-muted">{label}</p>
    </div>
  );
}

function PreSendPerformance({ campaign }: { campaign: Campaign }) {
  const isScheduled = campaign.status === "scheduled";
  const isDraft = campaign.status === "draft";
  const Icon = isScheduled ? CalendarClock : isDraft ? FileEdit : Send;
  const title = isScheduled
    ? "Всё готово к запуску"
    : isDraft
      ? "Показатели появятся после отправки"
      : "Событий доставки пока нет";
  const description = isScheduled
    ? `${BRAND_NAME} начнёт собирать данные о доставке и вовлечённости после запланированной отправки ${formatDateTime(campaign.scheduledAt)}.`
    : isDraft
      ? "Завершите проверку аудитории, контента и отправителя. После запуска отчёт заполнится автоматически."
      : "По этой кампании пока нет данных об отправке. Проверьте настройки перед повторной попыткой.";

  const checks = [
    {
      label: "Аудитория выбрана",
      detail: `Получателей: ${formatNumber(campaign.metrics.recipients)}`,
      complete: campaign.metrics.recipients > 0,
    },
    {
      label: "Контент письма готов",
      detail: campaign.subject || "Нужно указать тему",
      complete: Boolean(campaign.subject),
    },
    {
      label: "Отправитель настроен",
      detail: campaign.senderEmail || "Нужно указать отправителя",
      complete: Boolean(campaign.senderEmail),
    },
    {
      label: isScheduled ? "Время отправки подтверждено" : "Запланировать или отправить",
      detail: isScheduled ? formatDateTime(campaign.scheduledAt) : "Не запланировано",
      complete: Boolean(campaign.scheduledAt),
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,.75fr)]">
        <div className="flex min-h-72 flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_10%,var(--primary-subtle),transparent_52%)] px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-[14px] border border-primary/10 bg-primary-subtle text-primary shadow-[var(--shadow-xs)]">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-5 mb-0 text-[17px] font-semibold tracking-[-0.02em] text-text-strong">
            {title}
          </h3>
          <p className="mt-2 mb-0 max-w-lg text-[12px] leading-5 text-text-muted">
            {description}
          </p>
          <Link
            href={
              isDraft
                ? `/campaigns/new?draft=${campaign.id}`
                : `/campaigns/new?campaign=${campaign.id}&step=review`
            }
            className="btn btn-secondary mt-5"
          >
            {isDraft ? "Продолжить настройку" : "Проверить кампанию"}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>

        <div className="border-t border-border px-5 py-6 lg:border-t-0 lg:border-l lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[13px] font-semibold text-text-strong">
                Готовность к запуску
              </p>
              <p className="mt-1 mb-0 text-[11px] text-text-muted">
                {checks.filter((check) => check.complete).length} из {checks.length}{" "}
                проверок выполнено
              </p>
            </div>
            <Badge variant={isScheduled ? "success" : "warning"} dot>
              {isScheduled ? "Готово" : "В процессе"}
            </Badge>
          </div>
          <div className="mt-5 space-y-1">
            {checks.map((check) => (
              <div
                key={check.label}
                className="flex items-start gap-3 rounded-[10px] px-2 py-3"
              >
                <span
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                    check.complete
                      ? "bg-success-subtle text-success"
                      : "bg-surface-subtle text-text-subtle"
                  }`}
                >
                  {check.complete ? (
                    <Check aria-hidden="true" className="size-3" strokeWidth={2.5} />
                  ) : (
                    <CircleDashed aria-hidden="true" className="size-3" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[11px] font-medium text-text-strong">
                    {check.label}
                  </p>
                  <p className="mt-0.5 mb-0 truncate text-[10px] text-text-muted">
                    {check.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ContentPreview({
  campaign,
  template,
}: {
  campaign: Campaign;
  template?: EmailTemplate;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <CardTitle>Контент письма</CardTitle>
          <CardDescription>
            Предпросмотр кампании с выбранным контентом и персонализацией.
          </CardDescription>
        </div>
        <Badge variant={template ? "accent" : "neutral"}>
          {template?.name ?? "Собственное письмо"}
        </Badge>
      </CardHeader>
      <CardContent className="bg-surface-subtle p-3 sm:p-5">
        <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-[var(--shadow-sm)]">
          <div className="grid gap-2 border-b border-border bg-surface px-4 py-4 text-[11px] sm:grid-cols-[58px_1fr] sm:px-5">
            <span className="text-text-subtle">От</span>
            <span className="truncate font-medium text-text-strong">
              {campaign.senderName}{" "}
              <span className="font-normal text-text-muted">
                &lt;{campaign.senderEmail}&gt;
              </span>
            </span>
            <span className="text-text-subtle">Кому</span>
            <span className="truncate text-text">
              {campaign.audience} · Контактов: {formatNumber(campaign.metrics.recipients)}
            </span>
            <span className="text-text-subtle">Тема</span>
            <span className="font-semibold text-text-strong">{campaign.subject}</span>
          </div>

          <div className="bg-[#f5f6f9] px-3 py-5 sm:px-6 sm:py-8">
            <div
              className="mx-auto max-w-[590px] overflow-hidden rounded-[10px] border border-[#e5e7ec] bg-white shadow-[0_8px_24px_rgba(24,27,45,0.06)]"
              style={{
                backgroundColor: template?.backgroundColor ?? "#ffffff",
              }}
            >
              {template ? (
                <div className="px-7 py-9 sm:px-12 sm:py-12">
                  {template.blocks.map((block) => (
                    <EmailPreviewBlock
                      key={block.id}
                      block={block}
                      accentColor={template.accentColor}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-7 py-12 text-center sm:px-12">
                  <span className="mx-auto grid size-10 place-items-center rounded-[12px] bg-surface-subtle text-text-muted">
                    <Mail aria-hidden="true" className="size-4" />
                  </span>
                  <h3 className="mt-4 mb-0 text-[18px] font-semibold tracking-[-0.02em] text-[#20222b]">
                    {campaign.subject}
                  </h3>
                  <p className="mt-2 mb-0 text-[12px] leading-6 text-[#707582]">
                    {campaign.previewText ||
                      "Текст этого письма недоступен в текущем предпросмотре."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-[10px] text-text-muted sm:px-5">
            <Mail aria-hidden="true" className="size-3.5" />
            <span className="truncate">Предпросмотр: {campaign.previewText}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmailPreviewBlock({
  block,
  accentColor,
}: {
  block: EmailBlock;
  accentColor: string;
}) {
  const alignment = block.alignment ?? "left";
  const alignmentClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[alignment];

  if (block.type === "divider") {
    return <div className="my-6 h-px bg-black/10" />;
  }

  if (block.type === "spacer") {
    return <div aria-hidden="true" className="h-6" />;
  }

  if (block.type === "logo") {
    return (
      <p
        className={`mt-0 mb-8 text-[10px] font-bold tracking-[0.16em] ${alignmentClass}`}
        style={{ color: accentColor }}
      >
        {block.content}
      </p>
    );
  }

  if (block.type === "heading") {
    return (
      <h3
        className={`mt-0 mb-4 text-[25px] leading-[1.15] font-semibold tracking-[-0.035em] text-[#1d2029] sm:text-[30px] ${alignmentClass}`}
      >
        {block.content}
      </h3>
    );
  }

  if (block.type === "button") {
    return (
      <div className={`my-7 ${alignmentClass}`}>
        <span
          className="inline-flex min-h-10 items-center justify-center rounded-[8px] px-5 text-[11px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: accentColor }}
        >
          {block.label ?? block.content}
        </span>
      </div>
    );
  }

  if (block.type === "footer") {
    return (
      <p
        className={`mt-8 mb-0 border-t border-black/10 pt-5 text-[9px] leading-5 text-[#8a8e99] ${alignmentClass}`}
      >
        {block.content}
      </p>
    );
  }

  return (
    <p
      className={`mt-0 mb-4 text-[11px] leading-6 text-[#5e6370] ${alignmentClass}`}
    >
      {block.content}
    </p>
  );
}

function CampaignDetails({ campaign }: { campaign: Campaign }) {
  const rows = [
    { label: "Владелец", value: campaign.owner },
    { label: "Создана", value: formatDate(campaign.createdAt) },
    {
      label: campaign.sentAt ? "Отправлена" : "Запланирована",
      value: formatDateTime(campaign.sentAt ?? campaign.scheduledAt),
    },
  ];

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle>Данные кампании</CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-[11px] text-text-muted">Статус</span>
          <StatusBadge
            status={statusTones[campaign.status]}
            label={campaignStatusLabels[campaign.status]}
          />
        </div>
        {rows.map((row) => (
          <div key={row.label}>
            <Separator />
            <div className="flex items-start justify-between gap-6 py-3 text-[11px]">
              <span className="shrink-0 text-text-muted">{row.label}</span>
              <span className="text-right font-medium text-text-strong">
                {row.value}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AudienceDetails({
  campaign,
  segmentName,
}: {
  campaign: Campaign;
  segmentName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-subtle text-primary">
            <UsersRound aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-text-subtle">
                  Аудитория
                </p>
                <p className="mt-1 mb-0 truncate text-[13px] font-semibold text-text-strong">
                  {campaign.audience}
                </p>
              </div>
              <Badge variant={segmentName ? "success" : "outline"}>
                {segmentName ? "Динамическая" : "Список"}
              </Badge>
            </div>
            <p className="mt-2 mb-0 text-[11px] text-text-muted">
              Получателей: {formatNumber(campaign.metrics.recipients)}
              {segmentName ? ` · ${segmentName}` : ""}
            </p>
            {campaign.segmentId ? (
              <Link
                href="/segments"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover"
              >
                Открыть сегмент
                <ArrowRight aria-hidden="true" className="size-3" />
              </Link>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SenderDetails({ campaign }: { campaign: Campaign }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <Avatar name={campaign.senderName} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="m-0 truncate text-[13px] font-semibold text-text-strong">
                {campaign.senderName}
              </p>
              <span title="Проверенный отправитель">
                <Check
                  aria-label="Проверенный отправитель"
                  className="size-3.5 rounded-full bg-success p-0.5 text-white"
                  strokeWidth={3}
                />
              </span>
            </div>
            <p className="mt-0.5 mb-0 truncate text-[11px] text-text-muted">
              {campaign.senderEmail}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-success-subtle px-3 py-2.5 text-[10px] text-success">
          <UserRound aria-hidden="true" className="size-3.5" />
          Личность отправителя подтверждена
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignNotFound() {
  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <ArrowLeft
          aria-hidden="true"
          className="size-3.5 transition-transform group-hover:-translate-x-0.5"
        />
        Все кампании
      </Link>
      <Card>
        <CardContent className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-[14px] border border-border bg-surface-subtle text-text-muted shadow-[var(--shadow-xs)]">
            <SearchX aria-hidden="true" className="size-5" />
          </span>
          <h1 className="mt-5 mb-0 text-[20px] font-semibold tracking-[-0.025em] text-text-strong">
            Кампания не найдена
          </h1>
          <p className="mt-2 mb-0 max-w-sm text-[12px] leading-5 text-text-muted">
            Возможно, кампания удалена или ссылка устарела. Остальные кампании
            по-прежнему доступны.
          </p>
          <Link href="/campaigns" className="btn btn-primary mt-6">
            Вернуться к кампаниям
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
