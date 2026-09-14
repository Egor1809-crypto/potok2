"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button, FormField, Select, Textarea, buttonVariants } from "@/components/ui";
import { Sparkles, Download } from "@/components/ui/icons";
import { parsePhotoDirection, type PhotoDirection } from "@/lib/photo-direction";
import type { EmailAssetRecord } from "@/types/api";
import styles from "./Director.module.css";

export function PhotoDirector({ assets, initialId }: { assets: EmailAssetRecord[]; initialId: string | null }) {
  const images = assets.filter(a => /^image\/(png|jpeg|webp|gif)$/.test(a.mimeType));
  const [selectedId, setSelectedId] = useState(initialId ?? images[0]?.id ?? "");
  const selected = images.find(a => a.id === selectedId) ?? images[0];
  const [commands, setCommands] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<Record<string, PhotoDirection>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const review = async () => {
    if (!selected || busy) return;
    const id = selected.id;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/image-studio/director", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: id, command: commands[id] || "" }), signal: AbortSignal.any([request.signal, AbortSignal.timeout(160000)]) });
      const body = await response.json() as { error?: string; direction?: unknown };
      if (!response.ok) throw new Error(body.error || "Не удалось разобрать фотографию.");
      const report = parsePhotoDirection(body.direction);
      setReports(items => ({ ...items, [id]: report }));
    } catch (caught) { if (!request.signal.aborted) setError(caught instanceof Error && caught.name === "TimeoutError" ? "Разбор занял слишком много времени. Попробуйте ещё раз." : caught instanceof Error ? caught.message : "Не удалось разобрать фотографию."); }
    finally { setBusy(false); controller.current = null; }
  };
  const report = selected ? reports[selected.id] : undefined;
  return <section className={styles.frame} aria-label="Арт-директор фотографий">
    <div className={styles.body}>
      {!selected ? <div className="space-y-4"><p>В медиатеке пока нет фотографий.</p><Link href="/image-studio?view=create" className={buttonVariants({ variant: "primary" })}>Создать изображение</Link></div> : <div className={styles.photo}>
        <div className={styles.photoStage}><img src={selected.url} alt={selected.filename} /></div>
        <div className={styles.photoControls}>
          <FormField label="Фотография" htmlFor="director-photo"><Select id="director-photo" value={selected.id} disabled={busy} onChange={e => { setSelectedId(e.target.value); setError(""); }} options={images.map(a => ({ value: a.id, label: a.filename }))} /></FormField>
          <FormField label="На что обратить внимание?" htmlFor="photo-command"><Textarea id="photo-command" rows={5} maxLength={3000} value={commands[selected.id] || ""} disabled={busy} placeholder="Например, подойдёт ли фото для обложки, где разместить заголовок" onChange={e => setCommands(items => ({ ...items, [selected.id]: e.target.value }))} /></FormField>
          <Button leadingIcon={<Sparkles aria-hidden className="size-6" />} disabled={busy} onClick={() => void review()}>{busy ? "Разбираем фотографию…" : report ? "Повторить разбор" : "Разобрать фотографию"}</Button>
          {busy && <><p role="status" className="text-sm text-text-muted">Проверяем композицию, свет, цвет и качество изображения.</p><Button variant="ghost" onClick={() => controller.current?.abort()}>Остановить</Button></>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
        {report && <article className={styles.report} aria-label="Разбор фотографии"><h2>{selected.filename}</h2><p>{report.summary}</p>{report.findings.length > 0 && <><h3 className="mt-4 font-semibold">Замечания</h3><ul>{report.findings.map((text, i) => <li key={i}>{text}</li>)}</ul></>}<h3 className="mt-4 font-semibold">Рекомендации</h3><ul>{report.recommendations.map((text, i) => <li key={i}>{text}</li>)}</ul></article>}
      </div>}
    </div>
    <footer className={styles.footer}><Link href="/image-studio?view=library" className={buttonVariants({ variant: "secondary" })}>В медиатеку</Link>{selected && <a href={`${selected.url}${selected.url.includes("?") ? "&" : "?"}download=1`} className={buttonVariants({ variant: "secondary" })}><Download aria-hidden className="size-5" />Скачать фото</a>}</footer>
  </section>;
}
