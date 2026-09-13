"use client";
import { useState } from "react";
import { emailIcons } from "@/lib/email-icons";

export function EmailIconPicker({ onSelect, value, query: suppliedQuery }: { onSelect: (id: string) => void; value?: string; query?: string }) {
  const [query, setQuery] = useState("");
  const search = (suppliedQuery ?? query).trim().toLocaleLowerCase("ru");
  const icons = emailIcons.filter(icon => `${icon.name} ${icon.keywords}`.toLocaleLowerCase("ru").includes(search));
  return <div className="grid gap-3">
    {suppliedQuery === undefined && <label className="grid gap-1 text-xs">Найти значок<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Замок, диаграмма…" className="min-w-0 rounded-lg border border-border bg-surface p-2 text-sm" /></label>}
    <div className="grid grid-cols-3 gap-2">{icons.map(icon => <button type="button" key={icon.id} title={icon.name} aria-label={`Значок: ${icon.name}`} aria-pressed={value === icon.id} onClick={() => onSelect(icon.id)} className="grid min-h-20 place-items-center gap-1 rounded-xl border border-border bg-surface-subtle p-2 text-[10px] hover:border-primary focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-primary-subtle">
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={icon.path} alt="" width={40} height={40} />{icon.name}
    </button>)}</div>
    {!icons.length && <p className="text-xs text-text-muted">Таких значков пока нет. Попробуйте другое название.</p>}
  </div>;
}
