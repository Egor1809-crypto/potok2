"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Upload } from "lucide-react";

import type { ApiError, EmailAssetMutationResponse, EmailAssetRecord, EmailAssetsListResponse } from "@/types/api";

export function ImageAssetPicker({ kind, value, onSelect }: {
  kind: "photo" | "logo";
  value?: string;
  onSelect: (url: string, filename: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<EmailAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/assets", { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as EmailAssetsListResponse | ApiError;
        if (!response.ok || !("assets" in body)) throw new Error("error" in body ? body.error : "Изображения не загружены.");
        if (active) setAssets(body.assets);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Изображения не загружены.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const upload = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      setError("Выберите изображение PNG, JPEG или GIF.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Файл слишком большой. Выберите изображение до 4 МБ.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const raw = await response.text();
      const body = (() => { try { return JSON.parse(raw) as EmailAssetMutationResponse | ApiError; } catch { return { error: response.status === 413 ? "Файл слишком большой. Выберите изображение до 4 МБ." : "Сервер не принял изображение." }; } })();
      if (!response.ok || !("asset" in body)) throw new Error("error" in body ? body.error : "Файл не загружен.");
      setAssets((current) => [body.asset, ...current.filter((item) => item.id !== body.asset.id)]);
      onSelect(body.asset.url, body.asset.filename);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Файл не загружен.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const relevantAssets = assets.filter((asset) => asset.kind === kind);
  const pickerLabel = kind === "logo" ? "логотип" : "фотографию";
  return (
    <div className="grid gap-2.5">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <div
        role="button"
        tabIndex={0}
        aria-label={`Загрузить ${pickerLabel} с компьютера`}
        aria-busy={uploading}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !uploading) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !uploading) void upload(file);
        }}
        onPaste={(event) => {
          const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
          if (file && !uploading) {
            event.preventDefault();
            void upload(file);
          }
        }}
        className={`grid min-h-28 cursor-pointer place-items-center rounded-xl border-2 border-dashed px-4 py-4 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 ${dragActive ? "border-primary bg-primary-subtle/70" : "border-border-strong bg-surface-subtle hover:border-primary/50 hover:bg-primary-subtle/30"}`}
      >
        <span>
          {uploading ? <LoaderCircle aria-hidden="true" className="mx-auto size-5 animate-spin text-primary" /> : <Upload aria-hidden="true" className="mx-auto size-5 text-primary" />}
          <span className="mt-2 block text-[11px] font-semibold text-text-strong">
            {uploading ? "Загружаем…" : `Перетащите ${pickerLabel} сюда`}
          </span>
          <span className="mt-1 block text-[9px] leading-4 text-text-subtle">
            или нажмите, чтобы выбрать файл · можно вставить из буфера
          </span>
        </span>
      </div>
      <p className="m-0 text-[9px] leading-4 text-text-subtle">PNG, JPEG или GIF, до 4 МБ. После загрузки файл сразу появится в письме и сохранится в медиатеке.</p>
      {error ? <p role="alert" className="m-0 rounded-lg bg-danger-subtle px-2.5 py-2 text-[10px] leading-4 text-danger">{error}</p> : null}
      {loading ? <p className="m-0 text-[10px] text-text-subtle">Загружаем медиатеку…</p> : relevantAssets.length ? (
        <div>
          <p className="mb-2 mt-0 text-[10px] font-medium text-text-muted">Ранее загруженные</p>
          <div className="grid grid-cols-3 gap-2">
            {relevantAssets.slice(0, 9).map((asset) => (
              <button key={asset.id} type="button" title={asset.filename} aria-label={`Выбрать ${asset.filename}`} aria-pressed={value === asset.url} onClick={() => onSelect(asset.url, asset.filename)} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-subtle outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt="" className="size-full object-contain p-1" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-[10px] text-text-subtle"><ImagePlus aria-hidden="true" className="size-3.5" />{kind === "logo" ? "Логотипов пока нет" : "Фотографий пока нет"}</div>
      )}
    </div>
  );
}
