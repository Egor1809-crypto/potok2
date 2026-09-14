"use client";

import Link from "next/link";
import { MiniCalendar } from "./MiniCalendar";
import {
  ArrowRight,
  Cable,
  Check,
  CircleAlert,
  Clock3,
  ContactRound,
  FileText,
  GalleryHorizontalEnd,
  Eye,
  ImagePlus,
  LibraryBig,
  MailPlus,
  MailCheck,
  LayoutTemplate,
  LoaderCircle,
  Megaphone,
  Plus,
  PanelsTopLeft,
  RefreshCw,
  Send,
  MousePointerClick,
  SendHorizontal,
  UsersRound,
  UserSearch,
  Zap,
} from "@/components/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  CampaignRecord,
  CampaignStatus,
  ImageStudioStatusResponse,
  PresentationsListResponse,
  UniSenderLifetimeStatsResponse,
  WorkspaceSnapshot,
} from "@/types/api";

const REFRESH_INTERVAL = 3 * 60_000;

const number = new Intl.NumberFormat("ru-RU");
function formatDate(value: string, timeZone: string) {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  };
  try {
    return new Intl.DateTimeFormat("ru-RU", options).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: "UTC" }).format(new Date(value));
  }
}

const statusLabel: Record<CampaignStatus, string> = {
  draft: "Черновик",
  ready: "Готова к запуску",
  blocked: "Нужна настройка",
  scheduled: "Запланирована",
  sending: "Отправляется",
  completed: "Завершена",
  cancelled: "Отменена",
};

const statusTone: Record<CampaignStatus, string> = {
  draft: "badge-neutral",
  ready: "badge-success",
  blocked: "badge-warning",
  scheduled: "badge-info",
  sending: "badge-warning",
  completed: "badge-success",
  cancelled: "badge-neutral",
};

function unwrap(payload: unknown): WorkspaceSnapshot {
  if (!payload || typeof payload !== "object") throw new Error("Сервер вернул пустой ответ");
  const envelope = payload as { data?: unknown };
  return (envelope.data && typeof envelope.data === "object" ? envelope.data : payload) as WorkspaceSnapshot;
}

function errorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: unknown }).error === "string") {
    return (payload as { error: string }).error;
  }
  return "Не удалось загрузить рабочее состояние";
}

