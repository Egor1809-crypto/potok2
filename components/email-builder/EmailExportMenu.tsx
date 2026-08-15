"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Download, FileCode2, FileJson2, FileText, Printer, X } from "lucide-react";

import { Button } from "@/components/ui";
import type { ApiError, EmailExportResponse } from "@/types/api";

import type { BuilderDocument } from "./builder-types";

type ExportFormat = "html" | "doc" | "txt" | "json" | "pdf";

function safeName(value: string) {
  return (value.trim() || "письмо").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
}

function saveBlob(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Не удалось встроить изображение в файл."));
    }, { once: true });
    reader.addEventListener("error", () => reject(new Error("Не удалось прочитать изображение.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function downloadImageAsDataUrl(source: string) {
  if (source.startsWith("data:")) return source;
  const url = new URL(source, window.location.href);
  const response = await fetch(url, {
    credentials: url.origin === window.location.origin ? "same-origin" : "omit",
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml" },
  });
  if (!response.ok) throw new Error(`Изображение «${url.pathname.split("/").pop() || url.hostname}» недоступно.`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size < 1) {
    throw new Error("Один из файлов в письме не является изображением.");
  }
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error("Изображение больше 10 МБ. Сожмите его и повторите экспорт.");
  }
  return blobAsDataUrl(blob);
}

/**
 * Turns an exported email into one portable file. Uploaded images normally
 * point at /api/assets, which works in the editor but not after the HTML is
 * moved to another computer. Embedding the bytes also makes PDF rendering
 * deterministic and independent of authentication, CORS and network timing.
 */
async function makeHtmlSelfContained(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const sources = new Set<string>();
  parsed.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    if (image.src) sources.add(image.src);
  });
  parsed.querySelectorAll<HTMLElement>("[background]").forEach((element) => {
    const source = element.getAttribute("background");
    if (source) sources.add(new URL(source, window.location.href).toString());
  });
  parsed.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const source = element.style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (source) sources.add(new URL(source, window.location.href).toString());
  });

  const embedded = new Map<string, string>();
  await Promise.all([...sources].map(async (source) => {
    embedded.set(source, await downloadImageAsDataUrl(source));
  }));

  parsed.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    const replacement = embedded.get(image.src);
    if (replacement) image.src = replacement;
  });
  parsed.querySelectorAll<HTMLElement>("[background]").forEach((element) => {
    const source = element.getAttribute("background");
    if (!source) return;
    const replacement = embedded.get(new URL(source, window.location.href).toString());
    if (replacement) element.setAttribute("background", replacement);
  });
  parsed.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const source = element.style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (!source) return;
    const replacement = embedded.get(new URL(source, window.location.href).toString());
    if (replacement) element.style.backgroundImage = `url("${replacement}")`;
  });

  return `<!doctype html>${parsed.documentElement.outerHTML}`;
}

async function renderPdf(html: string) {
  const frame = window.document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "760px",
    height: "1200px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  window.document.body.appendChild(frame);
  try {
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error("Браузер не открыл область экспорта.");
    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
    await frameDocument.fonts?.ready;
    await Promise.all(Array.from(frameDocument.images).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); window.setTimeout(resolve, 2_500); })));
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const canvas = await html2canvas(frameDocument.body, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      windowWidth: 760,
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const margin = 10;
    const pageWidth = 210 - margin * 2;
    const pageHeight = 297 - margin * 2;
    const imageHeight = canvas.height * pageWidth / canvas.width;
    const imageData = canvas.toDataURL("image/jpeg", 0.94);
    let offset = 0;
    let page = 0;
    while (offset < imageHeight) {
      if (page > 0) pdf.addPage();
      pdf.addImage(imageData, "JPEG", margin, margin - offset, pageWidth, imageHeight, undefined, "FAST");
      offset += pageHeight;
      page += 1;
    }
    return pdf.output("blob");
  } finally {
    frame.remove();
  }
}

