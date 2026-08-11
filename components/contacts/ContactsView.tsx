"use client";

import Link from "next/link";
import {
  Check,
  CircleAlert,
  Download,
  LoaderCircle,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  SendHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { useDrawerAccessibility } from "@/components/shared/useDrawerAccessibility";
import { Switch } from "@/components/ui";
import type {
  ApiError,
  ContactCreateInput,
  ContactMutationResponse,
  ContactRecord,
  ContactsListResponse,
} from "@/types/api";
import { ContactDrawer } from "./ContactDrawer";

type StatusFilter = "all" | ContactRecord["status"];
export type ContactDraft = ContactCreateInput & { email: string; tagsText: string };

const statusLabel: Record<ContactRecord["status"], string> = {
  active: "Активен",
  unsubscribed: "Отписан",
  bounced: "Недоставляемый",
  invalid: "Некорректный",
};

const statusTone: Record<ContactRecord["status"], string> = {
  active: "badge-success",
  unsubscribed: "badge-neutral",
  bounced: "badge-warning",
  invalid: "badge-danger",
};

const emptyDraft: ContactDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  companyName: "",
  jobTitle: "",
  category: "Клиент",
  city: "",
  country: "Россия",
  tags: [],
  tagsText: "",
  status: "active",
  engagementScore: 0,
  emailConsent: false,
  telegramChatId: null,
  telegramConsent: false,
  vkUserId: null,
  vkConsent: false,
};

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof (payload as ApiError).error === "string") return (payload as ApiError).error;
  return fallback;
}

function toDraft(contact: ContactRecord): ContactDraft {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    companyName: contact.companyName,
    companyId: contact.companyId,
    jobTitle: contact.jobTitle,
    category: contact.category,
    city: contact.city,
    country: contact.country,
    tags: contact.tags,
    tagsText: contact.tags.join(", "),
    status: contact.status,
    engagementScore: contact.engagementScore,
    emailConsent: contact.emailConsent,
    telegramChatId: contact.telegramChatId,
    telegramConsent: contact.telegramConsent,
    vkUserId: contact.vkUserId,
    vkConsent: contact.vkConsent,
  };
}

function campaignHref(ids: string[]) {
  if (!ids.length) return "/campaigns/new";
  const params = new URLSearchParams({ source: "contacts", count: String(ids.length) });
  ids.forEach((id) => params.append("contact", id));
  return `/campaigns/new?${params.toString()}`;
}

