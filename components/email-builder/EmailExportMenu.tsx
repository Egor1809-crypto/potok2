"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Download, FileCode2, FileJson2, FileText, Printer, X } from "lucide-react";

import { Button } from "@/components/ui";
import type { ApiError, EmailExportResponse } from "@/types/api";

import type { BuilderDocument } from "./builder-types";

type ExportFormat = "html" | "doc" | "txt" | "json" | "pdf";

type PdfColor = { red: number; green: number; blue: number };
type EditableNamePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontKind: "sans" | "serif";
  textColor: PdfColor;
  backgroundColor: PdfColor;
  defaultText: string;
};

const EDITABLE_NAME_FONT_URLS = {
  sans: "https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
  serif: "https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSerif/NotoSerif-Regular.ttf",
} as const;
const editableNameFontBytesPromises = new Map<EditableNamePlacement["fontKind"], Promise<ArrayBuffer>>();

function loadEditableNameFontBytes(kind: EditableNamePlacement["fontKind"]) {
  if (!editableNameFontBytesPromises.has(kind)) {
    const promise = fetch(EDITABLE_NAME_FONT_URLS[kind], { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("Не удалось загрузить шрифт поля имени.");
        return response.arrayBuffer();
      })
      .catch((error) => {
        editableNameFontBytesPromises.delete(kind);
        throw error;
      });
    editableNameFontBytesPromises.set(kind, promise);
  }
  return editableNameFontBytesPromises.get(kind)!;
}

function parseCssColor(value: string): PdfColor {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length < 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return { red: 0.12, green: 0.14, blue: 0.2 };
  }
  return {
    red: Math.min(1, Math.max(0, channels[0] / 255)),
    green: Math.min(1, Math.max(0, channels[1] / 255)),
    blue: Math.min(1, Math.max(0, channels[2] / 255)),
  };
}

function resolveBackgroundColor(element: HTMLElement): PdfColor {
  const view = element.ownerDocument.defaultView;
  let current: HTMLElement | null = element;
  while (current && view) {
    const value = view.getComputedStyle(current).backgroundColor;
    const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
    const alpha = channels.length >= 4 ? channels[3] : 1;
    if (value !== "transparent" && alpha > 0.01) return parseCssColor(value);
    current = current.parentElement;
  }
  return { red: 1, green: 1, blue: 1 };
}

function resolveEditableFontKind(fontFamily: string): EditableNamePlacement["fontKind"] {
  return /\b(?:georgia|times)\b/i.test(fontFamily) || /(?:^|,)\s*serif(?:,|$)/i.test(fontFamily)
    ? "serif"
    : "sans";
}

function markEditableNamePlaceholders(frameDocument: Document) {
  const placeholderSource = String.raw`{{\s*(?:first_name|имя|name)\s*}}`;
  const placeholderMatcher = new RegExp(placeholderSource, "gi");
  const matcher = new RegExp(
    `Здравствуйте,\\s*${placeholderSource}!|${placeholderSource},\\s*добрый день\\.|${placeholderSource}`,
    "gi",
  );
  const walker = frameDocument.createTreeWalker(frameDocument.body, 4);
  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (!(current instanceof frameDocument.defaultView!.Text)) continue;
    if (current.parentElement?.closest("script, style, textarea, title")) continue;
    if (matcher.test(current.data)) textNodes.push(current);
    matcher.lastIndex = 0;
  }

  const markers: HTMLSpanElement[] = [];
  for (const textNode of textNodes) {
    const fragment = frameDocument.createDocumentFragment();
    let cursor = 0;
    matcher.lastIndex = 0;
    for (const match of textNode.data.matchAll(matcher)) {
      const index = match.index ?? 0;
      fragment.append(frameDocument.createTextNode(textNode.data.slice(cursor, index)));
      const marker = frameDocument.createElement("span");
      marker.dataset.pdfEditableName = String(markers.length + 1);
      marker.dataset.pdfEditableGreeting = match[0].replace(placeholderMatcher, "Имя");
      marker.dataset.pdfStandaloneGreeting = textNode.data.trim() === match[0].trim() ? "true" : "false";
      marker.textContent = marker.dataset.pdfEditableGreeting;
      Object.assign(marker.style, {
        display: marker.dataset.pdfStandaloneGreeting === "true" ? "block" : "inline-block",
        boxSizing: "border-box",
        whiteSpace: "nowrap",
        verticalAlign: "baseline",
      });
      markers.push(marker);
      fragment.append(marker);
      cursor = index + match[0].length;
    }
    fragment.append(frameDocument.createTextNode(textNode.data.slice(cursor)));
    textNode.replaceWith(fragment);
  }

  for (const marker of markers) {
    const view = marker.ownerDocument.defaultView;
    const computed = view?.getComputedStyle(marker);
    const fontSize = Number.parseFloat(computed?.fontSize ?? "16") || 16;
    const parsedLineHeight = Number.parseFloat(computed?.lineHeight ?? "");
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.45;
    const markerRect = marker.getBoundingClientRect();
    const parentRect = marker.parentElement?.getBoundingClientRect();
    const availableWidth = parentRect ? Math.max(markerRect.width, parentRect.right - markerRect.left) : markerRect.width;
    const width = marker.dataset.pdfStandaloneGreeting === "true"
      ? availableWidth
      : Math.max(markerRect.width, fontSize * 12);
    marker.style.width = `${width}px`;
    marker.style.height = `${Math.max(lineHeight, fontSize * 1.25)}px`;
    marker.style.lineHeight = `${Math.max(lineHeight, fontSize * 1.25)}px`;
    marker.textContent = "\u00a0";
  }
  return markers;
}

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

