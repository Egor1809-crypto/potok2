"use client";

import { Switch } from "@/components/ui";
import { BRAND_NAME, workspaceConfig } from "@/config/brand";
import {
  BadgeCheck,
  BellRing,
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  Globe2,
  KeyRound,
  Mail,
  Palette,
  Plug,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

type Section =
  | "Workspace"
  | "Members"
  | "Sending domains"
  | "Email senders"
  | "Brand kit"
  | "Integrations"
  | "Billing"
  | "Security";

const sections: {
  id: Section;
  label: string;
  Icon: typeof Building2;
}[] = [
  { id: "Workspace", label: "Рабочее пространство", Icon: Building2 },
  { id: "Members", label: "Участники", Icon: UsersRound },
  { id: "Sending domains", label: "Домены отправки", Icon: Globe2 },
  { id: "Email senders", label: "Отправители", Icon: Mail },
  { id: "Brand kit", label: "Фирменный стиль", Icon: Palette },
  { id: "Integrations", label: "Интеграции", Icon: Plug },
  { id: "Billing", label: "Тариф и оплата", Icon: CreditCard },
  { id: "Security", label: "Безопасность", Icon: ShieldCheck },
];

const sectionTitles = Object.fromEntries(
  sections.map(({ id, label }) => [id, label]),
) as Record<Section, string>;

const descriptions: Record<Section, string> = {
  Workspace: "Основные сведения и параметры рабочего пространства.",
  Members: "Приглашайте коллег и управляйте доступом.",
  "Sending domains": "Настройте домены для надёжной доставки писем.",
  "Email senders": "Управляйте именами и адресами отправителей команды.",
  "Brand kit": "Поддерживайте единый визуальный стиль всех писем.",
  Integrations: `Подключите ${BRAND_NAME} к инструментам вашей команды.`,
  Billing: "Тариф, использование и платёжные данные.",
  Security: "Аутентификация и защита рабочего пространства.",
};

export function SettingsView() {
  const [section, setSection] = useState<Section>("Workspace");
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  const save = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    setSaved(true);
    saveTimerRef.current = window.setTimeout(() => {
      setSaved(false);
      saveTimerRef.current = null;
    }, 2200);
  };

  const canSave = section === "Workspace" || section === "Brand kit";

  return (
    <div className="space-y-6">
      <div>
        <p className="section-eyebrow">Администрирование</p>
        <h1 className="mt-2 text-[28px] font-medium tracking-[-.04em]">
          Настройки
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          Управляйте рабочим пространством, отправителями и командой.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="card h-fit p-2" aria-label="Разделы настроек">
          {sections.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[10px] font-semibold transition-colors ${
                section === id
                  ? "bg-[#eeedff] text-[#5b55d8]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              }`}
            >
              <Icon size={14} />
              <span className="flex-1">{label}</span>
              {section === id && <ChevronRight size={12} />}
            </button>
          ))}
        </nav>

        <section className="card min-h-[640px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-[15px] font-semibold">
                {sectionTitles[section]}
              </h2>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                {descriptions[section]}
              </p>
            </div>
            {canSave && (
              <button onClick={save} className="btn btn-primary gap-2">
                {saved ? <Check size={14} /> : <Save size={14} />}
                {saved ? "Сохранено" : "Сохранить изменения"}
              </button>
            )}
          </div>
          <div className="p-5 sm:p-6">
            <SettingsContent section={section} />
          </div>
        </section>
      </div>

      {saved && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-[10px] font-semibold shadow-[var(--shadow-floating)]"
        >
          <span className="grid size-5 place-items-center rounded-full bg-[#e9f7ef] text-[#3e8d5b]">
            <Check size={12} />
          </span>
          Настройки сохранены
        </div>
      )}
    </div>
  );
}

