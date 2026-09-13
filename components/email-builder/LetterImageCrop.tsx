"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";

type Crop = { x: number; y: number; width: number; height: number };
const full: Crop = { x: 0, y: 0, width: 100, height: 100 };
export function LetterImageCrop({ source, initial, onApply }: { source: string; initial?: string; onApply: (url: string, crop: string) => void }) {
  const [open, setOpen] = useState(false);
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
    setImage(undefined); setError("");
    try { const c = JSON.parse(initial || "null") as Crop; setCrop(c && [c.x, c.y, c.width, c.height].every(Number.isFinite) && c.x >= 0 && c.y >= 0 && c.width > 0 && c.height > 0 && c.x + c.width <= 100 && c.y + c.height <= 100 ? c : full); } catch { setCrop(full); }
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
      const x = Math.round(original.width * crop.x / 100), y = Math.round(original.height * crop.y / 100);
      const width = Math.min(original.width - x, Math.round(original.width * crop.width / 100)), height = Math.min(original.height - y, Math.round(original.height * crop.height / 100));
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
  return <><Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Обрезать изображение</Button>
    <Modal open={open} onOpenChange={value => { if (!busy) setOpen(value); }} title="Обрезка изображения" size="xl" closeOnEscape={!busy} closeOnBackdrop={!busy} footer={<><Button variant="secondary" disabled={busy} onClick={() => setCrop(full)}>Весь исходник</Button><Button disabled={busy || !image} loading={busy} onClick={() => void apply()}>Применить обрезку</Button></>}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 rounded-xl bg-surface-inset p-3">{image ? <div className="relative mx-auto overflow-hidden" style={{ maxWidth: `${Math.min(600, 420 * image.width / image.height)}px` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}<img alt="Исходное изображение с выбранной областью" src={image.url} className="block w-full" />
          <div aria-hidden className="pointer-events-none absolute border-2 border-primary" style={{ borderColor: "var(--primary)", left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%`, boxShadow: "0 0 0 2000px rgb(0 0 0 / 55%)" }} />
        </div> : <p role="status" className="p-6 text-sm">{error ? "Изображение не загружено" : "Загружаем изображение…"}</p>}</div>
        <div className="grid content-start gap-4"><p className="text-sm text-text-muted">В письме останется выделенный фрагмент. Исходное изображение сохранится.</p>
          {(["x", "y", "width", "height"] as const).map((key, index) => <label key={key} className="grid gap-2 text-sm">{["Слева", "Сверху", "Ширина", "Высота"][index]} · {Math.round(crop[key])}%<input aria-label={["Обрезка слева", "Обрезка сверху", "Ширина обрезки", "Высота обрезки"][index]} type="range" style={{ accentColor: "var(--primary)" }} min={key === "x" || key === "y" ? 0 : 1} max={key === "x" ? 99 : key === "y" ? 99 : key === "width" ? 100 - crop.x : 100 - crop.y} value={crop[key]} onChange={event => setCrop(current => ({ ...current, [key]: Number(event.target.value), ...(key === "x" ? { width: Math.min(current.width, 100 - Number(event.target.value)) } : key === "y" ? { height: Math.min(current.height, 100 - Number(event.target.value)) } : {}) }))} /></label>)}
          <div role="alert" className="text-sm text-danger">{error}</div>
        </div>
      </div>
    </Modal>
  </>;
}