async function makePdfLinksViewerCompatible(pdfBlob: Blob, editableNames: EditableNamePlacement[]) {
  const { PDFArray, PDFBool, PDFDict, PDFDocument, PDFName, PDFNumber, PDFString, rgb } = await import("pdf-lib");
  const document = await PDFDocument.load(await pdfBlob.arrayBuffer());
  const annotsName = PDFName.of("Annots");
  const rectName = PDFName.of("Rect");
  const actionName = PDFName.of("A");

  for (const page of document.getPages()) {
    const annotations = page.node.lookupMaybe(annotsName, PDFArray);
    if (!annotations) continue;
    for (let index = 0; index < annotations.size(); index += 1) {
      const annotation = annotations.lookupMaybe(index, PDFDict);
      if (!annotation || annotation.lookupMaybe(PDFName.of("Subtype"), PDFName)?.asString() !== "/Link") continue;
      const rectangle = annotation.lookupMaybe(rectName, PDFArray);
      if (rectangle?.size() === 4) {
        const coordinates = Array.from({ length: 4 }, (_, coordinateIndex) => rectangle.lookup(coordinateIndex, PDFNumber).asNumber());
        annotation.set(rectName, document.context.obj([
          Math.min(coordinates[0], coordinates[2]),
          Math.min(coordinates[1], coordinates[3]),
          Math.max(coordinates[0], coordinates[2]),
          Math.max(coordinates[1], coordinates[3]),
        ]));
      }
      const action = annotation.lookupMaybe(actionName, PDFDict);
      action?.set(PDFName.of("Type"), PDFName.of("Action"));
      annotation.set(PDFName.of("F"), PDFNumber.of(4));
      annotation.set(PDFName.of("H"), PDFName.of("I"));
    }
  }

  if (editableNames.length > 0) {
    const form = document.getForm();
    const page = document.getPages()[0];
    const pointsPerMillimeter = 72 / 25.4;
    const fontCache = new Map<EditableNamePlacement["fontKind"], Awaited<ReturnType<typeof document.embedFont>>>();
    const defaultResourcesName = PDFName.of("DR");
    const fontsName = PDFName.of("Font");
    let defaultResources = form.acroForm.dict.lookupMaybe(defaultResourcesName, PDFDict);
    if (!defaultResources) {
      defaultResources = document.context.obj({});
      form.acroForm.dict.set(defaultResourcesName, defaultResources);
    }
    let formFonts = defaultResources.lookupMaybe(fontsName, PDFDict);
    if (!formFonts) {
      formFonts = document.context.obj({});
      defaultResources.set(fontsName, formFonts);
    }

    for (const [index, placement] of editableNames.entries()) {
      let fieldFont = fontCache.get(placement.fontKind);
      if (!fieldFont) {
        try {
          const { default: fontkit } = await import("@pdf-lib/fontkit");
          document.registerFontkit(fontkit);
          fieldFont = await document.embedFont(
            new Uint8Array(await loadEditableNameFontBytes(placement.fontKind)),
            { subset: false },
          );
        } catch {
          throw new Error("Не удалось встроить шрифт для редактируемой строки приветствия.");
        }
        fontCache.set(placement.fontKind, fieldFont);
        formFonts.set(PDFName.of(fieldFont.name), fieldFont.ref);
      }

      const nameField = form.createTextField(index === 0 ? "recipient_greeting" : `recipient_greeting_${index + 1}`);
      const width = placement.width * pointsPerMillimeter;
      const height = placement.height * pointsPerMillimeter;
      const fontSize = Math.min(height - 2, Math.max(7, placement.fontSize * pointsPerMillimeter));
      const textColor = rgb(placement.textColor.red, placement.textColor.green, placement.textColor.blue);
      const colorOperator = `${placement.textColor.red.toFixed(4)} ${placement.textColor.green.toFixed(4)} ${placement.textColor.blue.toFixed(4)} rg`;
      const defaultAppearance = `${colorOperator} /${fieldFont.name} ${fontSize.toFixed(2)} Tf`;
      nameField.setMaxLength(120);
      nameField.setText(placement.defaultText);
      nameField.addToPage(page, {
        x: placement.x * pointsPerMillimeter,
        y: page.getHeight() - (placement.y + placement.height) * pointsPerMillimeter,
        width,
        height,
        borderWidth: 0,
        textColor,
        backgroundColor: rgb(placement.backgroundColor.red, placement.backgroundColor.green, placement.backgroundColor.blue),
        font: fieldFont,
      });
      nameField.setFontSize(fontSize);
      nameField.updateAppearances(fieldFont);
      nameField.acroField.setDefaultAppearance(defaultAppearance);
      nameField.acroField.getWidgets()[0]?.setDefaultAppearance(defaultAppearance);
      if (index === 0) form.acroForm.dict.set(PDFName.of("DA"), PDFString.of(defaultAppearance));
    }
    form.acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.False);
  }

  const bytes = Uint8Array.from(await document.save({ useObjectStreams: false }));
  return new Blob([bytes.buffer], { type: "application/pdf" });
}

