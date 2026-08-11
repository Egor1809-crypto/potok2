"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  CircleAlert,
  Download,
  FileDown,
  LoaderCircle,
  Megaphone,
  Send,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
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

export function AnalyticsView() {
  const searchParams = useSearchParams();
  const requestedCampaign = searchParams.get("campaign") ?? "all";
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [selection, setSelection] = useState(requestedCampaign);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const payload: WorkspaceSnapshot | { error?: string } = await response.json();
      if (!response.ok || !("campaigns" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "Не удалось загрузить журнал отправки");
      }
      setSnapshot(payload);
      if (requestedCampaign !== "all" && !payload.campaigns.some((campaign) => campaign.id === requestedCampaign)) {
        setSelection("all");
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
  const selectedCampaigns = useMemo(
    () => selection === "all" ? campaigns : campaigns.filter((campaign) => campaign.id === selection),
    [campaigns, selection],
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
  const totals = useMemo(() => jobs.reduce(
    (result, job) => ({
      accepted: result.accepted + job.acceptedCount,
      manual: result.manual + job.manualCount,
      rejected: result.rejected + job.rejectedCount,
      ambiguous: result.ambiguous + job.ambiguousCount,
    }),
    { accepted: 0, manual: 0, rejected: 0, ambiguous: 0 },
  ), [jobs]);
  const audience = useMemo(
    () => selectedCampaigns.reduce((total, campaign) => total + campaign.metrics.recipients, 0),
    [selectedCampaigns],
  );

  const exportCsv = () => {
    if (!snapshot) return;
    const rows = [
      ["Кампания", "Статус задания", "Принято провайдером", "Ручной экспорт", "Отклонено", "Неопределённо", "Создано"],
      ...jobs.map((job) => [
        campaignName(campaigns, job.campaignId),
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
    return <div className="grid min-h-[420px] place-items-center"><div className="text-center"><LoaderCircle aria-hidden="true" className="mx-auto size-7 animate-spin text-[var(--primary)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем журнал отправки…</p></div></div>;
  }

  if (!snapshot) {
    return <div className="card mx-auto max-w-lg p-8 text-center"><CircleAlert aria-hidden="true" className="mx-auto size-8 text-[var(--danger)]" /><h1 className="mt-4 text-xl font-semibold">Журнал недоступен</h1><p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p><button type="button" onClick={() => void load()} className="btn btn-primary mt-5">Повторить</button></div>;
  }

  const kpis = [
    { label: "Кампании", value: selectedCampaigns.length, note: "в выбранном представлении", Icon: Megaphone },
    { label: "Получатели", value: audience, note: "уникальные контакты внутри кампаний", Icon: UsersRound },
    { label: "Принято провайдером", value: totals.accepted, note: "задания приняты, но доставка не подтверждена", Icon: Send },
    { label: "Ручной экспорт", value: totals.manual, note: "строки подготовлены без автоматической отправки", Icon: FileDown },
    { label: "Отклонено", value: totals.rejected, note: "провайдер вернул явную ошибку", Icon: ShieldAlert },
    { label: "Неопределённо", value: totals.ambiguous, note: "результат запроса требует проверки", Icon: BarChart3 },
  ];
  const historyLimit = snapshot.historyWindow.deliveryJobsLimit;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-eyebrow">Факты выполнения</p>
          <h1 className="text-[28px] font-semibold tracking-[-.04em]">Журнал отправки</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Здесь показано только то, что MAILFLOW действительно выполнил: последние {number.format(historyLimit)} заданий провайдерам и ручных выгрузок. Подтверждения доставки, открытия и ответы смотрите у подключённого провайдера.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label><span className="sr-only">Выбрать кампанию</span><select className="input min-w-56" value={selection} onChange={(event) => setSelection(event.target.value)}><option value="all">Все кампании</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
          <button type="button" onClick={exportCsv} disabled={!jobs.length} className="btn btn-secondary gap-2"><Download aria-hidden="true" className="size-4" />Скачать CSV</button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Итоги выполнения">
        {kpis.map(({ label, value, note, Icon }) => (
          <article key={label} className="card p-4">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--primary-subtle)] text-[var(--primary)]"><Icon aria-hidden="true" className="size-4" /></span>
            <p className="mt-5 text-[22px] font-semibold tracking-[-.04em]">{number.format(value)}</p>
            <p className="mt-1 text-[11px] font-semibold">{label}</p>
            <p className="mt-1 text-[9px] leading-4 text-[var(--text-subtle)]">{note}</p>
          </article>
        ))}
      </section>

      {!jobs.length ? (
        <section className="rounded-2xl border border-[#eadfbd] bg-[#fff9eb] p-5">
          <div className="flex items-start gap-3"><BarChart3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" /><div><h2 className="text-[13px] font-semibold">Заданий на отправку пока нет</h2><p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">Сохраните кампанию, проверьте готовность и запустите её явно. Если провайдер не подключён, MAILFLOW остановит запуск и покажет причину.</p><Link href="/campaigns" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--primary)]">Открыть кампании →</Link></div></div>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <h2 className="text-[15px] font-semibold">Задания по кампаниям</h2>
            <p className="mt-1 text-[11px] text-[var(--text-subtle)]">Одно задание фиксирует конкретную версию сообщения, аудитории и каналов. CSV содержит это же окно из последних {number.format(historyLimit)} заданий рабочего пространства.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[820px]">
              <thead><tr><th>Кампания</th><th>Результат</th><th>Принято</th><th>Вручную</th><th>Проблемы</th><th>Время</th></tr></thead>
              <tbody>{jobs.map((job) => (
                <tr key={job.id}>
                  <td><Link href={`/campaigns/${job.campaignId}`} className="text-[12px] font-semibold hover:text-[var(--primary)]">{campaignName(campaigns, job.campaignId)}</Link></td>
                  <td><span className="badge badge-neutral">{jobStatusLabel[job.status]}</span><p className="mt-1 max-w-xs text-[9px] leading-4 text-[var(--text-subtle)]">{job.statusMessage}</p></td>
                  <td>{number.format(job.acceptedCount)}</td>
                  <td>{number.format(job.manualCount)}</td>
                  <td>{number.format(job.rejectedCount + job.ambiguousCount)}</td>
                  <td>{formatDate(job.createdAt, snapshot.workspace.timezone)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
