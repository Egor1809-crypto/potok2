"use client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ImageAssetPicker } from "./ImageAssetPicker";
import { LetterImageCrop } from "./LetterImageCrop";
import { editLetterAttribute, type LetterElement } from "@/lib/email-import/visual-editor";
import { alignLetterImage, cropLetterImage, fitLetterImage, replaceLetterImage, restoreLetterImage, sizeLetterImage } from "@/lib/email-import/image-layout";

export function LetterImageControls({ item, update }: {item: LetterElement; update: (change: (html: string) => string) => void}) {
  const {attributes: attrs, index} = item;
  const width = /^\d+$/.test(attrs.width || "") ? Number(attrs.width) : /(?:^|;)\s*width:\s*(\d+)px/i.exec(attrs.style || "")?.[1] || "";
  const alignment = attrs.align || (/margin-left:\s*auto/i.test(attrs.style || "") ? /margin-right:\s*auto/i.test(attrs.style || "") ? "center" : "right" : "left");
  return <div className="grid gap-3">
    <label className="grid gap-1.5 text-xs font-medium">Описание изображения<input className="min-w-0 rounded-lg border border-border p-2" key={attrs.alt} defaultValue={attrs.alt || ""} onBlur={event => { if (event.target.value !== (attrs.alt || "")) update(html => editLetterAttribute(html, index, "alt", event.target.value)); }} /></label>
    <label className="grid gap-1.5 text-xs font-medium">Ширина, пикс.<input aria-label="Ширина изображения" type="number" min={16} max={1600} key={String(width)} defaultValue={width} placeholder="Авто" className="min-w-0 rounded-lg border border-border p-2" onBlur={event => { if (event.target.value !== event.target.defaultValue) update(html => sizeLetterImage(html, index, event.target.value ? Math.max(16, Math.min(1600, Number(event.target.value))) : null)); }} /></label>
    <label className="grid gap-1.5 text-xs font-medium">Выравнивание<Select value={alignment} onChange={event => update(html => alignLetterImage(html, index, event.target.value))} options={[{value:"left",label:"Слева"},{value:"center",label:"По центру"},{value:"right",label:"Справа"}]} /></label>
    <p className="text-xs text-text-muted">Высота подстраивается под пропорции изображения.</p>
    <LetterImageCrop source={attrs["data-potok-original-src"] || attrs.src} initial={attrs["data-potok-crop"]} onApply={(url, crop) => update(html => cropLetterImage(html, index, url, crop))} />
    <Button size="sm" variant="secondary" onClick={() => update(html => fitLetterImage(html, index))}>Убрать растяжение и смещение</Button>
    {attrs["data-potok-original-src"] && <Button size="sm" variant="ghost" onClick={() => update(html => restoreLetterImage(html, index))}>Вернуть исходное изображение</Button>}
    <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Заменить изображение</summary><div className="mt-3"><ImageAssetPicker kind="photo" value={attrs.src} onSelect={(url, name) => update(html => replaceLetterImage(html, index, url, name))} /></div></details>
  </div>;
}
