"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setLetterLink } from "@/lib/email-import/visual-editor";

export function LetterLinkEditor({ html, index, value, onChange }: { html: string; index: number; value: string; onChange: (html: string) => void }) {
  const [error, setError] = useState("");
  return <form className="grid gap-2 border-t border-border pt-4" onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    try { onChange(setLetterLink(html, index, String(data.get("url") || "").trim())); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Проверьте ссылку."); }
  }}>
    <label className="grid gap-1.5 text-xs font-medium">Ссылка при нажатии<input key={`${index}:${value}`} name="url" type="text" inputMode="url" defaultValue={value} placeholder="https://… или mailto:…" className="w-full rounded-lg border border-border p-2 text-sm" /></label>
    <p className="text-xs text-text-muted">{value ? "Ссылка назначена. В редакторе нажатие выбирает элемент; в отправленном письме открывает адрес." : "Добавьте адрес, чтобы этот элемент стал рабочей кнопкой или ссылкой."}</p>
    <Button type="submit" size="sm" variant="secondary">Применить ссылку</Button>
    {value && <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Открыть ссылку для проверки</a>}
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
  </form>;
}
