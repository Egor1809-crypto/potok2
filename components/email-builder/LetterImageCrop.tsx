"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";

import { fullImageCrop as full, normalizeImageCrop, dragImageCrop, imageCropPixels, type ImageCrop as Crop } from "@/lib/email-import/crop-geometry";
export function LetterImageCrop({ source, initial, onApply }: { source: string; initial?: string; onApply: (url: string, crop: string) => void }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const selection = useRef<HTMLDivElement>(null);
  const dragging = useRef<{x:number;y:number;crop:Crop;mode:string;width:number;height:number} | null>(null);
  const [image, setImage] = useState<{ url: string; width: number; height: number }>();
  const [crop, setCrop] = useState<Crop>(full);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bitmap = useRef<ImageBitmap | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController(); controller.current = abort;
    let objectUrl = "";
    setImage(undefined); setError(""); setZoom(1);
    try { const c = JSON.parse(initial || "null") as Crop; setCrop(c && [c.x, c.y, c.width, c.height].every(Number.isFinite) && c.x >= 0 && c.y >= 0 && c.width > 0 && c.height > 0 && c.x + c.width <= 100.01 && c.y + c.height <= 100.01 ? normalizeImageCrop(c) : full); } catch { setCrop(full); }
    void (async () => {
      try {
        const url = new URL(source, location.href);
        const local = /^\/api\/assets\/[\w-]+$|^\/email-icons\/[a-z0-9-]+\.png$/.test(url.pathname);
        const response = await fetch(local ? url.pathname : source, { signal: abort.signal, credentials: local ? "same-origin" : "omit" });
        if (!response.ok) throw new Error("Изображение недоступно. Загрузите его через «Заменить изображение».");
        const blob = await response.blob();
        if (!blob.type.startsWith("image/") || blob.size > 20_000_000) throw new Error("Выберите изображение до 20 МБ.");
        const decoded = await createImageBitmap(blob);
        if (abort.signal.aborted) { decoded.close(); return; }
        if (decoded.width * decoded.height > 40_000_000) { decoded.close(); throw new Error("Изображение слишком большое для обрезки. Загрузите уменьшенную копию."); }
        bitmap.current = decoded; objectUrl = URL.createObjectURL(blob);
        setImage({ url: objectUrl, width: decoded.width, height: decoded.height });
      } catch (caught) { if (!abort.signal.aborted) setError(caught instanceof TypeError ? "Источник не разрешает обрезку в браузере. Загрузите изображение через «Заменить изображение»." : caught instanceof Error ? caught.message : "Не удалось открыть изображение."); }
    })();
    return () => { abort.abort(); bitmap.current?.close(); bitmap.current = null; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, source, initial]);
  const apply = async () => {
    const original = bitmap.current, abort = controller.current;
    if (!original || !abort) return;
    setBusy(true); setError("");
    try {
      const {x,y,width,height} = imageCropPixels(crop, original.width, original.height);
      if (width < 2 || height < 2) throw new Error("Выберите фрагмент побольше.");
      const scale = Math.min(1, 1600 / width, 2400 / height), canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      canvas.getContext("2d")!.drawImage(original, x, y, width, height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Не удалось подготовить фрагмент.")), "image/png"));
      if (blob.size > 4_000_000) throw new Error("Фрагмент слишком большой. Выберите меньшую область.");
      const data = new FormData(); data.set("kind", "photo"); data.set("file", blob, "letter-image-crop.png");
      const response = await fetch("/api/assets", { method: "POST", body: data, signal: abort.signal });
      const body = await response.json() as { asset?: { url: string }; error?: string };
      if (!response.ok || !body.asset) throw new Error(body.error || "Не удалось сохранить фрагмент.");
      if (!abort.signal.aborted) { setOpen(false); onApply(body.asset.url, JSON.stringify(crop)); }
    } catch (caught) { if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "Не удалось обрезать изображение."); }
    finally { setBusy(false); }
  };
  const startDrag = (event: PointerEvent, mode: string) => {
    if (busy || !selection.current) return;
    event.preventDefault(); event.stopPropagation();
    const rect=selection.current.getBoundingClientRect();
    dragging.current={x:event.clientX,y:event.clientY,crop,mode,width:rect.width,height:rect.height};
    selection.current.setPointerCapture(event.pointerId);
  };
  const moving = (event: PointerEvent) => {
    const drag=dragging.current; if(!drag) return;
    setCrop(dragImageCrop(drag.crop,drag.mode,(event.clientX-drag.x)/drag.width*100,(event.clientY-drag.y)/drag.height*100));
  };
  const cropPixels=image ? imageCropPixels(crop,image.width,image.height) : null;
  return <><Button size="sm" variant="secondary" onClick={() => { setImage(undefined); setOpen(true); }}>Обрезать изображение</Button>
    <Modal open={open} onOpenChange={value => { if (!busy) setOpen(value); }} title="Обрезка изображения" size="xl" closeOnEscape={!busy} closeOnBackdrop={!busy} footer={<><Button variant="secondary" disabled={busy} onClick={() => setCrop({...full})}>Весь исходник</Button><Button disabled={busy || !image} loading={busy} onClick={() => void apply()}>Применить обрезку</Button></>}>
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-text-muted">Перетащите рамку или её углы. В предпросмотре — фрагмент, который появится в письме.</p>
          <div role="group" aria-label="Масштаб исходника" className="flex gap-2">{[1,1.5,2].map(value=><Button key={value} size="sm" variant={zoom===value ? "primary" : "secondary"} aria-pressed={zoom===value} onClick={()=>setZoom(value)}>{value*100}%</Button>)}</div>
          <div className="max-h-[58vh] min-w-0 overflow-auto rounded-xl bg-surface-inset p-3">
            {image ? <div ref={selection} onPointerMove={moving} onPointerUp={()=>{dragging.current=null;}} onPointerCancel={()=>{dragging.current=null;}} className="relative mx-auto touch-none select-none" style={{width:Math.min(720,540*image.width/image.height)*zoom,maxWidth:zoom===1 ? "100%" : undefined}}>
              {/* eslint-disable-next-line @next/next/no-img-element */}<img draggable={false} alt="Исходное изображение с выбранной областью" src={image.url} className="pointer-events-none block w-full" />
              <div role="group" tabIndex={0} aria-label="Область обрезки. Перемещение стрелками клавиатуры" onPointerDown={event=>startDrag(event,"move")} onKeyDown={event=>{if(!event.key.startsWith("Arrow")||busy)return;event.preventDefault();const delta=event.shiftKey?5:1;setCrop(dragImageCrop(crop,"move",event.key==="ArrowLeft"?-delta:event.key==="ArrowRight"?delta:0,event.key==="ArrowUp"?-delta:event.key==="ArrowDown"?delta:0));}} className="absolute cursor-move border-2 border-primary focus-visible:outline-4 focus-visible:outline-white" style={{left:`${crop.x}%`,top:`${crop.y}%`,width:`${crop.width}%`,height:`${crop.height}%`,boxShadow:"0 0 0 2000px rgb(0 0 0 / 55%)"}}>
                {(["nw","ne","sw","se"] as const).map((mode,index)=><button key={mode} type="button" disabled={busy} aria-label={["Верхний левый угол обрезки","Верхний правый угол обрезки","Нижний левый угол обрезки","Нижний правый угол обрезки"][index]} onPointerDown={event=>startDrag(event,mode)} onKeyDown={event=>{if(!event.key.startsWith("Arrow"))return;event.preventDefault();event.stopPropagation();const d=event.shiftKey?5:1;setCrop(dragImageCrop(crop,mode,event.key==="ArrowLeft"?-d:event.key==="ArrowRight"?d:0,event.key==="ArrowUp"?-d:event.key==="ArrowDown"?d:0));}} className="absolute size-7 rounded-sm border-2 border-primary bg-white shadow-sm focus-visible:outline-4 focus-visible:outline-primary" style={{[mode.includes("w")?"left":"right"]:-14,[mode.includes("n")?"top":"bottom"]:-14,cursor:`${mode}-resize`}} />)}
              </div>
            </div> : <p role="status" className="p-6 text-sm">{error ? "Изображение не загружено" : "Загружаем изображение…"}</p>}
          </div>
        </div>
        <fieldset disabled={busy} className="grid min-w-0 content-start gap-4">
          <div><p className="mb-2 text-sm font-medium">В письме</p>{image && cropPixels && <div className="relative max-w-full overflow-hidden rounded-lg bg-surface-inset" style={{width:Math.min(220,224*cropPixels.width/cropPixels.height),aspectRatio:cropPixels.width/cropPixels.height}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}<img alt="Предпросмотр обрезанного фрагмента" src={image.url} className="absolute max-w-none" style={{width:`${10000/crop.width}%`,height:`${10000/crop.height}%`,left:`${-crop.x/crop.width*100}%`,top:`${-crop.y/crop.height*100}%`}} />
          </div>}<p className="mt-2 text-xs text-text-muted">{cropPixels ? `${cropPixels.width} × ${cropPixels.height} пикс.` : ""} Исходное изображение сохранится.</p></div>
          {(["x", "y", "width", "height"] as const).map((key, index) => <label key={key} className="grid gap-2 text-sm">{["Слева", "Сверху", "Ширина", "Высота"][index]} · {Math.round(crop[key]*10)/10}%<input aria-label={["Обрезка слева", "Обрезка сверху", "Ширина обрезки", "Высота обрезки"][index]} type="range" style={{accentColor:"var(--primary)"}} min={key==="x"||key==="y"?0:0.1} step={0.1} max={key==="x"?100-crop.width:key==="y"?100-crop.height:key==="width"?100-crop.x:100-crop.y} value={crop[key]} onChange={event=>setCrop(current=>normalizeImageCrop({...current,[key]:Number(event.target.value)}))} /></label>)}
          <div role="alert" className="text-sm text-danger">{error}</div>
        </fieldset>
      </div>
    </Modal>
  </>;
}
