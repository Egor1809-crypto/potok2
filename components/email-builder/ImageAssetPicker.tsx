"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Upload } from "lucide-react";

import { Button } from "@/components/ui";
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
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const body = await response.json() as EmailAssetMutationResponse | ApiError;
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
  return (
    <div className="grid gap-2.5">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Upload aria-hidden="true" className="size-3.5" />}
        {uploading ? "Загружаем…" : kind === "logo" ? "Загрузить логотип" : "Загрузить фотографию"}
      </Button>
      <p className="m-0 text-[9px] leading-4 text-text-subtle">PNG, JPEG или GIF, до 8 МБ. Файл сохранится в рабочем пространстве.</p>
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
