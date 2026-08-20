"use client";

import Link from "next/link";
import {
  ArrowRight,
  Blocks,
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
  Paintbrush,
  RefreshCw,
  Send,
  SearchCheck,
  MousePointerClick,
  SendHorizontal,
  Upload,
  UsersRound,
  UserSearch,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CampaignRecord,
  CampaignStatus,
  ImageStudioStatusResponse,
  PresentationsListResponse,
  UniSenderLifetimeStatsResponse,
  WorkspaceSnapshot,
} from "@/types/api";

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
  sending: "badge-info",
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

  const refreshProviderStats = useCallback(async () => {
    setProviderRefreshing(true);
    try {
      const response = await fetch("/api/analytics/unisender-summary", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const payload = await response.json() as UniSenderLifetimeStatsResponse;
      setSnapshot((current) => current ? {
        ...current,
        stats: {
          ...current.stats,
          unisenderLifetime: payload.stats,
          unisenderByParticipant: payload.byParticipant,
        },
      } : current);
    } finally {
      setProviderRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workspace?scope=dashboard", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload));
      setSnapshot(unwrap(payload));
      void refreshProviderStats();
      const [presentationsResult, imagesResult] = await Promise.allSettled([
        fetch("/api/presentations", { cache: "no-store" }).then(async (result) => {
          if (!result.ok) throw new Error("Презентации недоступны");
          return result.json() as Promise<PresentationsListResponse>;
        }),
        fetch("/api/image-studio", { cache: "no-store" }).then(async (result) => {
          if (!result.ok) throw new Error("Медиатека недоступна");
          return result.json() as Promise<ImageStudioStatusResponse>;
        }),
      ]);
      setCreativeCounts({
        presentations: presentationsResult.status === "fulfilled" ? presentationsResult.value.presentations.length : 0,
        images: imagesResult.status === "fulfilled" ? imagesResult.value.assets.length : 0,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [refreshProviderStats]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
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
        <CircleAlert aria-hidden="true" className="mx-auto size-8 text-[var(--danger)]" />
        <h1 className="mt-4 text-xl font-semibold">Не удалось открыть рабочее пространство</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p>
        <button type="button" onClick={() => void load()} className="btn btn-primary mt-5 gap-2"><RefreshCw aria-hidden="true" className="size-4" />Повторить</button>
      </div>
    );
  }

  const nextAction = getNextAction(snapshot);
  const participantName = snapshot.participant.displayName || "Участник";
  const firstName = participantName.split(" ")[0];
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
  const clickRate = providerStats.delivered ? Math.round((providerStats.clicked / providerStats.delivered) * 100) : 0;
  const providerMetrics = [
    { label: "Отправлено", value: providerStats.sent, note: `${number.format(providerStats.campaigns)} кампаний`, Icon: SendHorizontal, tone: "bg-primary-subtle text-primary" },
    { label: "Доставлено", value: providerStats.delivered, note: `${deliveryRate}% от отправленных`, Icon: MailCheck, tone: "bg-success-subtle text-success" },
    { label: "Прочитано", value: providerStats.opened, note: `${openRate}% от доставленных`, Icon: Eye, tone: "bg-info-subtle text-info" },
    { label: "Переходы", value: providerStats.clicked, note: `${clickRate}% от доставленных`, Icon: MousePointerClick, tone: "bg-surface-subtle text-text-strong" },
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
      <section className="grid gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center sm:p-7">
        <div>
          <p className="section-eyebrow">{snapshot.workspace.name}</p>
          <h1 className="text-[28px] font-semibold tracking-[-.04em] sm:text-[32px]">{firstName ? `${firstName}, что создаём сегодня?` : "Что создаём сегодня?"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Письмо, презентация и изображения живут в одной студии. Найденные контакты проходят вашу проверку, а готовые материалы можно повторно использовать в проектах.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/templates" className="btn btn-secondary w-fit gap-2"><LayoutTemplate aria-hidden="true" className="size-4" />Выбрать шаблон</Link><Link href="/email-builder?new=1" className="btn btn-primary w-fit gap-2"><Plus aria-hidden="true" className="size-4" />Создать письмо</Link><Link href="/campaigns" className="btn btn-secondary w-fit gap-2"><SendHorizontal aria-hidden="true" className="size-4" />Рассылка писем</Link></div>
      </section>

      <section className="card overflow-hidden" aria-labelledby="unisender-lifetime-title">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="section-eyebrow">UniSender · за всё время</p>
            <h2 id="unisender-lifetime-title" className="mt-1 text-[17px] font-semibold">Общие результаты рассылок</h2>
            <p className="mt-1 text-[11px] text-[var(--text-subtle)]">Данные провайдера по всем синхронизированным email-кампаниям.</p>
          </div>
          <button type="button" onClick={() => void refreshProviderStats()} disabled={providerRefreshing} className="btn btn-secondary w-fit gap-2">
            <RefreshCw aria-hidden="true" className={`size-4 ${providerRefreshing ? "animate-spin" : ""}`} />
            {providerRefreshing ? "Обновляем…" : "Обновить данные"}
          </button>
        </div>
        <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 xl:grid-cols-4">
          {providerMetrics.map(({ label, value, note, Icon, tone }) => (
            <article key={label} className="bg-[var(--surface)] p-5 sm:p-6">
              <span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" className="size-5" /></span>
              <p className="mt-5 text-[30px] font-semibold tracking-[-.045em]">{number.format(value)}</p>
              <p className="mt-1 text-[12px] font-semibold">{label}</p>
              <p className="mt-1 text-[10px] text-[var(--text-subtle)]">{note}</p>
            </article>
          ))}
        </div>
        <div className="border-t border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div><h3 className="text-[13px] font-semibold">Кто реально отправлял</h3><p className="mt-1 text-[10px] text-[var(--text-subtle)]">Показатели относятся к автору кампании, а не к ответственному за контакт.</p></div>
            <Link href="/analytics" className="text-[11px] font-semibold text-[var(--primary)]">Подробная аналитика →</Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {participantStats.map((item) => {
              const isCurrent = item.participantId === snapshot.participant.id;
              return <article key={item.participantId} className={`rounded-xl border px-3 py-2.5 ${isCurrent ? "border-[var(--primary)]/35 bg-[var(--primary-subtle)]/40" : "border-[var(--border)] bg-[var(--surface-subtle)]/55"}`}>
                <div className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ backgroundColor: item.color }} /><b className="text-[11px]">{item.displayName}</b>{isCurrent && <span className="badge badge-primary ml-auto">Вы</span>}</div>
                <p className="mt-2 text-[10px] text-[var(--text-muted)]">Отправлено <b className="text-[var(--text-strong)]">{number.format(item.sent)}</b> · доставлено {number.format(item.delivered)} · прочитано {number.format(item.opened)} · переходы {number.format(item.clicked)}</p>
              </article>;
            })}
          </div>
        </div>
      </section>

      <section id="creative-studio" className="grid scroll-mt-24 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Творческие модули">
        <StudioCard href="/email-builder?new=1" Icon={MailPlus} title="Письмо" description="Собрать из блоков, шаблона или вместе с ИИ." action="Создать письмо" featured />
        <StudioCard href="/presentations?new=1" Icon={PanelsTopLeft} title="Презентация" description="Создать слайды с нуля, из письма или по задаче." action="Открыть презентации" />
        <StudioCard href="/image-studio?new=1" Icon={ImagePlus} title="Изображение" description="Создать визуал и использовать его в письме или слайдах." action="Открыть студию" />
        <StudioCard href="/contact-finder" Icon={UserSearch} title="Контакты" description="Найти публичные email и телефоны, проверить и импортировать." action="Начать поиск" />
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="workflow-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-eyebrow">Единый рабочий процесс</p><h2 id="workflow-title" className="mt-1 text-[17px] font-semibold">От источника до готового материала</h2></div><p className="max-w-xl text-[11px] leading-5 text-[var(--text-muted)]">Каждый переход сохраняет результат в рабочем пространстве: ничего не нужно переносить вручную между модулями.</p></div>
        <ol className="mt-5 grid gap-3 md:grid-cols-4">
          <WorkflowStep index="01" Icon={SearchCheck} title="Найти" text="Укажите сайт или вставьте текст, затем проверьте найденные данные." />
          <WorkflowStep index="02" Icon={Paintbrush} title="Создать визуал" text="Сохраните изображение в общей библиотеке материалов." />
          <WorkflowStep index="03" Icon={Blocks} title="Собрать" text="Добавьте визуал в письмо или презентацию и отредактируйте." />
          <WorkflowStep index="04" Icon={SendHorizontal} title="Использовать" text="Скачайте результат или передайте готовое письмо в рассылку." />
        </ol>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          <Link href="/templates?import=1" className="btn btn-secondary gap-2"><Upload aria-hidden="true" className="size-4" />Импортировать свой макет</Link>
          <Link href="/templates" className="btn btn-ghost gap-2">Открыть шаблоны<ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </section>

      <section className={`rounded-2xl border p-5 sm:p-6 ${nextAction.tone}`} aria-labelledby="next-action-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/75 text-[var(--primary)] shadow-sm"><nextAction.Icon aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--text-muted)]">Следующий шаг</p>
            <h2 id="next-action-title" className="mt-1 text-[17px] font-semibold">{nextAction.title}</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{nextAction.description}</p>
          </div>
          <Link href={nextAction.href} className="btn btn-primary shrink-0 gap-2">{nextAction.action}<ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Состояние рабочего пространства">
        {metrics.map(({ label, value, note, Icon, href, iconTone }) => (
          <Link key={label} href={href} className="card group p-4 transition hover:border-[var(--primary)]/30 hover:shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3"><p className="pt-1 text-[12px] font-semibold text-[var(--text-muted)]">{label}</p><span className={`grid size-9 place-items-center rounded-xl border ${iconTone} transition group-hover:scale-105`}><Icon aria-hidden="true" strokeWidth={1.8} className="size-[18px]" /></span></div>
            <p className="mt-4 text-[26px] font-semibold tracking-[-.04em]">{value}</p>
            <p className="mt-1 text-[11px] leading-4 text-[var(--text-subtle)]">{note}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div><h2 className="text-[15px] font-semibold">Кампании</h2><p className="mt-1 text-[11px] text-[var(--text-subtle)]">Черновики, блокировки и запуски из базы</p></div>
            <Link href="/campaigns" className="text-[12px] font-semibold text-[var(--primary)]">Все кампании</Link>
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
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold">Готовность к рассылке</h2><p className="mt-1 text-[11px] text-[var(--text-subtle)]">Проверяется перед каждым запуском</p></div><Check aria-hidden="true" className="size-5 text-[var(--success)]" /></div>
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
    <Link href={`/campaigns/${campaign.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--surface-subtle)] sm:px-6">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${campaign.status === "blocked" ? "bg-[var(--warning-subtle)] text-[var(--warning)]" : "bg-[var(--primary-subtle)] text-[var(--primary)]"}`}><Megaphone aria-hidden="true" className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold">{campaign.name}</span><span className="mt-1 block truncate text-[10px] text-[var(--text-subtle)]">{campaign.audienceLabel} · {formatDate(campaign.updatedAt, timeZone)}</span></span>
      <span className={`badge ${statusTone[campaign.status]}`}>{statusLabel[campaign.status]}</span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-[var(--text-subtle)]" />
    </Link>
  );
}

function ReadinessStep({ ready, label, action, href }: { ready: boolean; label: string; action: string; href: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg py-2.5">
      <span className={`grid size-6 shrink-0 place-items-center rounded-full ${ready ? "bg-[var(--success-subtle)] text-[var(--success)]" : "bg-[var(--warning-subtle)] text-[var(--warning)]"}`}>{ready ? <Check aria-hidden="true" className="size-3.5" /> : <Clock3 aria-hidden="true" className="size-3.5" />}</span>
      <span className="flex-1 text-[12px] font-medium">{label}</span>
      {!ready && <Link href={href} className="text-[11px] font-semibold text-[var(--primary)]">{action}</Link>}
    </li>
  );
}

function StudioCard({ href, Icon, title, description, action, featured = false }: {
  href: string;
  Icon: typeof MailPlus;
  title: string;
  description: string;
  action: string;
  featured?: boolean;
}) {
  return (
    <Link href={href} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--primary)]/35 hover:shadow-sm">
      <span className={`grid size-12 place-items-center rounded-xl border border-border-strong text-text-strong transition duration-200 group-hover:-rotate-2 group-hover:scale-105 ${featured ? "bg-primary-subtle" : "bg-surface-subtle"}`}><Icon aria-hidden="true" strokeWidth={1.9} className="size-6" /></span>
      <h2 className="mt-4 text-[15px] font-semibold">{title}</h2>
      <p className="mt-1.5 text-[11px] leading-5 text-[var(--text-muted)]">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">{action}<ArrowRight aria-hidden="true" className="size-3.5 transition group-hover:translate-x-0.5" /></span>
    </Link>
  );
}

function WorkflowStep({ index, Icon, title, text }: { index: string; Icon: typeof SearchCheck; title: string; text: string }) {
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
      <div className="flex items-center justify-between"><span className="text-[10px] font-semibold tracking-[.14em] text-[var(--primary)]">{index}</span><span className="grid size-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]"><Icon aria-hidden="true" strokeWidth={1.8} className="size-4" /></span></div>
      <h3 className="mt-3 text-[13px] font-semibold">{title}</h3>
      <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">{text}</p>
    </li>
  );
}

function EmptyCampaigns() {
  return (
    <div className="px-6 py-10 text-center"><Megaphone aria-hidden="true" className="mx-auto size-7 text-[var(--text-subtle)]" /><p className="mt-3 text-[13px] font-semibold">Кампаний пока нет</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Начните с аудитории, затем выберите сообщение и каналы.</p><Link href="/campaigns/new" className="btn btn-primary mt-4">Создать кампанию</Link></div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[420px] place-items-center"><div className="text-center"><LoaderCircle aria-hidden="true" className="mx-auto size-7 animate-spin text-[var(--primary)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем рабочее состояние…</p></div></div>
  );
}
