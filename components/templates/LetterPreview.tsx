"use client";
import { useEffect, useState } from "react";
import type { BuilderDocument } from "@/components/email-builder/builder-types";
import type { ImportResource } from "@/lib/email-import/import-letter";
import { inlinePreviewResources } from "@/lib/email-import/preview";

export function LetterPreview({ document, resources, html: suppliedHtml, className = "h-[60vh] min-h-64", title = "Предпросмотр письма" }: {
  document?: BuilderDocument; resources?: ImportResource[]; html?: string; className?: string; title?: string;
}) {
  const [result, setResult] = useState<{ key: unknown; html: string; error: string } | null>(null);
  const source = suppliedHtml ?? document?.rawHtml;
  const key = source ?? document;
  useEffect(() => {
    const controller = new AbortController();
    async function prepare() {
      try {
        let html = source;
        if (html === undefined && document) {
          const response = await fetch("/api/email-export", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(document) });
          const body = await response.json() as { html?: string; error?: string };
          if (!response.ok || !body.html) throw new Error(body.error || "Не удалось подготовить предпросмотр.");
          html = body.html;
        }
        if (!html) throw new Error("В письме пока нет содержимого.");
        const ready = await inlinePreviewResources(html, resources ?? []);
        if (!controller.signal.aborted) setResult({ key, html: ready, error: "" });
      } catch (error) { if (!controller.signal.aborted) setResult({ key, html: "", error: error instanceof Error ? error.message : "Не удалось показать письмо." }); }
    }
    void prepare(); return () => controller.abort();
  }, [key, source, document, resources]);
  const current = result?.key === key ? result : null;
  return <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-white">
    {current?.html ? <iframe title={title} sandbox="" srcDoc={current.html} className={`block w-full border-0 bg-white ${className}`} /> : <div role={current?.error ? "alert" : "status"} className={`grid place-content-center p-6 text-center text-sm text-text-muted ${className}`}>{current?.error || "Подготавливаем предпросмотр письма…"}</div>}
  </div>;
}
