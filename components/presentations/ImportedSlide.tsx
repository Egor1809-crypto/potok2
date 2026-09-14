"use client";
import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { PresentationElement, PresentationSlide } from "@/types/api";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { ImageAssetPicker } from "@/components/email-builder/ImageAssetPicker";
import {
  alignElement,
  reorderElement,
  transformElement,
  type Alignment,
} from "@/lib/presentation-import/editor";
import styles from "./PresentationWorkshop.module.css";

export function ImportedSlidePreview({
  slide,
  selectedId,
  onSelect,
  onGesture,
}: {
  slide: PresentationSlide;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onGesture?: (event: ReactPointerEvent, id: string, resize: boolean) => void;
}) {
  const c = slide.canvas!;
  return (
    <div
      data-presentation-canvas
      className={styles.importedSlide}
      style={
        {
          "--slide-ratio": c.width / c.height,
          aspectRatio: `${c.width}/${c.height}`,
          background: slide.backgroundColor || "#ffffff",
        } as CSSProperties
      }
    >
      {c.elements.map((e) => {
        const style: CSSProperties = {
          left: `${(100 * e.x) / c.width}%`,
          top: `${(100 * e.y) / c.height}%`,
          width: `${(100 * e.width) / c.width}%`,
          height: `${(100 * e.height) / c.height}%`,
          transform: `rotate(${e.rotation || 0}deg)`,
          background: e.fill || "transparent",
          color: e.color || "#111111",
          fontSize: `${(100 * (e.fontSize || 24)) / c.width}cqw`,
          fontFamily: e.fontFamily || "Arial, sans-serif",
          fontWeight: e.bold ? 700 : 400,
          fontStyle: e.italic ? "italic" : "normal",
          textAlign: e.align || "left",
          borderRadius:
            e.shape === "ellipse"
              ? "50%"
              : e.shape === "roundRect"
                ? "1cqw"
                : 0,
        };
        const crop = e.crop;
        return (
          <div
            key={e.id}
            className={styles.element}
            style={style}
            data-selected={selectedId === e.id}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={
              onSelect
                ? e.kind === "text"
                  ? e.text?.slice(0, 80) || "Текст"
                  : e.kind === "image"
                    ? "Изображение"
                    : "Фигура"
                : undefined
            }
            onPointerDown={(event) => onGesture?.(event, e.id, false)}
            onClick={() => onSelect?.(e.id)}
            onKeyDown={(event) => {
              if (onSelect && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onSelect(e.id);
              }
            }}
          >
            {e.kind === "image" ? (
              <div className={styles.imageCrop}>
                {e.imageUrl && (
                  <img
                    src={e.imageUrl}
                    alt=""
                    draggable={false}
                    style={
                      crop
                        ? {
                            position: "absolute",
                            maxWidth: "none",
                            width: `${100 / (1 - crop.left - crop.right)}%`,
                            height: `${100 / (1 - crop.top - crop.bottom)}%`,
                            left: `${(-100 * crop.left) / (1 - crop.left - crop.right)}%`,
                            top: `${(-100 * crop.top) / (1 - crop.top - crop.bottom)}%`,
                          }
                        : {
                            width: "100%",
                            height: "100%",
                            objectFit: e.fit || "contain",
                          }
                    }
                  />
                )}
              </div>
            ) : e.kind === "text" ? (
              e.text
            ) : null}
            {onGesture && selectedId === e.id && !e.locked && (
              <span
                className={styles.resizeHandle}
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onGesture(event, e.id, true);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ImportedSlideEditor({
  slide,
  onChange,
}: {
  slide: PresentationSlide;
  onChange: (patch: Partial<PresentationSlide>) => void;
}) {
  const [selection, setSelected] = useState(
    slide.canvas!.elements.at(-1)?.id || "",
  );
  const [imageMode, setImageMode] = useState<"add" | "replace" | null>(null);
  const [zoom, setZoom] = useState("fit"),
    [grid, setGrid] = useState(false),
    [keepRatio, setKeepRatio] = useState(true);
  const [transient, setTransient] = useState<PresentationElement | null>(null);
  const drag = useRef<{
    original: PresentationElement;
    startX: number;
    startY: number;
    scale: number;
    resize: boolean;
    current: PresentationElement;
    pointerId: number;
    target: HTMLElement;
  } | null>(null);
  const canvas = slide.canvas!;
  const selected = canvas.elements.some((e) => e.id === selection)
    ? selection
    : canvas.elements.at(-1)?.id || "";
  const element = canvas.elements.find((e) => e.id === selected);
  const replaceElements = (elements: PresentationElement[]) =>
    onChange({ canvas: { ...canvas, elements } });
  const patch = (value: Partial<PresentationElement>) =>
    replaceElements(
      canvas.elements.map((e) => (e.id === selected ? { ...e, ...value } : e)),
    );
  const add = (kind: "text" | "shape") => {
    const id = crypto.randomUUID();
    replaceElements([
      ...canvas.elements,
      {
        id,
        kind,
        x: canvas.width * 0.1,
        y: canvas.height * 0.1,
        width: canvas.width * (kind === "text" ? 0.6 : 0.25),
        height: canvas.height * 0.2,
        ...(kind === "text"
          ? {
              text: "Новый текст",
              fontSize: canvas.width / 30,
              color: "#111111",
            }
          : { shape: "roundRect" as const, fill: "#7c35f2" }),
      },
    ]);
    setSelected(id);
  };
  const duplicate = () => {
    if (!element || element.locked || canvas.elements.length >= 200) return;
    const id = crypto.randomUUID();
    replaceElements([
      ...canvas.elements,
      {
        ...structuredClone(element),
        id,
        x: Math.min(10000, element.x + 20),
        y: Math.min(10000, element.y + 20),
      },
    ]);
    setSelected(id);
  };
  const remove = () => {
    if (!element || element.locked) return;
    replaceElements(canvas.elements.filter((e) => e.id !== selected));
    setSelected("");
  };
  const gesture = (event: ReactPointerEvent, id: string, resize: boolean) => {
    if (event.button !== 0) return;
    const original = canvas.elements.find((e) => e.id === id)!;
    setSelected(id);
    if (original.locked) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement,
      root = target.closest("[data-presentation-canvas]") as HTMLElement;
    target.focus();
    target.setPointerCapture(event.pointerId);
    drag.current = {
      original,
      startX: event.clientX,
      startY: event.clientY,
      scale: canvas.width / root.getBoundingClientRect().width,
      resize,
      current: original,
      pointerId: event.pointerId,
      target,
    };
  };
  const finish = (cancel: boolean) => {
    const g = drag.current;
    if (!g) return;
    drag.current = null;
    if (g.target.hasPointerCapture(g.pointerId))
      g.target.releasePointerCapture(g.pointerId);
    if (!cancel && JSON.stringify(g.current) !== JSON.stringify(g.original))
      replaceElements(
        canvas.elements.map((e) => (e.id === g.original.id ? g.current : e)),
      );
    setTransient(null);
  };
  const shown = transient
    ? {
        ...slide,
        canvas: {
          ...canvas,
          elements: canvas.elements.map((e) =>
            e.id === transient.id ? transient : e,
          ),
        },
      }
    : slide;
  return (
    // Keyboard shortcuts are delegated from focusable objects and native controls.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={styles.elementEditor}
      role="group"
      aria-label="Редактирование элементов слайда"
      onKeyDown={(event) => {
        if (event.key === "Escape" && drag.current) {
          event.preventDefault();
          event.stopPropagation();
          finish(true);
          return;
        }
        if (
          (event.target as HTMLElement).closest(
            "input,textarea,select,[role=combobox],[contenteditable=true]",
          )
        )
          return;
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "d"
        ) {
          event.preventDefault();
          duplicate();
        }
        if (!element || element.locked) return;
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          remove();
        }
        const step = event.shiftKey ? 10 : 1,
          delta: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          };
        if (delta[event.key]) {
          event.preventDefault();
          const [dx, dy] = delta[event.key];
          patch(transformElement(element, dx, dy, false, false));
        }
      }}
    >
      <div className={styles.workshop}>
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="outline"
            disabled={canvas.elements.length >= 200}
            onClick={() => add("text")}
          >
            Добавить текст
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={canvas.elements.length >= 200}
            onClick={() => setImageMode("add")}
          >
            Добавить фото
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={canvas.elements.length >= 200}
            onClick={() => add("shape")}
          >
            Фигура
          </Button>
          <div className={styles.zoom}>
            <Select
              aria-label="Масштаб слайда"
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
              options={[
                { value: "fit", label: "Вписать" },
                ...[50, 75, 100, 125, 150].map((n) => ({
                  value: String(n),
                  label: `${n}%`,
                })),
              ]}
            />
          </div>
          <Button
            size="sm"
            variant={grid ? "primary" : "outline"}
            aria-pressed={grid}
            onClick={() => setGrid(!grid)}
          >
            Сетка
          </Button>
        </div>
        <div
          className={styles.editStage}
          data-grid={grid}
          onPointerMove={(event) => {
            const g = drag.current;
            if (!g || event.pointerId !== g.pointerId) return;
            let dx = (event.clientX - g.startX) * g.scale,
              dy = (event.clientY - g.startY) * g.scale;
            if (grid) {
              dx = Math.round(dx / 10) * 10;
              dy = Math.round(dy / 10) * 10;
            }
            g.current = transformElement(
              g.original,
              dx,
              dy,
              g.resize,
              keepRatio && g.original.kind === "image",
            );
            setTransient(g.current);
          }}
          onPointerUp={() => finish(false)}
          onPointerCancel={() => finish(true)}
        >
          <div
            className={styles.zoomCanvas}
            style={{
              width:
                zoom === "fit"
                  ? `min(100%, calc((min(60vh, 700px) - 48px) * ${canvas.width / canvas.height}))`
                  : `${(canvas.width * Number(zoom)) / 100}px`,
            }}
          >
            <ImportedSlidePreview
              slide={shown}
              selectedId={selected}
              onSelect={setSelected}
              onGesture={gesture}
            />
          </div>
        </div>
        <p className={styles.hint}>
          Перетащите объект или потяните за угол. Стрелки — сдвиг на 1, Shift —
          на 10. Page Up / Down — другой слайд.
        </p>
      </div>
      <aside className={styles.inspector} aria-label="Свойства элемента">
        <details className={styles.layerPanel} open>
          <summary>Слои · {canvas.elements.length}</summary>
          <div className={styles.layers}>
            {[...canvas.elements].reverse().map((e, i) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={selected === e.id}
                onClick={() => setSelected(e.id)}
              >
                <span>
                  {e.text?.slice(0, 42) ||
                    (e.kind === "image" ? "Изображение" : "Фигура")}
                </span>
                <small>
                  {e.locked ? "Закреплён" : canvas.elements.length - i}
                </small>
              </button>
            ))}
          </div>
        </details>
        {element && (
          <>
            <div className={styles.actions}>
              <Button
                size="sm"
                variant={element.locked ? "primary" : "outline"}
                aria-pressed={!!element.locked}
                onClick={() => patch({ locked: !element.locked })}
              >
                {element.locked ? "Разблокировать" : "Закрепить"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={element.locked || canvas.elements.length >= 200}
                onClick={duplicate}
              >
                Дублировать
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={element.locked}
                onClick={remove}
              >
                Удалить
              </Button>
            </div>
            <fieldset
              className={styles.propertyGroup}
              disabled={element.locked}
            >
              {element.kind === "text" && (
                <>
                  <FormField label="Текст">
                    <Textarea
                      aria-label="Текст"
                      value={element.text || ""}
                      maxLength={12000}
                      onChange={(e) => patch({ text: e.target.value })}
                    />
                  </FormField>
                  <div className={styles.fields}>
                    <FormField label="Размер шрифта">
                      <Input
                        aria-label="Размер шрифта"
                        type="number"
                        min={1}
                        max={1000}
                        value={element.fontSize || 24}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (value >= 1 && value <= 1000)
                            patch({ fontSize: value });
                        }}
                      />
                    </FormField>
                    <FormField label="Цвет текста">
                      <Input
                        aria-label="Цвет текста"
                        type="color"
                        value={element.color || "#111111"}
                        onChange={(e) => patch({ color: e.target.value })}
                      />
                    </FormField>
                  </div>
                  <FormField label="Шрифт">
                    <Select
                      aria-label="Шрифт"
                      value={element.fontFamily || "Arial"}
                      options={[
                        ...new Set([
                          element.fontFamily || "Arial",
                          "Arial",
                          "Georgia",
                          "Verdana",
                          "Tahoma",
                          "Trebuchet MS",
                          "Courier New",
                        ]),
                      ].map((value) => ({ value, label: value }))}
                      onChange={(e) => patch({ fontFamily: e.target.value })}
                    />
                  </FormField>
                  <div className={styles.actions}>
                    <Button
                      size="sm"
                      variant={element.bold ? "primary" : "outline"}
                      aria-pressed={!!element.bold}
                      onClick={() => patch({ bold: !element.bold })}
                    >
                      Жирный
                    </Button>
                    <Button
                      size="sm"
                      variant={element.italic ? "primary" : "outline"}
                      aria-pressed={!!element.italic}
                      onClick={() => patch({ italic: !element.italic })}
                    >
                      Курсив
                    </Button>
                  </div>
                  <Select
                    aria-label="Выравнивание текста"
                    value={element.align || "left"}
                    options={[
                      { value: "left", label: "Текст слева" },
                      { value: "center", label: "По центру" },
                      { value: "right", label: "Текст справа" },
                    ]}
                    onChange={(e) =>
                      patch({
                        align: e.target.value as "left" | "center" | "right",
                      })
                    }
                  />
                </>
              )}
              <div className={styles.fields}>
                {(["x", "y", "width", "height", "rotation"] as const).map(
                  (key, i) => (
                    <FormField
                      key={key}
                      label={
                        ["Слева", "Сверху", "Ширина", "Высота", "Поворот, °"][i]
                      }
                    >
                      <Input
                        aria-label={
                          ["Слева", "Сверху", "Ширина", "Высота", "Поворот, °"][
                            i
                          ]
                        }
                        type="number"
                        step="1"
                        value={Math.round((element[key] || 0) * 10) / 10}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (
                            Number.isFinite(value) &&
                            value >= (i === 4 ? -360 : i > 1 ? 1 : -10000) &&
                            value <= (i === 4 ? 360 : 10000)
                          ) {
                            if (
                              keepRatio &&
                              element.kind === "image" &&
                              (key === "width" || key === "height")
                            ) {
                              const ratio = value / element[key],
                                w = element.width * ratio,
                                h = element.height * ratio;
                              if (w >= 1 && h >= 1 && w <= 10000 && h <= 10000)
                                patch({ width: w, height: h });
                            } else patch({ [key]: value });
                          }
                        }}
                      />
                    </FormField>
                  ),
                )}
              </div>
              {element.kind === "image" && (
                <>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={keepRatio}
                      onChange={(e) => setKeepRatio(e.target.checked)}
                    />
                    Сохранять пропорции
                  </label>
                  <Select
                    aria-label="Режим изображения"
                    value={element.fit || "contain"}
                    options={[
                      { value: "contain", label: "Показать целиком" },
                      { value: "cover", label: "Заполнить область" },
                    ]}
                    onChange={(e) =>
                      patch({
                        fit: e.target.value as "contain" | "cover",
                        crop: undefined,
                      })
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImageMode("replace")}
                  >
                    Заменить изображение
                  </Button>
                  {element.crop && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => patch({ crop: undefined, fit: "contain" })}
                    >
                      Убрать обрезку из PowerPoint
                    </Button>
                  )}
                </>
              )}
              {element.kind === "shape" && (
                <>
                  <Select
                    aria-label="Форма"
                    value={element.shape || "rect"}
                    options={[
                      { value: "rect", label: "Прямоугольник" },
                      { value: "roundRect", label: "Скруглённый" },
                      { value: "ellipse", label: "Эллипс" },
                    ]}
                    onChange={(e) =>
                      patch({
                        shape: e.target.value as PresentationElement["shape"],
                      })
                    }
                  />
                  <FormField label="Заливка">
                    <Input
                      aria-label="Заливка"
                      type="color"
                      value={
                        element.fill?.startsWith("#") ? element.fill : "#7c35f2"
                      }
                      onChange={(e) => patch({ fill: e.target.value })}
                    />
                  </FormField>
                </>
              )}
              <details>
                <summary>Выровнять на слайде</summary>
                <div className={styles.alignments}>
                  {(
                    [
                      "left",
                      "center",
                      "right",
                      "top",
                      "middle",
                      "bottom",
                    ] as Alignment[]
                  ).map((a, i) => (
                    <Button
                      key={a}
                      size="sm"
                      variant="outline"
                      onClick={() => patch(alignElement(element, canvas, a))}
                    >
                      {
                        [
                          "Слева",
                          "По центру",
                          "Справа",
                          "Сверху",
                          "По середине",
                          "Снизу",
                        ][i]
                      }
                    </Button>
                  ))}
                </div>
              </details>
              <details>
                <summary>Порядок слоёв</summary>
                <div className={styles.alignments}>
                  {(["front", "forward", "backward", "back"] as const).map(
                    (move, i) => (
                      <Button
                        key={move}
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          replaceElements(
                            reorderElement(canvas.elements, selected, move),
                          )
                        }
                      >
                        {
                          [
                            "На передний план",
                            "На слой выше",
                            "На слой ниже",
                            "На задний план",
                          ][i]
                        }
                      </Button>
                    ),
                  )}
                </div>
              </details>
              <FormField label="Ссылка при нажатии">
                <Input
                  aria-label="Ссылка при нажатии"
                  value={element.href || ""}
                  placeholder="https://"
                  onChange={(e) => patch({ href: e.target.value || undefined })}
                />
              </FormField>
            </fieldset>
          </>
        )}
        <FormField label="Фон слайда">
          <Input
            aria-label="Фон слайда"
            type="color"
            value={slide.backgroundColor || "#ffffff"}
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
          />
        </FormField>
        {slide.canvas?.source === "pdf" && (
          <p>
            Страница PDF — цельное изображение. Текст и фигуры можно добавлять
            поверх.
          </p>
        )}
      </aside>
      {imageMode && (
        <div className={styles.imagePicker}>
          <div className={styles.actions}>
            <strong>
              {imageMode === "replace"
                ? "Заменить изображение"
                : "Добавить фото"}
            </strong>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImageMode(null)}
            >
              Закрыть выбор фото
            </Button>
          </div>
          <ImageAssetPicker
            kind="photo"
            onSelect={(url) => {
              if (imageMode === "replace")
                patch({ imageUrl: url, crop: undefined, fit: "contain" });
              else {
                const id = crypto.randomUUID();
                replaceElements([
                  ...canvas.elements,
                  {
                    id,
                    kind: "image",
                    x: canvas.width * 0.2,
                    y: canvas.height * 0.2,
                    width: canvas.width * 0.6,
                    height: canvas.height * 0.6,
                    imageUrl: url,
                    fit: "contain",
                  },
                ]);
                setSelected(id);
              }
              setImageMode(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
