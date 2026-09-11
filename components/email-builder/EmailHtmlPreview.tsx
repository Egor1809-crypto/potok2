"use client";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import type { BuilderDocument } from "./builder-types";

export function EmailHtmlPreview({ document }: { document: BuilderDocument }) {
  const [open, setOpen] = useState(false); const [view, setView] = useState("desktop");
  const [html, setHtml] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const preview = async () => {
    if (busy) return; setOpen(true); setBusy(true); setHtml(""); setMessage("");
    try { const response = await fetch("/api/email-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(document) }); const result = await response.json() as { html?: string; error?: string }; if (!response.ok || !result.html) throw new Error(result.error || "Не удалось подготовить HTML."); setHtml(result.html); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось открыть предпросмотр."); }
    finally { setBusy(false); }
  };
  const download = () => { const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })); const link = window.document.createElement("a"); link.href = url; link.download = "email.html"; window.document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); };
  return <><Button type="button" variant="secondary" size="sm" onClick={() => void preview()} disabled={busy || !document.blocks.length}>Предпросмотр / HTML</Button><Modal open={open} onOpenChange={setOpen} title="Предпросмотр письма" description="Тот же HTML используется при сохранении и отправке." size="full">
    <div className="flex flex-wrap gap-2 pb-4">{[["desktop", "Компьютер"], ["mobile", "Телефон"], ["html", "HTML"]].map(([value, label]) => <Button key={value} type="button" size="sm" aria-pressed={view === value} variant={view === value ? "primary" : "secondary"} onClick={() => setView(value)}>{label}</Button>)}<Button type="button" variant="secondary" size="sm" disabled={!html} onClick={() => void navigator.clipboard.writeText(html).then(() => setMessage("HTML скопирован."), () => setMessage("Копирование недоступно. Откройте вкладку HTML и выделите код."))}>Скопировать HTML</Button><Button type="button" variant="secondary" size="sm" disabled={!html} onClick={download}>Скачать .html</Button></div>
    <div role="status" className="mb-3 text-sm text-text-muted">{busy ? "Подготавливаем HTML…" : message}</div>
    {html ? view === "html" ? <textarea aria-label="HTML письма" readOnly value={html} className="h-[60vh] w-full rounded-xl border border-border p-4 font-mono text-xs" /> : <div className="overflow-auto rounded-xl bg-surface-inset p-2 sm:p-4"><iframe title={view === "mobile" ? "HTML письма на телефоне" : "HTML письма на компьютере"} srcDoc={html} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" className="mx-auto block h-[65vh] border-0 bg-white" style={{ width: view === "mobile" ? 360 : document.contentWidth + 48, maxWidth: view === "mobile" ? "100%" : "none" }} /></div> : null}
  </Modal></>;
}
