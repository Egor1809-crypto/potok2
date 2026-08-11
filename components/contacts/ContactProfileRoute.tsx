"use client";

import { contacts } from "@/data/mockContacts";
import { ArrowLeft, UserRoundX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ContactDrawer } from "./ContactDrawer";

export function ContactProfileRoute() {
  const params = useParams<{ id?: string }>();
  const contact = contacts.find(item => item.id === params?.id);

  if (!contact) {
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
