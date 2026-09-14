"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, FormField, Input, Modal } from "@/components/ui";
import { Upload } from "@/components/ui/icons";
import { importPresentation, uploadPresentationResources, type ImportedDeck } from "@/lib/presentation-import/import";
import type { PresentationCreateInput } from "@/types/api";
import { ImportedSlidePreview } from "./ImportedSlide";
import styles from "./PresentationWorkshop.module.css";
export function PresentationImport({ onClose, onCreate }: { onClose: () => void; onCreate: (input: PresentationCreateInput) => Promise<unknown> }) {
  const [deck, setDeck] = useState<ImportedDeck | null>(null), [selected, setSelected] = useState(0), [name, setName] = useState(""), [busy, setBusy] = useState(false), [progress, setProgress] = useState(""), [error, setError] = useState("");
  const current = useRef<ImportedDeck | null>(null), uploaded = useRef(new Map<string, string>()), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; current.current?.dispose(); }; }, []);
  const read = async (file?: File) => {
    if (!file || busy) return; setBusy(true); setError(""); setProgress("Открываем презентацию…");
    try { const result = await importPresentation(file, message => { if (mounted.current) setProgress(message); }); if (!mounted.current) { result.dispose(); return; } current.current?.dispose(); current.current = result; uploaded.current.clear(); setDeck(result); setName(result.name); setSelected(0); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось импортировать файл."); } finally { setBusy(false); setProgress(""); }
  };
  const save = async () => {
    if (!deck || busy) return; setBusy(true); setError("");
    try { const slides = await uploadPresentationResources(deck, uploaded.current, setProgress); setProgress("Добавляем в библиотеку…"); const result = await onCreate({ name: name.trim() || deck.name, sourceType: "import", slides, backgroundColor: slides[0].backgroundColor || "#ffffff", textColor: "#111111", accentColor: "#7c35f2", themeId: "modern" }); if (result) onClose(); else setError("Не удалось сохранить презентацию. Повторите попытку."); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить презентацию."); } finally { setBusy(false); setProgress(""); }
  };
  return <Modal open title="Импорт презентации" size="full" panelClassName="!max-w-[min(1600px,calc(100vw-32px))]" onOpenChange={() => { if (!busy) onClose(); }} footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Отмена</Button><Button disabled={!deck || busy} loading={busy} onClick={() => void save()}>Добавить в библиотеку</Button></>}>
    <div className={styles.workshop}>
      {error && <Alert tone="danger">{error}</Alert>}
      {progress && <p role="status">{progress}</p>}
      {!deck ? <div className={styles.dropzone} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void read(e.dataTransfer.files[0]); }}><Upload className="size-10 text-primary" /><strong>Перетащите PowerPoint или PDF</strong><span>PPTX — до 40 слайдов · PDF — до 20 страниц · до 30 МБ</span><input type="file" aria-label="Файл презентации" accept=".pptx,.pdf" disabled={busy} onChange={e => void read(e.target.files?.[0])} /></div> : <>
        <FormField label="Название презентации"><Input aria-label="Название презентации" value={name} maxLength={120} onChange={e => setName(e.target.value)} /></FormField>
        <div className={styles.layout}><nav className={styles.rail} aria-label="Импортированные слайды">{deck.slides.map((s, i) => <button key={s.id} type="button" aria-label={`Слайд ${i + 1}`} aria-pressed={i === selected} onClick={() => setSelected(i)}><ImportedSlidePreview slide={s} /><span>{i + 1}</span></button>)}</nav><div className={styles.canvas}><ImportedSlidePreview slide={deck.slides[selected]} /></div><aside className={styles.inspector}><strong>Слайдов: {deck.slides.length}</strong><p>{deck.slides[selected].canvas?.source === "pptx" ? "Текст, изображения и фигуры можно редактировать после сохранения." : "Страница PDF сохранена целиком."}</p><ul>{deck.warnings.map(w => <li key={w}>{w}</li>)}</ul><Button variant="outline" disabled={busy} onClick={() => { current.current?.dispose(); current.current = null; setDeck(null); }}>Другой файл</Button></aside></div>
      </>}
    </div>
  </Modal>;
}
