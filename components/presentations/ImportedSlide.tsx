"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { PresentationElement, PresentationSlide } from "@/types/api";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { ImageAssetPicker } from "@/components/email-builder/ImageAssetPicker";
import styles from "./PresentationWorkshop.module.css";

export function ImportedSlidePreview({ slide, selectedId, onSelect }: { slide: PresentationSlide; selectedId?: string; onSelect?: (id: string) => void }) {
  const c = slide.canvas!;
  return <div data-presentation-canvas className={styles.importedSlide} style={{ "--slide-ratio": c.width / c.height, aspectRatio: `${c.width}/${c.height}`, background: slide.backgroundColor || "#ffffff" } as CSSProperties}>
    {c.elements.map(e => {
      const style: CSSProperties = { left: `${100 * e.x / c.width}%`, top: `${100 * e.y / c.height}%`, width: `${100 * e.width / c.width}%`, height: `${100 * e.height / c.height}%`, transform: `rotate(${e.rotation || 0}deg)`, background: e.fill || "transparent", color: e.color || "#111111", fontSize: `${100 * (e.fontSize || 24) / c.width}cqw`, fontFamily: e.fontFamily || "Arial, sans-serif", fontWeight: e.bold ? 700 : 400, fontStyle: e.italic ? "italic" : "normal", textAlign: e.align || "left", borderRadius: e.shape === "ellipse" ? "50%" : e.shape === "roundRect" ? "1cqw" : 0 };
      const crop = e.crop;
      return <div key={e.id} className={styles.element} style={style} data-selected={selectedId === e.id} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? e.kind === "text" ? e.text?.slice(0, 80) || "Текст" : e.kind === "image" ? "Изображение" : "Фигура" : undefined} onClick={() => onSelect?.(e.id)} onKeyDown={event => { if (onSelect && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(e.id); } }}>
        {e.kind === "image" ? <div className={styles.imageCrop}>{e.imageUrl && <img src={e.imageUrl} alt="" draggable={false} style={crop ? { position: "absolute", maxWidth: "none", width: `${100 / (1 - crop.left - crop.right)}%`, height: `${100 / (1 - crop.top - crop.bottom)}%`, left: `${-100 * crop.left / (1 - crop.left - crop.right)}%`, top: `${-100 * crop.top / (1 - crop.top - crop.bottom)}%` } : { width: "100%", height: "100%", objectFit: e.fit || "contain" }} />}</div> : e.kind === "text" ? e.text : null}
      </div>;
    })}
  </div>;
}

export function ImportedSlideEditor({ slide, onChange }: { slide: PresentationSlide; onChange: (patch: Partial<PresentationSlide>) => void }) {
  const [selected, setSelected] = useState(slide.canvas!.elements[0]?.id || "");
  const [imageOpen, setImageOpen] = useState(false);
  const canvas = slide.canvas!, element = canvas.elements.find(e => e.id === selected);
  const patch = (value: Partial<PresentationElement>) => onChange({ canvas: { ...canvas, elements: canvas.elements.map(e => e.id === selected ? { ...e, ...value } : e) } });
  const addText = () => { const id = crypto.randomUUID(); onChange({ canvas: { ...canvas, elements: [...canvas.elements, { id, kind: "text", x: canvas.width * .1, y: canvas.height * .1, width: canvas.width * .7, height: canvas.height * .18, text: "Новый текст", fontSize: canvas.width / 30, color: "#111111" }] } }); setSelected(id); };
  return <div className={styles.elementEditor}>
    <div className={styles.canvas}><ImportedSlidePreview slide={slide} selectedId={selected} onSelect={setSelected} /></div>
    <div className={styles.inspector}>
      <div className={styles.actions}><Button size="sm" variant="outline" disabled={canvas.elements.length >= 200} onClick={addText}>Добавить текст</Button><Button size="sm" variant="outline" disabled={canvas.elements.length >= 200} onClick={() => setImageOpen(true)}>Добавить фото</Button></div>
      <FormField label="Элемент"><Select aria-label="Элемент" value={selected} onChange={e => setSelected(e.target.value)} options={canvas.elements.map((e, i) => ({ value: e.id, label: `${i + 1}. ${e.text?.slice(0, 35) || (e.kind === "image" ? "Изображение" : "Фигура")}` }))} /></FormField>
      {element && <>
        {element.kind === "text" && <><FormField label="Текст"><Textarea aria-label="Текст" value={element.text || ""} maxLength={12000} onChange={e => patch({ text: e.target.value })} /></FormField><FormField label="Размер шрифта"><Input aria-label="Размер шрифта" type="number" min={1} max={1000} value={element.fontSize || 24} onChange={e => { const value = Number(e.target.value); if (value >= 1 && value <= 1000) patch({ fontSize: value }); }} /></FormField><div className={styles.actions}><Button size="sm" variant={element.bold ? "primary" : "outline"} onClick={() => patch({ bold: !element.bold })}>Жирный</Button><Input aria-label="Цвет текста" type="color" value={element.color || "#111111"} onChange={e => patch({ color: e.target.value })} /></div></>}
        <div className={styles.fields}>{(["x", "y", "width", "height"] as const).map((key, i) => <FormField key={key} label={["Слева", "Сверху", "Ширина", "Высота"][i]}><Input aria-label={["Слева", "Сверху", "Ширина", "Высота"][i]} type="number" step="1" value={Math.round(element[key] * 10) / 10} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= (i > 1 ? 1 : -10000) && value <= 10000) patch({ [key]: value }); }} /></FormField>)}</div>
        {element.kind === "image" && <><FormField label="Изображение"><Select aria-label="Режим изображения" value={element.fit || "contain"} options={[{ value: "contain", label: "Показать целиком" }, { value: "cover", label: "Заполнить область" }]} onChange={e => patch({ fit: e.target.value as "contain" | "cover", crop: undefined })} /></FormField>{element.crop && <Button variant="outline" size="sm" onClick={() => patch({ crop: undefined, fit: "contain" })}>Убрать обрезку из PowerPoint</Button>}</>}
        <FormField label="Ссылка при нажатии"><Input aria-label="Ссылка при нажатии" value={element.href || ""} placeholder="https://" onChange={e => patch({ href: e.target.value || undefined })} /></FormField>
        <div className={styles.actions}><Button variant="outline" size="sm" onClick={() => onChange({ canvas: { ...canvas, elements: [...canvas.elements.filter(e => e.id !== selected), element] } })}>На передний план</Button><Button variant="outline" size="sm" onClick={() => { onChange({ canvas: { ...canvas, elements: canvas.elements.filter(e => e.id !== selected) } }); setSelected(""); }}>Удалить</Button></div>
      </>}
      <FormField label="Фон слайда"><Input aria-label="Фон слайда" type="color" value={slide.backgroundColor || "#ffffff"} onChange={e => onChange({ backgroundColor: e.target.value })} /></FormField>
      {imageOpen && <ImageAssetPicker kind="photo" onSelect={url => { const id = crypto.randomUUID(); onChange({ canvas: { ...canvas, elements: [...canvas.elements, { id, kind: "image", x: canvas.width * .2, y: canvas.height * .2, width: canvas.width * .6, height: canvas.height * .6, imageUrl: url, fit: "contain" }] } }); setSelected(id); setImageOpen(false); }} />}
    </div>
  </div>;
}
