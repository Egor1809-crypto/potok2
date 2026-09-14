"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PresentationProjectRecord, PresentationSlide } from "@/types/api";
import { Alert, Button, FormField, Modal, Textarea } from "@/components/ui";
import { ChevronLeft, ChevronRight, Undo2, Redo2 } from "@/components/ui/icons";
import { ImportedSlideEditor } from "./ImportedSlide";
import styles from "./PresentationWorkshop.module.css";

type Snapshot = { slides: PresentationSlide[]; selectedId: string };
export function PresentationElementsEditor({
  project,
  selectedId,
  onSelect,
  onChange,
  onClose,
  onSave,
  saving,
  dirty,
  error,
  renderSlide,
}: {
  project: PresentationProjectRecord;
  selectedId: string;
  onSelect: (id: string) => void;
  onChange: (slides: PresentationSlide[]) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  error?: string;
  renderSlide: (
    p: PresentationProjectRecord,
    slide: PresentationSlide,
  ) => ReactNode;
}) {
  const past = useRef<Snapshot[]>([]),
    future = useRef<Snapshot[]>([]),
    last = useRef({ key: "", time: 0 });
  const [available, setAvailable] = useState({ past: 0, future: 0 });
  const current = useRef({ slides: project.slides, selectedId });
  useLayoutEffect(() => {
    current.current = { slides: project.slides, selectedId };
  }, [project.slides, selectedId]);
  const selectedIndex = Math.max(
      0,
      project.slides.findIndex((s) => s.id === selectedId),
    ),
    slide = project.slides[selectedIndex];
  const commit = (patch: Partial<PresentationSlide>) => {
    const before = current.current,
      slides = before.slides.map((s) =>
        s.id === slide.id ? { ...s, ...patch } : s,
      );
    if (JSON.stringify(before.slides) === JSON.stringify(slides)) return;
    // Coalesce consecutive typing in the same object, while every pointer gesture stays undoable.
    const changed = patch.canvas?.elements.filter(
      (e) =>
        JSON.stringify(e) !==
        JSON.stringify(slide.canvas?.elements.find((old) => old.id === e.id)),
    );
    const textEdit =
      changed?.length === 1 &&
      changed[0].text !==
        slide.canvas?.elements.find((e) => e.id === changed[0].id)?.text;
    const key = textEdit ? `${slide.id}:${changed![0].id}:text` : "";
    if (
      !key ||
      key !== last.current.key ||
      Date.now() - last.current.time > 900
    )
      past.current.push(structuredClone(before));
    if (past.current.length > 60) past.current.shift();
    future.current = [];
    last.current = { key, time: Date.now() };
    current.current = { slides, selectedId };
    onChange(slides);
    setAvailable({ past: past.current.length, future: future.current.length });
  };
  const travel = (redo: boolean) => {
    const source = redo ? future.current : past.current,
      dest = redo ? past.current : future.current,
      next = source.pop();
    if (!next) return;
    dest.push(structuredClone(current.current));
    current.current = next;
    last.current.key = "";
    onChange(next.slides);
    onSelect(next.selectedId);
    setAvailable({ past: past.current.length, future: future.current.length });
  };
  const navigate = (index: number) => {
    if (index >= 0 && index < project.slides.length) {
      last.current.key = "";
      onSelect(project.slides[index].id);
    }
  };
  return (
    <Modal
      open
      title="Редактор презентации"
      size="full"
      panelClassName="!max-w-[min(1800px,calc(100vw-24px))]"
      onOpenChange={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <span className={styles.saveState} role="status">
            {dirty ? "Есть несохранённые изменения" : "Изменения сохранены"}
          </span>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Готово
          </Button>
          <Button disabled={!dirty || saving} loading={saving} onClick={onSave}>
            Сохранить презентацию
          </Button>
        </>
      }
    >
      {/* Keyboard shortcuts are delegated from the editor’s focusable controls. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={styles.workshop}
        role="group"
        aria-label="Редактор презентации"
        onKeyDown={(event) => {
          if (
            saving ||
            (event.target as HTMLElement).closest(
              "input,textarea,select,[role=combobox],[contenteditable=true]",
            )
          )
            return;
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "z"
          ) {
            event.preventDefault();
            travel(event.shiftKey);
          }
          if (event.key === "PageDown" || event.key === "PageUp") {
            event.preventDefault();
            navigate(selectedIndex + (event.key === "PageDown" ? 1 : -1));
          }
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <div className={styles.editorToolbar}>
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="outline"
              aria-label="Предыдущий слайд"
              disabled={!selectedIndex || saving}
              onClick={() => navigate(selectedIndex - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className={styles.slideCount} aria-live="polite">
              Слайд {selectedIndex + 1} / {project.slides.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              aria-label="Следующий слайд"
              disabled={selectedIndex === project.slides.length - 1 || saving}
              onClick={() => navigate(selectedIndex + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="outline"
              disabled={!available.past || saving}
              onClick={() => travel(false)}
            >
              <Undo2 />
              Отменить
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!available.future || saving}
              onClick={() => travel(true)}
            >
              <Redo2 />
              Повторить
            </Button>
          </div>
        </div>
        <div className={styles.editWorkspace} inert={saving || undefined}>
          <nav className={styles.rail} aria-label="Слайды в редакторе">
            {project.slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Открыть слайд ${i + 1}`}
                aria-pressed={i === selectedIndex}
                onClick={() => navigate(i)}
              >
                <div inert>{renderSlide(project, s)}</div>
                <span>{String(i + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </nav>
          {slide.canvas ? (
            <ImportedSlideEditor
              key={slide.id}
              slide={slide}
              onChange={commit}
            />
          ) : (
            <div className={styles.elementEditor}>
              <div className={styles.canvas}>{renderSlide(project, slide)}</div>
              <aside className={styles.inspector}>
                {(["eyebrow", "title", "body", "speakerNotes"] as const).map(
                  (field, i) => (
                    <FormField
                      key={field}
                      label={
                        [
                          "Подзаголовок",
                          "Заголовок",
                          "Текст слайда",
                          "Заметки",
                        ][i]
                      }
                    >
                      <Textarea
                        aria-label={
                          [
                            "Подзаголовок",
                            "Заголовок",
                            "Текст слайда",
                            "Заметки",
                          ][i]
                        }
                        value={slide[field] || ""}
                        onChange={(e) => commit({ [field]: e.target.value })}
                      />
                    </FormField>
                  ),
                )}
                <FormField label="Пункты">
                  <Textarea
                    aria-label="Пункты"
                    value={slide.bullets.join("\n")}
                    onChange={(e) =>
                      commit({ bullets: e.target.value.split("\n") })
                    }
                  />
                </FormField>
              </aside>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
