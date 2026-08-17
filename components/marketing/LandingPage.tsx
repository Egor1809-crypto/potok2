import { ArrowRight, Check, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FeatureShowcase } from "./FeatureShowcase";
import { MarketingHeader } from "./MarketingHeader";
import { ProductPreview } from "./ProductPreview";
import { BRAND_NAME, brandConfig } from "@/config/brand";

const footerGroups = [
  {
    title: "Продукт",
    links: [
      ["Контакты", "/contacts"],
      ["Кампании", "/campaigns"],
      ["Каналы и интеграции", "/integrations"],
      ["Аналитика", "/analytics"],
    ],
  },
  {
    title: "Инструменты",
    links: [
      ["Аудитории", "/segments"],
      ["Импорт контактов", "/import"],
      ["Шаблоны писем", "/templates"],
      ["Настройки", "/settings"],
    ],
  },
  {
    title: "Начало работы",
    links: [
      ["Возможности", "#product"],
      ["Новая кампания", "/campaigns/new"],
      ["Войти", "/login"],
      ["Открыть аккаунт", "/register"],
    ],
  },
] as const;

export function LandingPage() {
  return (
    <main className="mailflow-marketing min-h-screen overflow-hidden bg-background text-text-strong">
      <MarketingHeader />
      <section className="relative overflow-hidden bg-[#11111b] pb-16 pt-32 text-white sm:pb-24 sm:pt-40">
        <div className="container-shell relative grid items-center gap-12 lg:grid-cols-[.92fr_1.08fr]">
          <div className="relative z-10"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#bba6ff]">Поток · платформа деловой коммуникации</p><h1 className="mt-6 max-w-xl text-[clamp(3.2rem,6vw,6.1rem)] font-medium leading-[.92] tracking-[-.065em]">Письма, которые <span className="text-[#9b72ff]">ведут к действию.</span></h1><p className="mt-7 max-w-lg text-[17px] leading-8 text-white/65">Соберите письмо, выберите аудиторию и запустите рассылку в одном рабочем пространстве — с контролем каждого шага команды.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/register" className="btn min-h-12 bg-[#8a4cff] px-6 text-white hover:bg-[#9b64ff]">Открыть рабочее пространство <ArrowRight size={16}/></Link><Link href="/login" className="btn min-h-12 border-white/20 bg-white/5 px-6 text-white hover:bg-white/10"><Play size={13} fill="currentColor"/> Войти</Link></div><div className="mt-11 grid max-w-md grid-cols-3 border-t border-white/12 pt-5 text-[11px] text-white/50"><span>Письма и шаблоны</span><span>Единая база</span><span>Контроль отправок</span></div></div>
          <div className="relative"><div className="absolute -inset-8 rounded-full bg-[#7544ff]/25 blur-3xl"/><Image src="/landing/potok-executive-hero.png" alt="Рабочее пространство Поток для подготовки деловых писем" width={1536} height={1024} priority className="relative rounded-[28px] border border-white/15 shadow-2xl"/></div>
        </div>
      </section>

      <section className="border-y border-border bg-surface-subtle/55 py-10">
        <div className="container-shell">
          <p className="text-center text-[11px] font-medium uppercase tracking-[.14em] text-[#9698a5]">Для специалистов, которые работают с большой аудиторией</p>
          <div className="mt-7 grid grid-cols-2 items-center gap-x-8 gap-y-7 text-center sm:grid-cols-3 lg:grid-cols-6">
            {[["АРБИТРА","Право"],["ВЕКТОР","Партнёры"],["ПРИЗМА","Консалтинг"],["СЕВЕР","Группа"],["МАЯК","События"],["МОСТ","Практика"]].map(([name, suffix])=><div key={name} className="text-[12px] font-semibold tracking-[.08em] text-[#7d7f8b]">{name}<span className="ml-1 font-normal text-[#aaa]">{suffix}</span></div>)}
          </div>
        </div>
      </section>

      <FeatureShowcase />

      <section id="start" className="px-4 py-20 sm:py-28">
        <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[28px] bg-[#20212c] px-6 py-16 text-center text-white sm:px-12 sm:py-24">
          <div className="absolute -left-20 -top-44 size-[420px] rounded-full bg-[#746df8]/25 blur-3xl" />
          <div className="absolute -bottom-48 -right-10 size-[420px] rounded-full bg-[#3d9ce8]/15 blur-3xl" />
          <div className="relative">
            <p className="section-eyebrow !text-[#a9a5ff]">Всё в одном пространстве</p>
            <h2 className="mx-auto mt-5 max-w-3xl text-[clamp(2.4rem,5vw,4.8rem)] font-medium leading-[1] tracking-[-.055em]">Превращайте базу контактов в живые диалоги.</h2>
            <p className="mx-auto mt-6 max-w-lg text-[15px] leading-7 text-[#b7b8c2]">Начните с тех, кого уже знаете. {BRAND_NAME} даст вам нужный контекст и уберёт лишние шаги.</p>
            <Link href="/register" className="mt-9 inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-white px-5 text-[14px] font-semibold text-[#242530] shadow-lg transition-transform hover:-translate-y-0.5">Начать работу <ArrowRight size={16} /></Link>
            <div className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-[#b7b8c2]">{["Общая база команды","Цвет автора у контакта","Одинаковый полный доступ"].map(item=><span key={item} className="flex items-center gap-1.5"><Check size={12} className="text-[#a9a5ff]" />{item}</span>)}</div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface-subtle/55">
        <div className="container-shell grid gap-10 py-12 sm:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div><Link href="/" className="flex items-center gap-2.5"><Image src={brandConfig.logoPath} alt="" width={32} height={32} className="size-8 rounded-[9px] object-cover" /><span className="text-[14px] font-semibold tracking-[.12em]">{BRAND_NAME}</span></Link><p className="mt-4 max-w-xs text-[12px] leading-5 text-text-muted">Единое пространство для контактов, кампаний и всех диалогов между ними.</p></div>
          {footerGroups.map(group=><div key={group.title}><p className="text-[11px] font-semibold text-[#393a46]">{group.title}</p><div className="mt-4 space-y-3">{group.links.map(([label,href])=><Link key={label} href={href} className="block text-[12px] text-[#858793] hover:text-[#4d4f5c]">{label}</Link>)}</div></div>)}
        </div>
        <div className="container-shell flex flex-col gap-3 border-t border-[#e9eaf0] py-5 text-[10px] text-[#9698a5] sm:flex-row sm:items-center sm:justify-between"><span>© 2026 {BRAND_NAME}.</span><span>Контакты, согласия и кампании — в одном рабочем пространстве.</span></div>
      </footer>
    </main>
  );
}
