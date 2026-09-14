"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, Mail, Plus, Presentation } from "@/components/ui/icons";
import { Alert, Button, SearchInput, buttonVariants } from "@/components/ui";
import type { EmailAssetRecord } from "@/types/api";
import styles from "./PhotoLibrary.module.css";

function fileSize(value: number) {
  return value > 1048576 ? `${(value / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(value / 1024))} КБ`;
}

export function PhotoLibrary({ assets, selectedId, onSelect, loading, error }: {
  assets: EmailAssetRecord[]; selectedId: string; onSelect: (id: string) => void; loading: boolean; error: string;
}) {
  const [query, setQuery] = useState("");
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const images = useMemo(() => assets.filter(asset => asset.mimeType.startsWith("image/") && asset.filename.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))), [assets, query]);
  const selected = images.find(asset => asset.id === selectedId) ?? images[0];
  const index = images.findIndex(asset => asset.id === selected?.id);
  function move(next: number, focus = false) {
    const asset = images[next];
    if (!asset) return;
    onSelect(asset.id);
    const button = buttons.current.get(asset.id);
    if (focus) button?.focus();
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  return <div className={styles.shell}>
    <header className={styles.header}>
      <h1>Шаблоны фотографий</h1>
      <Link href="/image-studio?view=create" className={buttonVariants({ variant: "primary" })}><Plus aria-hidden className="size-6" />Создать изображение</Link>
    </header>
    {error && <Alert tone="danger">{error}</Alert>}
    <div className={styles.workspace}>
      <aside className={styles.rail} aria-label="Библиотека фотографий">
        <div className={styles.railHeader}><span>Медиатека</span><span>{images.length}</span></div>
        <div className={styles.search}><SearchInput value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Найти фото" aria-label="Найти фотографию" /></div>
        <div className={styles.railList}>
          {loading ? <p role="status" className={styles.railMessage}>Загружаем фотографии…</p> : images.map((asset, i) => <button
            key={asset.id} ref={element => { if (element) buttons.current.set(asset.id, element); else buttons.current.delete(asset.id); }}
            type="button" className={styles.thumbnail} aria-pressed={selected?.id === asset.id} aria-label={`Выбрать ${asset.filename}`} title={asset.filename} onClick={() => onSelect(asset.id)}
            onKeyDown={event => { const next = event.key === "ArrowDown" || event.key === "ArrowRight" ? i + 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? i - 1 : event.key === "Home" ? 0 : event.key === "End" ? images.length - 1 : null; if (next !== null) { event.preventDefault(); move(next, true); } }}>
            <img src={asset.url} alt="" loading="lazy" /><span>{String(i + 1).padStart(2, "0")}</span>
          </button>)}
          {!loading && !images.length && <p className={styles.railMessage}>{query ? "Ничего не найдено" : "Пока нет фотографий"}</p>}
        </div>
      </aside>
      <section className={styles.editor} aria-label="Рабочая область фотографий">
        <div className={styles.toolbar}>
          <div className={styles.paging}><Button size="icon" variant="ghost" disabled={index <= 0} aria-label="Предыдущее фото" onClick={() => move(index - 1)}><ChevronLeft aria-hidden className="size-5" /></Button><span aria-live="polite">{selected ? `${index + 1} / ${images.length}` : "0 / 0"}</span><Button size="icon" variant="ghost" disabled={index < 0 || index === images.length - 1} aria-label="Следующее фото" onClick={() => move(index + 1)}><ChevronRight aria-hidden className="size-5" /></Button></div>
          {selected && <a href={`${selected.url}${selected.url.includes("?") ? "&" : "?"}download=1`} className={buttonVariants({ variant: "secondary", size: "sm" })}><Download aria-hidden className="size-5" />Скачать</a>}
        </div>
        {selected ? <PhotoCanvas key={selected.id} asset={selected} /> : <div className={styles.empty}>
          <ImageIcon aria-hidden className="size-10" /><p>{loading ? "Подготавливаем медиатеку…" : query ? "Попробуйте другое название" : "Здесь появятся ваши изображения"}</p>
          {query && <Button variant="secondary" onClick={() => setQuery("")}>Сбросить поиск</Button>}
          {!loading && !query && <Link href="/image-studio?view=create" className={buttonVariants({ variant: "secondary" })}>Создать первое изображение</Link>}
        </div>}
        {selected && <footer className={styles.actions}>
          <Link href={`/art-director?type=photos&id=${encodeURIComponent(selected.id)}`} className={buttonVariants({ variant: "secondary" })}>Арт-директор</Link>
          <Link href={`/email-builder?new=1&asset=${encodeURIComponent(selected.id)}&assetName=${encodeURIComponent(selected.filename)}`} className={buttonVariants({ variant: "primary" })}><Mail aria-hidden className="size-5" />В письмо</Link>
          <Link href={`/email-builder?new=1&asset=${encodeURIComponent(selected.id)}&assetName=${encodeURIComponent(selected.filename)}&assetMode=background`} className={buttonVariants({ variant: "secondary" })}>Фон письма</Link>
          <Link href={`/presentations?new=1&asset=${encodeURIComponent(selected.id)}`} className={buttonVariants({ variant: "secondary" })}><Presentation aria-hidden className="size-5" />В презентацию</Link>
        </footer>}
      </section>
    </div>
  </div>;
}

function PhotoCanvas({ asset }: { asset: EmailAssetRecord }) {
  const [actualSize, setActualSize] = useState(false);
  const [dimensions, setDimensions] = useState("");
  const [failed, setFailed] = useState(false);
  return <>
    {/* Scrollable 100% preview needs a keyboard focus target. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className={styles.canvas} data-actual-size={actualSize} tabIndex={actualSize ? 0 : undefined} role="region" aria-label={`Просмотр: ${asset.filename}`}>
      {failed ? <p role="alert">Изображение не загрузилось. Выберите другой файл или обновите страницу.</p> : <img src={asset.url} alt={asset.filename} onLoad={event => setDimensions(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)} onError={() => setFailed(true)} />}
    </div>
    <div className={styles.info}>
      <div className={styles.file}><strong title={asset.filename}>{asset.filename}</strong><span>{[dimensions, fileSize(asset.size), asset.mimeType.split("/")[1].toUpperCase()].filter(Boolean).join(" · ")}</span></div>
      <div className={styles.zoom} role="group" aria-label="Масштаб изображения"><button type="button" aria-pressed={!actualSize} onClick={() => setActualSize(false)}>Вписать</button><button type="button" aria-pressed={actualSize} onClick={() => setActualSize(true)}>100%</button></div>
    </div>
  </>;
}