export function EmailExportMenu({ document, name }: { document: BuilderDocument; name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; message: string; retryPdf?: boolean; download?: { url: string; filename: string } } | null>(null);
  const [copies, setCopies] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dialog) return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setDialog(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (dialog.download) URL.revokeObjectURL(dialog.download.url);
    };
  }, [dialog]);

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

  const run = async (format: ExportFormat) => {
    setBusy(true);
    setOpen(false);
    setDialog(null);
    try {
      const filename = safeName(name);
      if (format === "json") {
        for (let index = 1; index <= copies; index += 1) saveBlob(JSON.stringify(document, null, 2), "application/json;charset=utf-8", `${filename}${copies > 1 ? `-${index}` : ""}.mailflow.json`);
      } else {
        const result = await compiled();
        const portableHtml = format === "html" || format === "doc" || format === "pdf"
          ? await makeHtmlSelfContained(result.html)
          : result.html;
        if (format === "html") for (let index = 1; index <= copies; index += 1) saveBlob(portableHtml, "text/html;charset=utf-8", `${filename}${copies > 1 ? `-${index}` : ""}.html`);
        if (format === "txt") for (let index = 1; index <= copies; index += 1) saveBlob(result.text, "text/plain;charset=utf-8", `${filename}${copies > 1 ? `-${index}` : ""}.txt`);
        if (format === "doc") {
          const wordBody = new DOMParser().parseFromString(portableHtml, "text/html").body.innerHTML;
          const wordHtml = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="ru"><head><meta charset="utf-8"><title>${filename}</title></head><body>${wordBody}</body></html>`;
          for (let index = 1; index <= copies; index += 1) saveBlob(wordHtml, "application/msword;charset=utf-8", `${filename}${copies > 1 ? `-${index}` : ""}.doc`);
        }
        if (format === "pdf") {
          const pdf = await renderPdf(portableHtml);
          for (let index = 1; index <= copies; index += 1) saveBlob(pdf, "application/pdf", `${filename}${copies > 1 ? `-${index}` : ""}.pdf`);
          const downloadName = `${filename}.pdf`;
          setDialog({ title: "PDF готов", message: copies === 1 ? "Скачивание началось. Если браузер его остановил, нажмите кнопку ниже." : `Подготовлено файлов: ${copies}. Если браузер остановил загрузки, скачайте первый файл кнопкой ниже.`, download: { url: URL.createObjectURL(pdf), filename: downloadName } });
        }
      }
    } catch (caught) {
      setDialog({
        title: "Экспорт не выполнен",
        message: caught instanceof Error ? caught.message : "Не удалось подготовить файл. Повторите попытку.",
      });
    } finally { setBusy(false); }
  };

  const options = [
    ["html", FileCode2, "HTML", "Автономный файл с изображениями"],
    ["doc", FileText, "Word (.doc)", "Для согласования и правок"],
    ["pdf", Printer, "PDF", "Фиксированный макет с изображениями"],
    ["txt", FileText, "Текст", "Без оформления"],
    ["json", FileJson2, "Исходник «Поток»", "Резервная копия макета"],
  ] as const;

  return <>
    <div className="relative">
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        <Download aria-hidden="true" className="size-3.5" /><span className="hidden xl:inline">{busy ? "Готовим…" : "Скачать"}</span>
      </Button>
      {open ? <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-floating)]">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-text-subtle">Экспорт письма</p>
        <label className="mb-2 grid grid-cols-[1fr_42px] items-center gap-2 rounded-lg bg-surface-subtle px-2.5 py-2 text-[10px] text-text-muted"><span>Количество копий<input type="range" min="1" max="20" value={copies} onInput={(event) => setCopies(Number(event.currentTarget.value))} className="mt-1 block w-full accent-primary" /></span><strong className="rounded-md bg-surface py-1 text-center text-primary">{copies}</strong></label>
        {options.map(([format, Icon, label, hint]) => <button key={format} role="menuitem" type="button" onClick={() => void run(format)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon aria-hidden="true" className="size-4" /></span>
          <span><span className="block text-[11px] font-semibold text-text-strong">{label}</span><span className="block text-[9px] text-text-subtle">{hint}</span></span>
        </button>)}
      </div> : null}
    </div>

    {dialog && typeof window !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-[1000] grid place-items-center bg-[#211924]/45 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
        <div ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="export-dialog-title" aria-describedby="export-dialog-description" className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-floating)] outline-none sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning-subtle text-warning"><AlertCircle aria-hidden="true" className="size-5" /></span>
            <div className="min-w-0 flex-1"><h2 id="export-dialog-title" className="m-0 text-[16px] font-semibold text-text-strong">{dialog.title}</h2><p id="export-dialog-description" className="mb-0 mt-2 text-[12px] leading-5 text-text-muted">{dialog.message}</p></div>
            <button type="button" onClick={() => setDialog(null)} className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface-subtle" aria-label="Закрыть"><X aria-hidden="true" className="size-4" /></button>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setDialog(null)}>Закрыть</Button>
            {dialog.download ? <a href={dialog.download.url} download={dialog.download.filename} className="btn btn-primary btn-sm"><Download aria-hidden="true" className="size-4" />Скачать PDF</a> : null}
            {dialog.retryPdf ? <Button type="button" variant="primary" size="sm" onClick={() => void run("pdf")}><Printer aria-hidden="true" className="size-4" />Разрешить и повторить</Button> : null}
          </div>
        </div>
      </div>,
      window.document.body,
    ) : null}
  </>;
}
