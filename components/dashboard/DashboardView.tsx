"use client";

import Link from "next/link";
import {
  ArrowRight,
  Cable,
  Check,
  CircleAlert,
  Clock3,
  ContactRound,
  FileText,
  LayoutTemplate,
  LoaderCircle,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CampaignRecord, CampaignStatus, WorkspaceSnapshot } from "@/types/api";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload));
      setSnapshot(unwrap(payload));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

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
  const metrics = [
    { label: "Шаблоны", value: number.format(snapshot.templates.length), note: "Макеты можно редактировать и клонировать", Icon: LayoutTemplate, href: "/templates" },
    { label: "Контакты", value: number.format(snapshot.stats.totalContacts), note: `${number.format(snapshot.stats.activeContacts)} доступны для работы`, Icon: ContactRound, href: "/contacts" },
    { label: "Кампании", value: number.format(snapshot.stats.totalCampaigns), note: `${number.format(snapshot.stats.activeCampaigns)} требуют внимания`, Icon: Megaphone, href: "/campaigns" },
    { label: "Подключённые каналы", value: number.format(snapshot.stats.connectedIntegrations), note: "Email, Telegram или ВКонтакте", Icon: Cable, href: "/integrations" },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center sm:p-7">
        <div>
          <p className="section-eyebrow">{snapshot.workspace.name}</p>
          <h1 className="text-[28px] font-semibold tracking-[-.04em] sm:text-[32px]">{firstName ? `${firstName}, создадим красивое письмо` : "Создадим красивое письмо"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Начните с шаблона или соберите макет с ИИ. Контакты и доставка через VK WorkSpace подключаются, когда письмо уже готово.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/templates" className="btn btn-secondary w-fit gap-2"><LayoutTemplate aria-hidden="true" className="size-4" />Выбрать шаблон</Link><Link href="/email-builder?new=1" className="btn btn-primary w-fit gap-2"><Plus aria-hidden="true" className="size-4" />Создать письмо</Link></div>
      </section>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Начать работу над письмом">
        <Link href="/templates" className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]/35 hover:shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)]"><LayoutTemplate aria-hidden="true" className="size-5" /></span><h2 className="mt-4 text-[15px] font-semibold">Выбрать из {number.format(snapshot.templates.length)} шаблонов</h2><p className="mt-1.5 text-[11px] leading-5 text-[var(--text-muted)]">Фильтры по задаче, стилю и насыщенности. Любой макет можно сохранить как свой.</p><span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">Открыть библиотеку <ArrowRight aria-hidden="true" className="size-3.5" /></span></Link>
        <Link href="/email-builder?new=1" className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]/35 hover:shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)]"><Sparkles aria-hidden="true" className="size-5" /></span><h2 className="mt-4 text-[15px] font-semibold">Создать письмо в студии</h2><p className="mt-1.5 text-[11px] leading-5 text-[var(--text-muted)]">Выберите шаблон, пустой холст или ИИ. Затем отредактируйте каждый блок и экспортируйте результат.</p><span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">Открыть студию <ArrowRight aria-hidden="true" className="size-3.5" /></span></Link>
        <Link href="/templates?import=1" className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]/35 hover:shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)]"><Upload aria-hidden="true" className="size-5" /></span><h2 className="mt-4 text-[15px] font-semibold">Импортировать свой макет</h2><p className="mt-1.5 text-[11px] leading-5 text-[var(--text-muted)]">Загрузите резервный файл MAILFLOW и продолжите редактирование в конструкторе.</p><span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">Импортировать <ArrowRight aria-hidden="true" className="size-3.5" /></span></Link>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Состояние рабочего пространства">
        {metrics.map(({ label, value, note, Icon, href }) => (
          <Link key={label} href={href} className="card group p-4 transition hover:border-[var(--primary)]/30 hover:shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3"><p className="text-[12px] font-semibold text-[var(--text-muted)]">{label}</p><Icon aria-hidden="true" className="size-4 text-[var(--primary)]" /></div>
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
            <ReadinessStep ready={snapshot.stats.totalContacts > 0} label="Есть контакты" action="Добавить" href="/contacts" />
            <ReadinessStep ready={snapshot.stats.totalSegments > 0} label="Есть сохранённая аудитория" action="Создать" href="/segments" />
            <ReadinessStep ready={snapshot.stats.connectedIntegrations > 0} label="Подключён хотя бы один канал" action="Подключить" href="/integrations" />
            <ReadinessStep ready={recentCampaigns.some((campaign) => campaign.status === "ready" || campaign.status === "scheduled")} label="Есть проверенная кампания" action="Проверить" href="/campaigns" />
          </ol>
          <p className="mt-5 rounded-xl bg-[var(--surface-subtle)] p-3 text-[11px] leading-5 text-[var(--text-muted)]">Запуск не изображается как успешная отправка: без настроенного провайдера кампания получает статус «Нужна настройка» и показывает причину.</p>
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