export function ContactsView() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerContact, setDrawerContact] = useState<ContactRecord | null>(null);
  const [editing, setEditing] = useState<ContactRecord | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [timezone, setTimezone] = useState("Europe/Moscow");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contacts", { cache: "no-store" });
      const payload: ContactsListResponse | ApiError = await response.json();
      if (!response.ok || !("contacts" in payload)) throw new Error(messageFrom(payload, "Не удалось загрузить контакты"));
      setContacts(payload.contacts);
      setTimezone(payload.timezone);
      setSelected(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить контакты");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ru-RU");
    return contacts.filter((contact) => {
      if (status !== "all" && contact.status !== status) return false;
      if (!needle) return true;
      return [contact.fullName, contact.email, contact.phone, contact.companyName, contact.jobTitle, contact.city, contact.tags.join(" ")]
        .join(" ")
        .toLocaleLowerCase("ru-RU")
        .includes(needle);
    });
  }, [contacts, search, status]);

  const selectedIds = useMemo(() => [...selected], [selected]);
  const dateFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: timezone,
      });
    } catch {
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Moscow",
      });
    }
  }, [timezone]);
  const allVisibleSelected = visible.length > 0 && visible.every((contact) => selected.has(contact.id));
  const activeCount = contacts.filter((contact) => contact.status === "active").length;
  const coverage = [
    { label: "Email", count: contacts.filter((contact) => contact.status === "active" && contact.emailConsent && contact.email).length, Icon: Mail },
    { label: "Telegram", count: contacts.filter((contact) => contact.status === "active" && contact.telegramChatId && contact.telegramConsent).length, Icon: SendHorizontal },
    { label: "ВКонтакте", count: contacts.filter((contact) => contact.status === "active" && contact.vkUserId && contact.vkConsent).length, Icon: MessageCircle },
  ];

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const saveContact = async (draft: ContactDraft) => {
    setBusy(true);
    setError("");
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
    const existing = editing !== "new" ? editing : null;
    try {
      const response = await fetch("/api/contacts", {
        method: existing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(existing ? { id: existing.id, ...input } : input),
      });
      const payload: ContactMutationResponse | ApiError = await response.json();
      if (!response.ok || !("contact" in payload)) throw new Error(messageFrom(payload, "Не удалось сохранить контакт"));
      setContacts((current) => existing ? current.map((contact) => contact.id === payload.contact.id ? payload.contact : contact) : [payload.contact, ...current]);
      setDrawerContact(payload.contact);
      setEditing(null);
      notify(existing ? "Контакт обновлён" : "Контакт добавлен");
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error("Не удалось сохранить контакт");
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    if (!selectedIds.length || !window.confirm(`Удалить выбранные контакты: ${selectedIds.length}? Это действие нельзя отменить.`)) return;
    setBusy(true);
    setError("");
    const deletedIds = new Set<string>();
    try {
      for (const id of selectedIds) {
        const response = await fetch(`/api/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(payload, "Не удалось удалить контакты"));
        deletedIds.add(id);
      }
      setContacts((current) => current.filter((contact) => !deletedIds.has(contact.id)));
      setSelected(new Set());
      notify("Контакты удалены");
    } catch (reason) {
      if (deletedIds.size) {
        setContacts((current) => current.filter((contact) => !deletedIds.has(contact.id)));
        setSelected((current) => {
          const next = new Set(current);
          deletedIds.forEach((id) => next.delete(id));
          return next;
        });
      }
      const message = reason instanceof Error ? reason.message : "Не удалось удалить контакты";
      setError(
        deletedIds.size
          ? `Удалено контактов: ${deletedIds.size}. Остальные не удалены: ${message}`
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const source = selectedIds.length ? contacts.filter((contact) => selected.has(contact.id)) : visible;
    const escape = (value: string) => {
      const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return `"${guarded.replaceAll('"', '""')}"`;
    };
    const rows = [
      [
        "Имя",
        "Фамилия",
        "Email",
        "Согласие Email",
        "Телефон",
        "Компания",
        "Должность",
        "Категория",
        "Город",
        "Страна",
        "Статус",
        "Вовлечённость",
        "Идентификатор чата Telegram",
        "Согласие Telegram",
        "Идентификатор пользователя ВКонтакте",
        "Согласие ВКонтакте",
        "Теги",
      ],
      ...source.map((contact) => [
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.emailConsent ? "да" : "нет",
        contact.phone,
        contact.companyName,
        contact.jobTitle,
        contact.category,
        contact.city,
        contact.country,
        statusLabel[contact.status],
        String(contact.engagementScore),
        contact.telegramChatId ?? "",
        contact.telegramConsent ? "да" : "нет",
        contact.vkUserId ?? "",
        contact.vkConsent ? "да" : "нет",
        contact.tags.join(", "),
      ]),
    ];
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mailflow-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(`Экспортировано контактов: ${source.length}`);
  };

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((contact) => next.delete(contact.id));
      else visible.forEach((contact) => next.add(contact.id));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-eyebrow">База и доступность каналов</p>
          <h1 className="text-[28px] font-semibold tracking-[-.04em]">Контакты</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{loading ? "Загружаем базу…" : `${contacts.length} контактов · ${activeCount} активных`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/import" className="btn btn-secondary gap-2"><Upload aria-hidden="true" className="size-4" />Импорт CSV</Link>
          <button type="button" onClick={() => setEditing("new")} className="btn btn-secondary gap-2"><Plus aria-hidden="true" className="size-4" />Добавить контакт</button>
          <Link href={campaignHref(selectedIds)} className="btn btn-primary gap-2"><SendHorizontal aria-hidden="true" className="size-4" />{selectedIds.length ? `Кампания · ${selectedIds.length}` : "Новая кампания"}</Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Точный охват по каналам">
        {coverage.map(({ label, count, Icon }) => (
          <div key={label} className="card flex items-center gap-3 p-4"><span className="grid size-9 place-items-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)]"><Icon aria-hidden="true" className="size-4" /></span><div><p className="text-[12px] font-semibold">{label}</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Доступно: {count}</p></div></div>
        ))}
      </section>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-subtle)] p-4 text-[12px] text-[var(--danger)]"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">Повторить</button></div>}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Поиск контактов</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" /><input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, email, компания или тег" /></label>
          <label className="sm:w-52"><span className="sr-only">Фильтр по статусу</span><select className="input" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">Все статусы</option><option value="active">Активные</option><option value="unsubscribed">Отписанные</option><option value="bounced">Недоставляемые</option><option value="invalid">Некорректные</option></select></label>
          <button type="button" onClick={exportCsv} disabled={!selectedIds.length && !visible.length} className="btn btn-secondary gap-2"><Download aria-hidden="true" className="size-4" />Экспорт</button>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center"><LoaderCircle aria-hidden="true" className="size-6 animate-spin text-[var(--primary)]" /><span className="sr-only">Загрузка контактов</span></div>
        ) : visible.length ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[820px]">
              <thead><tr><th className="w-12"><button type="button" onClick={toggleAll} aria-label="Выбрать все найденные контакты" className={`grid size-4 place-items-center rounded border ${allVisibleSelected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white"}`}>{allVisibleSelected && <Check aria-hidden="true" className="size-3" />}</button></th><th>Контакт</th><th>Компания</th><th>Каналы</th><th>Статус</th><th>Обновлён</th><th className="w-12"><span className="sr-only">Действия</span></th></tr></thead>
              <tbody>{visible.map((contact) => {
                const checked = selected.has(contact.id);
                const readyChannels = [contact.email && contact.emailConsent && contact.status === "active", contact.status === "active" && contact.telegramChatId && contact.telegramConsent, contact.status === "active" && contact.vkUserId && contact.vkConsent].filter(Boolean).length;
                const primaryEndpoint = contact.email || (contact.telegramChatId ? `Telegram: ${contact.telegramChatId}` : contact.vkUserId ? `ВК: ${contact.vkUserId}` : "Канал не указан");
                return <tr key={contact.id} data-selected={checked}><td><button type="button" onClick={() => setSelected((current) => { const next = new Set(current); if (next.has(contact.id)) next.delete(contact.id); else next.add(contact.id); return next; })} aria-label={`Выбрать ${contact.fullName}`} className={`grid size-4 place-items-center rounded border ${checked ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white"}`}>{checked && <Check aria-hidden="true" className="size-3" />}</button></td><td><button type="button" onClick={() => setDrawerContact(contact)} className="flex items-center gap-3 text-left"><span className="grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: contact.avatarColor }}>{contact.firstName[0]}{contact.lastName[0]}</span><span><span className="block text-[12px] font-semibold hover:text-[var(--primary)]">{contact.fullName}</span><span className="mt-0.5 block text-[10px] text-[var(--text-subtle)]">{primaryEndpoint}</span></span></button></td><td><p className="text-[11px] font-medium">{contact.companyName || "—"}</p><p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">{contact.jobTitle || "Должность не указана"}</p></td><td><span className={`badge ${readyChannels ? "badge-info" : "badge-warning"}`}>{readyChannels ? `${readyChannels} из 3` : "Нет доступных"}</span></td><td><span className={`badge ${statusTone[contact.status]}`}>{statusLabel[contact.status]}</span></td><td className="text-[11px] text-[var(--text-muted)]">{dateFormatter.format(new Date(contact.updatedAt))}</td><td><button type="button" onClick={() => setEditing(contact)} className="grid size-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]" aria-label={`Изменить ${contact.fullName}`}><Pencil aria-hidden="true" className="size-4" /></button></td></tr>;
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center"><Search aria-hidden="true" className="mx-auto size-7 text-[var(--text-subtle)]" /><p className="mt-3 text-[13px] font-semibold">Контакты не найдены</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Измените поиск или добавьте новый контакт.</p><button type="button" onClick={() => setEditing("new")} className="btn btn-primary mt-4">Добавить контакт</button></div>
        )}

        <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-3 text-[11px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between"><span>Найдено: {visible.length}</span>{selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[var(--text-strong)]">Выбрано: {selectedIds.length}</span><button type="button" onClick={() => void removeSelected()} disabled={busy} className="btn btn-danger btn-sm gap-2"><Trash2 aria-hidden="true" className="size-3.5" />Удалить</button><button type="button" onClick={() => setSelected(new Set())} className="btn btn-ghost btn-sm gap-2"><X aria-hidden="true" className="size-3.5" />Снять выбор</button></div>}</div>
      </section>

      {drawerContact && <ContactDrawer contact={drawerContact} timezone={timezone} onClose={() => setDrawerContact(null)} onEdit={(contact) => { setDrawerContact(null); setEditing(contact); }} />}
      {editing && <ContactFormDialog contact={editing === "new" ? null : editing} busy={busy} onClose={() => setEditing(null)} onSave={saveContact} />}
      {notice && <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-[12px] font-semibold shadow-[var(--shadow-floating)]"><span className="grid size-5 place-items-center rounded-full bg-[var(--success-subtle)] text-[var(--success)]"><Check aria-hidden="true" className="size-3" /></span>{notice}</div>}
    </div>
  );
}

