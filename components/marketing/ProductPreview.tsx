import {
  BarChart3,
  Check,
  ChevronDown,
  ContactRound,
  LayoutDashboard,
  Mail,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { BRAND_NAME } from "@/config/brand";

const rows = [
  { name: "Sofia Reynolds", initials: "SR", email: "sofia@northstar.legal", company: "Northstar Legal", role: "Managing Partner", tag: "VIP", tone: "bg-[#eeeaff] text-[#5c55d8]" },
  { name: "Mikhail Orlov", initials: "MO", email: "m.orlov@orlovpartners.ru", company: "Orlov & Partners", role: "Senior Counsel", tag: "Moscow", tone: "bg-[#e8f6ff] text-[#2672a8]" },
  { name: "Elena Vetrova", initials: "EV", email: "elena@prismadvisory.eu", company: "Prism Advisory", role: "Partner", tag: "Conference", tone: "bg-[#e9f8ef] text-[#2e7c4b]" },
  { name: "Daniel Kim", initials: "DK", email: "daniel@kindelbridge.com", company: "Kindelbridge", role: "Legal Director", tag: "Warm", tone: "bg-[#fff5dc] text-[#936817]" },
  { name: "Amelia Rhodes", initials: "AR", email: "amelia@arcfield.co", company: "Arcfield Group", role: "General Counsel", tag: "Partner", tone: "bg-[#f4ecff] text-[#7c4bb3]" },
];

export function ProductPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-[1180px] px-3 sm:px-6 lg:px-0">
      <div className="absolute inset-x-[8%] -top-10 h-64 rounded-full bg-[#756dff]/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[22px] border border-[#dfe1e9] bg-[#f8f9fb] p-2 shadow-[0_35px_90px_rgba(31,32,52,.16),0_3px_12px_rgba(31,32,52,.07)] sm:p-3">
        <div className="overflow-hidden rounded-[16px] border border-[#e4e5eb] bg-white">
          <div className="flex h-11 items-center gap-1.5 border-b border-[#ececf1] bg-[#fbfbfc] px-4">
            <span className="size-2.5 rounded-full bg-[#ffb8ad]" />
            <span className="size-2.5 rounded-full bg-[#ffe08a]" />
            <span className="size-2.5 rounded-full bg-[#a8e7b9]" />
            <div className="mx-auto hidden h-6 w-64 items-center justify-center rounded-md border border-[#e7e7ec] bg-white text-[10px] text-[#a0a2af] sm:flex">app.mailflow.work/contacts</div>
          </div>

          <div className="flex h-[548px] sm:h-[580px]">
            <aside className="hidden w-[188px] shrink-0 border-r border-[#ececf1] bg-[#fbfbfc] p-3.5 md:block">
              <div className="mb-5 flex items-center gap-2 px-1">
                <span className="grid size-6 place-items-center rounded-[7px] bg-[#625cf6] text-[10px] font-bold text-white">M</span>
                <span className="text-[11px] font-semibold tracking-[.12em]">{BRAND_NAME}</span>
              </div>
              <button className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#e5e5eb] bg-white px-2.5 py-2 text-left text-[10px] font-medium text-[#353744] shadow-sm">
                Legal Team <ChevronDown size={12} />
              </button>
              <div className="space-y-0.5">
                {[
                  [LayoutDashboard, "Overview", false],
                  [ContactRound, "Contacts", true],
                  [UsersRound, "Companies", false],
                  [Sparkles, "Segments", false],
                  [Mail, "Campaigns", false],
                  [BarChart3, "Analytics", false],
                ].map(([Icon, label, active]) => {
                  const NavIcon = Icon as typeof LayoutDashboard;
                  return (
                    <div key={label as string} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-medium ${active ? "bg-[#eeedff] text-[#5851dc]" : "text-[#787a88]"}`}>
                      <NavIcon size={13} strokeWidth={1.8} /> {label as string}
                    </div>
                  );
                })}
              </div>
              <div className="mt-[255px] flex items-center gap-2 border-t border-[#ececf1] px-1 pt-3">
                <span className="grid size-7 place-items-center rounded-full bg-[#e9e6ff] text-[9px] font-semibold text-[#625cf6]">ES</span>
                <div><p className="text-[10px] font-semibold">Egor S.</p><p className="text-[8px] text-[#9a9ca8]">Workspace admin</p></div>
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              <div className="flex h-14 items-center justify-between border-b border-[#ececf1] px-4 sm:px-6">
                <span className="text-xs font-semibold text-[#262734]">Contacts</span>
                <div className="flex items-center gap-2">
                  <div className="hidden items-center gap-2 rounded-lg border border-[#e4e5eb] px-2.5 py-1.5 text-[9px] text-[#9698a5] sm:flex"><Search size={12} /> Search <kbd className="ml-5 rounded bg-[#f2f2f5] px-1 py-0.5">⌘ K</kbd></div>
                  <span className="grid size-7 place-items-center rounded-full bg-[#20212d] text-[8px] font-semibold text-white">ES</span>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <div className="flex items-end justify-between">
                  <div><p className="text-[9px] font-medium uppercase tracking-[.14em] text-[#9b9da9]">People</p><h3 className="mt-1 text-xl font-semibold tracking-[-.025em] text-[#20212c] sm:text-2xl">Contacts</h3><p className="mt-1 text-[10px] text-[#8b8d99]">24,821 people across your workspace</p></div>
                  <button className="rounded-lg bg-[#625cf6] px-3 py-2 text-[9px] font-semibold text-white shadow-[0_5px_12px_rgba(98,92,246,.24)]">+ Add contact</button>
                </div>
                <div className="mt-5 flex items-center justify-between border-b border-[#ececf1]">
                  <div className="flex gap-4 text-[9px]"><span className="border-b-2 border-[#625cf6] pb-2.5 font-semibold text-[#343641]">All contacts</span><span className="pb-2.5 text-[#9294a0]">Partners</span><span className="hidden pb-2.5 text-[#9294a0] sm:inline">Lawyers</span><span className="hidden pb-2.5 text-[#9294a0] sm:inline">Conference 2026</span></div>
                  <span className="mb-2.5 text-[9px] text-[#9294a0]">View 4</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-[#e4e5eb] px-2.5 text-[9px] text-[#9b9da9]"><Search size={12} /> Search contacts</div>
                  <button className="h-8 rounded-lg border border-[#d9dbe3] bg-[#f8f7ff] px-3 text-[9px] font-semibold text-[#5e57dc]">Filter <span className="ml-1 rounded bg-[#625cf6] px-1.5 py-0.5 text-white">3</span></button>
                  <button className="hidden h-8 rounded-lg border border-[#e4e5eb] px-3 text-[9px] text-[#555765] sm:block">Columns</button>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-[#e6e7ec]">
                  <div className="grid grid-cols-[28px_1.5fr_1.2fr_.85fr_.65fr] items-center gap-2 bg-[#fafafb] px-3 py-2.5 text-[8px] font-semibold uppercase tracking-[.08em] text-[#9698a5] sm:grid-cols-[28px_1.6fr_1.3fr_1fr_.8fr]">
                    <span className="size-3 rounded-[3px] border border-[#cfd1da]" /><span>Name</span><span>Company</span><span>Role</span><span>Tag</span>
                  </div>
                  {rows.map((row, index) => (
                    <div key={row.email} className="grid grid-cols-[28px_1.5fr_1.2fr_.85fr_.65fr] items-center gap-2 border-t border-[#efeff3] px-3 py-3 sm:grid-cols-[28px_1.6fr_1.3fr_1fr_.8fr]">
                      <span className={`grid size-3 place-items-center rounded-[3px] border ${index < 2 ? "border-[#625cf6] bg-[#625cf6] text-white" : "border-[#cfd1da]"}`}>{index < 2 && <Check size={8} strokeWidth={3} />}</span>
                      <div className="flex min-w-0 items-center gap-2"><span className={`hidden size-7 shrink-0 place-items-center rounded-full text-[8px] font-semibold sm:grid ${row.tone}`}>{row.initials}</span><div className="min-w-0"><p className="truncate text-[9px] font-semibold text-[#383945]">{row.name}</p><p className="truncate text-[8px] text-[#989aa6]">{row.email}</p></div></div>
                      <span className="truncate text-[8px] text-[#5f616e]">{row.company}</span><span className="truncate text-[8px] text-[#5f616e]">{row.role}</span><span className={`w-fit rounded-md px-1.5 py-1 text-[7px] font-semibold ${row.tone}`}>{row.tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-10 right-0 z-10 hidden w-[330px] rounded-2xl border border-[#dedfe7] bg-white p-4 shadow-[0_24px_65px_rgba(32,33,50,.2)] lg:block xl:-right-9 xl:bottom-14">
        <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold text-[#2a2b37]">Filter contacts</p><p className="mt-0.5 text-[9px] text-[#989aa6]">Match all of these conditions</p></div><span className="rounded-md bg-[#eeedff] px-2 py-1 text-[8px] font-semibold text-[#5b55da]">AND</span></div>
        <div className="mt-3 space-y-2">
          {["Role · equals · Lawyer", "City · equals · Moscow", "Status · equals · Active"].map((filter) => <div key={filter} className="rounded-lg border border-[#e6e7ec] bg-[#fafafb] px-3 py-2 text-[9px] font-medium text-[#535562]">{filter}</div>)}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[#ececf1] pt-3"><div><p className="text-[8px] text-[#9698a5]">Matching audience</p><p className="text-[15px] font-semibold text-[#262733]">843 contacts</p></div><button className="rounded-lg bg-[#625cf6] px-3 py-2 text-[9px] font-semibold text-white">Create campaign</button></div>
      </div>

      <div className="absolute -left-5 bottom-12 hidden items-center gap-3 rounded-xl border border-[#dedfe7] bg-white p-3 pr-5 shadow-[0_18px_45px_rgba(32,33,50,.15)] xl:flex">
        <span className="grid size-9 place-items-center rounded-lg bg-[#eaf8ef] text-[#3f8c5b]"><BarChart3 size={17} /></span>
        <div><p className="text-[8px] text-[#9395a1]">Delivery rate</p><p className="text-sm font-semibold text-[#282a36]">98.2% <span className="ml-1 text-[8px] text-[#3f9b61]">+2.4%</span></p></div>
      </div>
    </div>
  );
}
