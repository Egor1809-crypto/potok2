"use client";

import Link from "next/link";
import {
  Check,
  CircleAlert,
  Download,
  KeyRound,
  LoaderCircle,
  Mail,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { demoUser, workspaceConfig } from "@/config/brand";

type Section = "account" | "sending" | "data";

type WorkspaceForm = {
  name: string;
  companyName: string;
  timezone: string;
  defaultSenderName: string;
  defaultSenderEmail: string;
  replyToEmail: string;
  signature: string;
  requireConsent: boolean;
  notifyCampaignComplete: boolean;
  notifyBlockedCampaign: boolean;
};

type WorkspaceSnapshot = {
  workspace?: Partial<WorkspaceForm> & { id?: string };
  participant?: { name?: string; displayName?: string; email?: string };
};

const initialForm: WorkspaceForm = {
  name: workspaceConfig.name,
  companyName: "",
  timezone: workspaceConfig.timezone,
  defaultSenderName: demoUser.name,
  defaultSenderEmail: demoUser.email,
  replyToEmail: demoUser.email,
  signature: "",
  requireConsent: true,
  notifyCampaignComplete: true,
  notifyBlockedCampaign: true,
};

const sections: Array<{
  id: Section;
  label: string;
  description: string;
  Icon: typeof UserRound;
}> = [
  {
    id: "account",
    label: "Аккаунт",
    description: "Один участник с полным доступом",
    Icon: UserRound,
  },
  {
    id: "sending",
    label: "Отправка",
    description: "Отправитель и правила рассылок",
    Icon: Send,
  },
  {
    id: "data",
    label: "Данные и вход",
    description: "Экспорт и защита аккаунта",
    Icon: ShieldCheck,
  },
];

function unwrapSnapshot(payload: unknown): WorkspaceSnapshot {
  if (!payload || typeof payload !== "object") return {};
  const envelope = payload as { data?: unknown };
  const value = envelope.data && typeof envelope.data === "object" ? envelope.data : payload;
  return value as WorkspaceSnapshot;
}

function messageFrom(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as { error?: unknown; message?: unknown };
  if (typeof value.error === "string") return value.error;
  if (value.error && typeof value.error === "object" && "message" in value.error) {
    const nested = (value.error as { message?: unknown }).message;
    if (typeof nested === "string") return nested;
  }
  return typeof value.message === "string" ? value.message : fallback;
}

export function SettingsView() {
  const [section, setSection] = useState<Section>("account");
  const [form, setForm] = useState<WorkspaceForm>(initialForm);
  const [participant, setParticipant] = useState<{ name: string; email: string }>({ name: demoUser.name, email: demoUser.email });
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(payload, "Не удалось загрузить настройки"));
      const snapshot = unwrapSnapshot(payload);
      setForm((current) => ({ ...current, ...snapshot.workspace }));
      setParticipant((current) => ({
        name: snapshot.participant?.displayName ?? snapshot.participant?.name ?? current.name,
        email: snapshot.participant?.email ?? current.email,
      }));
      setState("idle");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить настройки");
      setState("error");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const update = <Key extends keyof WorkspaceForm>(key: Key, value: WorkspaceForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (state === "saved" || state === "error") setState("idle");
  };

  const save = async () => {
    setState("saving");
    setError("");
    try {
      const response = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(payload, "Не удалось сохранить настройки"));
      const snapshot = unwrapSnapshot(payload);
      if (snapshot.workspace) setForm((current) => ({ ...current, ...snapshot.workspace }));
      if (snapshot.participant) {
        setParticipant((current) => ({
          name: snapshot.participant?.displayName ?? snapshot.participant?.name ?? current.name,
          email: snapshot.participant?.email ?? current.email,
        }));
      }
      window.dispatchEvent(new CustomEvent("mailflow:workspace-updated", { detail: { name: snapshot.workspace?.name ?? form.name } }));
      setState("saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить настройки");
      setState("error");
    }
  };

  const exportData = async () => {
    setError("");
    try {
      const response = await fetch("/api/workspace?include=export", { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(messageFrom(payload, "Не удалось подготовить экспорт"));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mailflow-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось подготовить экспорт");
      setState("error");
    }
  };

  const current = useMemo(() => sections.find((item) => item.id === section) ?? sections[0], [section]);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <p className="section-eyebrow">Рабочее пространство</p>
        <h1 className="text-[28px] font-semibold tracking-[-.035em] text-[var(--text-strong)]">Аккаунт и настройки</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Здесь только настройки, которые влияют на работу рассылок. Команд, ролей и ограничений доступа нет.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,760px)]">
        <nav className="card h-fit p-2" aria-label="Разделы настроек">
          {sections.map(({ id, label, description, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${section === id ? "bg-[var(--primary-subtle)] text-[var(--primary)]" : "hover:bg-[var(--surface-subtle)]"}`}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="block text-[13px] font-semibold">{label}</span>
                <span className={`mt-0.5 block text-[11px] leading-4 ${section === id ? "text-[var(--primary)]/70" : "text-[var(--text-subtle)]"}`}>{description}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-[16px] font-semibold">{current.label}</h2>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{current.description}</p>
            </div>
            {section !== "data" && (
              <button type="button" onClick={() => void save()} disabled={state === "loading" || state === "saving"} className="btn btn-primary gap-2 self-start sm:self-auto">
                {state === "saving" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : state === "saved" ? <Check aria-hidden="true" className="size-4" /> : <Save aria-hidden="true" className="size-4" />}
                {state === "saving" ? "Сохраняем" : state === "saved" ? "Сохранено" : "Сохранить"}
              </button>
            )}
          </div>

          {state === "error" && error && (
            <div role="alert" className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-4 py-3 text-[12px] text-[var(--danger)] sm:mx-6">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">Повторить</button>
            </div>
          )}

          <div className="p-5 sm:p-6">
            {section === "account" && <AccountSection form={form} participant={participant} update={update} />}
            {section === "sending" && <SendingSection form={form} update={update} />}
            {section === "data" && <DataSection participantEmail={participant.email} onExport={() => void exportData()} />}
          </div>
        </section>
      </div>
    </div>
  );
}

type UpdateForm = <Key extends keyof WorkspaceForm>(key: Key, value: WorkspaceForm[Key]) => void;

function AccountSection({ form, participant, update }: { form: WorkspaceForm; participant: { name: string; email: string }; update: UpdateForm }) {
  return (
    <div className="space-y-7">
      <div className="rounded-2xl border border-[var(--primary)]/15 bg-[var(--primary-subtle)]/55 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[13px] font-semibold text-white">{participant.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{participant.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{participant.email}</p>
          </div>
          <span className="badge badge-accent">Участник · полный доступ</span>
        </div>
        <p className="mt-4 text-[12px] leading-5 text-[var(--text-muted)]">
          Это единственный аккаунт продукта. Вход защищает платформа, а внутри Поток нет ролей и приглашений.
        </p>
      </div>

      <FormBlock title="Рабочее пространство" description="Название видно в навигации и в выгрузке данных.">
        <Field label="Название пространства" value={form.name} onChange={(value) => update("name", value)} />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold">Часовой пояс</span>
          <select className="input" value={form.timezone} onChange={(event) => update("timezone", event.target.value)}>
            <option value="Europe/Moscow">Москва (UTC+3)</option>
            <option value="Europe/Saratov">Саратов (UTC+4)</option>
            <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
            <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
          </select>
        </label>
      </FormBlock>
    </div>
  );
}

function SendingSection({ form, update }: { form: WorkspaceForm; update: UpdateForm }) {
  return (
    <div className="space-y-7">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]/70 p-4">
        <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" />
        <div>
          <p className="text-[12px] font-semibold">Сначала подключите канал доставки</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">Кампания не запустится, пока выбранный провайдер не настроен и аудитория не прошла проверку.</p>
          <Link href="/integrations" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--primary)]">Открыть интеграции →</Link>
        </div>
      </div>

      <FormBlock title="Отправитель по умолчанию" description="Подставляется в новую email-кампанию, но его можно изменить перед запуском.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Имя отправителя" value={form.defaultSenderName} onChange={(value) => update("defaultSenderName", value)} />
          <Field label="Email отправителя" type="email" value={form.defaultSenderEmail} onChange={(value) => update("defaultSenderEmail", value)} />
        </div>
      </FormBlock>
      <div className="rounded-xl border border-[var(--success)]/15 bg-[var(--success-subtle)] p-4 text-[11px] leading-5 text-[var(--text-muted)]">
        Согласие на email, Telegram и ВКонтакте всегда проверяется отдельно перед переводом кампании в готовность.
      </div>
    </div>
  );
}

function DataSection({ participantEmail, onExport }: { participantEmail: string; onExport: () => void }) {
  return (
    <div className="space-y-6">
      <SettingRow Icon={KeyRound} title="Вход в аккаунт" copy={`Доступ подтверждает защищённая учётная запись ${participantEmail}. Пароли внутри Поток не хранятся.`}>
        <span className="badge badge-success">Защищён</span>
      </SettingRow>
      <SettingRow Icon={Download} title="Экспорт данных" copy="Скачать снимок контактов, сегментов, email-шаблонов, кампаний и настроек в формате JSON.">
        <button type="button" onClick={onExport} className="btn btn-secondary gap-2"><Download aria-hidden="true" className="size-4" />Скачать</button>
      </SettingRow>
      <div className="rounded-xl border border-[var(--border)] p-4">
        <div className="flex gap-3">
          <Settings2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" />
          <div>
            <p className="text-[12px] font-semibold">Что хранится</p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">Рабочие данные сохраняются в базе проекта. Черновое состояние формы может временно храниться в браузере до сохранения.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: "text" | "email" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold">{label}</span>
      <input type={type} className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function FormBlock({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function SettingRow({ Icon, title, copy, children }: { Icon: typeof ShieldCheck; title: string; copy: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)]"><Icon aria-hidden="true" className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">{copy}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
