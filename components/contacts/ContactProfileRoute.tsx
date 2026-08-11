"use client";

import type {
  ApiError,
  ContactCreateInput,
  ContactMutationResponse,
  ContactsListResponse,
} from "@/types/api";
import { ArrowLeft, LoaderCircle, UserRoundX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ContactDrawer } from "./ContactDrawer";
import {
  ContactFormDialog,
  type ContactDraft,
} from "./ContactsView";

function apiMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as ApiError).error === "string"
  ) {
    return (payload as ApiError).error;
  }
  return fallback;
}

export function ContactProfileRoute() {
  const params = useParams<{ id?: string }>();
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [contact, setContact] = useState<ContactsListResponse["contacts"][number] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timezone, setTimezone] = useState("Europe/Moscow");

  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/contacts", { cache: "no-store", signal });
      const payload: ContactsListResponse | ApiError = await response.json();
      if (!response.ok || !("contacts" in payload)) {
        throw new Error(apiMessage(payload, "Не удалось загрузить контакт."));
      }
      const found = payload.contacts.find((item) => item.id === params?.id) ?? null;
      setContact(found);
      setTimezone(payload.timezone);
      setState(found ? "ready" : "missing");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить контакт.");
      setState("error");
    }
  }, [params?.id]);

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => void load(controller.signal));
    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [load]);

  const save = async (draft: ContactDraft) => {
    if (!contact) return;
    setBusy(true);
    try {
      const { tagsText, ...draftFields } = draft;
      const input: ContactCreateInput = {
        ...draftFields,
        emailConsent: Boolean(draft.email.trim() && draft.emailConsent),
        tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
        telegramChatId: draft.telegramChatId?.trim() || null,
        telegramConsent: Boolean(draft.telegramChatId?.trim() && draft.telegramConsent),
        vkUserId: draft.vkUserId?.trim() || null,
        vkConsent: Boolean(draft.vkUserId?.trim() && draft.vkConsent),
      };
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: contact.id, ...input }),
      });
      const payload: ContactMutationResponse | ApiError = await response.json();
      if (!response.ok || !("contact" in payload)) {
        throw new Error(apiMessage(payload, "Не удалось сохранить контакт."));
      }
      setContact(payload.contact);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return <div className="grid min-h-[420px] place-items-center"><LoaderCircle aria-hidden="true" className="size-6 animate-spin text-[var(--primary)]" /><span className="sr-only">Загрузка контакта</span></div>;
  }

  if (state === "error") {
    return (
      <section className="card mx-auto max-w-xl px-6 py-12 text-center" role="alert">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--danger-subtle)] text-[var(--danger)]">
          <UserRoundX aria-hidden="true" size={22} />
        </span>
        <h1 className="mt-5 text-[24px] font-semibold tracking-[-.035em]">
          Не удалось открыть контакт
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[var(--text-secondary)]">
          {error}
        </p>
        <button type="button" onClick={() => void load()} className="btn btn-primary mx-auto mt-6">
          Повторить
        </button>
      </section>
    );
  }

  if (state === "missing" || !contact) {
    return (
      <section className="card mx-auto max-w-xl px-6 py-12 text-center" role="status">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--surface-subtle)] text-[var(--text-tertiary)]">
          <UserRoundX aria-hidden="true" size={22} />
        </span>
        <p className="section-eyebrow mt-5">Контакт недоступен</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-.035em] text-[var(--text-primary)]">
          Контакт не найден
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[var(--text-secondary)]">
          Возможно, профиль удалён или ссылка указана неверно.
        </p>
        <Link href="/contacts" className="btn btn-primary mx-auto mt-6 w-fit gap-2">
          <ArrowLeft aria-hidden="true" size={14} />
          Вернуться к контактам
        </Link>
      </section>
    );
  }

  return (
    <>
      <ContactDrawer contact={contact} embedded timezone={timezone} onEdit={() => setEditing(true)} />
      {editing && (
        <ContactFormDialog
          contact={contact}
          busy={busy}
          onClose={() => setEditing(false)}
          onSave={save}
        />
      )}
    </>
  );
}
