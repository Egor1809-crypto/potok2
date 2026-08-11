"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Copy,
  MailPlus,
  MoreHorizontal,
  Pause,
  Play,
  Send,
  UsersRound,
} from "lucide-react";
import { campaigns as mockCampaigns } from "@/data/mockCampaigns";
import type { Campaign, CampaignStatus } from "@/types";
import { PageHeader } from "@/components/shared";
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Modal,
  SearchInput,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  ToastSurface,
  buttonVariants,
  cn,
} from "@/components/ui";
import {
  campaignStatusLabels,
  formatCampaignNumber,
  formatCampaignPercent,
} from "./campaignLabels";

export type CampaignsTab = "all" | CampaignStatus;

const tabs: { value: CampaignsTab; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "draft", label: "Черновики" },
  { value: "scheduled", label: "Запланированные" },
  { value: "sending", label: "Отправляются" },
  { value: "completed", label: "Завершённые" },
];

const statusTone: Record<
  CampaignStatus,
  "neutral" | "info" | "accent" | "success"
> = {
  draft: "neutral",
  scheduled: "info",
  sending: "accent",
  completed: "success",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return formatCampaignNumber(value);
}

export interface CampaignsViewProps {
  items?: Campaign[];
  initialTab?: CampaignsTab;
}

export function CampaignsView({
  items = mockCampaigns,
  initialTab = "all",
}: CampaignsViewProps) {
  const [activeTab, setActiveTab] = React.useState<CampaignsTab>(initialTab);
  const [search, setSearch] = React.useState("");
  const [actionCampaign, setActionCampaign] = React.useState<Campaign | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const notify = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  };

  const filteredCampaigns = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items.filter((campaign) => {
      const matchesTab = activeTab === "all" || campaign.status === activeTab;
      const matchesSearch =
        !query ||
        [campaign.name, campaign.subject, campaign.audience, campaign.owner]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      return matchesTab && matchesSearch;
    });
  }, [activeTab, items, search]);

  const statusCounts = React.useMemo(
    () =>
      items.reduce<Record<CampaignsTab, number>>(
        (counts, campaign) => {
          counts.all += 1;
          counts[campaign.status] += 1;
          return counts;
        },
        { all: 0, draft: 0, scheduled: 0, sending: 0, completed: 0 },
      ),
    [items],
  );

  const delivered = items.reduce(
    (total, campaign) => total + campaign.metrics.delivered,
    0,
  );
  const averageOpenRate =
    items.filter((campaign) => campaign.metrics.delivered > 0).reduce(
      (total, campaign, _, completed) =>
        total + campaign.metrics.openRate / completed.length,
      0,
    ) || 0;

  return (
    <div className="relative space-y-6">
      <PageHeader
        eyebrow="Коммуникации"
        title="Кампании"
        description="Создавайте адресные рассылки, управляйте расписанием и отслеживайте каждый диалог."
        meta={`Кампаний: ${items.length}`}
        action={
          <Link href="/campaigns/new" className={buttonVariants({ variant: "primary" })}>
            <MailPlus aria-hidden="true" className="size-4" />
            Новая кампания
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Сводка по кампаниям">
        <article className="card flex items-center gap-3.5 p-4">
          <span className="grid size-9 place-items-center rounded-[10px] bg-primary-subtle text-primary">
            <Send aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="m-0 text-[11px] text-text-muted">Доставлено</p>
            <p className="mt-0.5 mb-0 text-[19px] font-semibold tracking-[-0.03em] text-text-strong">
              {formatNumber(delivered)}
            </p>
          </div>
        </article>
        <article className="card flex items-center gap-3.5 p-4">
          <span className="grid size-9 place-items-center rounded-[10px] bg-info-subtle text-info">
            <CalendarClock aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="m-0 text-[11px] text-text-muted">Запланированы и отправляются</p>
            <p className="mt-0.5 mb-0 text-[19px] font-semibold tracking-[-0.03em] text-text-strong">
              {statusCounts.scheduled + statusCounts.sending}
            </p>
          </div>
        </article>
        <article className="card flex items-center gap-3.5 p-4">
          <span className="grid size-9 place-items-center rounded-[10px] bg-success-subtle text-success">
            <BarChart3 aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="m-0 text-[11px] text-text-muted">Средняя доля открытий</p>
            <p className="mt-0.5 mb-0 text-[19px] font-semibold tracking-[-0.03em] text-text-strong">
              {formatCampaignPercent(averageOpenRate)}
            </p>
          </div>
        </article>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as CampaignsTab)}
            className="min-w-0"
          >
            <TabsList className="border-b-0">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                  <span
                    className={cn(
                      "ml-1.5 rounded-full bg-surface-subtle px-1.5 py-0.5 text-[9px] text-text-subtle",
                      activeTab === tab.value && "bg-primary-subtle text-primary",
                    )}
                  >
                    {statusCounts[tab.value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Поиск кампаний"
            aria-label="Поиск кампаний"
            wrapperClassName="mb-3 w-full sm:w-64"
            className="h-9 min-h-9"
          />
        </div>

        {filteredCampaigns.length > 0 ? (
          <TableContainer className="rounded-none border-0 shadow-none">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Кампания</TableHead>
                  <TableHead>Аудитория</TableHead>
                  <TableHead>Получатели</TableHead>
                  <TableHead>Отправлено</TableHead>
                  <TableHead>Открытия</TableHead>
                  <TableHead>Переходы</TableHead>
                  <TableHead>Ответы</TableHead>
                  <TableHead>Создана</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Действия</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="min-w-64">
                      <a
                        href={`/campaigns/${campaign.id}`}
                        className="group inline-flex max-w-64 items-center gap-2.5"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-primary/10 bg-primary-subtle text-primary">
                          <Send aria-hidden="true" className="size-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-text-strong transition-colors group-hover:text-primary">
                            {campaign.name}
                          </span>
                          <span className="mt-0.5 block max-w-52 truncate text-[10px] text-text-subtle">
                            {campaign.subject}
                          </span>
                        </span>
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-text">
                        <UsersRound aria-hidden="true" className="size-3.5 text-text-subtle" />
                        {campaign.audience}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatNumber(campaign.metrics.recipients)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {campaign.metrics.sent > 0 ? formatNumber(campaign.metrics.sent) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {campaign.metrics.delivered > 0
                        ? formatCampaignPercent(campaign.metrics.openRate)
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {campaign.metrics.delivered > 0
                        ? formatCampaignPercent(campaign.metrics.clickRate)
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {campaign.metrics.replies > 0
                        ? formatNumber(campaign.metrics.replies)
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[11px] text-text-muted">
                      {formatDate(campaign.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusTone[campaign.status]} dot>
                        {campaignStatusLabels[campaign.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        label={`Действия с кампанией «${campaign.name}»`}
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionCampaign(campaign)}
                      >
                        <MoreHorizontal aria-hidden="true" className="size-4" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            icon={<Send className="size-5" />}
            title="Кампании не найдены"
            description={
              search
                ? "Измените запрос или сбросьте текущие фильтры."
                : "В этом рабочем пространстве пока нет кампаний с выбранным статусом."
            }
            action={
              search
                ? { label: "Очистить поиск", onClick: () => setSearch("") }
                : { label: "Создать кампанию", onClick: () => window.location.assign("/campaigns/new") }
            }
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-[11px] text-text-muted">
          <span>
            Показано {filteredCampaigns.length} из {items.length} кампаний
          </span>
          <span>Обновлено несколько секунд назад</span>
        </div>
      </section>

      <Modal
        open={Boolean(actionCampaign)}
        onOpenChange={(open) => !open && setActionCampaign(null)}
        title={actionCampaign?.name ?? "Действия с кампанией"}
        description="Выберите действие с этой кампанией."
        size="sm"
      >
        {actionCampaign && (
          <div className="grid gap-2">
            <a
              href={`/campaigns/${actionCampaign.id}`}
              className="group flex items-center justify-between rounded-[10px] border border-border p-3.5 transition-colors hover:border-primary/25 hover:bg-primary-subtle/40"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-[9px] bg-primary-subtle text-primary">
                  <BarChart3 aria-hidden="true" className="size-4" />
                </span>
                <span>
                  <span className="block text-[12px] font-semibold text-text-strong">Открыть кампанию</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">Эффективность и подробности доставки</span>
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="size-4 text-text-subtle group-hover:text-primary" />
            </a>
            <a
              href={`/campaigns/new?duplicate=${encodeURIComponent(actionCampaign.id)}`}
              className="group flex items-center justify-between rounded-[10px] border border-border p-3.5 transition-colors hover:border-primary/25 hover:bg-primary-subtle/40"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-[9px] bg-surface-subtle text-text-muted">
                  <Copy aria-hidden="true" className="size-4" />
                </span>
                <span>
                  <span className="block text-[12px] font-semibold text-text-strong">Дублировать кампанию</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">Повторно использовать аудиторию и контент</span>
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="size-4 text-text-subtle group-hover:text-primary" />
            </a>
            <Button
              variant="ghost"
              className="mt-1 justify-start"
              leadingIcon={
                actionCampaign.status === "sending" ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )
              }
              onClick={() => {
                notify(
                  actionCampaign.status === "sending"
                    ? "Отправка приостановлена в деморежиме"
                    : "Кампания поставлена в очередь в деморежиме",
                );
                setActionCampaign(null);
              }}
            >
              {actionCampaign.status === "sending" ? "Приостановить отправку" : "Выполнить демо-действие"}
            </Button>
          </div>
        )}
      </Modal>

      {notice && (
        <div className="fixed right-4 bottom-4 z-[170] w-[min(360px,calc(100vw-32px))]">
          <ToastSurface
            tone="success"
            title={notice}
            description="Внешние письма не отправлялись."
            onDismiss={() => setNotice(null)}
          />
        </div>
      )}
    </div>
  );
}
