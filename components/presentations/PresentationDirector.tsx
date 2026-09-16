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
import { PresentationElementsEditor } from "./PresentationElementsEditor";
import styles from "./PresentationWorkshop.module.css";

import { abortable, runSlideReviews } from "@/lib/presentation-import/review-queue";
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
  const [captureSlide, setCaptureSlide] = useState<PresentationSlide | null>(
    null,
  );
  const captureView = useRef<HTMLDivElement>(null),
    controller = useRef<AbortController | null>(null);
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
    if (previews.current.size >= 8) previews.current.delete(previews.current.keys().next().value!);
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
  const reviewDeck = async (refreshAll = false) => {
    if (!draft || busy) return;
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
    setTab("deck");
    setFailures({});
    setProgress({ completed, total, active: [], phase: "slides" });
    try {
      await runSlideReviews({
        items: snapshot.slides.map((slide, index) => ({ slide, number: index + 1 })).filter(item => !results[item.slide.id]),
        signal: abort.signal,
        capture: (item, signal) => screenshot(item.slide, signal),
        review: async (item, image, signal) => {
          const body = await request({ action: "review", slide: item.slide, screenshot: image, context: { ...context, number: item.number } }, signal);
          if (!body.direction || !Array.isArray(body.direction.findings)) throw new Error("ИИ не вернул разбор слайда.");
          return body.direction;
        },
        onResult: (item, direction) => {
          results[item.slide.id] = { fingerprint: slideFingerprint(snapshot, item.slide), direction };
          completed++;
          setReviews({ ...results });
          setProgress(current => current ? { ...current, completed } : current);
        },
        onError: (item, error) => setFailures(current => ({ ...current, [item.slide.id]: reviewErrorMessage(error) })),
        onActive: items => setProgress({ completed, total, active: items.map(item => item.number), phase: "slides" }),
        isFatal: error => error instanceof ReviewError && [401, 403, 429, 503].includes(error.status),
      });
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
      setBusy("");
      setCaptureSlide(null);
      controller.current = null;
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
  const revise = async () => {
    if (!slide || !draft || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy("revise");
    setError("");
    setProposed(null);
    setTab("slide");
    try {
      const png = await screenshot(slide, abort.signal),
        body = await request(
          {
            action: "revise",
            command: command.trim() || "Исправь приоритетные замечания из разбора. Сохрани смысл, факты и стиль презентации.",
            slide,
            screenshot: png,
            context: { ...reviewContext(draft), number: selected + 1 },
            previousReview: reviews[slide.id]?.direction,
            useReview: !command.trim(),
          },
          abort.signal,
        );
      abort.signal.throwIfAborted();
      setProposed({
        slideId: slide.id,
        slide: body.proposed,
        direction: body.direction,
      });
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
  const currentProposal = proposed?.slideId === slide?.id ? proposed : null;
  const report =
    currentProposal?.direction || (slide ? reviews[slide.id]?.direction : null);
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
                disabled={!!busy}
                onClick={() => void reviewDeck(!!overview)}
              >
                {overview
                  ? "Повторить проверку"
                  : Object.keys(reviews).length
                    ? "Продолжить проверку"
                    : "Разобрать всю презентацию"}
              </Button>
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
                  max={progress.total + 1}
                  value={
                    progress.completed + (progress.phase === "done" ? 1 : 0)
                  }
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
                      <button
                        key={s.id}
                        type="button"
                        aria-label={`Слайд ${i + 1}`}
                        aria-pressed={i === selected}
                        onClick={() => setSelected(i)}
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
                                  ? "Повторить"
                                  : "В очереди"}
                          </span>
                        )}
                      </button>
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
                  <div className={`${styles.canvas} ${styles.directorPreview}`}>
                    {renderSlide(
                      draft,
                      currentProposal && showAfter
                        ? currentProposal.slide
                        : slide,
                    )}
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
                        <strong>{report.summary}</strong>
                        {report.findings.map((f, i) => (
                          <div className={styles.finding} key={i}>
                            {f}
                          </div>
                        ))}
                      </>
                    ) : (
                      <p>
                        {failures[slide.id] ||
                          "Разбор этого слайда ещё не готов."}
                      </p>
                    )}
                  </div>
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
                    <p role="status">Готовим правки слайда…</p>
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
