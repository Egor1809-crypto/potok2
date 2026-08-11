"use client";

import type { ContactsListResponse } from "@/types/api";
import { ArrowLeft, LoaderCircle, UserRoundX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ContactDrawer } from "./ContactDrawer";

export function ContactProfileRoute() {
  const params = useParams<{ id?: string }>();
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [contact, setContact] = useState<ContactsListResponse["contacts"][number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/contacts", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("contacts unavailable");
        return response.json() as Promise<ContactsListResponse>;
      })
      .then((payload) => {
        if (cancelled) return;
        const found = payload.contacts.find((item) => item.id === params?.id) ?? null;
        setContact(found);
        setState(found ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  if (state === "loading") {
    return <div className="grid min-h-[420px] place-items-center"><LoaderCircle aria-hidden="true" className="size-6 animate-spin text-[var(--primary)]" /><span className="sr-only">Загрузка контакта</span></div>;
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

  return <ContactDrawer contact={contact} embedded />;
}
