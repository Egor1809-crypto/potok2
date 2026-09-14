"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PresentationProjectRecord, PresentationSlide } from "@/types/api";
import type { SlideDirection } from "@/lib/presentation-import/direction";
import {
  parseDeckDirection,
  slideFingerprint,
  type DeckDirection,
  type SlideReview,
} from "@/lib/presentation-import/review";
import {
  Alert,
  Button,
  FormField,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { confirmAction } from "@/components/ui/confirm-action";
import { PresentationElementsEditor } from "./PresentationElementsEditor";
import styles from "./PresentationWorkshop.module.css";

type Progress = {
  completed: number;
  total: number;
  current: number;
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
const pauseFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
export function PresentationDirector({
  projects,
  initial,
  onClose,
  onSaved,
  renderSlide,
}: {
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
    setCaptureSlide(s);
    await pauseFrame();
    await document.fonts.ready;
    signal.throwIfAborted();
    const root = (captureView.current?.querySelector(
      "[data-presentation-canvas]",
    ) || captureView.current?.firstElementChild) as HTMLElement;
    if (!root || !root.clientWidth)
      throw new Error("Не удалось подготовить изображение слайда.");
    await Promise.all(
      Array.from(root.querySelectorAll("img")).map((image) => image.decode()),
    );
    signal.throwIfAborted();
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(root, {
      scale: Math.min(2, 1440 / root.clientWidth),
      backgroundColor: null,
      useCORS: true,
      logging: false,
    });
    const png = canvas.toDataURL("image/png");
    canvas.width = canvas.height = 0;
    signal.throwIfAborted();
    return png;
  };
  const request = async (payload: unknown, signal: AbortSignal) => {
    const response = await fetch("/api/ai/presentations/director", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([signal, AbortSignal.timeout(165000)]),
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
      context = {
        outline: snapshot.slides.map((s) => ({ title: s.title.slice(0, 500) })),
      };
    let completed = Object.keys(results).length;
    if (refreshAll) setReviews({});
    setBusy("review");
    setError("");
    setOverview(null);
    setProposed(null);
    setTab("deck");
    setFailures({});
    setProgress({ completed, total, current: 0, phase: "slides" });
    try {
      for (let i = 0; i < total; i++) {
        const s = snapshot.slides[i];
        if (results[s.id]) continue;
        abort.signal.throwIfAborted();
        setProgress({ completed, total, current: i + 1, phase: "slides" });
        try {
          const png = await screenshot(s, abort.signal);
          const body = await request(
            {
              action: "review",
              slide: s,
              screenshot: png,
              context: { ...context, number: i + 1 },
            },
            abort.signal,
          );
          if (!body.direction || !Array.isArray(body.direction.findings))
            throw new Error("ИИ не вернул разбор слайда.");
          results[s.id] = {
            fingerprint: slideFingerprint(snapshot, s),
            direction: body.direction,
          };
          completed++;
          setReviews({ ...results });
          setProgress({ completed, total, current: i + 1, phase: "slides" });
        } catch (e) {
          if (abort.signal.aborted) throw e;
          const message =
            e instanceof Error ? e.message : "Не удалось проверить слайд.";
          setFailures((current) => ({ ...current, [s.id]: message }));
          if (
            e instanceof ReviewError &&
            [401, 403, 429, 503].includes(e.status)
          )
            throw e;
        }
      }
      if (completed !== total) {
        setError(
          `Проверено ${completed} из ${total}. Повторите проверку оставшихся слайдов.`,
        );
        setProgress({ completed, total, current: 0, phase: "paused" });
        return;
      }
      setProgress({ completed, total, current: 0, phase: "summary" });
      const reports = snapshot.slides.map((s, i) => ({
        number: i + 1,
        summary: results[s.id].direction.summary,
        findings: results[s.id].direction.findings,
      }));
      const body = await request(
        { action: "summary", context, reports },
        abort.signal,
      );
      setOverview(parseDeckDirection(body.overview, total));
      setProgress({ completed, total, current: 0, phase: "done" });
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Проверка остановлена. Готовые разборы сохранены в этом окне — можно продолжить."
          : e instanceof Error
            ? e.message
            : "Не удалось проверить презентацию.",
      );
      setProgress({ completed, total, current: 0, phase: "paused" });
    } finally {
      setBusy("");
      setCaptureSlide(null);
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
          { action: "revise", command, slide, screenshot: png },
          abort.signal,
        );
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
          : e instanceof Error
            ? e.message
            : "Не удалось подготовить правки.",
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
          : `Проверка слайда ${progress?.current || 1} из ${progress?.total || 0}`;
  return (
    <Modal
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
                  ? "Обновить общий разбор"
                  : Object.keys(reviews).length
                    ? "Продолжить проверку"
                    : "Разобрать всю презентацию"}
              </Button>
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
                          progress.current === i + 1
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
                      placeholder="Увеличь заголовок, выровняй изображение…"
                      onChange={(e) => setCommand(e.target.value)}
                    />
                  </FormField>
                  <Button
                    variant="outline"
                    disabled={!!busy || !command.trim()}
                    loading={busy === "revise"}
                    onClick={() => void revise()}
                  >
                    Предложить правки
                  </Button>
                  {busy === "revise" && (
                    <p role="status">Готовим правки слайда…</p>
                  )}
                </aside>
              </div>
            )}
            {captureSlide && (
              <div
                ref={captureView}
                className={styles.capture}
                aria-hidden="true"
                inert
              >
                {renderSlide(draft, captureSlide)}
              </div>
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
    </Modal>
  );
}