export function DashboardView() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [creativeCounts, setCreativeCounts] = useState({ presentations: 0, images: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [providerRefreshing, setProviderRefreshing] = useState(false);
  const [providerRefreshProgress, setProviderRefreshProgress] = useState(0);

  const activeRefresh = useRef<AbortController | null>(null);
  const lastRefreshStarted = useRef(0);

  const refreshProviderStats = useCallback(async (signal: AbortSignal) => {
    setProviderRefreshing(true);
    setProviderRefreshProgress(0);
    try {
      let cursor = 0;
      let failed = 0;
      while (!signal.aborted) {
        const response = await fetch("/api/analytics/unisender-summary", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "full", cursor }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
        });
        if (!response.ok) throw new Error("Не удалось обновить статистику рассылок. Повторим автоматически.");
        const payload = await response.json() as UniSenderLifetimeStatsResponse;
        if (signal.aborted) return;
        failed += payload.sync.failed;
        setSnapshot((current) => current ? {
          ...current,
          stats: {
            ...current.stats,
            unisenderLifetime: payload.stats,
            unisenderByParticipant: payload.byParticipant,
          },
        } : current);
        setProviderRefreshProgress(payload.sync.total > 0
          ? Math.min(100, Math.round(((payload.sync.nextCursor ?? payload.sync.total) / payload.sync.total) * 100))
          : 100);
        if (payload.sync.complete || payload.sync.nextCursor === null) break;
        if (payload.sync.nextCursor <= cursor) throw new Error("Обновление статистики остановилось. Повторим автоматически.");
        cursor = payload.sync.nextCursor;
      }
      if (failed > 0) throw new Error("Часть статистики пока не обновилась. Повторим автоматически.");
    } finally {
      if (!signal.aborted) setProviderRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (activeRefresh.current) return;
    const controller = new AbortController();
    activeRefresh.current = controller;
    lastRefreshStarted.current = Date.now();
    const { signal } = controller;
    // Bound a stalled request without interrupting a full paginated sync.
    const fetchDashboard = (url: string) => fetch(url, { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
    setLoading(true);
    setError("");
    try {
      const response = await fetchDashboard("/api/workspace?scope=dashboard");
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload));
      const next = unwrap(payload);
      if (signal.aborted) return;
      // Keep the complete provider totals until reconciliation returns them;
      // the workspace response may contain only a recent campaign window.
      setSnapshot(current => current ? { ...next, stats: { ...next.stats, unisenderLifetime: current.stats.unisenderLifetime, unisenderByParticipant: current.stats.unisenderByParticipant } } : next);
      await Promise.all([
        refreshProviderStats(signal),
        Promise.allSettled([
          fetchDashboard("/api/presentations").then(async result => {
            if (!result.ok) throw new Error("Презентации недоступны");
            return result.json() as Promise<PresentationsListResponse>;
          }),
          fetchDashboard("/api/image-studio").then(async result => {
            if (!result.ok) throw new Error("Медиатека недоступна");
            return result.json() as Promise<ImageStudioStatusResponse>;
          }),
        ]).then(([presentationsResult, imagesResult]) => {
          if (!signal.aborted) setCreativeCounts(current => ({
            presentations: presentationsResult.status === "fulfilled" ? presentationsResult.value.presentations.length : current.presentations,
            images: imagesResult.status === "fulfilled" ? imagesResult.value.assets.length : current.images,
          }));
        }),
      ]);
    } catch (reason) {
      if (!signal.aborted) setError(reason instanceof Error && reason.name !== "TimeoutError" && reason.name !== "TypeError"
        ? reason.message
        : "Не удалось обновить данные. Повторим автоматически.");
    } finally {
      controller.abort();
      if (activeRefresh.current === controller) {
        activeRefresh.current = null;
        setLoading(false);
        setProviderRefreshing(false);
      }
    }
  }, [refreshProviderStats]);

  useEffect(() => {
    const refresh = () => { if (!document.hidden) void load(); };
    const frame = window.requestAnimationFrame(refresh);
    const interval = window.setInterval(refresh, REFRESH_INTERVAL);
    const onVisible = () => {
      if (Date.now() - lastRefreshStarted.current >= REFRESH_INTERVAL) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      activeRefresh.current?.abort();
      activeRefresh.current = null;
    };
  }, [load]);

  const recentCampaigns = useMemo(
    () => [...(snapshot?.campaigns ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5),
    [snapshot],
  );

  if (loading && !snapshot) {
    return <LoadingState />;
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[var(--danger)]/20 bg-[var(--surface)] p-8 text-center shadow-sm">
        <CircleAlert aria-hidden="true" className="mx-auto size-10 text-[var(--danger)]" />
        <h1 className="mt-4 text-xl font-semibold">Не удалось открыть рабочее пространство</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p>
        <button type="button" onClick={() => void load()} className="btn btn-primary mt-5 gap-2"><RefreshCw aria-hidden="true" className="size-6" />Повторить</button>
      </div>
    );
  }

  const nextAction = getNextAction(snapshot);
  const connectedEmailProvider = snapshot.integrations.some(
    (integration) =>
      integration.enabled &&
      integration.status === "connected" &&
      integration.deliveryMode === "automatic" &&
      integration.channels.includes("email"),
  );
  const providerStats = snapshot.stats.unisenderLifetime;
  const participantStats = snapshot.stats.unisenderByParticipant ?? [];
  const deliveryRate = providerStats.sent ? Math.round((providerStats.delivered / providerStats.sent) * 100) : 0;
  const openRate = providerStats.delivered ? Math.round((providerStats.opened / providerStats.delivered) * 100) : 0;
  const uniqueClicks = providerStats.clickedUnique ?? providerStats.clicked;
  const clickRate = providerStats.delivered ? Math.round((uniqueClicks / providerStats.delivered) * 100) : 0;
  const providerMetrics = [
    { label: "Отправлено", value: providerStats.sent, note: `${number.format(providerStats.campaigns)} кампаний`, Icon: SendHorizontal, tone: "bg-primary-subtle text-primary" },
    { label: "Доставлено", value: providerStats.delivered, note: `${deliveryRate}% от отправленных`, Icon: MailCheck, tone: "bg-success-subtle text-success" },
    { label: "Прочитано", value: providerStats.opened, note: `${openRate}% от доставленных`, Icon: Eye, tone: "bg-info-subtle text-info" },
    { label: "Все переходы", value: providerStats.clicked, note: `${number.format(uniqueClicks)} уникальных по кампаниям · ${clickRate}%`, Icon: MousePointerClick, tone: "bg-surface-subtle text-text-strong" },
  ];
  const metrics = [
    { label: "Шаблоны", value: number.format(snapshot.templates.length), note: "Макеты можно редактировать и клонировать", Icon: LibraryBig, href: "/templates", iconTone: "bg-primary-subtle text-text-strong border-border-strong" },
    { label: "Презентации", value: number.format(creativeCounts.presentations), note: "Сохранённые редактируемые проекты", Icon: GalleryHorizontalEnd, href: "/presentations", iconTone: "bg-surface-subtle text-text-strong border-border-strong" },
    { label: "Изображения", value: number.format(creativeCounts.images), note: "Визуалы в общей медиатеке", Icon: ImagePlus, href: "/image-studio", iconTone: "bg-surface-subtle text-text-strong border-border-strong" },
    { label: "Контакты", value: number.format(snapshot.stats.totalContacts), note: `${number.format(snapshot.stats.activeContacts)} доступны для работы`, Icon: UsersRound, href: "/contacts", iconTone: "bg-surface-subtle text-text-strong border-border-strong" },
    { label: "Рассылки писем", value: number.format(snapshot.stats.totalCampaigns), note: `${number.format(snapshot.stats.activeCampaigns)} требуют внимания`, Icon: SendHorizontal, href: "/campaigns", iconTone: "bg-surface-subtle text-text-strong border-border-strong" },
    { label: "Подключённые каналы", value: number.format(snapshot.stats.connectedIntegrations), note: "Email, Telegram или ВКонтакте", Icon: Zap, href: "/integrations", iconTone: "bg-primary-subtle text-text-strong border-border-strong" },
  ];

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-text-strong">{error}</p> : null}
      <section aria-label="Сводка рассылок" aria-busy={loading} className="grid min-w-0 gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_232px] sm:items-start sm:p-7">
        <div className="min-w-0">
          <h1 className="sr-only">Обзор рассылок</h1>
          <div className="flex min-w-0 flex-wrap gap-2"><Link href="/templates" className="btn btn-secondary w-fit gap-2"><LayoutTemplate aria-hidden="true" className="size-6" />Выбрать шаблон</Link><Link href="/email-builder?new=1" className="btn btn-primary w-fit gap-2"><Plus aria-hidden="true" className="size-6" />Создать письмо</Link><Link href="/campaigns" className="btn btn-secondary w-fit gap-2"><SendHorizontal aria-hidden="true" className="size-6" />Рассылка писем</Link></div>
          <div className="mt-6 grid min-w-0 grid-cols-1 gap-x-5 gap-y-6 min-[360px]:grid-cols-2 xl:grid-cols-4">
            {providerMetrics.map(({ label, value, note, Icon, tone }) => (
              <article key={label} aria-label={label} className="min-w-0">
                <span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" className="size-7" /></span>
                <p className="mt-3 break-words text-[30px] font-semibold tabular-nums tracking-[-.045em]">{number.format(value)}</p>
                <p className="mt-1 text-[12px] font-semibold">{label}</p>
                <p className="mt-1 text-[10px] text-[var(--text-subtle)]">{note}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs text-text-subtle" role="status">{providerRefreshing ? `Обновляем данные… ${providerRefreshProgress}%` : "UniSender · за всё время · обновление каждые 3 минуты"}</p>
        </div>
        <div className="flex min-w-0 justify-center sm:justify-end"><MiniCalendar campaigns={snapshot.calendarSchedule ?? snapshot.campaigns} /></div>
      </section>

      <section className="card min-w-0 overflow-hidden px-5 py-4 sm:px-6" aria-labelledby="participant-stats-title">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="participant-stats-title" className="text-[13px] font-semibold">По авторам рассылок</h2>
            <Link href="/analytics" className="text-[11px] font-semibold text-[var(--primary)]">Подробная аналитика →</Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {participantStats.map((item) => {
              const isCurrent = item.participantId === snapshot.participant.id;
              return <article key={item.participantId} className={`rounded-xl border px-3 py-2.5 ${isCurrent ? "border-[var(--primary)]/35 bg-[var(--primary-subtle)]/40" : "border-[var(--border)] bg-[var(--surface-subtle)]/55"}`}>
                <div className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ backgroundColor: item.color }} /><b className="text-[11px]">{item.displayName}</b>{isCurrent && <span className="badge badge-primary ml-auto">Вы</span>}</div>
                <p className="mt-2 text-[10px] text-[var(--text-muted)]">Отправлено <b className="text-[var(--text-strong)]">{number.format(item.sent)}</b> · доставлено {number.format(item.delivered)} · прочитано {number.format(item.opened)} · переходы {number.format(item.clicked)}{item.clickedUnique !== undefined ? ` · уникальных ${number.format(item.clickedUnique)}` : ""}</p>
              </article>;
            })}
          </div>
      </section>

      <section id="creative-studio" className="grid scroll-mt-24 gap-3 md:grid-cols-3" aria-label="Творческие модули">
        <StudioCard href="/presentations?new=1" Icon={PanelsTopLeft} title="Презентация" />
        <StudioCard href="/image-studio?new=1" Icon={ImagePlus} title="Изображение" />
        <StudioCard href="/contact-finder" Icon={UserSearch} title="Поиск контактов" />
      </section>

      <section className={`rounded-2xl border p-5 sm:p-6 ${nextAction.tone}`} aria-labelledby="next-action-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/75 text-[var(--primary)] shadow-sm"><nextAction.Icon aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="next-action-title" className="mt-1 text-[17px] font-semibold">{nextAction.title}</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{nextAction.description}</p>
          </div>
          <Link href={nextAction.href} className="btn btn-primary shrink-0 gap-2">{nextAction.action}<ArrowRight aria-hidden="true" className="size-6" /></Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Состояние рабочего пространства">
        {metrics.map(({ label, value, note, Icon, href, iconTone }) => (
          <Link key={label} href={href} className="card group p-4 transition hover:border-[var(--primary)]/30 hover:shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3"><p className="pt-1 text-[12px] font-semibold text-[var(--text-muted)]">{label}</p><span className={`grid size-9 place-items-center rounded-xl border ${iconTone} transition group-hover:scale-105`}><Icon aria-hidden="true" strokeWidth={1.8} className="size-7" /></span></div>
            <p className="mt-4 text-[26px] font-semibold tracking-[-.04em]">{value}</p>
            <p className="mt-1 text-[11px] leading-4 text-[var(--text-subtle)]">{note}</p>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <div className="card min-w-0 overflow-hidden">
          <div className="flex items-center justify-end border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <h2 className="sr-only">Последние рассылки</h2>
            <Link href="/campaigns" className="text-[12px] font-semibold text-[var(--primary)]">Все рассылки →</Link>
          </div>
          {recentCampaigns.length ? (
            <div className="divide-y divide-[var(--border)]">
              {recentCampaigns.map((campaign) => <CampaignRow key={campaign.id} campaign={campaign} timeZone={snapshot.workspace.timezone} />)}
            </div>
          ) : (
            <EmptyCampaigns />
          )}
        </div>

        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold">Готовность к рассылке</h2></div><Check aria-hidden="true" className="size-7 text-[var(--success)]" /></div>
          <ol className="mt-5 space-y-1">
            <ReadinessStep ready={snapshot.templates.length > 0} label="Есть шаблон письма" action="Создать" href="/email-builder?new=1" />
            <ReadinessStep ready={snapshot.stats.totalContacts > 0} label="Есть получатели" action="Добавить" href="/contacts" />
            <ReadinessStep ready={connectedEmailProvider} label="Подключён Email-провайдер" action="Подключить" href="/integrations" />
            <ReadinessStep ready={recentCampaigns.some((campaign) => campaign.status === "ready" || campaign.status === "scheduled")} label="Есть проверенная кампания" action="Проверить" href="/campaigns" />
          </ol>
          <p className="mt-5 rounded-xl bg-[var(--surface-subtle)] p-3 text-[11px] leading-5 text-[var(--text-muted)]">Для разовой рассылки достаточно выбрать конкретных получателей — сохранённый сегмент не обязателен. Перед запуском «Поток» повторно проверит провайдера, согласие и содержание письма.</p>
        </div>
      </section>
    </div>
  );
}

function getNextAction(snapshot: WorkspaceSnapshot) {
  if (snapshot.templates.length === 0) return { title: "Создайте первый шаблон", description: "Соберите визуальное письмо из блоков или попросите ИИ подготовить весь макет.", action: "Открыть студию", href: "/email-builder?new=1", Icon: LayoutTemplate, tone: "border-primary/20 bg-primary-subtle/55" };
  if (snapshot.stats.totalContacts === 0) return { title: "Добавьте первые контакты", description: "Импортируйте CSV или создайте контакт вручную. Без аудитории запуск невозможен.", action: "Добавить контакты", href: "/contacts", Icon: ContactRound, tone: "border-primary/20 bg-primary-subtle/55" };
  if (snapshot.stats.connectedIntegrations === 0) return { title: "Подключите канал доставки", description: "Выберите email, Telegram или ВКонтакте и завершите настройку провайдера.", action: "Настроить канал", href: "/integrations", Icon: Cable, tone: "border-primary/20 bg-primary-subtle/55" };
  const blocked = snapshot.campaigns.find((campaign) => campaign.status === "blocked");
  if (blocked) return { title: `Исправьте кампанию «${blocked.name}»`, description: blocked.statusReason || "Кампания не прошла проверку готовности.", action: "Открыть кампанию", href: `/campaigns/${blocked.id}`, Icon: CircleAlert, tone: "border-[#f0d8dc] bg-[#fff5f6]" };
  const draft = snapshot.campaigns.find((campaign) => campaign.status === "draft");
  if (draft) return { title: `Продолжите «${draft.name}»`, description: "Аудитория и черновик уже сохранены. Завершите каналы и проверку.", action: "Продолжить", href: `/campaigns/${draft.id}`, Icon: FileText, tone: "border-primary/20 bg-primary-subtle/55" };
  return { title: "Создайте новое письмо", description: "Возьмите шаблон, добавьте фирменные фото и логотип — отправку можно настроить позже.", action: "Создать письмо", href: "/email-builder?new=1", Icon: Send, tone: "border-[#d9eadf] bg-[#f2faf5]" };
}

function CampaignRow({ campaign, timeZone }: { campaign: CampaignRecord; timeZone: string }) {
  return (
    <Link href={`/campaigns/${campaign.id}`} className="grid grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-x-3 gap-y-2 px-5 py-4 transition hover:bg-[var(--surface-subtle)] sm:flex sm:px-6">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${campaign.status === "blocked" ? "bg-[var(--warning-subtle)] text-[var(--warning)]" : "bg-[var(--primary-subtle)] text-[var(--primary)]"}`}><Megaphone aria-hidden="true" className="size-6" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold">{campaign.name}</span><span className="mt-1 block truncate text-[10px] text-[var(--text-subtle)]">{campaign.audienceLabel} · {formatDate(campaign.updatedAt, timeZone)}</span></span>
      <span className={`badge col-start-2 row-start-2 justify-self-start ${statusTone[campaign.status]}`}>{statusLabel[campaign.status]}</span>
      <ArrowRight aria-hidden="true" className="col-start-3 row-start-1 size-6 shrink-0 text-[var(--text-subtle)]" />
    </Link>
  );
}

function ReadinessStep({ ready, label, action, href }: { ready: boolean; label: string; action: string; href: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg py-2.5">
      <span className={`grid size-6 shrink-0 place-items-center rounded-full ${ready ? "bg-[var(--success-subtle)] text-[var(--success)]" : "bg-[var(--warning-subtle)] text-[var(--warning)]"}`}>{ready ? <Check aria-hidden="true" className="size-5" /> : <Clock3 aria-hidden="true" className="size-5" />}</span>
      <span className="min-w-0 flex-1 break-words text-[12px] font-medium">{label}</span>
      {!ready && <Link href={href} className="text-[11px] font-semibold text-[var(--primary)]">{action}</Link>}
    </li>
  );
}

function StudioCard({ href, Icon, title }: {
  href: string;
  Icon: typeof MailPlus;
  title: string;
}) {
  return (
    <Link href={href} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--primary)]/35 hover:shadow-sm">
      <span className={`grid size-12 place-items-center rounded-xl border border-border-strong text-text-strong transition duration-200 group-hover:-rotate-2 group-hover:scale-105 bg-surface-subtle`}><Icon aria-hidden="true" strokeWidth={1.9} className="size-8" /></span>
      <h2 className="mt-4 text-[15px] font-semibold">{title}</h2>
    </Link>
  );
}

function EmptyCampaigns() {
  return (
    <div className="px-6 py-10 text-center"><Megaphone aria-hidden="true" className="mx-auto size-9 text-[var(--text-subtle)]" /><p className="mt-3 text-[13px] font-semibold">Кампаний пока нет</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Начните с аудитории, затем выберите сообщение и каналы.</p><Link href="/campaigns/new" className="btn btn-primary mt-4">Создать кампанию</Link></div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[420px] place-items-center"><div className="text-center"><LoaderCircle aria-hidden="true" className="mx-auto size-9 animate-spin text-[var(--primary)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем рабочее состояние…</p></div></div>
  );
}
