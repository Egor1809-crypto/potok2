"use client";

import { FileText, LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ApiError, EmailAssetMutationResponse, EmailAssetRecord, EmailAssetsListResponse } from "@/types/api";

export function TelegramDocumentPicker({ value, filename, onChange }: {
  value: string | null;
  filename: string | null;
  onChange: (url: string | null, filename: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<EmailAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/assets", { cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json() as EmailAssetsListResponse | ApiError;
        if (!response.ok || !("assets" in body)) throw new Error("PDF-медиатека не загрузилась.");
        if (active) setDocuments(body.assets.filter((asset) => asset.kind === "document"));
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "PDF-медиатека не загрузилась."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const upload = async (file: File) => {
    if (file.type !== "application/pdf") return setError("Выберите PDF-файл.");
    if (file.size > 20 * 1024 * 1024) return setError("PDF должен быть не больше 20 МБ.");
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", "document");
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const body = await response.json() as EmailAssetMutationResponse | ApiError;
      if (!response.ok || !("asset" in body)) throw new Error("error" in body ? body.error : "PDF не загружен.");
      setDocuments((current) => [body.asset, ...current.filter((item) => item.id !== body.asset.id)]);
      onChange(body.asset.url, body.asset.filename);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PDF не загружен.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return <div className="space-y-2.5">
    <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    {value ? <div className="flex items-center gap-3 rounded-xl border border-info/25 bg-info-subtle p-3"><FileText aria-hidden="true" className="size-5 shrink-0 text-info" /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-text-strong">{filename || "document.pdf"}</p><p className="mt-0.5 text-[10px] text-text-muted">Документ с текстом сообщения в подписи</p></div><button type="button" onClick={() => onChange(null, null)} className="grid size-8 place-items-center rounded-lg hover:bg-white" aria-label="Убрать PDF"><X aria-hidden="true" className="size-4" /></button></div> : <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="btn btn-secondary w-full gap-2">{uploading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Upload aria-hidden="true" className="size-4" />}{uploading ? "Загружаем PDF…" : "Добавить PDF до 20 МБ"}</button>}
    {!value && documents.length ? <label className="block"><span className="mb-1 block text-[10px] font-semibold text-text-muted">Ранее загруженные</span><select className="input" value="" onChange={(event) => { const item = documents.find((document) => document.id === event.target.value); if (item) onChange(item.url, item.filename); }}><option value="">Выбрать PDF…</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label> : null}
    {loading ? <p className="text-[10px] text-text-muted">Загружаем PDF-медиатеку…</p> : null}
    {error ? <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-[10px] text-danger">{error}</p> : null}
  </div>;
}
