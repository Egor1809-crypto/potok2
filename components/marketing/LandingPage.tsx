import { ArrowRight, Check, Play } from "lucide-react";
import Link from "next/link";
import { FeatureShowcase } from "./FeatureShowcase";
import { MarketingHeader } from "./MarketingHeader";
import { ProductPreview } from "./ProductPreview";
import { BRAND_NAME } from "@/config/brand";

const footerGroups = [
  {
    title: "Product",
    links: [
      ["Contacts", "/contacts"],
      ["Campaigns", "/campaigns"],
      ["Email builder", "/email-builder"],
      ["Analytics", "/analytics"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/#product"],
      ["Customers", "/#solutions"],
      ["Security", "/settings"],
      ["Careers", "/register"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Templates", "/templates"],
      ["Guides", "/#product"],
      ["Help center", "/settings"],
      ["Status", "/dashboard"],
    ],
  },
] as const;

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#181923]">
      <MarketingHeader />
      <section className="relative pb-20 pt-36 sm:pb-28 sm:pt-44">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(107,99,255,.10),transparent_68%)]" />
        <div className="container-shell relative text-center">
          <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-[#deddf8] bg-[#f7f6ff] px-3 py-1.5 text-[11px] font-semibold text-[#5c56d7] shadow-sm">
            <span className="size-1.5 rounded-full bg-[#6b64f7] shadow-[0_0_0_3px_rgba(107,100,247,.14)]" />
            A calmer way to run outreach
          </div>
          <h1 className="mx-auto max-w-[930px] text-[clamp(3.4rem,8.2vw,7.3rem)] font-medium leading-[.91] tracking-[-.065em] text-[#181923]">
            Email outreach.<br /><span className="text-[#625cf6]">Finally organized.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-[650px] text-[17px] leading-7 text-[#686a78] sm:text-[19px] sm:leading-8">
            Manage contacts, build personalized emails and launch targeted campaigns from one beautifully organized workspace.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn btn-primary min-h-12 w-full justify-center gap-2 px-5 text-[14px] sm:w-auto">Start for free <ArrowRight size={16} /></Link>
            <Link href="/dashboard" className="btn btn-secondary min-h-12 w-full justify-center gap-2 px-5 text-[14px] sm:w-auto"><Play size={14} fill="currentColor" /> View product</Link>
          </div>
          <p className="mt-4 text-[11px] text-[#9a9ca8]">No credit card required · Ready in two minutes</p>
        </div>
        <ProductPreview />
      </section>

      <section className="border-y border-[#ececf1] bg-[#fbfbfc] py-10">
        <div className="container-shell">
          <p className="text-center text-[11px] font-medium uppercase tracking-[.14em] text-[#9698a5]">Built for teams that communicate at scale</p>
          <div className="mt-7 grid grid-cols-2 items-center gap-x-8 gap-y-7 text-center sm:grid-cols-3 lg:grid-cols-6">
            {[["NORTHSTAR","Legal"],["BRIGHTWELL","Partners"],["PRISM","Advisory"],["ARCHELON","Group"],["KESTREL","Events"],["KINDEL","Bridge"]].map(([name, suffix])=><div key={name} className="text-[12px] font-semibold tracking-[.08em] text-[#7d7f8b]">{name}<span className="ml-1 font-normal text-[#aaa]">{suffix}</span></div>)}
          </div>
        </div>
      </section>

      <FeatureShowcase />

      <section id="pricing" className="px-4 py-20 sm:py-28">
        <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[28px] bg-[#20212c] px-6 py-16 text-center text-white sm:px-12 sm:py-24">
          <div className="absolute -left-20 -top-44 size-[420px] rounded-full bg-[#746df8]/25 blur-3xl" />
          <div className="absolute -bottom-48 -right-10 size-[420px] rounded-full bg-[#3d9ce8]/15 blur-3xl" />
          <div className="relative">
            <p className="section-eyebrow !text-[#a9a5ff]">One connected workspace</p>
            <h2 className="mx-auto mt-5 max-w-3xl text-[clamp(2.4rem,5vw,4.8rem)] font-medium leading-[1] tracking-[-.055em]">Turn your contact database into conversations.</h2>
            <p className="mx-auto mt-6 max-w-lg text-[15px] leading-7 text-[#b7b8c2]">Start with the people you already know. {BRAND_NAME} helps your team reach them with more context and less friction.</p>
            <Link href="/register" className="mt-9 inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-white px-5 text-[14px] font-semibold text-[#242530] shadow-lg transition-transform hover:-translate-y-0.5">Start building <ArrowRight size={16} /></Link>
            <div className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-[#b7b8c2]">{["Free demo workspace","All product areas","Realistic sample data"].map(item=><span key={item} className="flex items-center gap-1.5"><Check size={12} className="text-[#a9a5ff]" />{item}</span>)}</div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e9eaf0] bg-[#fbfbfc]">
        <div className="container-shell grid gap-10 py-12 sm:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div><Link href="/" className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-[9px] bg-[#625cf6] text-[13px] font-semibold text-white">M</span><span className="text-[14px] font-semibold tracking-[.12em]">{BRAND_NAME}</span></Link><p className="mt-4 max-w-xs text-[12px] leading-5 text-[#858793]">One organized workspace for contacts, campaigns and every conversation in between.</p></div>
          {footerGroups.map(group=><div key={group.title}><p className="text-[11px] font-semibold text-[#393a46]">{group.title}</p><div className="mt-4 space-y-3">{group.links.map(([label,href])=><Link key={label} href={href} className="block text-[12px] text-[#858793] hover:text-[#4d4f5c]">{label}</Link>)}</div></div>)}
        </div>
        <div className="container-shell flex flex-col gap-3 border-t border-[#e9eaf0] py-5 text-[10px] text-[#9698a5] sm:flex-row sm:items-center sm:justify-between"><span>© 2026 {BRAND_NAME}. Demo workspace.</span><div className="flex gap-5"><Link href="/#product">Privacy</Link><Link href="/#product">Terms</Link><Link href="/#product">Cookies</Link></div></div>
      </footer>
    </main>
  );
}