export function ContactFormDialog({ contact, busy, onClose, onSave }: { contact: ContactRecord | null; busy: boolean; onClose: () => void; onSave: (draft: ContactDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<ContactDraft>(() => contact ? toDraft(contact) : emptyDraft);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  useDrawerAccessibility(panelRef, onClose);
  const update = <Key extends keyof ContactDraft>(key: Key, value: ContactDraft[Key]) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setError("Укажите имя и фамилию.");
      return;
    }
    if (!draft.email.trim() && !draft.telegramChatId?.trim() && !draft.vkUserId?.trim()) {
      setError("Укажите хотя бы один канал: адрес электронной почты, идентификатор чата Telegram или идентификатор пользователя ВКонтакте.");
      return;
    }
    try {
      await onSave(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить контакт");
    }
  };

  return (
    <div role="presentation" className="fixed inset-0 z-[90] flex items-center justify-center bg-[#171823]/35 p-3 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="contact-form-title" className="max-h-[calc(100vh-24px)] w-full max-w-[700px] overflow-y-auto rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-floating)]">
        <form onSubmit={submit}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-white/95 px-5 py-4 backdrop-blur-xl"><div><h2 id="contact-form-title" className="text-[16px] font-semibold">{contact ? "Изменить контакт" : "Новый контакт"}</h2><p className="mt-1 text-[11px] text-[var(--text-muted)]">Каналы используются только при наличии идентификатора и согласия.</p></div><button data-autofocus="true" type="button" disabled={busy} onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-subtle)]" aria-label="Закрыть"><X aria-hidden="true" className="size-5" /></button></div>
          <div className="space-y-6 p-5 sm:p-6">
            {error && <div role="alert" className="rounded-xl bg-[var(--danger-subtle)] p-3 text-[12px] text-[var(--danger)]">{error}</div>}
            <FormGroup title="Основные данные">
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Имя" required value={draft.firstName} onChange={(value) => update("firstName", value)} /><Field label="Фамилия" required value={draft.lastName} onChange={(value) => update("lastName", value)} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Email" type="email" value={draft.email} onChange={(value) => update("email", value)} placeholder="Можно оставить пустым для Telegram или ВКонтакте" /><Field label="Телефон" value={draft.phone ?? ""} onChange={(value) => update("phone", value)} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Компания" value={draft.companyName ?? ""} onChange={(value) => update("companyName", value)} /><Field label="Должность" value={draft.jobTitle ?? ""} onChange={(value) => update("jobTitle", value)} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Категория" value={draft.category ?? ""} onChange={(value) => update("category", value)} placeholder="Например, клиент или партнёр" /><label><span className="mb-1.5 block text-[12px] font-semibold">Вовлечённость</span><input type="number" min={0} max={100} required className="input" value={draft.engagementScore ?? 0} onChange={(event) => update("engagementScore", Number(event.target.value))} /><span className="mt-1 block text-[10px] text-[var(--text-subtle)]">Оценка от 0 до 100 для сегментации.</span></label></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Город" value={draft.city ?? ""} onChange={(value) => update("city", value)} /><Field label="Страна" value={draft.country ?? ""} onChange={(value) => update("country", value)} /></div>
              <label><span className="mb-1.5 block text-[12px] font-semibold">Статус</span><select className="input" value={draft.status} onChange={(event) => update("status", event.target.value as ContactRecord["status"])}><option value="active">Активен</option><option value="unsubscribed">Отписан</option><option value="bounced">Недоставляемый</option><option value="invalid">Некорректный адрес</option></select></label>
              <Field label="Теги через запятую" value={draft.tagsText} onChange={(value) => update("tagsText", value)} placeholder="Клиент, Москва, VIP" />
            </FormGroup>

            <FormGroup title="Каналы и согласия">
              <ChannelField Icon={Mail} label="Email" hint={draft.email || "Укажите email выше"}><Switch disabled={!draft.email.trim()} checked={Boolean(draft.email.trim() && draft.emailConsent)} onCheckedChange={(checked) => update("emailConsent", checked)} label="Есть согласие на email" /></ChannelField>
              <ChannelField Icon={SendHorizontal} label="Telegram" hint="Числовой идентификатор чата, полученный после диалога с ботом"><div className="flex items-center gap-3"><input className="input min-w-0 flex-1" value={draft.telegramChatId ?? ""} onChange={(event) => update("telegramChatId", event.target.value)} placeholder="Например, 123456789" /><Switch disabled={!draft.telegramChatId?.trim()} checked={Boolean(draft.telegramChatId?.trim() && draft.telegramConsent)} onCheckedChange={(checked) => update("telegramConsent", checked)} label="Есть согласие на Telegram" /></div></ChannelField>
              <ChannelField Icon={MessageCircle} label="ВКонтакте" hint="Идентификатор пользователя, которому сообщество может отправлять сообщения"><div className="flex items-center gap-3"><input className="input min-w-0 flex-1" value={draft.vkUserId ?? ""} onChange={(event) => update("vkUserId", event.target.value)} placeholder="Например, 987654321" /><Switch disabled={!draft.vkUserId?.trim()} checked={Boolean(draft.vkUserId?.trim() && draft.vkConsent)} onCheckedChange={(checked) => update("vkConsent", checked)} label="Есть согласие на ВКонтакте" /></div></ChannelField>
            </FormGroup>
          </div>
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--border)] bg-white/95 px-5 py-4 backdrop-blur-xl"><button type="button" disabled={busy} onClick={onClose} className="btn btn-secondary">Отмена</button><button type="submit" disabled={busy} className="btn btn-primary gap-2">{busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}{busy ? "Сохраняем" : "Сохранить контакт"}</button></div>
        </form>
      </section>
    </div>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="space-y-4"><legend className="mb-3 text-[13px] font-semibold">{title}</legend>{children}</fieldset>;
}

function Field({ label, value, onChange, placeholder, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: "text" | "email" }) {
  return <label><span className="mb-1.5 block text-[12px] font-semibold">{label}{required && <span className="text-[var(--danger)]"> *</span>}</span><input type={type} required={required} className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function ChannelField({ Icon, label, hint, children }: { Icon: typeof Mail; label: string; hint: string; children: ReactNode }) {
  return <div className="rounded-xl border border-[var(--border)] p-4"><div className="mb-3 flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)]"><Icon aria-hidden="true" className="size-4" /></span><div><p className="text-[12px] font-semibold">{label}</p><p className="mt-0.5 text-[10px] leading-4 text-[var(--text-subtle)]">{hint}</p></div></div>{children}</div>;
}
