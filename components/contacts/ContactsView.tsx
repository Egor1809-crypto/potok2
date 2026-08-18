"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  LoaderCircle,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Phone,
  Search,
  SendHorizontal,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ImportWizard } from "@/components/imports/ImportWizard";
import { useDrawerAccessibility } from "@/components/shared/useDrawerAccessibility";
import { Switch } from "@/components/ui";
import type {
  ApiError,
  ContactCreateInput,
  ContactMutationResponse,
  ContactRecord,
  ContactListSummary,
  ContactOwnerSummary,
  ContactsListResponse,
  ParticipantRecord,
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
  marketingConsentSource: "",
  marketingConsentAt: null,
  marketingConsentText: "",
  serviceEmailAllowed: false,
  serviceEmailBasis: "",
  serviceEmailAllowedAt: null,
  telegramChatId: null,
  telegramConsent: false,
  vkUserId: null,
  vkConsent: false,
};

const emptySummary: ContactListSummary = {
  total: 0,
  active: 0,
  assigned: 0,
  primaryBase: 0,
  secondaryBase: 0,
  coverage: {
    email: { found: 0, ready: 0, serviceReady: 0 },
    telegram: { found: 0, ready: 0 },
    vk: { found: 0, ready: 0 },
    phone: { found: 0, ready: 0 },
  },
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
    marketingConsentSource: contact.marketingConsentSource,
    marketingConsentAt: contact.marketingConsentAt,
    marketingConsentText: contact.marketingConsentText,
    serviceEmailAllowed: contact.serviceEmailAllowed,
    serviceEmailBasis: contact.serviceEmailBasis,
    serviceEmailAllowedAt: contact.serviceEmailAllowedAt,
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

function personalTelegramHref(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/^(?:https?:\/\/)?t\.me\/([a-z][a-z0-9_]{4,31})\/?$/iu);
  const handleMatch = trimmed.match(/^@?([a-z][a-z0-9_]{4,31})$/iu);
  const handle = urlMatch?.[1] ?? handleMatch?.[1];
  return handle ? `https://t.me/${handle}` : null;
}

