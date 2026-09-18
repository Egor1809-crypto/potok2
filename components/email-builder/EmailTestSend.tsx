"use client";

import { useRef, useState } from "react";
import { Button, FormField, Input, Modal, Select } from "@/components/ui";
import type { BuilderDocument } from "./builder-types";

export function EmailTestSend({ document }: { document: BuilderDocument }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [providerId, setProviderId] = useState<"unisender" | "vk-workspace">("unisender");
  const [accountId, setAccountId] = useState<"primary" | "secondary">("primary");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);

  const send = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/email-ai/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, email, providerId, accountId }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Тестовое письмо не отправлено.");
      setMessage(result.message || "Письмо передано провайдеру.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Нет подтверждения отправки. Проверьте статус у провайдера перед повтором.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return <>
    <Button type="button" variant="secondary" size="sm" disabled={!document.blocks.length} onClick={() => { setOpen(true); setMessage(""); setError(""); }}>Отправить тест</Button>
    <Modal open={open} onOpenChange={value => { if (!busy) setOpen(value); }} title="Тестовая отправка" description="Текущий макет будет отправлен на один адрес через выбранного провайдера. Персональные поля без данных останутся пустыми.">
      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void send(); }}>
        <FormField label="Провайдер" htmlFor="email-test-provider">
          <Select id="email-test-provider" value={providerId} onChange={event => setProviderId(event.target.value as "unisender" | "vk-workspace")} options={[{ value: "unisender", label: "UniSender" }, { value: "vk-workspace", label: "VK WorkSpace" }]} />
        </FormField>
        {providerId === "vk-workspace" ? <FormField label="Ящик отправителя" htmlFor="email-test-account">
          <Select id="email-test-account" value={accountId} onChange={event => setAccountId(event.target.value as "primary" | "secondary")} options={[{ value: "primary", label: "Основной ящик" }, { value: "secondary", label: "Второй ящик" }]} />
        </FormField> : null}
        <FormField label="Адрес получателя теста" htmlFor="email-test-recipient">
          <Input id="email-test-recipient" type="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} placeholder="you@example.ru" />
        </FormField>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Отправляем…" : "Отправить на этот адрес"}</Button>
        <div role="status" className="text-sm">{message}</div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  </>;
}
