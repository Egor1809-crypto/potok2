"use client";
import { useState } from "react";
import { emailIcons, colorEmailIcons } from "@/lib/email-icons";
import { runeEmailIcons, runeCategories } from "@/lib/runeicons";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function EmailIconPicker({ onSelect, value, query: suppliedQuery }: { onSelect: (id: string) => void; value?: string; query?: string }) {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState(value && !value.startsWith("rune-") ? "color" : "pixel");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState({ key: "", count: 36 });
  const search = (suppliedQuery ?? query).trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  const icons = emailIcons.filter(icon => icon.collection === collection && (!category || icon.category === category) && `${icon.name} ${icon.keywords}`.toLocaleLowerCase("ru").replaceAll("ё", "е").includes(search));
  const key = `${collection}:${category}:${search}`, count = page.key === key ? page.count : 36;
  return <div className="grid gap-3">
    <div role="group" aria-label="Коллекция значков" className="grid grid-cols-2 gap-1 rounded-lg bg-surface-subtle p-1">{[["pixel", "Runeicons", runeEmailIcons.length], ["color", "Цветные", colorEmailIcons.length]].map(([id, label, total]) => <button key={id} type="button" aria-label={`${label}: ${total} значков`} aria-pressed={collection === id} onClick={() => { setCollection(String(id)); setCategory(""); }} style={{ fontSize: 12 }} className="min-h-11 rounded-md px-1 py-2 text-xs font-medium aria-pressed:bg-primary aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-primary">{label}<span className="block text-[11px] opacity-75">{total}</span></button>)}</div>
    {suppliedQuery === undefined && <label className="grid gap-1 text-xs">Найти значок<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Замок, диаграмма…" className="min-w-0 rounded-lg border border-border bg-surface p-2 text-sm" /></label>}
    {collection === "pixel" && <label className="grid gap-1 text-xs">Категория<Select value={category} onChange={event => setCategory(event.target.value)} options={[{ value: "", label: "Все категории" }, ...Object.values(runeCategories).map(name => ({value: name, label: name}))]} /></label>}
    <div className="grid gap-2" style={{gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 72px), 1fr))"}}>{icons.slice(0, count).map(icon => <button type="button" key={icon.id} title={icon.name} aria-label={`${icon.collection === "pixel" ? "Пиксельный значок" : "Значок"}: ${icon.name}`} aria-pressed={value === icon.id} onClick={() => onSelect(icon.id)} style={{ fontSize: 12, lineHeight: "16px" }} className="grid min-h-20 min-w-0 place-items-center gap-1 rounded-xl border border-border bg-surface-subtle px-1 py-2 text-xs hover:border-primary focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-primary-subtle">
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={icon.path} alt="" width={40} height={40} loading="lazy" style={{imageRendering: icon.collection === "pixel" ? "pixelated" : "auto"}} /><span className="line-clamp-2 max-w-full break-words">{icon.name}</span>
    </button>)}</div>
    {icons.length > count && <Button size="sm" variant="secondary" onClick={() => setPage({key, count: count + 36})}>Показать ещё</Button>}
    <p role="status" className="text-xs text-text-muted">{icons.length ? `Показано ${Math.min(count, icons.length)} из ${icons.length}` : "Ничего не найдено. Попробуйте другое название или категорию."}</p>
    {collection === "pixel" && <p className="text-xs text-text-muted"><a href="https://github.com/Nexvyn/runeicons" target="_blank" rel="noopener noreferrer" className="underline">Runeicons</a> · <a href="/email-icons/Runeicons-LICENSE.txt" target="_blank" rel="noopener noreferrer" className="underline">Apache 2.0</a></p>}
  </div>;
}
