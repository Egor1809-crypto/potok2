"use client";
import { createPortal, flushSync } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PresentationProjectRecord, PresentationSlide } from "@/types/api";
import type { SlideDirection } from "@/lib/presentation-import/direction";
import {
  parseDeckDirection,
  buildDeckOverview,
  slideFingerprint,
  type DeckDirection,
  type SlideReview,
} from "@/lib/presentation-import/review";
import {
  Alert,
  Button,
  FormField,
  Select,
  Textarea,
} from "@/components/ui";
import { confirmAction } from "@/components/ui/confirm-action";
import { RevisionChanges } from "./RevisionChanges";
import { finalizeRevision, revisionChanges } from "@/lib/presentation-import/revision";
import { correctPresentation, type CorrectionResult } from "@/lib/presentation-import/deck-corrections";
import { AnnotatedSlide } from "./AnnotatedSlide";
import { parseSlideFindings, findingRegions } from "@/lib/presentation-import/review-findings";
import { PresentationElementsEditor } from "./PresentationElementsEditor";
import styles from "./PresentationWorkshop.module.css";

import { abortable, createSlideReviewQueue } from "@/lib/presentation-import/review-queue";
import { DirectorFrame } from "@/components/art-director/DirectorFrame";

type Progress = {
  completed: number;
  total: number;
  active: number[];
  phase: "slides" | "summary" | "done" | "paused";
};
class ReviewError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
function reviewContext(project: PresentationProjectRecord) {
  return {
    theme: { themeId: project.themeId, backgroundColor: project.backgroundColor, textColor: project.textColor, accentColor: project.accentColor },
    outline: project.slides.map(s => ({
      title: s.title.slice(0, 500),
      excerpt: (s.canvas ? s.canvas.elements.filter(e => e.kind === "text").map(e => e.text).join(" ") : [s.body, ...s.bullets].join(" ")).slice(0, 500),
    })),
  };
}
function reviewErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") return "Проверка заняла слишком много времени. Готовые результаты сохранены; повторите только незавершённые слайды.";
  return error instanceof Error ? error.message : "Не удалось проверить слайд.";
}
export function PresentationDirector({
  projects,
  embedded = false,
  initial,
  onClose,
  onSaved,
  renderSlide,
}: {
  embedded?: boolean;
  projects: PresentationProjectRecord[];
  initial?: PresentationProjectRecord;
  onClose: () => void;
  onSaved: (p: PresentationProjectRecord) => void;
  renderSlide: (
    p: PresentationProjectRecord,
    s: PresentationSlide,
  ) => ReactNode;
}) {
  const [draft, setDraft] = useState<PresentationProjectRecord | null>(
    initial ?? projects[0] ?? null,
  );
  const [selected, setSelected] = useState(0),
    [command, setCommand] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [proposed, setProposed] = useState<{
      slideId: string;
      slide: PresentationSlide;
      direction: SlideDirection;
    } | null>(null),
    [showAfter, setShowAfter] = useState(true),
    [edit, setEdit] = useState(false);
  const [reviews, setReviews] = useState<Record<string, SlideReview>>({}),
    [failures, setFailures] = useState<Record<string, string>>({}),
    [overview, setOverview] = useState<DeckDirection | null>(null),
    [tab, setTab] = useState<"deck" | "slide">("deck"),
    [progress, setProgress] = useState<Progress | null>(null);
  type BatchItem = {status:CorrectionResult["status"]|"pending"|"working"|"error"|"cancelled";changes:CorrectionResult["changes"];notes:string[]};
  const [batchResults,setBatchResults] = useState<Record<string,BatchItem>>({});
  const [batchBefore,setBatchBefore] = useState<PresentationProjectRecord|null>(null);
  const batchReviews = useRef<Record<string,SlideReview>>({});
  const [batchShowBefore,setBatchShowBefore] = useState(false);
  const [activeFinding, setActiveFinding] = useState<number | null>(null);
  const [showFindings, setShowFindings] = useState(true);
  const revisionCache = useRef(new Map<string, {slideId:string;slide:PresentationSlide;direction:SlideDirection}>());
  const findingCards = useRef(new Map<number, HTMLButtonElement>());
  const [revisionSeconds, setRevisionSeconds] = useState(0);
  useEffect(() => { if (busy !== "revise") return; setRevisionSeconds(0); const start = Date.now(); const timer = setInterval(() => setRevisionSeconds(Math.floor((Date.now()-start)/1000)),1000); return () => clearInterval(timer); }, [busy]);
  useEffect(() => setActiveFinding(null), [selected, draft?.id]);
  const [captureSlide, setCaptureSlide] = useState<PresentationSlide | null>(
    null,
  );
  const captureView = useRef<HTMLDivElement>(null),
    controller = useRef<AbortController | null>(null);
  const retryInQueue = useRef<((id: string) => boolean) | null>(null);
  const previews = useRef(new Map<string, string>());
  useEffect(() => () => controller.current?.abort(), []);
  const slide = draft?.slides[selected];
  const leave = async () => {
    if (busy) return;
    if (
      !dirty ||
      (await confirmAction(
        "Закрыть арт-директора без сохранения правок в библиотеку?",
      ))
    )
      onClose();
  };
  const updateSlides = (slides: PresentationSlide[]) => {
    if (!draft) return;
    revisionCache.current.clear();
    setBatchBefore(null); setBatchResults({}); setBatchShowBefore(false);
    setActiveFinding(null);
    const next = { ...draft, slides };
    setDraft(next);
    setDirty(true);
    setProposed(null);
    setError("");
    setReviews((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id, report]) => {
          const s = slides.find((item) => item.id === id);
          return s && report.fingerprint === slideFingerprint(next, s);
        }),
      ),
    );
    setOverview(null);
    setProgress(null);
    setFailures({});
  };
  const screenshot = async (s: PresentationSlide, signal: AbortSignal) => {
    signal.throwIfAborted();
    const key = slideFingerprint(draft!, s);
    const cached = previews.current.get(key);
    if (cached) return cached;
    flushSync(() => setCaptureSlide(s));
    const preparation = AbortSignal.any([signal, AbortSignal.timeout(20000)]);
    await abortable(document.fonts.ready, preparation);
    signal.throwIfAborted();
    const root = (captureView.current?.querySelector(
      "[data-presentation-canvas]",
    ) || captureView.current?.firstElementChild) as HTMLElement;
    if (!root || !root.clientWidth)
      throw new Error("Не удалось подготовить изображение слайда.");
    await abortable(Promise.all(
      Array.from(root.querySelectorAll("img")).map((image) => image.decode()),
    ), preparation);
    signal.throwIfAborted();
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await abortable(html2canvas(root, {
      scale: Math.min(2, 1440 / root.clientWidth),
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      imageTimeout: 12000,
    }), preparation);
    const image = canvas.toDataURL("image/jpeg", 0.92);
    canvas.width = canvas.height = 0;
    signal.throwIfAborted();
    // Keep memory bounded; repeat reviews and revisions reuse unchanged previews.
    if (previews.current.size >= 40) previews.current.delete(previews.current.keys().next().value!);
    previews.current.set(key, image);
    return image;
  };
  const request = async (payload: unknown, signal: AbortSignal) => {
    const response = await fetch("/api/ai/presentations/director", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([signal, AbortSignal.timeout(105000)]),
    });
    const body = (await response.json()) as {
      error?: string;
      direction: SlideDirection;
      proposed: PresentationSlide;
      overview: DeckDirection;
    };
    if (!response.ok)
      throw new ReviewError(
        body.error || "Не удалось получить разбор.",
        response.status,
      );
    return body;
  };
  const reviewDeck = async (refreshAll = false, onlyId?: string) => {
    if (!draft || busy || controller.current) return;
    const snapshot = structuredClone(draft),
      abort = new AbortController();
    controller.current = abort;
    const results: Record<string, SlideReview> = Object.fromEntries(
      Object.entries(refreshAll ? {} : reviews).filter(([id, report]) => {
        const s = snapshot.slides.find((item) => item.id === id);
        return s && report.fingerprint === slideFingerprint(snapshot, s);
      }),
    );
    const total = snapshot.slides.length,
      context = reviewContext(snapshot);
    let completed = Object.keys(results).length;
    if (refreshAll) setReviews({});
    setBusy("review");
    setError("");
    setOverview(null);
    setProposed(null);
    setTab("slide");
    setFailures(current => onlyId ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== onlyId)) : {});
    setProgress({ completed, total, active: [], phase: "slides" });
    try {
      const items = snapshot.slides.map((slide, index) => ({ slide, number: index + 1 }));
      const queue = createSlideReviewQueue({
        items: items.filter(item => !results[item.slide.id] && (!onlyId || item.slide.id === onlyId)),
        key: item => item.slide.id,
        concurrency: 4,
        signal: abort.signal,
        capture: (item, signal) => screenshot(item.slide, signal),
        review: async (item, image, signal) => {
          const body = await request({ action: "review", slide: item.slide, screenshot: image, context: { ...context, number: item.number } }, signal);
          if (!body.direction || !Array.isArray(body.direction.findings)) throw new Error("ИИ не вернул разбор слайда.");
          return body.direction;
        },
        onResult: (item, direction) => {
          results[item.slide.id] = { fingerprint: slideFingerprint(snapshot, item.slide), direction };
          completed = Object.keys(results).length;
          setFailures(current => Object.fromEntries(Object.entries(current).filter(([id]) => id !== item.slide.id)));
          setReviews({ ...results });
          setProgress(current => current ? { ...current, completed } : current);
        },
        onError: (item, error) => setFailures(current => ({ ...current, [item.slide.id]: reviewErrorMessage(error) })),
        onActive: items => setProgress({ completed, total, active: items.map(item => item.number), phase: "slides" }),
        isFatal: error => error instanceof ReviewError && [401, 403, 429, 503].includes(error.status),
      });
      retryInQueue.current = id => {
        const item = items.find(item => item.slide.id === id);
        return !!item && !results[id] && queue.enqueue(item);
      };
      await queue.done;
      if (completed !== total) {
        setError(
          `Проверено ${completed} из ${total}. Повторите проверку оставшихся слайдов.`,
        );
        setProgress({ completed, total, active: [], phase: "paused" });
        return;
      }
      setOverview(buildDeckOverview(snapshot.slides.map(s => results[s.id].direction)));
      setProgress({ completed, total, active: [], phase: "done" });
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Проверка остановлена. Готовые разборы сохранены в этом окне — можно продолжить."
          : reviewErrorMessage(e),
      );
      setProgress({ completed, total, active: [], phase: "paused" });
    } finally {
      retryInQueue.current = null;
      setBusy("");
      setCaptureSlide(null);
      controller.current = null;
    }
  };
  const retrySlide = (id: string) => {
    if (!failures[id]) return;
    if (busy === "review") {
      if (retryInQueue.current?.(id)) {
        setFailures(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
        setError("");
      }
    } else if (!busy) {
      void reviewDeck(false, id);
    }
  };
  const analyzeDeck = async () => {
    if (!draft || busy || !draft.slides.every(s => reviews[s.id])) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy("summary");
    setError("");
    setTab("deck");
    setProgress({ completed: draft.slides.length, total: draft.slides.length, active: [], phase: "summary" });
    try {
      const body = await request({ action: "summary", context: reviewContext(draft), reports: draft.slides.map((s, i) => ({ number: i + 1, summary: reviews[s.id].direction.summary, findings: reviews[s.id].direction.findings })) }, abort.signal);
      abort.signal.throwIfAborted();
      setOverview(parseDeckDirection(body.overview, draft.slides.length));
    } catch (error) {
      setError(abort.signal.aborted ? "Углублённый разбор остановлен. Замечания по слайдам сохранены." : reviewErrorMessage(error));
    } finally {
      setProgress({ completed: draft.slides.length, total: draft.slides.length, active: [], phase: "done" });
      setBusy("");
      controller.current = null;
    }
  };
  const revise = async (findingIndex?: number) => {
    if (!slide || !draft || busy || controller.current) return;
    const review = reviews[slide.id]?.direction;
    const chosen = typeof findingIndex === "number" ? review?.findings[findingIndex] : undefined;
    const useReview = !!review?.findings.length && (!!chosen || !command.trim());
    const cacheKey = JSON.stringify([slideFingerprint(draft,slide),chosen ?? command.trim(),review?.findings]);
    const cached = revisionCache.current.get(cacheKey);
    if (cached) { setProposed(cached); setShowAfter(true); setTab("slide"); return; }
    const abort = new AbortController();
    controller.current = abort;
    setBusy("revise");
    setError("");
    setProposed(null);
    setTab("slide");
    try {
      const png = useReview ? undefined : await screenshot(slide, abort.signal),
        body = await request(
          {
            action: "revise",
            command: chosen ? `Исправь только это замечание: ${chosen}` : command.trim() || "Исправь приоритетные замечания из разбора. Сохрани смысл, факты и стиль презентации.",
            slide,
            screenshot: png,
            context: { ...reviewContext(draft), number: selected + 1 },
            previousReview: chosen && review ? {...review, findings:[chosen], issues:review.issues?.filter((_,i)=>i===findingIndex)} : review,
            useReview,
          },
          abort.signal,
        );
      abort.signal.throwIfAborted();
      const verified = finalizeRevision(slide,body.direction,useReview);
      const proposal = {slideId:slide.id,slide:verified.proposed,direction:verified.direction};
      if (revisionCache.current.size >= 12) revisionCache.current.delete(revisionCache.current.keys().next().value!);
      revisionCache.current.set(cacheKey, proposal);
      setProposed(proposal);
      setShowAfter(true);
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Подготовка правок остановлена."
          : reviewErrorMessage(e),
      );
    } finally {
      setBusy("");
      setCaptureSlide(null);
      controller.current = null;
    }
  };
  const reviseDeck = async (retry = false) => {
    if (!draft || busy || controller.current) return;
    const snapshot = structuredClone(draft);
    const ids = retry ? Object.entries(batchResults).filter(([,r])=>["error","cancelled"].includes(r.status)).map(([id])=>id) : snapshot.slides.map(s=>s.id);
    if (!ids.length) return;
    if (!retry || !batchBefore) {setBatchBefore(snapshot);batchReviews.current={...reviews};}
    const abort = new AbortController(); controller.current=abort;
    const context=reviewContext(snapshot);
    setBusy("batch");setError("");setProposed(null);setOverview(null);setProgress(null);setTab("slide");setBatchShowBefore(false);
    setBatchResults(current=>({...(retry?current:{}),...Object.fromEntries(ids.map(id=>[id,{status:"pending",changes:[],notes:[]} as BatchItem]))}));
    try {
      await correctPresentation({project:snapshot,reviews,ids,signal:abort.signal,
        capture:(s,signal)=>screenshot(s,signal),
        review:async(s,image,number,signal)=>(await request({action:"review",slide:s,screenshot:image,context:{...context,number}},signal)).direction,
        revise:async(s,review,number,signal)=>(await request({action:"revise",slide:s,previousReview:review,useReview:true,command:"Исправь все применимые замечания этого слайда. Сохрани факты и стиль. Для каждого неприменимого замечания объясни причину.",context:{...context,number}},signal)).direction,
        onReviewed:(s,review)=>setReviews(current=>({...current,[s.id]:review})),
        onResult:(source,result)=>{
          setBatchResults(current=>({...current,[source.id]:{status:result.status,changes:result.changes,notes:result.notes}}));
          if(result.status === "changed") {
            setDraft(current=>current && current.id===snapshot.id ? {...current,slides:current.slides.map(s=>s.id===source.id?result.slide:s)} : current);
            setDirty(true);
            setReviews(current=>Object.fromEntries(Object.entries(current).filter(([id])=>id!==source.id)));
          }
        },
        onError:(s,error)=>setBatchResults(current=>({...current,[s.id]:{status:"error",changes:[],notes:[reviewErrorMessage(error)]}})),
        onActive:active=>setBatchResults(current=>Object.fromEntries(Object.entries(current).map(([id,r])=>[id,active.includes(id)&&r.status==="pending"?{...r,status:"working"}:r]))),
        isFatal:error=>error instanceof ReviewError && [401,403,429,503].includes(error.status),
      });
    } catch(error) {setError(abort.signal.aborted?"Исправление остановлено. Уже внесённые изменения сохранены в рабочей версии.":reviewErrorMessage(error));}
    finally {
      setBatchResults(current=>Object.fromEntries(Object.entries(current).map(([id,r])=>[id,["pending","working"].includes(r.status)?{...r,status:"cancelled",notes:["Не обработан. Можно повторить."]}:r])));
      revisionCache.current.clear();setCaptureSlide(null);controller.current=null;setBusy("");
    }
  };
  const undoBatch = () => {
    if (!draft || !batchBefore || busy) return;
    setDraft({...draft,slides:structuredClone(batchBefore.slides)});setReviews(batchReviews.current);
    setDirty(true);setBatchBefore(null);setBatchResults({});setBatchShowBefore(false);setOverview(null);setProgress(null);setError("");
  };
  const save = async () => {
    if (!draft || busy) return;
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/presentations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          slides: draft.slides,
          expectedUpdatedAt: draft.updatedAt,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const body = (await response.json()) as {
        error?: string;
        presentation: PresentationProjectRecord;
      };
      if (!response.ok || !body.presentation)
        throw new Error(body.error || "Не удалось сохранить правки.");
      setDraft(body.presentation);
      onSaved(body.presentation);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить.");
    } finally {
      setBusy("");
    }
  };
  const batchEntries = Object.values(batchResults);
  const batchCompleted = batchEntries.filter(r=>!["pending","working"].includes(r.status)).length;
  const batchChanged = batchEntries.filter(r=>r.status==="changed").length;
  const batchOriginal = batchBefore?.slides.find(s=>s.id===slide?.id);
  const currentProposal = proposed?.slideId === slide?.id ? proposed : null;
  const reviewReport = slide ? reviews[slide.id]?.direction : undefined;
  const slideFindings = slide && reviewReport ? reviewReport.issues ?? parseSlideFindings(reviewReport.findings,slide) : [];
  const showingProposal = !!currentProposal && showAfter;
  const selectFinding = (index:number, fromSlide = false) => {
    setActiveFinding(index); setTab("slide");
    if (fromSlide) requestAnimationFrame(() => findingCards.current.get(index)?.focus({preventScroll:false}));
  };
  const report =
    (showingProposal ? currentProposal?.direction : null) || (slide ? reviews[slide.id]?.direction : null);
  const progressText =
    progress?.phase === "summary"
      ? "Собираем общие рекомендации"
      : progress?.phase === "done"
        ? "Презентация проверена"
        : progress?.phase === "paused"
          ? "Проверка приостановлена"
          : progress?.active.length
            ? `Проверяем ${progress.active.length === 1 ? "слайд" : "слайды"} ${progress.active.join(", ")}`
            : "Подготавливаем проверку";
  return (
    <DirectorFrame
      embedded={embedded}
      open
      title="Арт-директор презентаций"
      size="full"
      panelClassName="!max-w-[min(1700px,calc(100vw-24px))]"
      onOpenChange={() => void leave()}
      footer={
        <>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => void leave()}
          >
            В библиотеку
          </Button>
          <Button
            disabled={!dirty || !!busy}
            loading={busy === "save"}
            onClick={() => void save()}
          >
            Сохранить изменения
          </Button>
        </>
      }
    >
      <div className={styles.workshop}>
        {error && !edit && <Alert tone="danger">{error}</Alert>}
        {!draft ? (
          <p>
            Добавьте или импортируйте презентацию, чтобы открыть её в
            арт-директоре.
          </p>
        ) : (
          <>
            <div className={styles.editorToolbar}>
              <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                <Select
                  aria-label="Презентация"
                  disabled={!!busy}
                  value={draft.id}
                  options={[
                    ...new Map(
                      [...(initial ? [initial] : []), ...projects].map((p) => [
                        p.id,
                        p,
                      ]),
                    ).values(),
                  ].map((p) => ({ value: p.id, label: p.name }))}
                  onChange={async (e) => {
                    const id = e.target.value;
                    if (
                      dirty &&
                      !(await confirmAction(
                        "Перейти к другой презентации без сохранения текущих правок?",
                      ))
                    )
                      return;
                    previews.current.clear();
                    revisionCache.current.clear();
                    setBatchBefore(null);setBatchResults({});setBatchShowBefore(false);
                    setDraft(
                      projects.find((p) => p.id === id) ?? initial ?? null,
                    );
                    setSelected(0);
                    setDirty(false);
                    setReviews({});
                    setOverview(null);
                    setProgress(null);
                    setFailures({});
                    setProposed(null);
                    setError("");
                  }}
                />
              </div>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => void reviewDeck(!!overview)}
              >
                {batchChanged ? "Проверить исправления" : overview
                  ? "Повторить проверку"
                  : Object.keys(reviews).length
                    ? "Продолжить проверку"
                    : "Разобрать всю презентацию"}
              </Button>
              <Button disabled={!!busy} onClick={()=>void reviseDeck()}>Исправить всю презентацию</Button>
              {overview && <Button variant="outline" disabled={!!busy} onClick={() => void analyzeDeck()}>Проверить связность и общий стиль</Button>}
              {busy && busy !== "save" && (
                <Button
                  variant="outline"
                  onClick={() => controller.current?.abort()}
                >
                  Остановить
                </Button>
              )}
            </div>
            {batchEntries.length>0 && <section className={styles.batchPanel} aria-label="Исправление всей презентации">
              <div className={styles.progressTitle}><strong role="status">{busy==="batch"?`Исправляем презентацию: ${batchCompleted} из ${batchEntries.length}`:`Изменено слайдов: ${batchChanged} из ${batchEntries.length}`}</strong><span>{batchChanged?(dirty?"Изменения в рабочей версии. Сохраните их в библиотеку.":"Изменения сохранены в библиотеке."):"Готовые изменения появятся здесь."}</span></div>
              {busy==="batch" && <progress aria-label="Прогресс исправления" max={batchEntries.length} value={batchCompleted}/>}
              <div className={styles.actions}>
                <Button size="sm" variant="outline" disabled={!!busy||!batchChanged} onClick={()=>setBatchShowBefore(v=>!v)}>{batchShowBefore?"Показать после исправлений":"Показать до исправлений"}</Button>
                <Button size="sm" variant="outline" disabled={!!busy||!batchChanged} onClick={undoBatch}>Отменить все исправления</Button>
                {batchEntries.some(r=>["error","cancelled"].includes(r.status))&&<Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void reviseDeck(true)}>Повторить незавершённые</Button>}
              </div>
              <div className={styles.batchResults}>{draft.slides.map((s,i)=>{const r=batchResults[s.id];return r?<details key={s.id}><summary>Слайд {i+1} · {{pending:"В очереди",working:"Проверяем и исправляем…",changed:`Изменений: ${r.changes.length}`,clean:"Без замечаний",manual:"Нужна ручная правка",error:"Ошибка",cancelled:"Не обработан"}[r.status]}</summary><Button size="sm" variant="ghost" onClick={()=>{setSelected(i);setTab("slide");}}>Показать слайд {i+1}</Button>{r.changes.length>0&&<RevisionChanges changes={r.changes}/>}<div>{r.notes.map((note,n)=><p key={n}>{note}</p>)}</div></details>:null;})}</div>
            </section>}
            {progress && (
              <div className={styles.progressPanel}>
                <div className={styles.progressTitle}>
                  <strong role="status">{progressText}</strong>
                  <span>
                    {progress.completed} / {progress.total} слайдов
                  </span>
                </div>
                <progress
                  aria-label="Прогресс проверки презентации"
                  max={progress.total}
                  value={progress.completed}
                  aria-valuetext={progressText}
                />
              </div>
            )}
            {slide && (
              <div className={styles.layout}>
                <nav className={styles.rail} aria-label="Слайды для разбора">
                  {draft.slides.map((s, i) => {
                    const status = reviews[s.id]
                      ? "done"
                      : busy === "review" &&
                          progress?.phase === "slides" &&
                          progress.active.includes(i + 1)
                        ? "running"
                        : failures[s.id]
                          ? "error"
                          : "pending";
                    return (
                      <div className={styles.reviewSlideCard} key={s.id}>
                        <button
                          type="button"
                          aria-label={`Слайд ${i + 1}`}
                          aria-pressed={i === selected}
                          onClick={() => {setSelected(i);setTab("slide");}}
                        >
                          <div inert>{renderSlide(draft, s)}</div>
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          {progress && (
                            <span
                              className={styles.reviewState}
                              data-status={status}
                            >
                              {status === "done"
                                ? "Проверен"
                                : status === "running"
                                  ? "Проверяем…"
                                  : status === "error"
                                    ? "Не удалось проверить"
                                    : busy === "review" ? "В очереди" : "Не проверен"}
                            </span>
                          )}
                        </button>
                        {status === "error" && (
                          <button
                            type="button"
                            className={styles.retrySlide}
                            aria-label={`Повторить проверку слайда ${i + 1}`}
                            disabled={!!busy && (busy !== "review" || controller.current?.signal.aborted)}
                            onClick={() => retrySlide(s.id)}
                          >
                            Повторить проверку
                          </button>
                        )}
                      </div>
                    );
                  })}
                </nav>
                <div className={styles.workshop}>
                  <div className={styles.actions}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!selected}
                      onClick={() => setSelected((n) => n - 1)}
                    >
                      Предыдущий
                    </Button>
                    <span className={styles.slideCount}>
                      {selected + 1} / {draft.slides.length}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selected === draft.slides.length - 1}
                      onClick={() => setSelected((n) => n + 1)}
                    >
                      Следующий
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => setEdit(true)}
                    >
                      Редактировать элементы
                    </Button>
                  </div>
                  {slideFindings.length > 0 && !showingProposal && <div className={styles.annotationToolbar}>
                    <label><input type="checkbox" checked={showFindings} onChange={e=>setShowFindings(e.target.checked)}/>Показать замечания на слайде</label>
                    <span>Номер на слайде = номер в списке</span>
                  </div>}
                  {batchOriginal && batchResults[slide.id]?.status==="changed" && <strong className={styles.versionLabel}>{batchShowBefore?"До исправлений":"После исправлений — изменения применены"}</strong>}
                  <div className={`${styles.canvas} ${styles.directorPreview}`}>
                    <AnnotatedSlide slide={batchShowBefore && batchOriginal ? batchOriginal : showingProposal ? currentProposal!.slide : slide} findings={showFindings && !showingProposal && !batchShowBefore ? slideFindings : []} active={activeFinding} onSelect={i=>selectFinding(i,true)}>
                    {renderSlide(
                      draft,
                      batchShowBefore && batchOriginal ? batchOriginal : currentProposal && showAfter
                        ? currentProposal.slide
                        : slide,
                    )}
                    </AnnotatedSlide>
                  </div>
                  {currentProposal &&
                    currentProposal.direction.patches.length > 0 && (
                      <div className={styles.actions}>
                        <Button
                          variant={showAfter ? "outline" : "primary"}
                          onClick={() => setShowAfter(false)}
                        >
                          До
                        </Button>
                        <Button
                          variant={showAfter ? "primary" : "outline"}
                          onClick={() => setShowAfter(true)}
                        >
                          После
                        </Button>
                        <Button
                          disabled={!!busy}
                          onClick={() =>
                            updateSlides(
                              draft.slides.map((s) =>
                                s.id === slide.id ? currentProposal.slide : s,
                              ),
                            )
                          }
                        >
                          Применить правки
                        </Button>
                      </div>
                    )}
                </div>
                <aside className={styles.inspector}>
                  <div className={styles.reportTabs}>
                    <Button
                      size="sm"
                      variant={tab === "deck" ? "primary" : "ghost"}
                      aria-pressed={tab === "deck"}
                      onClick={() => setTab("deck")}
                    >
                      Вся презентация
                    </Button>
                    <Button
                      size="sm"
                      variant={tab === "slide" ? "primary" : "ghost"}
                      aria-pressed={tab === "slide"}
                      onClick={() => setTab("slide")}
                    >
                      Слайд {selected + 1}
                    </Button>
                  </div>
                  <div className={styles.report}>
                    {tab === "deck" ? (
                      overview ? (
                        <>
                          <strong>{overview.summary}</strong>
                          {overview.recommendations.map((r, i) => (
                            <div className={styles.finding} key={i}>
                              <p>{r.text}</p>
                              <div className={styles.actions}>
                                {r.slides.map((n) => (
                                  <Button
                                    key={n}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelected(n - 1);
                                      setTab("slide");
                                    }}
                                  >
                                    Слайд {n}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p>
                          {busy === "review"
                            ? "Общие рекомендации появятся после проверки всех слайдов. Готовые замечания уже доступны во вкладке слайда."
                            : "Проверьте всю презентацию: композицию каждого слайда, последовательность и единый стиль."}
                        </p>
                      )
                    ) : report ? (
                      <>
                        {showingProposal && currentProposal ? <div className={styles.proposalSummary}><strong>{currentProposal.direction.patches.length ? "Правки готовы к просмотру" : "Нужны изменения вручную"}</strong><p>{report.summary}</p><RevisionChanges changes={revisionChanges(slide,currentProposal.slide)}/>{report.findings.map((f,i)=><p key={i}>{f}</p>)}<Button size="sm" variant="outline" onClick={()=>setProposed(null)}>Вернуться к замечаниям</Button></div> : <>
                          <p className={styles.reviewSummary}>{report.summary}</p>
                          <div className={styles.findingLegend}><span>Исправить: {slideFindings.filter(f=>f.priority==="required").length}</span><span>По желанию: {slideFindings.filter(f=>f.priority==="suggestion").length}</span></div>
                          {!slideFindings.length && <p>Замечаний к этому слайду нет.</p>}
                          <ol className={styles.findingList} aria-label={`Замечания к слайду ${selected+1}`}>
                            {slideFindings.map((f,i)=><li key={i} className={styles.findingCard} data-priority={f.priority} data-active={activeFinding===i}>
                              <button ref={node=>{if(node)findingCards.current.set(i,node);else findingCards.current.delete(i);}} type="button" className={styles.findingTitle} onClick={()=>selectFinding(i)} aria-pressed={activeFinding===i}>
                                <span className={styles.findingNumber}>{i+1}</span><span><small>{f.priority==="required"?"Исправить":"По желанию"}</small><strong>{f.title}</strong></span>
                              </button>
                              <p>{f.problem}</p>
                              {f.suggestion && <p className={styles.findingAction}><strong>Что изменить</strong>{f.suggestion}</p>}
                              {!findingRegions(f,slide).length && <small>Без привязки к отдельному объекту</small>}
                              <Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void revise(i)}>Исправить пункт {i+1}</Button>
                            </li>)}
                          </ol>
                        </>}
                      </>
                    ) : batchResults[slide.id]?.status==="changed" ? (
                      <><strong>Изменения применены к слайду</strong><RevisionChanges changes={batchResults[slide.id].changes}/>{batchResults[slide.id].notes.map((note,i)=><p key={i}>{note}</p>)}<p>Повторная проверка покажет оставшиеся замечания.</p></>
                    ) : (
                      <p>
                        {failures[slide.id] ||
                          "Разбор этого слайда ещё не готов."}
                      </p>
                    )}
                  </div>
                  {tab === "slide" && failures[slide.id] && (
                    <Button variant="outline" disabled={!!busy && (busy !== "review" || controller.current?.signal.aborted)} onClick={() => retrySlide(slide.id)}>
                      Повторить проверку слайда {selected + 1}
                    </Button>
                  )}
                  <FormField label={`Правки слайда ${selected + 1}`}>
                    <Textarea
                      aria-label="Что изменить?"
                      value={command}
                      maxLength={3000}
                      placeholder={reviews[slide.id]?.direction.findings.length ? "Можно уточнить задачу или исправить замечания из разбора" : "Что нужно изменить на слайде?"}
                      onChange={(e) => setCommand(e.target.value)}
                    />
                  </FormField>
                  <Button
                    variant="outline"
                    disabled={!!busy || (!command.trim() && !reviews[slide.id]?.direction.findings.length)}
                    loading={busy === "revise"}
                    onClick={() => void revise()}
                  >
                    {command.trim() ? "Предложить правки" : "Исправить замечания"}
                  </Button>
                  {busy === "revise" && (
                    <p role="status">{revisionSeconds < 30 ? "Готовим правки" : "Запрос ещё выполняется"} · {revisionSeconds} с</p>
                  )}
                </aside>
              </div>
            )}
            {captureSlide && typeof document !== "undefined" && createPortal(
              <div
                ref={captureView}
                className={styles.capture}
                aria-hidden="true"
                inert
              >
                {renderSlide(draft, captureSlide)}
              </div>, document.body
            )}
            {edit && slide && (
              <PresentationElementsEditor
                project={draft}
                selectedId={slide.id}
                onSelect={(id) =>
                  setSelected(draft.slides.findIndex((s) => s.id === id))
                }
                onChange={updateSlides}
                onClose={() => setEdit(false)}
                onSave={() => void save()}
                saving={busy === "save"}
                dirty={dirty}
                error={error}
                renderSlide={renderSlide}
              />
            )}
          </>
        )}
      </div>
    </DirectorFrame>
  );
}