function SettingsContent({ section }: { section: Section }) {
  if (section === "Workspace") {
    return (
      <div className="max-w-[620px] space-y-7">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-[#625cf6] text-xl font-semibold text-white">
            ЮК
          </span>
          <div>
            <button className="btn btn-secondary gap-2">
              <Upload size={13} />
              Изменить логотип
            </button>
            <p className="mt-2 text-[9px] text-[var(--text-tertiary)]">
              PNG, JPG или SVG · до 2 МБ
            </p>
          </div>
        </div>

        <FormSection title="Сведения о рабочем пространстве">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Название" value="Юридическая команда" />
            <Field
              label="Адрес рабочего пространства"
              value="mailflow.work/legal-team"
            />
          </div>
          <Field label="Название компании" value="Northstar Legal Group" />
          <Field label="Сайт" value="https://northstar.legal" />
        </FormSection>

        <FormSection title="Региональные настройки">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Часовой пояс" value="Москва (UTC+3)" />
            <Field label="Язык по умолчанию" value="Русский" />
          </div>
        </FormSection>
      </div>
    );
  }

  if (section === "Brand kit") {
    return (
      <div className="max-w-[720px] space-y-7">
        <div className="grid gap-5 sm:grid-cols-[1fr_190px]">
          <FormSection title="Элементы фирменного стиля">
            <Field label="Название компании" value="Northstar Legal" />
            <Field label="Сайт" value="northstar.legal" />
            <div>
              <p className="mb-2 text-[10px] font-semibold">Фирменные цвета</p>
              <div className="flex gap-2">
                {["#242530", "#625CF6", "#FFFFFF", "#F3F4F8"].map(
                  (color) => (
                    <button
                      key={color}
                      aria-label={`Фирменный цвет ${color}`}
                      className="size-9 rounded-lg border border-[var(--border)] shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ),
                )}
                <button
                  aria-label="Добавить фирменный цвет"
                  className="grid size-9 place-items-center rounded-lg border border-dashed border-[var(--border-strong)] text-[var(--text-tertiary)]"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <Field label="Фирменный шрифт" value="Geist" />
          </FormSection>

          <div className="rounded-2xl bg-[var(--surface-subtle)] p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[var(--text-tertiary)]">
              Предпросмотр логотипа
            </p>
            <div className="mt-4 grid aspect-square place-items-center rounded-xl bg-white shadow-sm">
              <div className="text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#242530] text-sm font-semibold text-white">
                  N
                </span>
                <p className="mt-3 text-[9px] font-semibold tracking-[.14em]">
                  NORTHSTAR
                </p>
                <p className="text-[7px] tracking-[.12em] text-[#625cf6]">
                  LEGAL
                </p>
              </div>
            </div>
          </div>
        </div>

        <FormSection title="Подпись в письмах по умолчанию">
          <textarea
            className="input min-h-28 w-full resize-y py-3 text-[10px] leading-5"
            defaultValue={
              "Northstar Legal Group\nул. Тверская, 18, Москва, 125009\nВы получили это письмо, потому что сотрудничаете с нашей командой."
            }
          />
        </FormSection>
      </div>
    );
  }

  if (section === "Members") {
    const members = [
      ["Егор Сабалин", "egor@northstar.legal", "Администратор", "ЕС", "#625cf6"],
      ["Алина Волкова", "alina@northstar.legal", "Редактор", "АВ", "#2f8a79"],
      ["Елена Морозова", "elena@northstar.legal", "Редактор", "ЕМ", "#d97757"],
      ["Павел Романов", "pavel@northstar.legal", "Наблюдатель", "ПР", "#3b82c4"],
    ] as const;

    return (
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold">
              Участники рабочего пространства
            </h3>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
              Использовано 4 из 10 мест
            </p>
          </div>
          <button className="btn btn-primary gap-2">
            <UserPlus size={13} />
            Пригласить участника
          </button>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)]">
          {members.map(([name, email, role, initials, color]) => (
            <div
              key={email}
              className="flex items-center gap-3 border-b border-[var(--border)] p-4 last:border-0"
            >
              <span
                className="grid size-9 place-items-center rounded-full text-[9px] font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold">{name}</p>
                <p className="mt-0.5 truncate text-[8px] text-[var(--text-tertiary)]">
                  {email}
                </p>
              </div>
              <span className="badge badge-neutral">{role}</span>
              <button
                className="text-[var(--text-tertiary)]"
                aria-label={`Удалить участника ${name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Sending domains") {
    const domains = [
      ["northstar.legal", "Проверен", "success", "Все записи настроены"],
      ["events.northstar.legal", "Ожидает", "warning", "Отсутствует запись DKIM"],
    ] as const;

    return (
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold">
              Аутентифицированные домены
            </h3>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
              SPF, DKIM и DMARC защищают репутацию отправителя.
            </p>
          </div>
          <button className="btn btn-primary gap-2">
            <Plus size={13} />
            Добавить домен
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {domains.map(([domain, status, tone, description]) => (
            <div
              key={domain}
              className="flex items-center gap-4 rounded-xl border border-[var(--border)] p-4"
            >
              <span
                className={`grid size-10 place-items-center rounded-xl ${
                  tone === "success"
                    ? "bg-[#e9f7ef] text-[#3e8d5b]"
                    : "bg-[#fff5df] text-[#a9640a]"
                }`}
              >
                <Globe2 size={17} />
              </span>
              <div className="flex-1">
                <p className="text-[11px] font-semibold">{domain}</p>
                <p className="mt-1 text-[9px] text-[var(--text-tertiary)]">
                  {description}
                </p>
              </div>
              <span className={`badge badge-${tone}`}>
                {tone === "success" && <Check size={9} />}
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Email senders") {
    const senders = [
      ["Егор Сабалин", "egor@northstar.legal", "Основной отправитель"],
      ["Нортстар Ивентс", "events@northstar.legal", "Отправитель кампаний"],
      ["Отдел по работе с партнёрами", "partners@northstar.legal", "Отправитель кампаний"],
    ] as const;

    return (
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Проверенные отправители</h3>
          <button className="btn btn-primary gap-2">
            <Plus size={13} />
            Добавить отправителя
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {senders.map(([name, email], index) => (
            <div
              key={email}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-4"
            >
              <span className="grid size-9 place-items-center rounded-full bg-[#eeedff] text-[9px] font-semibold text-[#625cf6]">
                {name
                  .split(" ")
                  .map((value) => value[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div className="flex-1">
                <p className="text-[10px] font-semibold">{name}</p>
                <p className="text-[8px] text-[var(--text-tertiary)]">{email}</p>
              </div>
              <span className="badge badge-success">
                <BadgeCheck size={9} />
                {index === 0 ? "По умолчанию" : "Проверен"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Integrations") {
    const integrations = [
      ["Google Таблицы", "Синхронизация контактов из общих таблиц", "G", "#2f9d59", true],
      ["Salesforce", "Синхронизация контактов и активности", "S", "#2493d1", false],
      ["HubSpot", "Синхронизация записей CRM и ответственных", "H", "#ef7a45", false],
      ["Zapier", "Подключение к тысячам сервисов", "Z", "#ff6b35", true],
    ] as const;

    return (
      <div>
        <h3 className="text-[13px] font-semibold">Доступные интеграции</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {integrations.map(([name, description, initial, color, connected]) => (
            <div
              key={name}
              className="rounded-xl border border-[var(--border)] p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid size-9 place-items-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {initial}
                </span>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold">{name}</p>
                  <p className="text-[9px] text-[var(--text-tertiary)]">
                    {description}
                  </p>
                </div>
              </div>
              <button
                className={`btn mt-4 w-full ${
                  connected ? "btn-secondary" : "btn-primary"
                }`}
              >
                {connected ? "Управлять" : "Подключить"}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Billing") {
    return (
      <div>
        <div className="rounded-2xl bg-[#242530] p-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="badge !border-white/10 !bg-white/10 !text-white">
                Тариф «{workspaceConfig.plan}»
              </span>
              <p className="mt-4 text-[28px] font-semibold tracking-[-.04em]">
                149 $ {" "}
                <span className="text-[12px] font-normal text-white/50">
                  / мес.
                </span>
              </p>
              <p className="mt-2 text-[10px] text-white/55">
                До 50 000 контактов и 250 000 писем в месяц.
              </p>
            </div>
            <button className="btn bg-white text-[#242530]">
              Управление тарифом
            </button>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[49%] rounded-full bg-[#817bf4]" />
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-white/50">
            <span>24 821 из 50 000 контактов</span>
            <span>49%</span>
          </div>
        </div>

        <FormSection title="Способ оплаты">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-4">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--surface-subtle)]">
              <CreditCard size={17} />
            </span>
            <div className="flex-1">
              <p className="text-[10px] font-semibold">Visa •••• 4242</p>
              <p className="text-[8px] text-[var(--text-tertiary)]">
                Действует до 08/29
              </p>
            </div>
            <button className="btn btn-secondary">Обновить</button>
          </div>
        </FormSection>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] space-y-6">
      <FormSection title="Аутентификация">
        <SettingRow
          Icon={KeyRound}
          title="Двухфакторная аутентификация"
          copy="Запрашивать второй фактор при входе."
          action={<button className="btn btn-secondary">Настроить</button>}
        />
        <SettingRow
          Icon={ShieldCheck}
          title="Единый вход"
          copy="Подключите провайдера удостоверений по протоколу SAML."
          action={<button className="btn btn-secondary">Настроить SSO</button>}
        />
      </FormSection>
      <FormSection title="Управление сеансами">
        <SettingRow
          Icon={BellRing}
          title="Уведомления о входе"
          copy="Сообщать администраторам о входе с нового устройства."
          action={
            <Switch defaultChecked label="Включить уведомления о входе" />
          }
        />
        <SettingRow
          Icon={KeyRound}
          title="Продолжительность сеанса"
          copy="Автоматически завершать сеанс через 30 дней."
          action={<button className="btn btn-secondary">30 дней</button>}
        />
      </FormSection>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold">{label}</span>
      <input
        className="input h-10 w-full text-[11px]"
        defaultValue={value}
      />
    </label>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-[12px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function SettingRow({
  Icon,
  title,
  copy,
  action,
}: {
  Icon: typeof KeyRound;
  title: string;
  copy: string;
  action: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] p-4">
      <span className="grid size-9 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
        <Icon size={15} />
      </span>
      <div className="flex-1">
        <p className="text-[10px] font-semibold">{title}</p>
        <p className="mt-1 text-[8px] text-[var(--text-tertiary)]">{copy}</p>
      </div>
      {action}
    </div>
  );
}
