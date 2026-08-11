"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Check,
  CircleAlert,
  Download,
  LoaderCircle,
  MailCheck,
  MousePointerClick,
  Reply,
  Send,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CampaignMetricsRecord, CampaignRecord, WorkspaceSnapshot } from "@/types/api";

const number = new Intl.NumberFormat("ru-RU");
const percent = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const emptyMetrics: CampaignMetricsRecord = {
  recipients: 0,
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  replies: 0,
  bounced: 0,
  unsubscribed: 0,
};

function rate(value: number, base: number) {
  return base > 0 ? (value / base) * 100 : 0;
}

function sumMetrics(campaigns: CampaignRecord[]) {
  return campaigns.reduce<CampaignMetricsRecord>((total, campaign) => {
    for (const key of Object.keys(total) as Array<keyof CampaignMetricsRecord>) total[key] += campaign.metrics[key];
    return total;
  }, { ...emptyMetrics });
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
      if (!response.ok || !("campaigns" in payload)) throw new Error("error" in payload && payload.error ? payload.error : "Не удалось загрузить результаты");
      setSnapshot(payload);
      if (requestedCampaign !== "all" && !payload.campaigns.some((campaign) => campaign.id === requestedCampaign)) setSelection("all");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить результаты");
    } finally {
      setLoading(false);
    }
  }, [requestedCampaign]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const campaigns = useMemo(() => snapshot?.campaigns ?? [], [snapshot]);
  const selectedCampaigns = useMemo(() => selection === "all" ? campaigns : campaigns.filter((campaign) => campaign.id === selection), [campaigns, selection]);
  const metrics = useMemo(() => sumMetrics(selectedCampaigns), [selectedCampaigns]);
  const title = selection === "all" ? "Все кампании" : campaigns.find((campaign) => campaign.id === selection)?.name ?? "Кампания";

  const exportCsv = () => {
    const rows = [
      ["Кампания", "Получатели", "Отправлено", "Доставлено", "Открыто", "Переходы", "Ответы", "Ошибки", "Отписки"],
      ...selectedCampaigns.map((campaign) => [campaign.name, ...Object.values(campaign.metrics).map(String)]),
    ];
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mailflow-results-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !snapshot) return <div className="grid min-h-[420px] place-items-center"><div className="text-center"><LoaderCircle aria-hidden="true" className="mx-auto size-7 animate-spin text-[var(--primary)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем результаты…</p></div></div>;

  if (!snapshot) return <div className="card mx-auto max-w-lg p-8 text-center"><CircleAlert aria-hidden="true" className="mx-auto size-8 text-[var(--danger)]" /><h1 className="mt-4 text-xl font-semibold">Результаты недоступны</h1><p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p><button type="button" onClick={() => void load()} className="btn btn-primary mt-5">Повторить</button></div>;

  const kpis = [
    { label: "Отправлено", value: metrics.sent, note: `${number.format(metrics.recipients)} получателей`, Icon: Send },
    { label: "Доставлено", value: metrics.delivered, note: `${percent.format(rate(metrics.delivered, metrics.sent))}% от отправленных`, Icon: ShieldCheck },
    { label: "Открыто", value: metrics.opened, note: `${percent.format(rate(metrics.opened, metrics.delivered))}% от доставленных`, Icon: MailCheck },
    { label: "Переходы", value: metrics.clicked, note: `${percent.format(rate(metrics.clicked, metrics.opened))}% от открытий`, Icon: MousePointerClick },
    { label: "Ответы", value: metrics.replies, note: `${percent.format(rate(metrics.replies, metrics.delivered))}% от доставленных`, Icon: Reply },
    { label: "Отписки", value: metrics.unsubscribed, note: `${percent.format(rate(metrics.unsubscribed, metrics.delivered))}% от доставленных`, Icon: UserMinus },
  ];

  const funnel = [
    { label: "Получатели", value: metrics.recipients, base: metrics.recipients },
    { label: "Отправлено", value: metrics.sent, base: metrics.recipients },
    { label: "Доставлено", value: metrics.delivered, base: metrics.recipients },
    { label: "Открыто", value: metrics.opened, base: metrics.recipients },
    { label: "Ответили", value: metrics.replies, base: metrics.recipients },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="section-eyebrow">Результаты доставки</p><h1 className="text-[28px] font-semibold tracking-[-.04em]">Результаты</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Только факты, которые сохранены у кампаний. Расчётные показатели не подставляются.</p></div>
        <div className="flex flex-wrap gap-2"><label><span className="sr-only">Выбрать кампанию</span><select className="input min-w-56" value={selection} onChange={(event) => setSelection(event.target.value)}><option value="all">Все кампании</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label><button type="button" onClick={exportCsv} disabled={!selectedCampaigns.length} className="btn btn-secondary gap-2"><Download aria-hidden="true" className="size-4" />Скачать CSV</button></div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {kpis.map(({ label, value, note, Icon }) => <article key={label} className="card p-4"><div className="flex items-center justify-between"><span className="grid size-8 place-items-center rounded-lg bg-[var(--primary-subtle)] text-[var(--primary)]"><Icon aria-hidden="true" className="size-4" /></span>{value > 0 && <Check aria-hidden="true" className="size-4 text-[var(--success)]" />}</div><p className="mt-5 text-[22px] font-semibold tracking-[-.04em]">{number.format(value)}</p><p className="mt-1 text-[11px] font-semibold">{label}</p><p className="mt-1 text-[9px] leading-4 text-[var(--text-subtle)]">{note}</p></article>)}
      </section>

      {metrics.sent === 0 && <section className="rounded-2xl border border-[#eadfbd] bg-[#fff9eb] p-5"><div className="flex items-start gap-3"><BarChart3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" /><div><h2 className="text-[13px] font-semibold">Результатов отправки пока нет</h2><p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">Подготовка и проверка кампании работают уже сейчас. Метрики доставки появятся только после реальной обработки подключённым провайдером.</p><Link href="/campaigns" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--primary)]">Открыть кампании →</Link></div></div></section>}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <article className="card p-5 sm:p-6"><h2 className="text-[15px] font-semibold">Воронка</h2><p className="mt-1 text-[11px] text-[var(--text-subtle)]">{title}</p><div className="mt-6 space-y-4">{funnel.map((step) => { const width = step.base > 0 ? Math.max(2, rate(step.value, step.base)) : 0; return <div key={step.label}><div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-semibold">{step.label}</span><span className="text-[var(--text-muted)]">{number.format(step.value)} · {percent.format(step.base > 0 ? rate(step.value, step.base) : 0)}%</span></div><div className="h-8 overflow-hidden rounded-lg bg-[var(--surface-subtle)]"><div className="h-full rounded-lg bg-[var(--primary)] transition-[width]" style={{ width: `${width}%` }} /></div></div>; })}</div></article>

        <article className="card overflow-hidden"><div className="border-b border-[var(--border)] px-5 py-4 sm:px-6"><h2 className="text-[15px] font-semibold">По кампаниям</h2><p className="mt-1 text-[11px] text-[var(--text-subtle)]">Откройте кампанию, чтобы увидеть причину блокировки или план доставки.</p></div>{selectedCampaigns.length ? <div className="overflow-x-auto"><table className="data-table min-w-[650px]"><thead><tr><th>Кампания</th><th>Отправлено</th><th>Доставка</th><th>Ответы</th><th>Ошибки</th></tr></thead><tbody>{selectedCampaigns.map((campaign) => <tr key={campaign.id}><td><Link href={`/campaigns/${campaign.id}`} className="text-[12px] font-semibold hover:text-[var(--primary)]">{campaign.name}</Link><p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">{campaign.audienceLabel}</p></td><td>{number.format(campaign.metrics.sent)}</td><td>{percent.format(rate(campaign.metrics.delivered, campaign.metrics.sent))}%</td><td>{number.format(campaign.metrics.replies)}</td><td>{number.format(campaign.metrics.bounced)}</td></tr>)}</tbody></table></div> : <div className="px-6 py-12 text-center text-[12px] text-[var(--text-muted)]">Кампаний пока нет.</div>}</article>
      </section>
    </div>
  );
}
