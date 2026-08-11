"use client";

import Link from "next/link";
import {
  Building2,
  Check,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Send,
  SendHorizontal,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRef } from "react";

import { useDrawerAccessibility } from "@/components/shared/useDrawerAccessibility";
import type { Contact as LegacyContact } from "@/types";
import type { ContactRecord } from "@/types/api";

type ContactLike = ContactRecord | LegacyContact;

const date = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const statusLabels = {
  active: "Активен",
  unsubscribed: "Отписан",
  bounced: "Недоставляемый",
  invalid: "Некорректный адрес",
} as const;

function isStoredContact(contact: ContactLike): contact is ContactRecord {
  return "jobTitle" in contact;
}

export function ContactDrawer({
  contact,
  onClose,
  onEdit,
  embedded = false,
}: {
  contact: ContactLike;
  onClose?: () => void;
  onEdit?: (contact: ContactRecord) => void;
  embedded?: boolean;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useDrawerAccessibility(panelRef, onClose, !embedded);

  const stored = isStoredContact(contact);
  const jobTitle = stored ? contact.jobTitle : contact.role;
  const updatedAt = stored ? contact.updatedAt : contact.createdAt;
  const channels = stored
    ? [
        {
          id: "email",
          label: "Email",
          address: contact.email,
          ready: Boolean(contact.email && contact.emailConsent && contact.status === "active"),
          reason: !contact.emailConsent ? "Нет согласия" : contact.status !== "active" ? "Контакт недоступен" : "Готов к отправке",
          Icon: Mail,
        },
        {
          id: "telegram",
          label: "Telegram",
          address: contact.telegramChatId ?? "Идентификатор чата не указан",
          ready: Boolean(contact.status === "active" && contact.telegramChatId && contact.telegramConsent),
          reason: contact.status !== "active" ? "Контакт недоступен" : !contact.telegramChatId ? "Нет идентификатора чата" : !contact.telegramConsent ? "Нет согласия" : "Готов к отправке",
          Icon: SendHorizontal,
        },
        {
          id: "vk",
          label: "ВКонтакте",
          address: contact.vkUserId ?? "Идентификатор пользователя не указан",
          ready: Boolean(contact.status === "active" && contact.vkUserId && contact.vkConsent),
          reason: contact.status !== "active" ? "Контакт недоступен" : !contact.vkUserId ? "Нет идентификатора пользователя" : !contact.vkConsent ? "Нет согласия" : "Готов к отправке",
          Icon: MessageCircle,
        },
      ]
    : [
        { id: "email", label: "Email", address: contact.email, ready: contact.status === "active", reason: contact.status === "active" ? "Готов к отправке" : "Контакт недоступен", Icon: Mail },
      ];

  return (
    <div
      className={embedded ? "card overflow-hidden" : "fixed inset-0 z-[80] flex justify-end bg-[#171823]/30 backdrop-blur-[2px]"}
      role={embedded ? undefined : "presentation"}
      onMouseDown={(event) => {
        if (!embedded && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={panelRef}
        tabIndex={embedded ? undefined : -1}
        className={embedded ? "min-h-[620px] bg-white" : "h-full w-full max-w-[520px] overflow-y-auto border-l border-[var(--border)] bg-white shadow-[-22px_0_60px_rgba(30,31,46,.16)]"}
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-label={`Контакт ${contact.fullName}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-white/95 px-5 py-3 backdrop-blur-xl">
          <p className="text-[12px] font-semibold">Карточка контакта</p>
          <div className="flex items-center gap-1">
            {!embedded && <Link href={`/contacts/${contact.id}`} className="grid size-9 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]" aria-label="Открыть отдельную страницу"><ExternalLink aria-hidden="true" className="size-4" /></Link>}
            {onClose && <button data-autofocus={!embedded ? "true" : undefined} type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]" aria-label="Закрыть карточку"><X aria-hidden="true" className="size-5" /></button>}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-[16px] font-semibold text-white" style={{ backgroundColor: contact.avatarColor }}>{contact.firstName[0]}{contact.lastName[0]}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-semibold tracking-[-.035em]">{contact.fullName}</h1><span className={`badge ${contact.status === "active" ? "badge-success" : "badge-warning"}`}>{statusLabels[contact.status]}</span></div>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{[jobTitle, contact.companyName].filter(Boolean).join(" · ") || "Должность и компания не указаны"}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {contact.email && <a href={`mailto:${contact.email}`} className="btn btn-primary gap-2"><Mail aria-hidden="true" className="size-4" />Написать письмо</a>}
            <Link href={`/campaigns/new?contact=${contact.id}`} className="btn btn-secondary gap-2"><Send aria-hidden="true" className="size-4" />В кампанию</Link>
            {stored && onEdit && <button type="button" onClick={() => onEdit(contact)} className="btn btn-secondary gap-2"><Pencil aria-hidden="true" className="size-4" />Изменить</button>}
          </div>

          <section className="mt-8">
            <h2 className="text-[12px] font-semibold">Контактные данные</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
              <Detail Icon={Mail} label="Email" value={contact.email || "Не указан"} />
              <Detail Icon={Phone} label="Телефон" value={contact.phone || "Не указан"} />
              <Detail Icon={Building2} label="Компания" value={contact.companyName || "Не указана"} />
              <Detail Icon={MapPin} label="Город" value={[contact.city, contact.country].filter(Boolean).join(", ") || "Не указан"} />
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-[12px] font-semibold">Доступность каналов</h2><p className="mt-1 text-[10px] leading-4 text-[var(--text-subtle)]">Идентификатор и согласие проверяются отдельно.</p></div>
              <Link href="/integrations" className="text-[11px] font-semibold text-[var(--primary)]">Провайдеры</Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {channels.map(({ id, label, address, ready, reason, Icon }) => (
                <div key={id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between gap-2"><span className={`grid size-8 place-items-center rounded-lg ${ready ? "bg-[var(--success-subtle)] text-[var(--success)]" : "bg-[var(--surface-subtle)] text-[var(--text-subtle)]"}`}><Icon aria-hidden="true" className="size-4" /></span>{ready && <Check aria-hidden="true" className="size-4 text-[var(--success)]" />}</div>
                  <p className="mt-3 text-[11px] font-semibold">{label}</p>
                  <p className="mt-1 truncate text-[9px] text-[var(--text-subtle)]" title={address}>{address}</p>
                  <p className={`mt-2 text-[9px] font-semibold ${ready ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-xl bg-[var(--surface-subtle)] p-4">
            <div className="flex gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" /><div><h2 className="text-[11px] font-semibold">Состояние данных</h2><p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">Контакт обновлён {date.format(new Date(updatedAt))}. Перед запуском кампания повторно проверит статус и согласия.</p></div></div>
          </section>
        </div>
      </section>
    </div>
  );
}

function Detail({ Icon, label, value }: { Icon: typeof Mail; label: string; value: string }) {
  return <div className="grid grid-cols-[28px_100px_minmax(0,1fr)] items-center border-b border-[var(--border)] px-4 py-3 last:border-0"><Icon aria-hidden="true" className="size-4 text-[var(--text-subtle)]" /><span className="text-[10px] text-[var(--text-subtle)]">{label}</span><span className="truncate text-[11px] font-medium">{value}</span></div>;
}
