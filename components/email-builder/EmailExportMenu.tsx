"use client";

import { useState } from "react";
import { Download, FileCode2, FileJson2, FileText, Printer } from "lucide-react";

import { Button } from "@/components/ui";
import type { ApiError, EmailExportResponse } from "@/types/api";

import type { BuilderDocument } from "./builder-types";

function safeName(value: string) {
  return (value.trim() || "письмо").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
}

function saveBlob(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function EmailExportMenu({ document, name }: { document: BuilderDocument; name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const compiled = async () => {
    const response = await fetch("/api/email-export", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(document),
    });
    const body = await response.json() as EmailExportResponse | ApiError;
    if (!response.ok || !("html" in body)) throw new Error("error" in body ? body.error : "Не удалось подготовить файл.");
    return body;
  };

  const run = async (format: "html" | "doc" | "txt" | "json" | "pdf") => {
    setBusy(true);
    setError("");
    try {
      const filename = safeName(name);
      if (format === "json") {
        saveBlob(JSON.stringify(document, null, 2), "application/json;charset=utf-8", `${filename}.mailflow.json`);
      } else {
        const result = await compiled();
        if (format === "html") saveBlob(result.html, "text/html;charset=utf-8", `${filename}.html`);
        if (format === "txt") saveBlob(result.text, "text/plain;charset=utf-8", `${filename}.txt`);
        if (format === "doc") {
          const wordHtml = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${filename}</title></head><body>${result.html}</body></html>`;
          saveBlob(wordHtml, "application/msword;charset=utf-8", `${filename}.doc`);
        }
        if (format === "pdf") {
          const frame = window.open("", "_blank", "noopener,noreferrer");
          if (!frame) throw new Error("Разрешите всплывающие окна, чтобы сохранить PDF.");
          frame.document.write(result.html);
          frame.document.close();
          frame.addEventListener("load", () => { frame.focus(); frame.print(); }, { once: true });
        }
      }
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось подготовить файл.");
    } finally { setBusy(false); }
  };

  const options = [
    ["html", FileCode2, "HTML", "Для отправки и публикации"],
    ["doc", FileText, "Word (.doc)", "Для согласования и правок"],
    ["pdf", Printer, "PDF", "Через системное окно печати"],
    ["txt", FileText, "Текст", "Без оформления"],
    ["json", FileJson2, "Исходник MAILFLOW", "Резервная копия макета"],
  ] as const;

  return <div className="relative">
    <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
      <Download aria-hidden="true" className="size-3.5" /><span className="hidden xl:inline">Скачать</span>
    </Button>
    {open ? <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-floating)]">
      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-text-subtle">Экспорт письма</p>
      {options.map(([format, Icon, label, hint]) => <button key={format} role="menuitem" type="button" onClick={() => void run(format)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon aria-hidden="true" className="size-4" /></span>
        <span><span className="block text-[11px] font-semibold text-text-strong">{label}</span><span className="block text-[9px] text-text-subtle">{hint}</span></span>
      </button>)}
      {error ? <p role="alert" className="m-2 rounded-lg bg-danger-subtle p-2 text-[10px] text-danger">{error}</p> : null}
    </div> : null}
  </div>;
}
