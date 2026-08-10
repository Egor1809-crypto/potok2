"use client";

import type { Contact } from "@/types";
import { contactActivities, contactNotes } from "@/data/mockContacts";
import { Building2, Check, ExternalLink, Mail, MapPin, MessageSquare, MousePointer2, Phone, Plus, Reply, Send, Tag, X } from "lucide-react";
import { useRef, useState } from "react";
import { useDrawerAccessibility } from "@/components/shared/useDrawerAccessibility";

const activityIcons = {
  email_sent: Send,
  email_opened: Mail,
  link_clicked: MousePointer2,
  reply_received: Reply,
  tag_added: Tag,
  note_added: MessageSquare,
};

const shortDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function ContactDrawer({ contact, onClose, embedded = false }: { contact: Contact; onClose?: () => void; embedded?: boolean }) {
  const [tab, setTab] = useState<"overview" | "activity" | "campaigns" | "notes">("overview");
  const panelRef = useRef<HTMLElement>(null);
  useDrawerAccessibility(panelRef, onClose, !embedded);
  const activities = contactActivities.filter(item => item.contactId === contact.id);
  const notes = contactNotes.filter(item => item.contactId === contact.id);
  const displayedActivities = activities.length ? activities : [
    { id: "fallback-1", type: "email_opened" as const, title: "Campaign opened", detail: "Opened Partners Q3 Update.", occurredAt: "2026-08-10T09:20:00Z" },
    { id: "fallback-2", type: "email_sent" as const, title: "Email delivered", detail: "Partners Q3 Update was delivered.", occurredAt: "2026-08-10T09:12:00Z" },
  ];

  return (
    <div className={embedded ? "card overflow-hidden" : "fixed inset-0 z-[80] flex justify-end bg-[#171823]/25 backdrop-blur-[2px]"} role={embedded ? undefined : "presentation"} onMouseDown={event => { if (!embedded && event.target === event.currentTarget) onClose?.(); }}>
      <section ref={panelRef} tabIndex={embedded ? undefined : -1} className={embedded ? "min-h-[680px] bg-white" : "h-full w-full max-w-[560px] overflow-y-auto border-l border-[var(--border)] bg-white shadow-[-22px_0_60px_rgba(30,31,46,.16)]"} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true} aria-label={`${contact.fullName} contact profile`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-white/90 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]"><span>Contacts</span><span>/</span><span className="font-medium text-[var(--text-secondary)]">{contact.fullName}</span></div>
          <div className="flex items-center gap-1">
            {!embedded && <a href={`/contacts/${contact.id}`} className="grid size-8 place-items-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-subtle)]" aria-label="Open full profile"><ExternalLink size={15} /></a>}
            {onClose && <button data-autofocus={!embedded ? "true" : undefined} onClick={onClose} className="grid size-8 place-items-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-subtle)]" aria-label="Close profile"><X size={17} /></button>}
          </div>
        </div>

        <div className="px-5 pt-6 sm:px-7">
          <div className="flex items-start gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl text-[17px] font-semibold text-white shadow-sm" style={{backgroundColor:contact.avatarColor}}>{contact.firstName[0]}{contact.lastName[0]}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-semibold tracking-[-.035em]">{contact.fullName}</h1>{contact.status === "active" && <span className="badge badge-success"><Check size={10} />Active</span>}</div><p className="mt-1 text-[12px] text-[var(--text-secondary)]">{contact.role} at {contact.companyName}</p><div className="mt-3 flex flex-wrap gap-1.5">{contact.tags.map(tag => <span key={tag} className="badge badge-neutral">{tag}</span>)}</div></div></div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"><a href={`mailto:${contact.email}`} className="btn btn-primary justify-center gap-1.5 px-2"><Mail size={13}/>Email</a><a href={`/campaigns/new?contact=${contact.id}`} className="btn btn-secondary justify-center gap-1.5 px-2"><Send size={13}/>Campaign</a><button className="btn btn-secondary justify-center gap-1.5 px-2"><MessageSquare size={13}/>Note</button><button className="btn btn-secondary justify-center gap-1.5 px-2"><Plus size={13}/>Tag</button></div>
        </div>

        <nav className="mt-6 flex gap-5 border-b border-[var(--border)] px-5 sm:px-7" aria-label="Contact profile sections">{(["overview","activity","campaigns","notes"] as const).map(value => <button key={value} onClick={() => setTab(value)} className={`border-b-2 pb-3 text-[11px] font-semibold capitalize transition-colors ${tab===value ? "border-[#625cf6] text-[#5c56d7]" : "border-transparent text-[var(--text-tertiary)]"}`}>{value}</button>)}</nav>

        <div className="p-5 sm:p-7">
          {tab === "overview" && <div className="space-y-6">
            <section><h2 className="text-[11px] font-semibold uppercase tracking-[.07em] text-[var(--text-tertiary)]">Contact details</h2><div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">{[[Mail,"Email",contact.email],[Phone,"Phone",contact.phone],[Building2,"Company",contact.companyName],[MapPin,"Location",`${contact.city}, ${contact.country}`]].map(([Icon,label,value])=>{const DetailIcon=Icon as typeof Mail;return <div key={label as string} className="grid grid-cols-[28px_92px_1fr] items-center border-b border-[var(--border)] px-4 py-3 last:border-0"><DetailIcon size={14} className="text-[var(--text-tertiary)]"/><span className="text-[10px] text-[var(--text-tertiary)]">{label as string}</span><span className="truncate text-[10px] font-medium">{value as string}</span></div>})}</div></section>
            <section className="grid grid-cols-3 gap-2">{[["Engagement",`${contact.engagementScore}/100`],["Campaigns","12"],["Replies","6"]].map(([label,value])=><div key={label} className="rounded-xl bg-[var(--surface-subtle)] p-3"><p className="text-[9px] text-[var(--text-tertiary)]">{label}</p><p className="mt-1 text-[16px] font-semibold tracking-[-.03em]">{value}</p></div>)}</section>
            <section><div className="flex items-center justify-between"><h2 className="text-[11px] font-semibold uppercase tracking-[.07em] text-[var(--text-tertiary)]">Recent activity</h2><button onClick={()=>setTab("activity")} className="text-[10px] font-semibold text-[#5c56d7]">View all</button></div><ActivityList activities={displayedActivities.slice(0,3)} /></section>
          </div>}
          {tab === "activity" && <section><h2 className="text-sm font-semibold">Activity timeline</h2><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Every touchpoint with {contact.firstName}</p><ActivityList activities={displayedActivities} /></section>}
          {tab === "campaigns" && <section><h2 className="text-sm font-semibold">Campaign history</h2><div className="mt-4 space-y-2">{[["Legal Technology Conference Invitation","Opened · Replied","Aug 11"],["Partners Q3 Update","Opened · Clicked","Jul 28"],["Moscow Leaders Dinner","Delivered","Jun 19"]].map(row=><div key={row[0]} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3.5"><div><p className="text-[10px] font-semibold">{row[0]}</p><p className="mt-1 text-[9px] text-[var(--text-tertiary)]">{row[1]}</p></div><span className="text-[9px] text-[var(--text-tertiary)]">{row[2]}</span></div>)}</div></section>}
          {tab === "notes" && <section><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Notes</h2><button className="btn btn-secondary gap-1.5"><Plus size={13}/>Add note</button></div><div className="mt-4 space-y-3">{(notes.length?notes:[{id:"note-fallback",author:"Egor Sabalin",body:"Follow up after the conference with the updated partnership brief.",createdAt:"2026-08-09T11:30:00Z"}]).map(note=><article key={note.id} className="rounded-xl border border-[var(--border)] bg-[#fffefa] p-4"><p className="text-[11px] leading-5 text-[var(--text-secondary)]">{note.body}</p><p className="mt-3 text-[9px] text-[var(--text-tertiary)]">{note.author} · {shortDateFormatter.format(new Date(note.createdAt))}</p></article>)}</div></section>}
        </div>
      </section>
    </div>
  );
}

function ActivityList({ activities }: { activities: Array<{id:string;type:keyof typeof activityIcons;title:string;detail:string;occurredAt:string}> }) {
  return <div className="relative mt-4 space-y-0 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-[var(--border)]">{activities.map(activity=>{const Icon=activityIcons[activity.type];return <div key={activity.id} className="relative flex gap-3 py-3"><span className="z-[1] grid size-8 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white text-[#625cf6]"><Icon size={13}/></span><div className="min-w-0 flex-1 pt-0.5"><div className="flex items-start justify-between gap-3"><p className="text-[10px] font-semibold">{activity.title}</p><time className="shrink-0 text-[8px] text-[var(--text-tertiary)]">{shortDateFormatter.format(new Date(activity.occurredAt))}</time></div><p className="mt-1 text-[9px] leading-4 text-[var(--text-tertiary)]">{activity.detail}</p></div></div>})}</div>;
}
