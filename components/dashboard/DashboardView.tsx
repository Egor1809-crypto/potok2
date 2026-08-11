"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, MailPlus, MoreHorizontal, Sparkles, UsersRound } from "lucide-react";
import { campaigns } from "@/data/mockCampaigns";
import type { CampaignStatus } from "@/types";
import { PerformanceChart } from "./PerformanceChart";

const metrics = [
  { label: "Контакты", value: "24 821", change: "+8,2%", note: "Добавлено 1 894", color: "#625cf6", progress: "72%" },
  { label: "Отправлено кампаний", value: "128", change: "+12%", note: "14 в этом месяце", color: "#33a3d6", progress: "56%" },
  { label: "Доставляемость", value: "98,2%", change: "+1,4%", note: "Выше среднего", color: "#45a36c", progress: "98%" },
  { label: "Доля ответов", value: "6,4%", change: "+0,8%", note: "328 диалогов", color: "#e09742", progress: "64%" },
];

const statusTone: Record<CampaignStatus, string> = {
  draft: "neutral",
  scheduled: "warning",
  sending: "info",
  completed: "success",
};

const recentCampaigns = [...campaigns]
  .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
  .slice(0, 4);

const statusLabel: Record<CampaignStatus, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  sending: "Отправляется",
  completed: "Завершена",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatCampaignDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function DashboardView() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-[#dddff8] bg-[linear-gradient(118deg,#f4f3ff_0%,#fbfbff_60%,#eef8ff_100%)] p-5 sm:p-7">
        <div className="absolute -right-8 -top-20 size-64 rounded-full bg-[#716afa]/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="section-eyebrow">Вторник, 11 августа</p><h1 className="mt-2 text-[27px] font-medium tracking-[-.04em] text-[#20212c] sm:text-[32px]">Доброе утро, Егор</h1><p className="mt-2 text-sm text-[#727481]">Главное о ваших рассылках на сегодня.</p></div>
          <Link href="/campaigns/new" className="btn btn-primary w-fit gap-2"><MailPlus size={15} />Создать кампанию</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(metric => <article key={metric.label} className="card group p-5 transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between"><p className="text-xs font-medium text-[var(--text-secondary)]">{metric.label}</p><span className="grid size-7 place-items-center rounded-lg" style={{ backgroundColor: `${metric.color}12`, color: metric.color }}><ArrowUpRight size={14} /></span></div><div className="mt-5 flex items-end gap-2"><p className="text-[28px] font-semibold tracking-[-.045em] text-[var(--text-primary)]">{metric.value}</p><span className="mb-1 rounded-md bg-[#edf8f1] px-1.5 py-1 text-[9px] font-semibold text-[#3e8d5c]">{metric.change}</span></div><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{metric.note}</p><div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className="h-full rounded-full" style={{ width: metric.progress, backgroundColor: metric.color }} /></div></article>)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <PerformanceChart />
        <div className="space-y-4">
          <article className="card p-5"><div className="flex items-center justify-between"><div><h2 className="text-[14px] font-semibold">Рост аудитории</h2><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Новые контакты в этом месяце</p></div><UsersRound size={17} className="text-[#625cf6]" /></div><p className="mt-5 text-[30px] font-semibold tracking-[-.045em]">+1 894</p><p className="mt-1 text-[10px] font-medium text-[#3e8d5c]">На 8,2% больше, чем в прошлом месяце</p><div className="mt-5 flex h-20 items-end gap-1">{[24,31,29,42,37,52,48,61,55,74,68,82,78,91,86].map((height,index)=><span key={index} className="flex-1 rounded-t-sm bg-[#716afa]/80" style={{height:`${height}%`,opacity:.45+index/30}} />)}</div></article>
          <article className="overflow-hidden rounded-xl bg-[#242530] p-5 text-white shadow-[0_14px_35px_rgba(31,32,47,.18)]"><span className="grid size-9 place-items-center rounded-lg bg-white/10 text-[#aaa6ff]"><Sparkles size={17} /></span><h2 className="mt-5 text-[16px] font-semibold tracking-[-.02em]">Ваша лучшая аудитория растёт.</h2><p className="mt-2 text-[11px] leading-5 text-white/55">В сегменте «Юристы Москвы» появились 84 новых активных контакта за неделю.</p><Link href="/segments" className="mt-5 flex items-center gap-1.5 text-[10px] font-semibold text-[#b9b6ff]">Открыть сегмент <ArrowRight size={12} /></Link></article>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6"><div><h2 className="text-[14px] font-semibold">Недавние кампании</h2><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Последние кампании и черновики</p></div><Link href="/campaigns" className="btn btn-ghost gap-1.5 text-[11px]">Показать все <ArrowRight size={13} /></Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[9px] font-semibold uppercase tracking-[.08em] text-[var(--text-tertiary)]"><th className="px-6 py-3">Кампания</th><th className="px-4 py-3">Аудитория</th><th className="px-4 py-3">Отправлено</th><th className="px-4 py-3">Открытия</th><th className="px-4 py-3">Переходы</th><th className="px-4 py-3">Ответы</th><th className="px-4 py-3">Статус</th><th className="w-10 px-4 py-3" /></tr></thead><tbody>{recentCampaigns.map(row => <tr key={row.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]"><td className="px-6 py-4"><Link href={`/campaigns/${row.id}`} className="text-[11px] font-semibold text-[var(--text-primary)] hover:text-[#625cf6]">{row.name}</Link><p className="mt-0.5 text-[9px] text-[var(--text-tertiary)]">Обновлено {formatCampaignDate(row.sentAt ?? row.scheduledAt ?? row.createdAt)}</p></td><td className="px-4 py-4 text-[10px] text-[var(--text-secondary)]">{row.audience}</td><td className="px-4 py-4 text-[10px] font-medium">{row.metrics.sent > 0 ? formatNumber(row.metrics.sent) : "—"}</td><td className="px-4 py-4 text-[10px]">{row.metrics.sent > 0 ? `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(row.metrics.openRate)}%` : "—"}</td><td className="px-4 py-4 text-[10px]">{row.metrics.sent > 0 ? `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(row.metrics.clickRate)}%` : "—"}</td><td className="px-4 py-4 text-[10px]">{row.metrics.sent > 0 ? formatNumber(row.metrics.replies) : "—"}</td><td className="px-4 py-4"><span className={`badge badge-${statusTone[row.status]}`}>{statusLabel[row.status]}</span></td><td className="px-4 py-4"><button aria-label={`Другие действия для кампании «${row.name}»`} className="text-[var(--text-tertiary)]"><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