export function ContactsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [members, setMembers] = useState<ParticipantRecord[]>([]);
  const [summary, setSummary] = useState<ContactListSummary>(emptySummary);
  const [owners, setOwners] = useState<ContactOwnerSummary[]>([]);
  const [participantId, setParticipantId] = useState("");
  const [sheets, setSheets] = useState<Array<{ label: string; count: number }>>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [company, setCompany] = useState("all");
  const [city, setCity] = useState("all");
  const [team, setTeam] = useState("all");
  const [channel, setChannel] = useState("all");
  const [owner, setOwner] = useState("all");
  const [sheet, setSheet] = useState("all");
  const [teamName, setTeamName] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerContact, setDrawerContact] = useState<ContactRecord | null>(null);
  const [editing, setEditing] = useState<ContactRecord | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [timezone, setTimezone] = useState("Europe/Moscow");
  const metadataLoaded = useRef(false);
  const activeView = searchParams.get("view") === "import" ? "import" : "contacts";

  const setView = (view: "contacts" | "import") => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "import") params.set("view", "import");
    else {
      params.delete("view");
      metadataLoaded.current = false;
    }
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const load = useCallback(async (refreshMeta = false) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "100" });
      if (refreshMeta) metadataLoaded.current = false;
      if (metadataLoaded.current) params.set("meta", "0");
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (company !== "all") params.set("company", company);
      if (city !== "all") params.set("city", city);
      if (team !== "all") params.set("team", team);
      if (channel !== "all") params.set("channel", channel);
      if (owner !== "all") params.set("owner", owner);
      if (sheet !== "all") params.set("sheet", sheet);
      const response = await fetch(`/api/contacts?${params.toString()}`, { cache: "no-store" });
      const payload: ContactsListResponse | ApiError = await response.json();
      if (!response.ok || !("contacts" in payload)) throw new Error(messageFrom(payload, "Не удалось загрузить контакты"));
      setContacts(payload.contacts);
      setMembers(payload.members);
      setParticipantId(payload.participantId);
      setTimezone(payload.timezone);
      if (payload.summary && payload.facets) {
        setSummary(payload.summary);
        setSheets(payload.facets.sheets);
        setCompanies(payload.facets.companies);
        setCities(payload.facets.cities);
        setTeams(payload.facets.teams);
        setOwners(payload.facets.owners);
        metadataLoaded.current = true;
      }
      setFilteredCount(payload.filteredCount);
      setTotalPages(payload.totalPages);
      if (payload.page !== page) setPage(payload.page);
      setSelected(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить контакты");
    } finally {
      setLoading(false);
    }
  }, [channel, city, company, debouncedSearch, owner, page, sheet, status, team]);

  useEffect(() => {
    if (activeView !== "contacts") return;
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, load]);

  const visible = contacts;

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
  const activeCount = summary.active;
  const primaryBaseCount = summary.primaryBase;
  const secondaryBaseCount = summary.secondaryBase;
  const assignedCount = summary.assigned;
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const coverage = [
    { id: "email", label: "База №1 · Email", ...summary.coverage.email, Icon: Mail, color: "#F43CB8" },
    { id: "telegram", label: "База №2 · Telegram", ...summary.coverage.telegram, Icon: SendHorizontal, color: "#229ED9" },
    { id: "vk", label: "База №3 · ВКонтакте", ...summary.coverage.vk, Icon: MessageCircle, color: "#0077FF" },
    { id: "phone", label: "База №4 · Телефоны", ...summary.coverage.phone, Icon: Phone, color: "#16E7EE" },
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
      setDrawerContact(payload.contact);
      setEditing(null);
      await load(true);
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
      await load(true);
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

  const assignTeam = async () => {
    const normalized = teamName.trim().replace(/^команда\s*:\s*/i, "");
    if (!selectedIds.length || !normalized) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, addTags: [`Команда: ${normalized}`] }) });
      const payload = await response.json() as { contacts?: ContactRecord[]; updatedCount?: number } | ApiError;
      if (!response.ok || !("contacts" in payload) || !payload.contacts) throw new Error(messageFrom(payload, "Не удалось добавить контакты в команду"));
      const updated = new Map(payload.contacts.map((contact) => [contact.id, contact]));
      setTeamName("");
      await load(true);
      notify(`В команду «${normalized}» добавлено: ${updated.size}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось добавить контакты в команду");
    } finally { setBusy(false); }
  };

  const assignResponsible = async () => {
    if (!selectedIds.length || !responsibleId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, responsibleParticipantId: responsibleId }) });
      const payload = await response.json() as { contacts?: ContactRecord[]; updatedCount?: number } | ApiError;
      if (!response.ok || !("contacts" in payload) || !payload.contacts) throw new Error(messageFrom(payload, "Не удалось назначить ответственного"));
      const updated = new Map(payload.contacts.map((contact) => [contact.id, contact]));
      const member = members.find((item) => item.id === responsibleId);
      await load(true);
      notify(`Ответственный «${member?.displayName ?? "участник"}» назначен: ${updated.size}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось назначить ответственного");
    } finally { setBusy(false); }
  };

  const markContacted = async (contact: ContactRecord) => {
    setBusy(true);
    try {
      const response = await fetch("/api/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [contact.id], markContacted: true }) });
      const payload = await response.json() as { contacts?: ContactRecord[] } | ApiError;
      if (!response.ok || !("contacts" in payload)) throw new Error(messageFrom(payload, "Не удалось отметить отправку"));
      await load(true);
      notify(`Отправка для «${contact.fullName}» учтена`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отметить отправку");
    } finally { setBusy(false); }
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
        "Согласие на рекламный Email",
        "Источник рекламного согласия",
        "Дата рекламного согласия",
        "Формулировка рекламного согласия",
        "Разрешены сервисные Email",
        "Основание сервисного сообщения",
        "Дата сервисного основания",
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
        contact.marketingConsentSource,
        contact.marketingConsentAt ?? "",
        contact.marketingConsentText,
        contact.serviceEmailAllowed ? "да" : "нет",
        contact.serviceEmailBasis,
        contact.serviceEmailAllowedAt ?? "",
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-[var(--text-muted)]">{loading && summary.total === 0 ? "Загружаем базу…" : `${summary.total.toLocaleString("ru-RU")} контактов · ${activeCount.toLocaleString("ru-RU")} активных`}</p>
            <a href="https://tech-pravo.ru/" target="_blank" rel="noreferrer" aria-label="ТехнологИИ Права — открыть сайт" className="group inline-flex items-center gap-2 rounded-full border border-[#16E7EE]/20 bg-[#10141d] px-3 py-1.5 text-[11px] font-semibold tracking-[-.02em] shadow-[0_6px_16px_rgba(16,20,29,.12)] transition hover:-translate-y-px hover:border-[#F43CB8]/55 hover:shadow-[0_10px_20px_rgba(16,20,29,.18)]">
              <span className="whitespace-nowrap"><span className="font-extrabold text-[#16E7EE]">Технолог</span><span className="font-extrabold text-[#F43CB8]">ИИ</span><span className="font-extrabold text-[#16E7EE]"> Права</span></span>
              <span aria-hidden="true" className="text-[#8d9aa7] transition group-hover:translate-x-0.5 group-hover:text-[#16E7EE]">↗</span>
            </a>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setView("import")} className="btn btn-secondary gap-2"><Upload aria-hidden="true" className="size-4" />Импорт таблицы</button>
          <button type="button" onClick={() => setEditing("new")} className="btn btn-secondary gap-2"><Plus aria-hidden="true" className="size-4" />Добавить контакт</button>
          <Link href={campaignHref(selectedIds)} className="btn btn-primary gap-2"><SendHorizontal aria-hidden="true" className="size-4" />{selectedIds.length ? `Кампания · ${selectedIds.length}` : "Новая кампания"}</Link>
        </div>
      </header>

      <nav aria-label="Режим работы с контактами" className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1">
        <button type="button" onClick={() => setView("contacts")} aria-pressed={activeView === "contacts"} className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition ${activeView === "contacts" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"}`}>База команды</button>
        <button type="button" onClick={() => setView("import")} aria-pressed={activeView === "import"} className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition ${activeView === "import" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"}`}>Импорт таблицы</button>
      </nav>

      {activeView === "import" ? (
        <section className="card p-4 sm:p-6">
          <div className="mb-5 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-[12px] leading-5 text-[var(--text-muted)]">
            Импорт работает внутри общей базы: после проверки вы увидите, какие строки добавлены, обновлены или требуют внимания. Исходный файл остаётся у вас, а новые контакты автоматически помечаются цветом текущего участника.
          </div>
          <ImportWizard />
        </section>
      ) : <>

      {sheets.length > 0 && (
        <section className="card overflow-hidden" aria-labelledby="contact-sheets-title">
          <div className="flex flex-col gap-1 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <h2 id="contact-sheets-title" className="text-[13px] font-semibold">Листы баз</h2>
            <p className="text-[10px] text-[var(--text-muted)]">Каждая загруженная таблица сохраняется отдельным листом. Контакт остаётся в общей базе и может входить в кампании.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-5">
            <button type="button" onClick={() => { setPage(1); setSheet("all"); }} aria-pressed={sheet === "all"} className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${sheet === "all" ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--text-muted)] hover:border-[var(--primary)]/35"}`}>Все контакты · {summary.total.toLocaleString("ru-RU")}</button>
            {sheets.map((item) => <button key={item.label} type="button" onClick={() => { setPage(1); setSheet(item.label); }} aria-pressed={sheet === item.label} className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${sheet === item.label ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--text-muted)] hover:border-[var(--primary)]/35"}`}>{item.label.replace(/^Импорт: /, "")} · {item.count.toLocaleString("ru-RU")}</button>)}
          </div>
        </section>
      )}

      {(primaryBaseCount > 0 || secondaryBaseCount > 0) && <section className="flex flex-col gap-3 rounded-2xl border border-[#16E7EE]/20 bg-[linear-gradient(105deg,#101118_0%,#142430_64%,#16121D_100%)] px-4 py-3 text-white shadow-[0_12px_28px_rgba(10,17,29,.12)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#16E7EE]"><UsersRound aria-hidden="true" className="size-4" /></span>
          <div><p className="text-[12px] font-bold">База команды подключена</p><p className="mt-0.5 text-[10px] text-white/70">{primaryBaseCount > 0 ? `База №1: ${primaryBaseCount} контактов Telegram` : ""}{primaryBaseCount > 0 && secondaryBaseCount > 0 ? " · " : ""}{secondaryBaseCount > 0 ? `База №2: ${secondaryBaseCount} компания` : ""}</p></div>
        </div>
        <p className="text-[10px] font-medium text-[#A9F9FC]">{assignedCount} закреплены за участниками — цветная линия слева показывает ответственного</p>
      </section>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Четыре канальные базы">
        {coverage.map(({ id, label, found, ready, Icon, color }) => (
          <button type="button" key={id} onClick={() => { setPage(1); setChannel(channel === id ? "all" : id); }} aria-pressed={channel === id} className={`card flex items-center gap-3 p-4 text-left transition hover:-translate-y-px hover:shadow-sm ${channel === id ? "ring-2 ring-[var(--primary)]/45" : ""}`}><span className="grid size-9 place-items-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}><Icon aria-hidden="true" className="size-4" /></span><div><p className="text-[12px] font-semibold">{label}</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Уникальных контактов: {found.toLocaleString("ru-RU")}{id === "email" ? ` · доступно для отправки: ${ready.toLocaleString("ru-RU")} · сервисные: ${summary.coverage.email.serviceReady.toLocaleString("ru-RU")}` : id !== "phone" ? ` · разрешено: ${ready.toLocaleString("ru-RU")}` : ""}</p></div></button>
        ))}
      </section>
      <p className="-mt-3 text-[10px] text-[var(--text-muted)]">Это четыре представления одной объединённой базы: контакт не дублируется, даже если у него несколько каналов.</p>

      {owners.length > 0 && (
        <section className="card overflow-hidden" aria-labelledby="owner-statistics-title">
          <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <h2 id="owner-statistics-title" className="text-[13px] font-semibold">Контакты по ответственным</h2>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Точное количество контактов и доступных каналов у каждого участника. Нажмите карточку, чтобы отфильтровать базу.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {owners.map((item) => {
              const isCurrent = item.participantId === participantId;
              return (
                <button key={item.participantId} type="button" onClick={() => { setPage(1); setOwner(item.participantId); }} className={`rounded-xl border p-3 text-left transition hover:-translate-y-px hover:shadow-sm ${isCurrent ? "border-[var(--primary)]/45 bg-[var(--primary)]/[.04]" : "border-[var(--border)] bg-white"}`}>
                  <span className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} /><b className="text-[12px]">{item.displayName}</b>{isCurrent && <span className="badge badge-primary ml-auto">Вы</span>}</span>
                  <span className="mt-2 grid grid-cols-5 gap-1 text-center text-[9px] text-[var(--text-muted)]">
                    <span><b className="block text-[12px] text-[var(--text-strong)]">{item.total.toLocaleString("ru-RU")}</b>Всего</span>
                    <span><b className="block text-[12px] text-[var(--text-strong)]">{item.email.toLocaleString("ru-RU")}</b>Email</span>
                    <span><b className="block text-[12px] text-[var(--text-strong)]">{item.telegram.toLocaleString("ru-RU")}</b>TG</span>
                    <span><b className="block text-[12px] text-[var(--text-strong)]">{item.vk.toLocaleString("ru-RU")}</b>VK</span>
                    <span><b className="block text-[12px] text-[var(--text-strong)]">{item.phone.toLocaleString("ru-RU")}</b>Тел.</span>
                  </span>
                  <span className="mt-2 block text-[9px] text-[var(--text-muted)]">Email: доступно {item.readyEmail.toLocaleString("ru-RU")} · сервисные {item.serviceEmail.toLocaleString("ru-RU")} · Telegram {item.readyTelegram.toLocaleString("ru-RU")}</span>
                  <span className="mt-1 block text-[9px] font-semibold text-[var(--success)]">Уже обработано: {item.sent.toLocaleString("ru-RU")}</span>
                  {item.sheets.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{item.sheets.map((entry) => <span key={entry.label} className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-1 text-[8px] text-[var(--text-muted)]">{entry.label.replace(/^Импорт: /, "")} · {entry.count.toLocaleString("ru-RU")}</span>)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-subtle)] p-4 text-[12px] text-[var(--danger)]"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">Повторить</button></div>}

      <section className="card overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--border)] p-3 lg:grid-cols-[minmax(220px,1fr)_repeat(6,minmax(125px,175px))_auto]">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Поиск контактов</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" /><input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, email, компания или тег" /></label>
          <label><span className="sr-only">Фильтр по статусу</span><select className="input" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as StatusFilter); }}><option value="all">Все статусы</option><option value="active">Активные</option><option value="unsubscribed">Отписанные</option><option value="bounced">Недоставляемые</option><option value="invalid">Некорректные</option></select></label>
          <label><span className="sr-only">Фильтр по компании</span><select className="input" value={company} onChange={(event) => { setPage(1); setCompany(event.target.value); }}><option value="all">Все компании</option>{companies.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Фильтр по городу</span><select className="input" value={city} onChange={(event) => { setPage(1); setCity(event.target.value); }}><option value="all">Все города</option>{cities.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Фильтр по команде</span><select className="input" value={team} onChange={(event) => { setPage(1); setTeam(event.target.value); }}><option value="all">Все команды</option>{teams.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Фильтр по каналу</span><select className="input" value={channel} onChange={(event) => { setPage(1); setChannel(event.target.value); }}><option value="all">Все каналы</option><option value="email">Есть Email</option><option value="telegram">Есть Telegram</option><option value="vk">Есть ВКонтакте</option><option value="phone">Есть телефон</option></select></label>
          <label><span className="sr-only">Фильтр по ответственному</span><select className="input" value={owner} onChange={(event) => { setPage(1); setOwner(event.target.value); }}><option value="all">Все ответственные</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label>
          <button type="button" onClick={exportCsv} disabled={!selectedIds.length && !visible.length} className="btn btn-secondary gap-2"><Download aria-hidden="true" className="size-4" />Экспорт</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-subtle)]/65 px-3 py-2.5">
          <button type="button" onClick={toggleAll} disabled={!visible.length} className="btn btn-secondary btn-sm gap-2"><Check aria-hidden="true" className="size-3.5" />{allVisibleSelected ? "Снять выбор страницы" : `Выбрать страницу · ${visible.length}`}</button>
          {(company !== "all" || city !== "all" || team !== "all" || channel !== "all" || owner !== "all" || sheet !== "all" || status !== "all" || search) ? <button type="button" onClick={() => { setPage(1); setSearch(""); setStatus("all"); setCompany("all"); setCity("all"); setTeam("all"); setChannel("all"); setOwner("all"); setSheet("all"); }} className="btn btn-ghost btn-sm">Сбросить фильтры</button> : null}
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">Показано до 100 контактов — браузер больше не загружает всю базу сразу</span>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center"><LoaderCircle aria-hidden="true" className="size-6 animate-spin text-[var(--primary)]" /><span className="sr-only">Загрузка контактов</span></div>
        ) : visible.length ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[980px]">
              <thead><tr><th className="w-12"><button type="button" onClick={toggleAll} aria-label="Выбрать контакты на странице" className={`grid size-4 place-items-center rounded border ${allVisibleSelected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white"}`}>{allVisibleSelected && <Check aria-hidden="true" className="size-3" />}</button></th><th>Контакт</th><th>Компания</th><th>Источники</th><th>Отправка</th><th>Статус</th><th>Обновлён</th><th className="w-24"><span className="sr-only">Действия</span></th></tr></thead>
              <tbody>{visible.map((contact) => {
                const checked = selected.has(contact.id);
                const creator = contact.createdByParticipantId ? membersById.get(contact.createdByParticipantId) : undefined;
                const responsible = membersById.get(contact.responsibleParticipantId ?? contact.createdByParticipantId ?? "");
                const primaryEndpoint = contact.email || contact.phone || (contact.telegramChatId ? `Telegram: ${contact.telegramChatId}` : contact.vkUserId ? `ВК: ${contact.vkUserId}` : "Канал не указан");
                const telegramHref = personalTelegramHref(contact.telegramChatId);
                return <tr key={contact.id} data-selected={checked} style={{ boxShadow: `inset 4px 0 0 ${responsible?.color ?? creator?.color ?? "#CBD5E1"}` }}>
                  <td><button type="button" onClick={() => setSelected((current) => { const next = new Set(current); if (next.has(contact.id)) next.delete(contact.id); else next.add(contact.id); return next; })} aria-label={`Выбрать ${contact.fullName}`} className={`grid size-4 place-items-center rounded border ${checked ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white"}`}>{checked && <Check aria-hidden="true" className="size-3" />}</button></td>
                  <td><button type="button" onClick={() => setDrawerContact(contact)} className="flex items-center gap-3 text-left"><span className="grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: responsible?.color ?? creator?.color ?? contact.avatarColor }}>{contact.firstName[0]}{contact.lastName[0]}</span><span><span className="block text-[12px] font-semibold hover:text-[var(--primary)]">{contact.fullName}</span><span className="mt-0.5 block text-[10px] text-[var(--text-subtle)]">{primaryEndpoint}</span>{responsible && <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold" style={{ color: responsible.color }}><i className="size-1.5 rounded-full" style={{ backgroundColor: responsible.color }} />Ответственный: {responsible.displayName}</span>}</span></button></td>
                  <td><p className="text-[11px] font-medium">{contact.companyName || "—"}</p><p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">{contact.jobTitle || "Должность не указана"}</p></td>
                  <td><div className="flex max-w-44 flex-wrap gap-1">{contact.email && <SourcePill label="Email" color="#F43CB8" ready={Boolean(contact.emailConsent && contact.marketingConsentSource && contact.marketingConsentAt && contact.marketingConsentText)} />}{contact.telegramChatId && <SourcePill label="TG" color="#229ED9" ready={contact.telegramConsent} />}{contact.vkUserId && <SourcePill label="VK" color="#0077FF" ready={contact.vkConsent} />}{contact.phone && <SourcePill label="Телефон" color="#0E7490" />}</div></td>
                  <td>{contact.lastContactedAt ? <span className="badge badge-success">✓ Отправлено</span> : telegramHref ? <span className="flex flex-wrap gap-1"><a href={telegramHref} target="_blank" rel="noreferrer" className="badge badge-primary">Открыть TG</a><button type="button" disabled={busy} onClick={() => void markContacted(contact)} className="badge badge-neutral">Отметить</button></span> : <span className="badge badge-neutral">Не отправляли</span>}</td>
                  <td><span className={`badge ${statusTone[contact.status]}`}>{statusLabel[contact.status]}</span></td>
                  <td className="text-[11px] text-[var(--text-muted)]">{dateFormatter.format(new Date(contact.updatedAt))}</td>
                  <td><div className="flex"><Link href={campaignHref([contact.id])} className="grid size-8 place-items-center rounded-lg text-[var(--primary)] hover:bg-[var(--primary-subtle)]" aria-label={`Написать ${contact.fullName}`}><SendHorizontal aria-hidden="true" className="size-4" /></Link><button type="button" onClick={() => setEditing(contact)} className="grid size-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]" aria-label={`Изменить ${contact.fullName}`}><Pencil aria-hidden="true" className="size-4" /></button></div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center"><Search aria-hidden="true" className="mx-auto size-7 text-[var(--text-subtle)]" /><p className="mt-3 text-[13px] font-semibold">Контакты не найдены</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Измените поиск или добавьте новый контакт.</p><button type="button" onClick={() => setEditing("new")} className="btn btn-primary mt-4">Добавить контакт</button></div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 text-[11px] text-[var(--text-muted)] xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap items-center gap-3"><span>Найдено: {filteredCount.toLocaleString("ru-RU")}</span><div className="inline-flex items-center gap-1"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1} className="btn btn-secondary btn-sm" aria-label="Предыдущая страница"><ChevronLeft aria-hidden="true" className="size-3.5" /></button><span className="min-w-28 text-center">Страница {page} из {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={loading || page >= totalPages} className="btn btn-secondary btn-sm" aria-label="Следующая страница"><ChevronRight aria-hidden="true" className="size-3.5" /></button></div></div>{selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[var(--text-strong)]">Выбрано: {selectedIds.length}</span><div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white p-1"><select value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)} className="h-7 max-w-44 border-0 bg-transparent px-1 text-[11px] outline-none"><option value="">Назначить ответственного</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select><button type="button" onClick={() => void assignResponsible()} disabled={busy || !responsibleId} className="btn btn-primary btn-sm">Назначить</button></div><div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white p-1"><UsersRound aria-hidden="true" className="ml-1 size-3.5 text-[var(--primary)]" /><input value={teamName} onChange={(event) => setTeamName(event.target.value)} className="h-7 w-36 border-0 bg-transparent px-1 text-[11px] outline-none" placeholder="Название команды" /><button type="button" onClick={() => void assignTeam()} disabled={busy || !teamName.trim()} className="btn btn-primary btn-sm">Добавить</button></div><button type="button" onClick={() => void removeSelected()} disabled={busy} className="btn btn-danger btn-sm gap-2"><Trash2 aria-hidden="true" className="size-3.5" />Удалить</button><button type="button" onClick={() => setSelected(new Set())} className="btn btn-ghost btn-sm gap-2"><X aria-hidden="true" className="size-3.5" />Снять выбор</button></div>}</div>
      </section>

      {drawerContact && <ContactDrawer contact={drawerContact} timezone={timezone} onClose={() => setDrawerContact(null)} onEdit={(contact) => { setDrawerContact(null); setEditing(contact); }} />}
      {editing && <ContactFormDialog contact={editing === "new" ? null : editing} busy={busy} onClose={() => setEditing(null)} onSave={saveContact} />}
      </>}
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

            <FormGroup title="Каналы и основания отправки">
              <ChannelField Icon={Mail} label="Рекламная email-рассылка" hint="Только предварительное доказуемое согласие адресата">
                <div className="space-y-3"><Switch disabled={!draft.email.trim()} checked={Boolean(draft.email.trim() && draft.emailConsent)} onCheckedChange={(checked) => update("emailConsent", checked)} label="Согласие на рекламу подтверждено" />
                {draft.emailConsent && <><Field label="Источник согласия" required value={draft.marketingConsentSource ?? ""} onChange={(value) => update("marketingConsentSource", value)} placeholder="Форма сайта, договор, регистрация на мероприятие" /><Field label="Дата и время согласия" required type="datetime-local" value={draft.marketingConsentAt?.slice(0, 16) ?? ""} onChange={(value) => update("marketingConsentAt", value ? new Date(value).toISOString() : null)} /><label><span className="mb-1.5 block text-[12px] font-semibold">Сохранённая формулировка согласия *</span><textarea required className="input min-h-24 py-2" value={draft.marketingConsentText ?? ""} onChange={(event) => update("marketingConsentText", event.target.value)} placeholder="Точный текст, который видел и подтвердил адресат" /></label></>}
                </div>
              </ChannelField>
              <ChannelField Icon={Mail} label="Сервисные email-сообщения" hint="Чек, билет, статус заказа или аккаунта; без рекламных предложений">
                <div className="space-y-3"><Switch disabled={!draft.email.trim()} checked={Boolean(draft.email.trim() && draft.serviceEmailAllowed)} onCheckedChange={(checked) => update("serviceEmailAllowed", checked)} label="Есть документируемое основание" />
                {draft.serviceEmailAllowed && <><Field label="Основание" required value={draft.serviceEmailBasis ?? ""} onChange={(value) => update("serviceEmailBasis", value)} placeholder="Покупка №…, регистрация, обращение в поддержку" /><Field label="Дата основания" required type="datetime-local" value={draft.serviceEmailAllowedAt?.slice(0, 16) ?? ""} onChange={(value) => update("serviceEmailAllowedAt", value ? new Date(value).toISOString() : null)} /></>}
                </div>
              </ChannelField>
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

function SourcePill({ label, color, ready }: { label: string; color: string; ready?: boolean }) {
  return <span title={ready === undefined ? "Контакт найден" : ready ? "Контакт найден, отправка разрешена" : "Контакт найден, согласие на отправку не подтверждено"} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold" style={{ borderColor: `${color}45`, backgroundColor: `${color}12`, color }}><i className="size-1.5 rounded-full" style={{ backgroundColor: color }} />{label}{ready ? " ✓" : ""}</span>;
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="space-y-4"><legend className="mb-3 text-[13px] font-semibold">{title}</legend>{children}</fieldset>;
}

function Field({ label, value, onChange, placeholder, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: "text" | "email" | "datetime-local" }) {
  return <label><span className="mb-1.5 block text-[12px] font-semibold">{label}{required && <span className="text-[var(--danger)]"> *</span>}</span><input type={type} required={required} className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function ChannelField({ Icon, label, hint, children }: { Icon: typeof Mail; label: string; hint: string; children: ReactNode }) {
  return <div className="rounded-xl border border-[var(--border)] p-4"><div className="mb-3 flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)]"><Icon aria-hidden="true" className="size-4" /></span><div><p className="text-[12px] font-semibold">{label}</p><p className="mt-0.5 text-[10px] leading-4 text-[var(--text-subtle)]">{hint}</p></div></div>{children}</div>;
}
