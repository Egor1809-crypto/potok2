"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BRAND_NAME } from "@/config/brand";

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.055] bg-white/85 backdrop-blur-xl">
      <div className="container-shell flex h-[72px] items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5" aria-label={`${BRAND_NAME}: главная`}>
          <span className="grid size-8 place-items-center rounded-[9px] bg-[#625cf6] text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(98,92,246,.25)] transition-transform group-hover:-rotate-3">
            M
          </span>
          <span className="text-[15px] font-semibold tracking-[.12em] text-[#171825]">{BRAND_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-6 xl:flex" aria-label="Главная навигация">
          {[
            ["Продукт", "#product"],
            ["Решения", "#solutions"],
            ["Интеграции", "/integrations"],
            ["Шаблоны", "#templates"],
            ["Тарифы", "#pricing"],
          ].map(([label, href]) => (
            <a key={label} href={href} className="text-sm font-medium text-[#626474] transition-colors hover:text-[#171825]">
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <Link href="/login" className="btn btn-ghost">Войти</Link>
          <Link href="/register" className="btn btn-primary gap-2">Попробовать бесплатно <ArrowRight size={15} /></Link>
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-lg text-[#454754] xl:hidden"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-black/[0.06] bg-white px-5 py-5 xl:hidden">
          <nav className="mx-auto flex max-w-xl flex-col gap-1" aria-label="Мобильная навигация">
            {[
              ["Продукт", "#product"],
              ["Решения", "#solutions"],
              ["Интеграции", "/integrations"],
              ["Шаблоны", "#templates"],
              ["Тарифы", "#pricing"],
            ].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-[#454754] hover:bg-[#f4f5f8]">
                {label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/login" className="btn btn-secondary justify-center">Войти</Link>
              <Link href="/register" className="btn btn-primary justify-center">Начать бесплатно</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
