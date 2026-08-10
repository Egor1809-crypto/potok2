"use client";

import { contacts } from "@/data/mockContacts";
import type { Contact } from "@/types";
import { Check, ChevronDown, Columns3, Download, Filter, ListFilter, MailPlus, MoreHorizontal, Plus, Search, Tag, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ContactDrawer } from "./ContactDrawer";

type SavedView = "All contacts" | "Partners" | "Lawyers" | "VIP" | "Conference 2026";

const LAWYERS_MOSCOW_ACTIVE_FILTER = "lawyers-moscow-active";
const FILTERED_CONTACT_COUNT = 843;

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getBrowserSearch() {
  return window.location.search;
}

function getServerSearch() {
  return "";
}

function campaignHref(selectedIds: string[], filtered: boolean) {
  if (selectedIds.length === 0 && !filtered) return "/campaigns/new";

  const params = new URLSearchParams();
  if (selectedIds.length > 0) {
    params.set("source", "contacts");
    params.set("count", String(selectedIds.length));
    selectedIds.forEach((id) => params.append("contact", id));
  } else {
    params.set("filter", LAWYERS_MOSCOW_ACTIVE_FILTER);
    params.set("count", String(FILTERED_CONTACT_COUNT));
  }
  return `/campaigns/new?${params.toString()}`;
}

