"use client";
import { useMemo, useState } from "react";
import { letterElements } from "@/lib/email-import/visual-editor";
import { LetterImageControls } from "@/components/email-builder/LetterImageControls";

export function DirectorImagePanel({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const images = useMemo(() => letterElements(html).filter(item => item.kind === "image"), [html]);
  const [error, setError] = useState("");
  return <section aria-label="Настройка изображений письма" className="space-y-3 rounded-xl border border-border bg-surface p-4">
    <p className="text-sm text-text-muted">Выберите изображение. Размер, положение и кадрирование сразу появятся в письме.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="grid gap-3" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))"}}>{images.map((item, index) => <details key={item.index} className="min-w-0 rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium"><span>{index + 1}. {item.label}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img alt="" src={item.attributes.src.replace(/^https:\/\/(?:mailflow-outreach\.isakovegor820\.chatgpt\.site|potok\.slava-hunter\.ru)(?=\/(?:api\/assets|email-icons)\/)/, "")} className="mt-2 h-24 w-full rounded-md bg-surface-inset object-contain" />
      </summary>
      <div className="mt-4"><LetterImageControls item={item} update={change => { try { onChange(change(html)); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось изменить изображение."); } }} /></div>
    </details>)}</div>
  </section>;
}
