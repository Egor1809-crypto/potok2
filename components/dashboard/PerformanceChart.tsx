"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const allData = [
  { day: "Jul 13", sent: 1420, opened: 680, clicked: 188, replies: 72 },
  { day: "Jul 15", sent: 1940, opened: 860, clicked: 244, replies: 91 },
  { day: "Jul 17", sent: 1680, opened: 812, clicked: 231, replies: 86 },
  { day: "Jul 19", sent: 2360, opened: 1180, clicked: 318, replies: 132 },
  { day: "Jul 21", sent: 2210, opened: 1090, clicked: 286, replies: 118 },
  { day: "Jul 23", sent: 2780, opened: 1420, clicked: 402, replies: 164 },
  { day: "Jul 25", sent: 2510, opened: 1310, clicked: 372, replies: 151 },
  { day: "Jul 27", sent: 3180, opened: 1640, clicked: 468, replies: 192 },
  { day: "Jul 29", sent: 2940, opened: 1535, clicked: 442, replies: 181 },
  { day: "Jul 31", sent: 3560, opened: 1810, clicked: 526, replies: 214 },
  { day: "Aug 02", sent: 3340, opened: 1740, clicked: 502, replies: 206 },
  { day: "Aug 04", sent: 3980, opened: 2040, clicked: 618, replies: 246 },
  { day: "Aug 06", sent: 3720, opened: 1960, clicked: 582, replies: 231 },
  { day: "Aug 08", sent: 4310, opened: 2260, clicked: 674, replies: 271 },
  { day: "Aug 10", sent: 4480, opened: 2380, clicked: 716, replies: 292 },
];

const metrics = [
  { key: "sent", label: "Sent", color: "#625cf6" },
  { key: "opened", label: "Opened", color: "#33a3d6" },
  { key: "clicked", label: "Clicked", color: "#45a36c" },
] as const;

export function PerformanceChart({ compact = false }: { compact?: boolean }) {
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const [visible, setVisible] = useState<(typeof metrics)[number]["key"][]>(["sent", "opened"]);
  const data = useMemo(() => range === "7" ? allData.slice(-5) : range === "30" ? allData : [...allData.map((d, i) => ({ ...d, day: `May ${12 + i}` })), ...allData.map((d, i) => ({ ...d, day: `Jun ${10 + i}`, sent: Math.round(d.sent * .84), opened: Math.round(d.opened * .86), clicked: Math.round(d.clicked * .82), replies: Math.round(d.replies * .8) })), ...allData], [range]);

  return (
    <div className={compact ? "" : "card p-5 sm:p-6"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Campaign performance</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">Audience engagement across every send</p></div>
        <div className="flex w-fit rounded-lg bg-[var(--surface-subtle)] p-1" role="group" aria-label="Performance period">
          {(["7", "30", "90"] as const).map(value => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition ${range === value ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)]"}`}>{value} days</button>)}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-4">
        {metrics.map(metric => <button key={metric.key} type="button" aria-pressed={visible.includes(metric.key)} onClick={() => setVisible(current => current.includes(metric.key) ? current.filter(item => item !== metric.key) : [...current, metric.key])} className={`flex items-center gap-1.5 text-[10px] font-medium transition-opacity ${visible.includes(metric.key) ? "opacity-100" : "opacity-40"}`}><span className="size-2 rounded-full" style={{ backgroundColor: metric.color }} />{metric.label}</button>)}
      </div>
      <div className={compact ? "mt-5 h-[245px]" : "mt-5 h-[280px] sm:h-[330px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="mailflowSent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#625cf6" stopOpacity={0.18}/><stop offset="100%" stopColor="#625cf6" stopOpacity={0}/></linearGradient>
              <linearGradient id="mailflowOpened" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#33a3d6" stopOpacity={0.13}/><stop offset="100%" stopColor="#33a3d6" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ececf1" strokeDasharray="3 3" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} minTickGap={32} tick={{ fontSize: 9, fill: "#999ba7" }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#999ba7" }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e3e9", boxShadow: "0 12px 30px rgba(29,30,45,.12)", fontSize: 11 }} labelStyle={{ color: "#777986", marginBottom: 4 }} />
            {visible.includes("sent") && <Area type="monotone" dataKey="sent" stroke="#625cf6" strokeWidth={2} fill="url(#mailflowSent)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "white" }} />}
            {visible.includes("opened") && <Area type="monotone" dataKey="opened" stroke="#33a3d6" strokeWidth={2} fill="url(#mailflowOpened)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "white" }} />}
            {visible.includes("clicked") && <Area type="monotone" dataKey="clicked" stroke="#45a36c" strokeWidth={2} fill="transparent" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "white" }} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
