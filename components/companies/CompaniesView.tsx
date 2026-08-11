"use client";

import { useDrawerAccessibility } from "@/components/shared/useDrawerAccessibility";
import { companies } from "@/data/mockCompanies";
import { contacts } from "@/data/mockContacts";
import type { Company } from "@/types";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Globe2,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

function formatCompanySize(size: Company["size"]): string {
  return size.replace(",", " ");
}

export function CompaniesView() {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const visible = useMemo(
    () =>
      companies.filter((item) =>
        `${item.name} ${item.industry} ${item.location}`
          .toLocaleLowerCase("ru-RU")
          .includes(search.toLocaleLowerCase("ru-RU")),
      ),
    [search],
  );

  const metrics = [
    { Icon: Building2, value: companies.length, label: "Компании" },
    { Icon: UsersRound, value: 24_821, label: "Связанные контакты" },
    { Icon: Globe2, value: 8, label: "Отрасли" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">Организации</p>
          <h1 className="mt-2 text-[28px] font-medium tracking-[-.04em]">
            Компании
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            10 организаций, связанных с вашими контактами
          </p>
        </div>
        <button className="btn btn-primary w-fit gap-2">
          <Plus size={14} />
          Добавить компанию
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ Icon, value, label }) => (
          <article key={label} className="card flex items-center gap-4 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-[#f0efff] text-[#625cf6]">
              <Icon size={18} />
            </span>
            <div>
              <p className="text-[21px] font-semibold tracking-[-.035em]">
                {numberFormatter.format(value)}
              </p>
              <p className="text-[9px] text-[var(--text-tertiary)]">{label}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Поиск компаний</span>
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input h-9 w-full pl-9 text-[11px]"
              placeholder="Поиск компаний"
            />
          </label>
          <button className="btn btn-secondary gap-2">
            Отрасль <ChevronDown size={12} />
          </button>
          <button className="btn btn-secondary gap-2">
            Регион <ChevronDown size={12} />
          </button>
          <button
            className="btn btn-ghost px-2"
            aria-label="Дополнительные фильтры компаний"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="bg-[var(--surface-subtle)] text-[9px] font-semibold uppercase tracking-[.07em] text-[var(--text-tertiary)]">
                <th className="px-5 py-3">Компания</th>
                <th className="px-4 py-3">Отрасль</th>
                <th className="px-4 py-3">Контакты</th>
                <th className="px-4 py-3">Регион</th>
                <th className="px-4 py-3">Ответственный</th>
                <th className="px-4 py-3">Последняя активность</th>
                <th className="w-10">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                >
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => setCompany(item)}
                      className="flex items-center gap-3 text-left"
                    >
                      <span
                        className="grid size-9 place-items-center rounded-xl text-[10px] font-semibold text-white"
                        style={{ backgroundColor: item.brandColor }}
                      >
                        {item.initials}
                      </span>
                      <span>
                        <span className="block text-[10px] font-semibold hover:text-[#625cf6]">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-[8px] text-[var(--text-tertiary)]">
                          {item.domain}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-[10px] text-[var(--text-secondary)]">
                    {item.industry}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="badge badge-info">
                      {numberFormatter.format(item.contactsCount)} чел.
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[10px] text-[var(--text-secondary)]">
                    {item.location}
                  </td>
                  <td className="px-4 py-3.5 text-[10px]">{item.owner}</td>
                  <td className="px-4 py-3.5 text-[9px] text-[var(--text-tertiary)]">
                    {shortDateFormatter.format(new Date(item.lastActivityAt))}
                  </td>
                  <td>
                    <button aria-label={`Действия для компании ${item.name}`}>
                      <MoreHorizontal
                        size={15}
                        className="text-[var(--text-tertiary)]"
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {company && (
        <CompanyDrawer company={company} onClose={() => setCompany(null)} />
      )}
    </div>
  );
}

function CompanyDrawer({
  company,
  onClose,
}: {
  company: Company;
  onClose: () => void;
}) {
  const linked = contacts
    .filter((contact) => contact.companyId === company.id)
    .slice(0, 5);
  const panelRef = useRef<HTMLElement>(null);
  useDrawerAccessibility(panelRef, onClose);

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-[#171823]/25 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${company.name}: профиль компании`}
        className="h-full w-full max-w-[540px] overflow-y-auto border-l border-[var(--border)] bg-white shadow-[-22px_0_60px_rgba(30,31,46,.16)]"
      >
        <div className="sticky top-0 z-10 flex justify-between border-b border-[var(--border)] bg-white/90 px-5 py-3 backdrop-blur-xl">
          <span className="text-[10px] text-[var(--text-tertiary)]">
            Профиль компании
          </span>
          <button
            data-autofocus="true"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface-subtle)]"
            aria-label="Закрыть профиль компании"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex gap-4">
            <span
              className="grid size-14 place-items-center rounded-2xl text-[16px] font-semibold text-white"
              style={{ backgroundColor: company.brandColor }}
            >
              {company.initials}
            </span>
            <div>
              <h2 className="text-[22px] font-semibold tracking-[-.035em]">
                {company.name}
              </h2>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                {company.industry} · {formatCompanySize(company.size)} сотрудников
              </p>
              <span className="badge badge-success mt-2 inline-flex">
                Активная компания
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <a
              href={company.website}
              className="btn btn-secondary justify-center gap-2"
            >
              <Globe2 size={13} />
              Сайт
            </a>
            <a
              href={`/campaigns/new?company=${company.id}`}
              className="btn btn-primary justify-center gap-2"
            >
              Создать кампанию
              <ArrowRight size={13} />
            </a>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
              <p className="text-[9px] text-[var(--text-tertiary)]">Контакты</p>
              <p className="mt-1 text-[21px] font-semibold">
                {numberFormatter.format(company.contactsCount)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
              <p className="text-[9px] text-[var(--text-tertiary)]">Регион</p>
              <p className="mt-1 text-[11px] font-semibold">
                {company.location}
              </p>
            </div>
          </div>

          <section className="mt-7">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold">
                Контакты компании «{company.name}»
              </h3>
              <button className="text-[10px] font-semibold text-[#625cf6]">
                Показать все
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
              {linked.length ? (
                linked.map((contact) => (
                  <a
                    key={contact.id}
                    href={`/contacts/${contact.id}`}
                    className="flex items-center gap-3 border-b border-[var(--border)] p-3 last:border-0 hover:bg-[var(--surface-subtle)]"
                  >
                    <span
                      className="grid size-8 place-items-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: contact.avatarColor }}
                    >
                      {contact.firstName[0]}
                      {contact.lastName[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold">
                        {contact.fullName}
                      </span>
                      <span className="mt-0.5 block truncate text-[8px] text-[var(--text-tertiary)]">
                        {contact.role}
                      </span>
                    </span>
                    <ArrowRight
                      size={13}
                      className="text-[var(--text-tertiary)]"
                    />
                  </a>
                ))
              ) : (
                <div className="p-7 text-center">
                  <MapPin
                    size={18}
                    className="mx-auto text-[var(--text-tertiary)]"
                  />
                  <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">
                    Нет связанных демонстрационных контактов
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
