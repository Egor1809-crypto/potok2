"use client";

import { ChevronDown, Download, MailCheck, MousePointerClick, Reply, Send, ShieldCheck, UserMinus } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { campaigns } from "@/data/mockCampaigns";

const kpis = [
  { label: "Sent", value: "10,000", delta: "+12.4%", Icon: Send, color: "#625cf6" },
  { label: "Delivered", value: "9,820", delta: "98.2%", Icon: ShieldCheck, color: "#33a3d6" },
  { label: "Opened", value: "4,921", delta: "+8.6%", Icon: MailCheck, color: "#825bd8" },
  { label: "Clicked", value: "1,284", delta: "+2.1%", Icon: MousePointerClick, color: "#45a36c" },
  { label: "Replies", value: "328", delta: "+0.8%", Icon: Reply, color: "#e09742" },
  { label: "Unsubscribed", value: "18", delta: "0.18%", Icon: UserMinus, color: "#9a9ca8" },
];

const funnel = [
  { label: "Sent", value: 10000, rate: "100%", width: 100, color: "#625cf6" },
  { label: "Delivered", value: 9820, rate: "98.2%", width: 90, color: "#716bf1" },
  { label: "Opened", value: 4921, rate: "50.1%", width: 68, color: "#5f94e1" },
  { label: "Clicked", value: 1284, rate: "26.1%", width: 46, color: "#48a987" },
  { label: "Replies", value: 328, rate: "25.5%", width: 28, color: "#3e8d5c" },
];

export function AnalyticsView() {
  const searchParams = useSearchParams();
  const requestedCampaign = campaigns.find(item => item.id === searchParams.get("campaign"));
  const demoName = searchParams.get("demoName")?.trim();
  const initialCampaign = demoName || requestedCampaign?.name || "All campaigns";
  const [campaign, setCampaign] = useState(initialCampaign);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="section-eyebrow">Performance intelligence</p><h1 className="mt-2 text-[28px] font-medium tracking-[-.04em]">Analytics</h1><p className="mt-1.5 text-sm text-[var(--text-secondary)]">Understand what turns a send into a conversation.</p></div><div className="flex flex-wrap gap-2"><label className="relative"><span className="sr-only">Select campaign</span><select value={campaign} onChange={event => setCampaign(event.target.value)} className="input h-10 appearance-none pr-9 text-[11px]"><option>All campaigns</option>{demoName && !campaigns.some(item => item.name === demoName) ? <option>{demoName}</option> : null}{campaigns.map(item => <option key={item.id}>{item.name}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" /></label><button className="btn btn-secondary gap-2"><Download size={14} />Export</button></div></div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{kpis.map(({ label, value, delta, Icon, color }) => <article key={label} className="card p-4"><div className="flex items-center justify-between"><span className="grid size-7 place-items-center rounded-lg" style={{backgroundColor:`${color}12`,color}}><Icon size={14}/></span><span className={`text-[9px] font-semibold ${label === "Unsubscribed" ? "text-[var(--text-tertiary)]" : "text-[#3e8d5c]"}`}>{delta}</span></div><p className="mt-5 text-[21px] font-semibold tracking-[-.04em]">{value}</p><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{label}</p></article>)}</section>

      <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <article className="card p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-[14px] font-semibold">Engagement funnel</h2><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{campaign} · last 30 days</p></div><span className="badge badge-success">Healthy</span></div><div className="mt-7 space-y-3">{funnel.map((step,index)=><div key={step.label} className="group"><div className="mb-1.5 flex items-end justify-between text-[10px]"><span className="font-semibold">{step.label}</span><span className="text-[var(--text-tertiary)]">{step.value.toLocaleString("en-US")} · {step.rate}</span></div><div className="h-9 overflow-hidden rounded-lg bg-[var(--surface-subtle)]"><div className="flex h-full items-center px-3 font-mono text-[9px] font-semibold text-white transition-[width] duration-500" style={{width:`${step.width}%`,backgroundColor:step.color}}>{index === 0 ? "Audience" : `${funnel[index-1].value-step.value} drop-off`}</div></div></div>)}</div><div className="mt-6 rounded-xl border border-[#dbebdf] bg-[#f3faf5] p-4"><p className="text-[10px] font-semibold text-[#347a50]">Strongest conversion</p><p className="mt-1 text-[11px] text-[#5f7868]">25.5% of clickers replied—4.8 points above your workspace average.</p></div></article>
        <article className="card p-5 sm:p-6"><PerformanceChart compact /></article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <article className="card overflow-hidden"><div className="border-b border-[var(--border)] px-5 py-4"><h2 className="text-[14px] font-semibold">Top campaigns</h2><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Ranked by reply rate</p></div><div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left"><thead><tr className="bg-[var(--surface-subtle)] text-[9px] font-semibold uppercase tracking-[.07em] text-[var(--text-tertiary)]"><th className="px-5 py-3">Campaign</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Opened</th><th className="px-4 py-3">Clicked</th><th className="px-4 py-3">Replied</th></tr></thead><tbody>{[["Partners Q3 Update","1,284","62.1%","18.7%","8.4%"],["Legal Conference Invitation","3,921","54.8%","14.2%","7.1%"],["Arbitration Leaders Dinner","584","58.2%","16.9%","6.8%"],["August Follow-up","2,110","44.6%","9.8%","5.2%"]].map(row=><tr key={row[0]} className="border-t border-[var(--border)]"><td className="px-5 py-4 text-[10px] font-semibold">{row[0]}</td>{row.slice(1).map(value=><td key={value} className="px-4 py-4 text-[10px] text-[var(--text-secondary)]">{value}</td>)}</tr>)}</tbody></table></div></article>
        <article className="card p-5"><div><h2 className="text-[14px] font-semibold">Audience quality</h2><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Delivery health across your database</p></div><div className="mt-6 flex items-center justify-center"><div className="relative grid size-40 place-items-center rounded-full" style={{background:"conic-gradient(#625cf6 0 78%, #33a3d6 78% 92%, #e6e7ec 92% 100%)"}}><div className="grid size-[118px] place-items-center rounded-full bg-white text-center"><div><p className="text-[27px] font-semibold tracking-[-.04em]">94%</p><p className="text-[9px] text-[var(--text-tertiary)]">Healthy contacts</p></div></div></div></div><div className="mt-7 grid grid-cols-3 gap-2">{[["Healthy","23,334","#625cf6"],["At risk","1,102","#33a3d6"],["Invalid","385","#d8dae2"]].map(([label,value,color])=><div key={label} className="rounded-lg bg-[var(--surface-subtle)] p-2.5"><span className="mb-2 block size-1.5 rounded-full" style={{backgroundColor:color}}/><p className="text-[12px] font-semibold">{value}</p><p className="text-[8px] text-[var(--text-tertiary)]">{label}</p></div>)}</div></article>
      </section>
    </div>
  );
}