export function ContactsView() {
  const browserSearch = useSyncExternalStore(
    subscribeToLocation,
    getBrowserSearch,
    getServerSearch,
  );
  const queryRequestsFilter = useMemo(
    () => new URLSearchParams(browserSearch).get("filter") === LAWYERS_MOSCOW_ACTIVE_FILTER,
    [browserSearch],
  );
  const [view, setView] = useState<SavedView>("All contacts");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOverride, setFilterOverride] = useState<boolean | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const filtersApplied = filterOverride ?? queryRequestsFilter;

  const filteredContacts = useMemo(() => {
    let result = contacts.filter(contact => `${contact.fullName} ${contact.email} ${contact.companyName} ${contact.role}`.toLowerCase().includes(search.toLowerCase()));
    if (view === "Partners") result = result.filter(c => c.category === "Partner" || c.tags.includes("Partner"));
    if (view === "Lawyers") result = result.filter(c => c.category === "Lawyer");
    if (view === "VIP") result = result.filter(c => c.tags.includes("VIP"));
    if (view === "Conference 2026") result = result.filter(c => c.tags.includes("Conference"));
    if (filtersApplied) result = result.filter(c => c.category === "Lawyer" && c.city === "Moscow" && c.status === "active");
    return [...result].sort((a,b) => sortAsc ? a.fullName.localeCompare(b.fullName) : b.fullName.localeCompare(a.fullName));
  }, [view, search, filtersApplied, sortAsc]);
  const visible = filteredContacts.slice(0, 16);
  const allSelected = visible.length > 0 && visible.every(contact => selected.has(contact.id));
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const createCampaignHref = useMemo(
    () => campaignHref(selectedIds, filtersApplied),
    [filtersApplied, selectedIds],
  );

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 2400); };
  const toggleAll = () => setSelected(current => { const next = new Set(current); if (allSelected) visible.forEach(c=>next.delete(c.id)); else visible.forEach(c=>next.add(c.id)); return next; });
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <div className="relative space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-eyebrow">People database</p><h1 className="mt-2 text-[28px] font-medium tracking-[-.04em]">Contacts</h1><p className="mt-1.5 text-sm text-[var(--text-secondary)]">{filtersApplied ? "843 active lawyers in Moscow" : "24,821 people across your workspace"}</p></div><div className="flex flex-wrap gap-2"><Link href="/import" className="btn btn-secondary gap-2"><Upload size={14}/>Import</Link><button onClick={()=>notify("Contact form opened in demo mode") } className="btn btn-secondary gap-2"><Plus size={14}/>Add contact</button><Link href={createCampaignHref} className="btn btn-primary gap-2"><MailPlus size={14}/>Create campaign</Link></div></div>

      <section className="card overflow-visible">
        <div className="overflow-x-auto border-b border-[var(--border)] px-4"><nav className="flex min-w-max gap-5" aria-label="Saved views">{(["All contacts","Partners","Lawyers","VIP","Conference 2026"] as SavedView[]).map(value=><button key={value} onClick={()=>{setView(value);setFilterOverride(false)}} className={`border-b-2 py-3.5 text-[10px] font-semibold transition-colors ${view===value?"border-[#625cf6] text-[#5d57dc]":"border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>{value}{value!=="All contacts" && <span className="ml-1.5 rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[8px]">{value==="Partners"?"1,284":value==="Lawyers"?"4,802":value==="VIP"?"184":"3,921"}</span>}</button>)}</nav></div>

        <div className="relative flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
          <label className="relative min-w-[210px] flex-1"><span className="sr-only">Search contacts</span><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"/><input value={search} onChange={e=>setSearch(e.target.value)} className="input h-9 w-full pl-9 text-[11px]" placeholder="Search contacts"/></label>
          <button onClick={()=>setFilterOpen(v=>!v)} className={`btn ${filtersApplied?"border-[#d8d6ff] bg-[#f3f2ff] text-[#5a54d2]":"btn-secondary"} gap-2`}><Filter size={13}/>Filter{filtersApplied&&<span className="rounded bg-[#625cf6] px-1.5 py-0.5 text-[8px] text-white">3</span>}</button>
          <button onClick={()=>setSortAsc(v=>!v)} className="btn btn-secondary gap-2"><ListFilter size={13}/>Sort <span className="text-[9px] text-[var(--text-tertiary)]">{sortAsc?"A–Z":"Z–A"}</span></button>
          <div className="relative"><button onClick={()=>setColumnsOpen(v=>!v)} className="btn btn-secondary gap-2"><Columns3 size={13}/>Columns</button>{columnsOpen&&<div className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-[var(--border)] bg-white p-2 shadow-[var(--shadow-floating)]">{["Email","Company","Role","Category","Location","Tags","Status","Last contacted"].map(item=><label key={item} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] hover:bg-[var(--surface-subtle)]"><input type="checkbox" defaultChecked className="accent-[#625cf6]"/>{item}</label>)}</div>}</div>
          <button className="btn btn-ghost px-2" aria-label="More contact actions"><MoreHorizontal size={16}/></button>

          {filterOpen && <FilterPanel applied={filtersApplied} onApply={()=>{setFilterOverride(true);setFilterOpen(false)}} onClear={()=>{setFilterOverride(false);setFilterOpen(false)}} />}
        </div>

        <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-left"><thead><tr className="bg-[var(--surface-subtle)] text-[9px] font-semibold uppercase tracking-[.075em] text-[var(--text-tertiary)]"><th className="w-12 px-4 py-3"><button onClick={toggleAll} aria-label="Select all visible contacts" className={`grid size-4 place-items-center rounded-[4px] border ${allSelected?"border-[#625cf6] bg-[#625cf6] text-white":"border-[#cfd1da] bg-white"}`}>{allSelected&&<Check size={10} strokeWidth={3}/>}</button></th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Company</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Tags</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Last contacted</th></tr></thead><tbody>{visible.map(contact=><tr key={contact.id} className={`border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-subtle)] ${selected.has(contact.id)?"bg-[#faf9ff]":""}`}><td className="px-4 py-3"><button onClick={()=>toggle(contact.id)} aria-label={`Select ${contact.fullName}`} className={`grid size-4 place-items-center rounded-[4px] border ${selected.has(contact.id)?"border-[#625cf6] bg-[#625cf6] text-white":"border-[#cfd1da] bg-white"}`}>{selected.has(contact.id)&&<Check size={10} strokeWidth={3}/>}</button></td><td className="px-3 py-3"><button onClick={()=>setDrawerContact(contact)} className="flex items-center gap-2.5 text-left"><span className="grid size-8 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white" style={{backgroundColor:contact.avatarColor}}>{contact.firstName[0]}{contact.lastName[0]}</span><span><span className="block text-[10px] font-semibold text-[var(--text-primary)] hover:text-[#625cf6]">{contact.fullName}</span><span className="mt-0.5 block text-[8px] text-[var(--text-tertiary)]">Score {contact.engagementScore}</span></span></button></td><td className="px-3 py-3 text-[10px] text-[var(--text-secondary)]">{contact.email}</td><td className="px-3 py-3 text-[10px] font-medium">{contact.companyName}</td><td className="max-w-[150px] truncate px-3 py-3 text-[10px] text-[var(--text-secondary)]">{contact.role}</td><td className="px-3 py-3"><span className="badge badge-neutral">{contact.category}</span></td><td className="px-3 py-3 text-[10px] text-[var(--text-secondary)]">{contact.city}</td><td className="px-3 py-3"><div className="flex gap-1">{contact.tags.slice(0,2).map(tag=><span key={tag} className="badge badge-info">{tag}</span>)}{contact.tags.length>2&&<span className="badge badge-neutral">+{contact.tags.length-2}</span>}</div></td><td className="px-3 py-3"><span className={`badge ${contact.status==="active"?"badge-success":contact.status==="unsubscribed"?"badge-neutral":contact.status==="bounced"?"badge-warning":"badge-danger"}`}><span className="size-1.5 rounded-full bg-current"/>{contact.status}</span></td><td className="px-3 py-3 text-[9px] text-[var(--text-tertiary)]">{contact.lastContactedAt?new Date(contact.lastContactedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"}):"Never"}</td></tr>)}</tbody></table></div>
        <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-3 text-[9px] text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between"><span>Showing {visible.length} of {filtersApplied?FILTERED_CONTACT_COUNT.toLocaleString("en-US"):"24,821"} contacts</span><div className="flex items-center gap-2"><button className="btn btn-secondary h-8 px-2.5 text-[9px]" disabled>Previous</button><span className="grid size-7 place-items-center rounded-md bg-[#625cf6] font-semibold text-white">1</span><button className="grid size-7 place-items-center rounded-md hover:bg-[var(--surface-subtle)]">2</button><button className="grid size-7 place-items-center rounded-md hover:bg-[var(--surface-subtle)]">3</button><button className="btn btn-secondary h-8 px-2.5 text-[9px]">Next</button></div></div>
      </section>

      {selected.size>0&&<div className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-[#242530] p-1.5 pl-4 text-white shadow-[0_20px_55px_rgba(24,25,38,.28)]"><span className="mr-3 whitespace-nowrap text-[10px] font-semibold">{selected.size} selected</span><Link href={createCampaignHref} className="flex items-center gap-1.5 rounded-lg bg-[#625cf6] px-3 py-2 text-[9px] font-semibold"><MailPlus size={12}/>Create campaign</Link><button onClick={()=>notify("Tag added to selected contacts")} className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[9px] text-white/75 hover:bg-white/10 sm:flex"><Tag size={12}/>Add tag</button><button onClick={()=>notify("Export prepared") } className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[9px] text-white/75 hover:bg-white/10 sm:flex"><Download size={12}/>Export</button><button onClick={()=>notify("Delete is disabled in demo mode")} className="grid size-8 place-items-center rounded-lg text-white/50 hover:bg-white/10" aria-label="Delete selected contacts"><Trash2 size={13}/></button><button onClick={()=>setSelected(new Set())} className="grid size-8 place-items-center rounded-lg text-white/50 hover:bg-white/10" aria-label="Clear selection"><X size={14}/></button></div>}
      {drawerContact&&<ContactDrawer contact={drawerContact} onClose={()=>setDrawerContact(null)}/>} 
      {toast&&<div className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 rounded-xl border border-[#dfe0e7] bg-white px-4 py-3 text-[10px] font-semibold shadow-[var(--shadow-floating)]"><span className="grid size-5 place-items-center rounded-full bg-[#e9f7ef] text-[#3f8c5b]"><Check size={12}/></span>{toast}</div>}
    </div>
  );
}

function FilterPanel({ applied, onApply, onClear }: {applied:boolean;onApply:()=>void;onClear:()=>void}) {
  return <div className="absolute left-3 top-14 z-30 w-[min(470px,calc(100vw-48px))] rounded-2xl border border-[var(--border-strong)] bg-white p-4 shadow-[var(--shadow-floating)]"><div className="flex items-start justify-between"><div><h2 className="text-[12px] font-semibold">Filter contacts</h2><p className="mt-1 text-[9px] text-[var(--text-tertiary)]">Match all of the following conditions</p></div><span className="rounded-md bg-[#eeedff] px-2 py-1 text-[8px] font-semibold text-[#5b55d8]">AND</span></div><div className="mt-4 space-y-2">{[["Role","equals","Lawyer"],["City","equals","Moscow"],["Status","equals","Active"]].map((row,index)=><div key={row[0]} className="flex items-center gap-2"><span className="w-10 text-[8px] font-semibold text-[#625cf6]">{index===0?"WHERE":"AND"}</span>{row.map(cell=><button key={cell} className="flex flex-1 items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-2 text-left text-[9px] font-medium">{cell}<ChevronDown size={10} className="text-[var(--text-tertiary)]"/></button>)}</div>)}</div><button className="ml-12 mt-2 flex items-center gap-1.5 py-2 text-[9px] font-semibold text-[#5d57dc]"><Plus size={12}/>Add filter</button><div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[8px] text-[var(--text-tertiary)]">Matching audience</p><p className="text-[17px] font-semibold tracking-[-.03em]">843 contacts</p></div><div className="flex gap-2"><button onClick={onClear} className="btn btn-secondary">{applied?"Clear":"Cancel"}</button><button onClick={onApply} className="btn btn-primary">Apply filters</button></div></div></div>;
}
