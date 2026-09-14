"use client";
import { useRef, useState, type ReactNode } from "react";
import type { PresentationProjectRecord, PresentationSlide } from "@/types/api";
import type { SlideDirection } from "@/lib/presentation-import/direction";
import { Alert, Button, FormField, Modal, Select, Textarea } from "@/components/ui";
import { confirmAction } from "@/components/ui/confirm-action";
import { ImportedSlideEditor } from "./ImportedSlide";
import styles from "./PresentationWorkshop.module.css";
export function PresentationDirector({ projects, initial, onClose, onSaved, renderSlide }: { projects: PresentationProjectRecord[]; initial?: PresentationProjectRecord; onClose: () => void; onSaved: (p: PresentationProjectRecord) => void; renderSlide: (p: PresentationProjectRecord, s: PresentationSlide) => ReactNode }) {
  const [draft, setDraft] = useState<PresentationProjectRecord | null>(initial ?? projects[0] ?? null), [selected, setSelected] = useState(0), [command, setCommand] = useState(""), [busy, setBusy] = useState(""), [error, setError] = useState(""), [dirty, setDirty] = useState(false), [direction, setDirection] = useState<SlideDirection | null>(null), [proposed, setProposed] = useState<PresentationSlide | null>(null), [showAfter, setShowAfter] = useState(true), [edit, setEdit] = useState(false);
  const view = useRef<HTMLDivElement>(null), slide = draft?.slides[selected];
  const leave = async () => { if (busy) return; if (!dirty || await confirmAction("Закрыть арт-директора без сохранения правок в библиотеку?")) onClose(); };
  const clear = () => { setDirection(null); setProposed(null); setError(""); };
  const update = (patch: Partial<PresentationSlide>) => { if (!draft || !slide) return; setDraft({ ...draft, slides: draft.slides.map(s => s.id === slide.id ? { ...s, ...patch } : s) }); setDirty(true); clear(); };
  const analyze = async (action: "review" | "revise") => {
    if (!slide || !view.current || busy) return; setBusy(action); setError(""); setProposed(null); setDirection(null);
    try {
      // Capture the unchanged slide; compare mode never becomes the next source implicitly.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await document.fonts.ready;
      const root = (view.current!.querySelector("[data-presentation-canvas]") || view.current!.firstElementChild) as HTMLElement;
      await Promise.all(Array.from(root.querySelectorAll("img")).map(image => image.decode()));
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(root, { scale: Math.min(2, 1440 / root.clientWidth), backgroundColor: null, useCORS: true, logging: false });
      const screenshot = canvas.toDataURL("image/png"); canvas.width = canvas.height = 0;
      const response = await fetch("/api/ai/presentations/director", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, command, slide, screenshot }), signal: AbortSignal.timeout(165000) });
      const body = await response.json() as { error?: string; direction: SlideDirection; proposed: PresentationSlide; presentation: PresentationProjectRecord }; if (!response.ok) throw new Error(body.error || "Не удалось получить разбор.");
      setDirection(body.direction); if (body.direction.patches.length) { setProposed(body.proposed); setShowAfter(true); }
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось проверить слайд."); } finally { setBusy(""); }
  };
  const save = async () => {
    if (!draft || busy) return; setBusy("save"); setError("");
    try { const response = await fetch("/api/presentations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draft.id, slides: draft.slides, expectedUpdatedAt: draft.updatedAt }), signal: AbortSignal.timeout(30000) }); const body = await response.json() as { error?: string; direction: SlideDirection; proposed: PresentationSlide; presentation: PresentationProjectRecord }; if (!response.ok || !body.presentation) throw new Error(body.error || "Не удалось сохранить правки."); setDraft(body.presentation); onSaved(body.presentation); setDirty(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить."); } finally { setBusy(""); }
  };
  return <Modal open title="Арт-директор презентаций" size="full" panelClassName="!max-w-[min(1600px,calc(100vw-32px))]" onOpenChange={() => void leave()} footer={<><Button variant="outline" disabled={!!busy} onClick={() => void leave()}>В библиотеку</Button><Button disabled={!dirty || !!busy} loading={busy === "save"} onClick={() => void save()}>Сохранить изменения</Button></>}>
    <div className={styles.workshop}>
      {error && <Alert tone="danger">{error}</Alert>}
      {!draft ? <p>Добавьте или импортируйте презентацию, чтобы открыть её в арт-директоре.</p> : <>
        <FormField label="Презентация"><Select aria-label="Презентация" disabled={!!busy} value={draft.id} options={[...new Map([...(initial ? [initial] : []), ...projects].map(p => [p.id, p])).values()].map(p => ({ value: p.id, label: p.name }))} onChange={async e => { const id = e.target.value; if (dirty && !await confirmAction("Перейти к другой презентации без сохранения текущих правок?")) return; setDraft(projects.find(p => p.id === id) ?? initial ?? null); setSelected(0); setDirty(false); clear(); }} /></FormField>
        {slide && <div className={styles.layout}><nav className={styles.rail} aria-label="Слайды для разбора">{draft.slides.map((s, i) => <button key={s.id} type="button" disabled={!!busy} aria-label={`Слайд ${i + 1}`} aria-pressed={i === selected} onClick={() => { setSelected(i); clear(); }}>{renderSlide(draft, s)}<span>{i + 1}</span></button>)}</nav><div className={styles.workshop}><div className={styles.canvas}><div ref={view}>{renderSlide(draft, proposed && showAfter ? proposed : slide)}</div></div>{proposed && <div className={styles.actions}><Button variant={showAfter ? "outline" : "primary"} onClick={() => setShowAfter(false)}>До</Button><Button variant={showAfter ? "primary" : "outline"} onClick={() => setShowAfter(true)}>После</Button><Button onClick={() => update(proposed)}>Применить правки</Button></div>}{slide.canvas && <Button variant="outline" disabled={!!busy} onClick={() => setEdit(true)}>Редактировать элементы</Button>}</div><aside className={styles.inspector}><Button loading={busy === "review"} disabled={!!busy} onClick={() => void analyze("review")}>Разобрать слайд</Button><FormField label="Что изменить?"><Textarea aria-label="Что изменить?" value={command} maxLength={3000} placeholder="Увеличь заголовок, выровняй изображение…" onChange={e => setCommand(e.target.value)} /></FormField><Button variant="outline" disabled={!!busy || !command.trim()} loading={busy === "revise"} onClick={() => void analyze("revise")}>Предложить правки</Button>{busy && busy !== "save" && <p role="status">Изучаем слайд…</p>}{direction && <><strong>{direction.summary}</strong><ul>{direction.findings.map((f, i) => <li key={i}>{f}</li>)}</ul></>}{slide.canvas?.source === "pdf" && <p>Арт-директор видит страницу PDF целиком. Текст внутри изображения можно изменить в исходном файле; здесь доступны положение, размер и новые элементы поверх.</p>}</aside></div>}
      </>}
    </div>
    {edit && slide?.canvas && <Modal open title="Элементы слайда" size="full" panelClassName="!max-w-[min(1600px,calc(100vw-32px))]" onOpenChange={() => setEdit(false)}><ImportedSlideEditor key={slide.id} slide={slide} onChange={update} /></Modal>}
  </Modal>;
}
