import { ArrowRight, Check, Play } from "lucide-react";
import Link from "next/link";
import { FeatureShowcase } from "./FeatureShowcase";
import { MarketingHeader } from "./MarketingHeader";
import { ProductPreview } from "./ProductPreview";
import { BRAND_NAME } from "@/config/brand";

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
      ["Обзор", "/dashboard"],
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
      <section className="relative pb-20 pt-36 sm:pb-28 sm:pt-44">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(124,53,242,.12),transparent_68%)]" />
        <div className="container-shell relative text-center">
          <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-border bg-primary-subtle px-3 py-1.5 text-[11px] font-semibold text-primary shadow-sm">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_0_3px_rgba(124,53,242,.14)]" />
            Спокойный порядок в каждой коммуникации
          </div>
          <h1 className="mx-auto max-w-[930px] text-[clamp(3.4rem,8.2vw,7.3rem)] font-medium leading-[.91] tracking-[-.065em] text-text-strong">
            Деловые рассылки.<br /><span className="text-primary">Во всех нужных каналах.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-[650px] text-[17px] leading-7 text-[#686a78] sm:text-[19px] sm:leading-8">
            Храните контакты и запускайте персональные кампании по email, в Telegram и ВКонтакте — через VK WorkSpace и подключённые сервисы.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn btn-primary min-h-12 w-full justify-center gap-2 px-5 text-[14px] sm:w-auto">Начать работу <ArrowRight size={16} /></Link>
            <Link href="/dashboard" className="btn btn-secondary min-h-12 w-full justify-center gap-2 px-5 text-[14px] sm:w-auto"><Play size={14} fill="currentColor" /> Посмотреть платформу</Link>
          </div>
          <p className="mt-4 text-[11px] text-[#9a9ca8]">Один участник · Полный доступ ко всем функциям</p>
        </div>
        <ProductPreview />
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
            <div className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-[#b7b8c2]">{["Единое рабочее пространство","Все разделы платформы","Один участник с полным доступом"].map(item=><span key={item} className="flex items-center gap-1.5"><Check size={12} className="text-[#a9a5ff]" />{item}</span>)}</div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface-subtle/55">
        <div className="container-shell grid gap-10 py-12 sm:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div><Link href="/" className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-[9px] bg-primary text-[13px] font-semibold text-white">M</span><span className="text-[14px] font-semibold tracking-[.12em]">{BRAND_NAME}</span></Link><p className="mt-4 max-w-xs text-[12px] leading-5 text-text-muted">Единое пространство для контактов, кампаний и всех диалогов между ними.</p></div>
          {footerGroups.map(group=><div key={group.title}><p className="text-[11px] font-semibold text-[#393a46]">{group.title}</p><div className="mt-4 space-y-3">{group.links.map(([label,href])=><Link key={label} href={href} className="block text-[12px] text-[#858793] hover:text-[#4d4f5c]">{label}</Link>)}</div></div>)}
        </div>
        <div className="container-shell flex flex-col gap-3 border-t border-[#e9eaf0] py-5 text-[10px] text-[#9698a5] sm:flex-row sm:items-center sm:justify-between"><span>© 2026 {BRAND_NAME}.</span><span>Контакты, согласия и кампании — в одном рабочем пространстве.</span></div>
      </footer>
    </main>
  );
}
