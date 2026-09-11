"use client";
import { useRef, useState } from "react";
import { Button, FormField, Input, Modal } from "@/components/ui";
import type { BuilderDocument } from "./builder-types";
export function EmailTestSend({ document }: { document: BuilderDocument }) {
  const [open, setOpen] = useState(false); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const lock = useRef(false);
  const send = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setMessage("");
    try { const response = await fetch("/api/email-ai/test-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document, email }) }); const result = await response.json() as { message?: string; error?: string }; if (!response.ok) throw new Error(result.error || "Тестовое письмо не отправлено."); setMessage(result.message || "Письмо передано провайдеру."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Нет подтверждения отправки. Проверьте статус у провайдера перед повтором."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <><Button type="button" variant="secondary" size="sm" disabled={!document.blocks.length} onClick={() => { setOpen(true); setMessage(""); setError(""); }}>Отправить тест</Button><Modal open={open} onOpenChange={value => { if (!busy) setOpen(value); }} title="Тестовая отправка" description="Текущий макет будет отправлен на один адрес через подключённый UniSender. Персональные поля без данных останутся пустыми."><form className="grid gap-4" onSubmit={e => { e.preventDefault(); void send(); }}><FormField label="Адрес получателя теста" htmlFor="email-test-recipient"><Input id="email-test-recipient" type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} placeholder="you@example.ru" /></FormField><Button type="submit" variant="primary" disabled={busy}>{busy ? "Отправляем…" : "Отправить на этот адрес"}</Button><div role="status" className="text-sm">{message}</div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}</form></Modal></>;
}
