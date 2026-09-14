"use client";

import { Select } from "@/components/ui/select";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import ui from "@/components/shared/workflow.module.css";
import styles from "./analytics.module.css";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  LoaderCircle,
  MailCheck,
  MousePointerClick,
  Send,
  ShieldAlert,
} from "@/components/ui/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CampaignRecord,
  DeliveryJobRecord,
  WorkspaceSnapshot,
} from "@/types/api";

const number = new Intl.NumberFormat("ru-RU");

const jobStatusLabel: Record<DeliveryJobRecord["status"], string> = {
  queued: "В очереди",
  processing: "Обрабатывается",
  completed: "Принято провайдером",
  partial: "Выполнено частично",
  manual_required: "Нужен ручной экспорт",
  failed: "Ошибка",
};

const jobStatusTone: Record<DeliveryJobRecord["status"], BadgeVariant> = {
  queued: "info",
  processing: "warning",
  completed: "success",
  partial: "warning",
  manual_required: "warning",
  failed: "danger",
};

function formatDate(value: string, timeZone: string) {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
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

function campaignName(campaigns: CampaignRecord[], campaignId: string) {
  return campaigns.find((campaign) => campaign.id === campaignId)?.name ?? "Удалённая кампания";
}

function participantName(snapshot: WorkspaceSnapshot, participantId: string) {
  return snapshot.members.find((participant) => participant.id === participantId)?.displayName ?? "Участник команды";
}

export function AnalyticsView() {
  const searchParams = useSearchParams();
  const requestedCampaign = searchParams.get("campaign") ?? "all";
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [selection, setSelection] = useState(requestedCampaign);
  const [participantSelection, setParticipantSelection] = useState("mine");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workspace?scope=history", { cache: "no-store" });
      const payload: WorkspaceSnapshot | { error?: string } = await response.json();
      if (!response.ok || !("campaigns" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "Не удалось загрузить журнал отправки");
      }
      setSnapshot(payload);
      if (requestedCampaign !== "all") {
        const requested = payload.campaigns.find((campaign) => campaign.id === requestedCampaign);
        if (!requested) setSelection("all");
        else setParticipantSelection(requested.participantId === payload.participant.id ? "mine" : requested.participantId);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить журнал отправки");
    } finally {
      setLoading(false);
    }
  }, [requestedCampaign]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const campaigns = useMemo(() => snapshot?.campaigns ?? [], [snapshot]);
  const participantCampaigns = useMemo(() => {
    if (!snapshot || participantSelection === "all") return campaigns;
    const selectedParticipantId = participantSelection === "mine" ? snapshot.participant.id : participantSelection;
    return campaigns.filter((campaign) => campaign.participantId === selectedParticipantId);
  }, [campaigns, participantSelection, snapshot]);
  const selectedCampaigns = useMemo(
    () => selection === "all" ? participantCampaigns : participantCampaigns.filter((campaign) => campaign.id === selection),
    [participantCampaigns, selection],
  );
  const selectedIds = useMemo(
    () => new Set(selectedCampaigns.map((campaign) => campaign.id)),
    [selectedCampaigns],
  );
  const jobs = useMemo(
    () => (snapshot?.deliveryJobs ?? [])
      .filter((job) => selectedIds.has(job.campaignId))
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
    [selectedIds, snapshot?.deliveryJobs],
  );
  const jobTotals = useMemo(() => jobs.reduce(
    (result, job) => ({
      accepted: result.accepted + job.acceptedCount,
      manual: result.manual + job.manualCount,
      rejected: result.rejected + job.rejectedCount,
      ambiguous: result.ambiguous + job.ambiguousCount,
    }),
    { accepted: 0, manual: 0, rejected: 0, ambiguous: 0 },
  ), [jobs]);
  const providerTotals = useMemo(() => selectedCampaigns.reduce((result, campaign) => ({
    sent: result.sent + campaign.metrics.sent,
    delivered: result.delivered + campaign.metrics.delivered,
    opened: result.opened + campaign.metrics.opened,
    clicked: result.clicked + campaign.metrics.clicked,
    bounced: result.bounced + campaign.metrics.bounced,
  }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }), [selectedCampaigns]);

  const exportCsv = () => {
    if (!snapshot) return;
    const rows = [
      ["Кампания", "Отправитель", "Статус задания", "Принято провайдером", "Ручной экспорт", "Отклонено", "Неопределённо", "Создано"],
      ...jobs.map((job) => [
        campaignName(campaigns, job.campaignId),
        participantName(snapshot, campaigns.find((campaign) => campaign.id === job.campaignId)?.participantId ?? ""),
        jobStatusLabel[job.status],
        String(job.acceptedCount),
        String(job.manualCount),
        String(job.rejectedCount),
        String(job.ambiguousCount),
        formatDate(job.createdAt, snapshot.workspace.timezone),
      ]),
    ];
    const escape = (value: string) => {
      const guarded = /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
      return `"${guarded.replaceAll('"', '""')}"`;
    };
    const blob = new Blob(
      ["\uFEFF", rows.map((row) => row.map(escape).join(";")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mailflow-delivery-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !snapshot) {
    return <div className={`${ui.page} min-h-[420px] place-items-center`}><div className="text-center" role="status"><LoaderCircle aria-hidden="true" className="mx-auto size-9 animate-spin text-[var(--primary)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем журнал отправки…</p></div></div>;
  }

  if (!snapshot) {
    return <div className="card mx-auto max-w-lg p-8 text-center"><CircleAlert aria-hidden="true" className="mx-auto size-10 text-[var(--danger)]" /><h1 className="mt-4 text-xl font-semibold">Журнал недоступен</h1><p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p><button type="button" onClick={() => void load()} className="btn btn-primary mt-5">Повторить</button></div>;
  }

  const kpis = [
    { label: "Отправлено", value: providerTotals.sent, note: `${number.format(selectedCampaigns.length)} email-кампаний`, Icon: Send, tone: "primary" },
    { label: "Доставлено", value: providerTotals.delivered, note: "подтверждено UniSender", Icon: MailCheck, tone: "success" },
    { label: "Прочитано", value: providerTotals.opened, note: "уникальные открытия", Icon: Eye, tone: "info" },
    { label: "Все переходы", value: providerTotals.clicked, note: "включая повторные клики", Icon: MousePointerClick, tone: "primary" },
    { label: "Не доставлено", value: providerTotals.bounced, note: "по данным провайдера", Icon: ShieldAlert, tone: "danger" },
    { label: "Принято в заданиях", value: jobTotals.accepted, note: `последние ${number.format(snapshot.historyWindow.deliveryJobsLimit)} заданий`, Icon: BarChart3, tone: "success" },
  ];
  const historyLimit = snapshot.historyWindow.deliveryJobsLimit;

  return (
    <div className={`${ui.page} ${styles.page}`}>
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-.04em]">Журнал отправки</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Данные UniSender по авторам рассылок.</p>
        </div>
        <div className={`${ui.toolbar} ${styles.controls}`}>
          <label><span className="sr-only">Выбрать участника</span><Select className="input min-w-56" value={participantSelection} onChange={(event) => { setParticipantSelection(event.target.value); setSelection("all"); }}><option value="mine">Моя фактическая активность</option><option value="all">Вся команда</option>{snapshot.members.filter((member) => member.id !== snapshot.participant.id).map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</Select></label>
          <label><span className="sr-only">Выбрать кампанию</span><Select className="input min-w-56" value={selection} onChange={(event) => setSelection(event.target.value)}><option value="all">Все кампании участника</option>{participantCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</Select></label>
          <button type="button" onClick={exportCsv} disabled={!jobs.length} className="btn btn-secondary gap-2"><Download aria-hidden="true" className="size-6" />Скачать CSV</button>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Итоги выполнения">
        {kpis.map(({ label, value, note, Icon, tone }) => (
          <article key={label} className={ui.metric} data-tone={tone}>
            <span className={ui.metricIcon}><Icon aria-hidden="true" className="size-6" /></span>
            <p className={`${ui.value} ${styles.value}`}>{number.format(value)}</p>
            <p className={styles.metricLabel}>{label}</p>
            <p className={styles.metricNote}>{note}</p>
          </article>
        ))}
      </section>

      {!jobs.length ? (
        <section className="rounded-2xl border border-[#eadfbd] bg-[#fff9eb] p-5">
          <div className="flex items-start gap-3"><BarChart3 aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-[var(--warning)]" /><div><h2 className="text-[13px] font-semibold">Заданий на отправку пока нет</h2><p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">Сохраните кампанию, проверьте готовность и запустите её явно. Если провайдер не подключён, Поток остановит запуск и покажет причину.</p><Link href="/campaigns" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--primary)]">Открыть кампании →</Link></div></div>
        </section>
      ) : (
        <section className={styles.history} aria-label="Задания по кампаниям">
          <div className={styles.historyHeader}>
            <h2 className="text-[15px] font-semibold">Задания по кампаниям</h2>
            <p className="mt-1 text-[11px] text-[var(--text-subtle)]">Одно задание фиксирует конкретную версию сообщения, аудитории и каналов. CSV содержит это же окно из последних {number.format(historyLimit)} заданий рабочего пространства.</p>
          </div>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the wide table. */}
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="История отправок">
            <table className={`data-table ${styles.table}`}>
              <thead><tr><th>Кампания</th><th>Отправитель</th><th>Результат</th><th>Принято</th><th>Вручную</th><th>Проблемы</th><th>Время</th></tr></thead>
              <tbody>{jobs.map((job) => (
                <tr key={job.id} data-tone={jobStatusTone[job.status]}>
                  <td><Link href={`/campaigns/${job.campaignId}`} className={styles.campaignName}>{campaignName(campaigns, job.campaignId)}</Link></td>
                  <td data-label="Отправитель">{participantName(snapshot, campaigns.find((campaign) => campaign.id === job.campaignId)?.participantId ?? "")}</td>
                  <td><Badge variant={jobStatusTone[job.status]} dot>{jobStatusLabel[job.status]}</Badge><p className={styles.statusMessage}>{job.statusMessage}</p></td>
                  <td data-label="Принято"><span className={styles.accepted} data-active={job.acceptedCount > 0}>{number.format(job.acceptedCount)}</span></td>
                  <td data-label="Вручную">{number.format(job.manualCount)}</td>
                  <td data-label="Проблемы"><span className={styles.problems} data-active={job.rejectedCount + job.ambiguousCount > 0}>{number.format(job.rejectedCount + job.ambiguousCount)}</span></td>
                  <td><time className={styles.time} dateTime={job.createdAt}><Clock3 size={18} aria-hidden="true"/>{formatDate(job.createdAt, snapshot.workspace.timezone)}</time></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