async function renderPdf(html: string) {
  const renderScale = 2;
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
    const editableNameMarkers = markEditableNamePlaceholders(frameDocument);
    await new Promise<void>((resolve) => frame.contentWindow?.requestAnimationFrame(() => resolve()));
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const canvas = await html2canvas(frameDocument.body, {
      backgroundColor: "#ffffff",
      scale: renderScale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      windowWidth: 760,
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const margin = 10;
    const pageWidth = 210 - margin * 2;
    const pageHeight = 297 - margin * 2;
    const contentWidth = canvas.width / renderScale;
    const contentHeight = canvas.height / renderScale;
    if (contentWidth <= 0 || contentHeight <= 0) throw new Error("Письмо не удалось разместить на странице A4.");
    const cssToPdf = Math.min(pageWidth / contentWidth, pageHeight / contentHeight);
    const imageWidth = contentWidth * cssToPdf;
    const imageHeight = contentHeight * cssToPdf;
    const imageX = margin + (pageWidth - imageWidth) / 2;
    const imageY = margin;
    const imageData = canvas.toDataURL("image/jpeg", 0.94);
    const bodyRect = frameDocument.body.getBoundingClientRect();
    const editableNames = editableNameMarkers.flatMap((marker) => {
      const rect = marker.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return [];
      const computedStyle = frame.contentWindow?.getComputedStyle(marker);
      const textColor = parseCssColor(computedStyle?.color ?? "rgb(31, 35, 48)");
      const fontSize = Number.parseFloat(computedStyle?.fontSize ?? "16") || 16;
      const backgroundColor = resolveBackgroundColor(marker);
      return [{
        x: imageX + (rect.left - bodyRect.left) * cssToPdf,
        y: imageY + (rect.top - bodyRect.top) * cssToPdf,
        width: rect.width * cssToPdf,
        height: rect.height * cssToPdf,
        fontSize: fontSize * cssToPdf,
        fontKind: resolveEditableFontKind(computedStyle?.fontFamily ?? "Arial"),
        textColor,
        backgroundColor,
        defaultText: marker.dataset.pdfEditableGreeting ?? "Имя",
      }];
    });
    const links = Array.from(frameDocument.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .flatMap((anchor) => {
        const rawHref = anchor.getAttribute("href")?.trim();
        if (!rawHref) return [];
        let url: URL;
        try {
          url = new URL(rawHref, window.location.origin);
        } catch {
          return [];
        }
        if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return [];
        return Array.from(anchor.getClientRects()).map((rect) => ({
          url: url.href,
          x: imageX + (rect.left - bodyRect.left) * cssToPdf,
          y: imageY + (rect.top - bodyRect.top) * cssToPdf,
          width: rect.width * cssToPdf,
          height: rect.height * cssToPdf,
        }));
      })
      .filter((link) => link.width > 0 && link.height > 0);
    pdf.addImage(imageData, "JPEG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST");
    for (const link of links) {
      const left = Math.max(imageX, link.x);
      const top = Math.max(imageY, link.y);
      const right = Math.min(imageX + imageWidth, link.x + link.width);
      const bottom = Math.min(imageY + imageHeight, link.y + link.height);
      if (right <= left || bottom <= top) continue;
      pdf.link(left, top, right - left, bottom - top, { url: link.url });
    }
    return makePdfLinksViewerCompatible(pdf.output("blob"), editableNames);
  } finally {
    frame.remove();
  }
}

export function EmailExportMenu({ document, name }: { document: BuilderDocument; name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; message: string; retryPdf?: boolean; download?: { url: string; filename: string } } | null>(null);
  const [copies, setCopies] = useState(1);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const menuId = useId();
  const menuTitleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const viewportPadding = 12;
    const gap = 8;
    const menuWidth = Math.min(288, window.innerWidth - viewportPadding * 2);
    const triggerRect = trigger.getBoundingClientRect();
    const measuredHeight = menuRef.current?.scrollHeight ?? 408;
    const spaceBelow = window.innerHeight - triggerRect.bottom - gap - viewportPadding;
    const spaceAbove = triggerRect.top - gap - viewportPadding;
    const openBelow = spaceBelow >= Math.min(measuredHeight, 320) || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(180, openBelow ? spaceBelow : spaceAbove);
    const top = openBelow
      ? triggerRect.bottom + gap
      : Math.max(viewportPadding, triggerRect.top - gap - Math.min(measuredHeight, maxHeight));
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    );
    setMenuPosition({ left, top, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    const frame = window.requestAnimationFrame(() => {
      updateMenuPosition();
      menuRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.document.addEventListener("pointerdown", onPointerDown);
    window.document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.document.removeEventListener("pointerdown", onPointerDown);
      window.document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, updateMenuPosition]);

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
    const response = await fetch("/api/email-export?portable=1", {
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
        if (format === "html") for (let index = 1; index <= copies; index += 1) saveBlob(result.html, "text/html;charset=utf-8", `${filename}${copies > 1 ? `-${index}` : ""}.html`);
        if (format === "txt") for (let index = 1; index <= copies; index += 1) saveBlob(result.text, "text/plain;charset=utf-8", `${filename}${copies > 1 ? `-${index}` : ""}.txt`);
        if (format === "doc") {
          const wordBody = new DOMParser().parseFromString(result.html, "text/html").body.innerHTML;
          const wordHtml = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="ru"><head><meta charset="utf-8"><title>${filename}</title></head><body>${wordBody}</body></html>`;
          for (let index = 1; index <= copies; index += 1) saveBlob(wordHtml, "application/msword;charset=utf-8", `${filename}${copies > 1 ? `-${index}` : ""}.doc`);
        }
        if (format === "pdf") {
          const pdf = await renderPdf(result.html);
          for (let index = 1; index <= copies; index += 1) saveBlob(pdf, "application/pdf", `${filename}${copies > 1 ? `-${index}` : ""}.pdf`);
          const downloadName = `${filename}.pdf`;
          setDialog({ title: "PDF готов", message: copies === 1 ? "Письмо собрано на одной странице A4. Нажмите на строку приветствия и замените слово «Имя» — шрифт, цвет и положение сохранятся. Кнопки и ссылки работают." : `Подготовлено файлов: ${copies}. В каждом PDF можно нажать на строку приветствия и заменить слово «Имя»; оформление и рабочие ссылки сохранятся.`, download: { url: URL.createObjectURL(pdf), filename: downloadName } });
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
    ["pdf", Printer, "PDF", "A4 · редактируемая строка · рабочие ссылки"],
    ["txt", FileText, "Текст", "Без оформления"],
    ["json", FileJson2, "Исходник «Поток»", "Резервная копия макета"],
  ] as const;

  return <>
    <div className="relative">
      <Button ref={triggerRef} type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? menuId : undefined}>
        <Download aria-hidden="true" className="size-3.5" /><span className="hidden xl:inline">{busy ? "Готовим…" : "Скачать"}</span>
      </Button>
    </div>

    {open && typeof window !== "undefined" ? createPortal(
      <div
        ref={menuRef}
        id={menuId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={menuTitleId}
        className="fixed z-[1200] w-[min(18rem,calc(100vw-24px))] overscroll-contain overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-floating)] outline-none"
        style={menuPosition ? { left: menuPosition.left, top: menuPosition.top, maxHeight: menuPosition.maxHeight } : { left: 12, top: 12, visibility: "hidden" }}
      >
        <p id={menuTitleId} className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-text-subtle">Экспорт письма</p>
        <label className="mb-2 grid grid-cols-[1fr_42px] items-center gap-2 rounded-lg bg-surface-subtle px-2.5 py-2 text-[10px] text-text-muted"><span>Количество копий<input type="range" min="1" max="20" value={copies} onInput={(event) => setCopies(Number(event.currentTarget.value))} className="mt-1 block w-full accent-primary" /></span><strong className="rounded-md bg-surface py-1 text-center text-primary">{copies}</strong></label>
        {options.map(([format, Icon, label, hint]) => <button key={format} type="button" onClick={() => void run(format)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon aria-hidden="true" className="size-4" /></span>
          <span><span className="block text-[11px] font-semibold text-text-strong">{label}</span><span className="block text-[9px] text-text-subtle">{hint}</span></span>
        </button>)}
      </div>,
      window.document.body,
    ) : null}

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
