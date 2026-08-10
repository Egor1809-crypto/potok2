import Link from "next/link";
import { AlignCenter, ArrowRight, ChevronDown, Columns3, Image as ImageIcon, Link2, MousePointer2, Plus, Type } from "lucide-react";

function FeatureHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="max-w-xl">
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-[clamp(2rem,4vw,3.4rem)] font-medium leading-[1.06] tracking-[-.045em] text-[#191a25]">{title}</h2>
      <p className="mt-5 max-w-lg text-[16px] leading-7 text-[#6d6f7d]">{copy}</p>
    </div>
  );
}

export function FeatureShowcase() {
  return (
    <section id="product" className="overflow-hidden py-24 sm:py-32">
      <div className="container-shell space-y-28 sm:space-y-40">
        <div className="grid items-center gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
          <FeatureHeading eyebrow="Contact intelligence" title="One database for every relationship." copy="Keep every person, company, interaction and signal in one calm workspace. Your team always knows who to reach—and why." />
          <div className="rounded-[20px] border border-[#e2e3e9] bg-[#f8f9fb] p-3 shadow-[0_22px_60px_rgba(31,32,52,.09)]">
            <div className="overflow-hidden rounded-[14px] border border-[#e4e5eb] bg-white">
              <div className="flex items-center justify-between border-b border-[#ececf1] px-4 py-3"><div><p className="text-xs font-semibold">Conference relations</p><p className="text-[10px] text-[#9799a5]">3,921 contacts</p></div><button className="rounded-lg bg-[#625cf6] px-3 py-2 text-[9px] font-semibold text-white">Add contact</button></div>
              <div className="grid grid-cols-[1.5fr_1fr_.8fr] bg-[#fafafb] px-4 py-2.5 text-[8px] font-semibold uppercase tracking-[.08em] text-[#9698a5]"><span>Contact</span><span>Company</span><span>Status</span></div>
              {[
                ["Maya Chen", "Proxima Legal", "Speaker", "MC"], ["Arthur Bell", "Brightwell", "Partner", "AB"], ["Nadia Volkova", "Nexa Counsel", "VIP", "NV"], ["Noah Williams", "Kite & Finch", "Active", "NW"],
              ].map(([name, company, status, initials], index) => (
                <div key={name} className="grid grid-cols-[1.5fr_1fr_.8fr] items-center border-t border-[#efeff3] px-4 py-3 text-[10px]"><span className="flex items-center gap-2 font-medium"><span className={`grid size-7 place-items-center rounded-full text-[8px] font-semibold ${index % 2 ? "bg-[#e8f6ff] text-[#2672a8]" : "bg-[#eeeaff] text-[#5c55d8]"}`}>{initials}</span>{name}</span><span className="text-[#717380]">{company}</span><span className="w-fit rounded-md bg-[#eef7f2] px-2 py-1 text-[8px] font-semibold text-[#39805a]">{status}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div id="solutions" className="grid items-center gap-12 lg:grid-cols-[1.16fr_.84fr] lg:gap-20">
          <div className="order-2 rounded-[22px] border border-[#dedfe7] bg-white p-5 shadow-[0_24px_70px_rgba(31,32,52,.1)] lg:order-1">
            <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[#242631]">Find exactly who you need</p><p className="mt-1 text-[11px] text-[#9698a5]">All conditions must match</p></div><button className="rounded-lg border border-[#e2e3e9] px-2.5 py-1.5 text-[9px] font-semibold text-[#555765]">Clear</button></div>
            <div className="mt-5 space-y-2.5">
              {[
                ["Role", "equals", "Lawyer"], ["City", "equals", "Moscow"], ["Status", "equals", "Active"],
              ].map((row, index) => (
                <div key={row[0]} className="flex items-center gap-2"><span className="w-9 text-[8px] font-semibold text-[#625cf6]">{index === 0 ? "WHERE" : "AND"}</span>{row.map((cell) => <button key={cell} className="flex flex-1 items-center justify-between rounded-lg border border-[#e2e3e9] bg-[#fafafb] px-3 py-2.5 text-left text-[10px] font-medium text-[#454754]">{cell}<ChevronDown size={12} className="text-[#9698a5]" /></button>)}</div>
              ))}
              <button className="ml-11 flex items-center gap-1.5 py-2 text-[10px] font-semibold text-[#5d57dc]"><Plus size={13} /> Add filter</button>
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#deddfd] bg-[#f7f6ff] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] text-[#77798a]">Ready to reach</p><p className="text-xl font-semibold tracking-[-.03em] text-[#252632]">843 contacts</p></div><div className="flex gap-2"><button className="rounded-lg border border-[#d9d8f8] bg-white px-3 py-2 text-[10px] font-semibold text-[#5752c5]">Save segment</button><Link href="/campaigns/new?audience=segment-moscow-lawyers&count=843" className="flex items-center gap-2 rounded-lg bg-[#625cf6] px-3 py-2 text-[10px] font-semibold text-white">Create campaign <ArrowRight size={13} /></Link></div></div>
          </div>
          <div className="order-1 lg:order-2"><FeatureHeading eyebrow="Dynamic audiences" title="Find exactly who you need." copy="Combine any attribute with flexible AND/OR rules. Save the audience once and it keeps itself current as your database changes." /></div>
        </div>

        <div id="templates" className="grid items-center gap-12 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
          <FeatureHeading eyebrow="Email builder" title="Beautiful emails, no designer required." copy="Compose polished outreach with familiar content blocks, live personalization and focused controls that stay out of your way." />
          <div className="overflow-hidden rounded-[22px] border border-[#dfe0e7] bg-[#edeef3] shadow-[0_25px_75px_rgba(31,32,52,.12)]">
            <div className="flex h-11 items-center justify-between border-b border-[#dddfe6] bg-white px-4"><div><p className="text-[10px] font-semibold">Legal Conference Invitation</p><p className="text-[8px] text-[#999ba7]">Saved just now</p></div><div className="flex gap-1.5"><button className="rounded-md border border-[#e3e4e9] px-2 py-1.5 text-[8px]">Preview</button><button className="rounded-md bg-[#625cf6] px-2 py-1.5 text-[8px] font-semibold text-white">Continue</button></div></div>
            <div className="grid h-[440px] grid-cols-[72px_1fr] sm:grid-cols-[108px_1fr_132px]">
              <div className="border-r border-[#dddfe6] bg-white p-2.5"><p className="mb-2 text-[7px] font-semibold uppercase tracking-wider text-[#a0a2ad]">Blocks</p>{[[Type,"Text"],[Type,"Heading"],[ImageIcon,"Image"],[MousePointer2,"Button"],[Columns3,"Columns"]].map(([Icon,label]) => { const BlockIcon=Icon as typeof Type; return <div key={label as string} className="mb-1.5 flex flex-col items-center gap-1 rounded-lg border border-[#e6e7ec] px-2 py-2 text-[7px] text-[#666875]"><BlockIcon size={13} />{label as string}</div>; })}</div>
              <div className="overflow-hidden p-4 sm:p-7"><div className="mx-auto min-h-[380px] max-w-[330px] bg-white p-8 shadow-sm"><div className="mb-9 text-[8px] font-semibold tracking-[.15em]">NORTHSTAR <span className="text-[#625cf6]">LEGAL</span></div><p className="text-[9px] font-medium text-[#625cf6]">SEPTEMBER 25–26 · MOSCOW</p><h3 className="mt-3 text-[25px] font-medium leading-[1.08] tracking-[-.04em] text-[#242530]">You’re invited.</h3><p className="mt-4 text-[9px] leading-4 text-[#71737f]">Hello, <span className="rounded bg-[#eeedff] px-1 text-[#5b55d8]">{`{{first_name}}`}</span>. Join legal leaders for two focused days on the future of technology and practice.</p><button className="mt-6 rounded-md bg-[#242530] px-4 py-2.5 text-[8px] font-semibold text-white">Reserve your place</button><div className="mt-10 border-t border-[#ebebef] pt-4 text-[7px] leading-3 text-[#a0a2ad]">Northstar Legal · 18 Tverskaya Street<br />Moscow, 125009</div></div></div>
              <div className="hidden border-l border-[#dddfe6] bg-white p-3 sm:block"><p className="text-[7px] font-semibold uppercase tracking-wider text-[#a0a2ad]">Properties</p><p className="mt-4 text-[8px] font-medium">Alignment</p><div className="mt-2 flex rounded-md border border-[#e5e6eb] p-1"><span className="grid flex-1 place-items-center rounded bg-[#f1f1f6] py-1"><AlignCenter size={11} /></span><span className="grid flex-1 place-items-center"><Link2 size={11} /></span></div><p className="mt-4 text-[8px] font-medium">Spacing</p><div className="mt-2 h-7 rounded-md border border-[#e5e6eb] bg-[#fafafb]" /><p className="mt-4 text-[8px] font-medium">Background</p><div className="mt-2 flex h-7 items-center gap-2 rounded-md border border-[#e5e6eb] px-2"><span className="size-3 rounded border bg-white" /><span className="text-[7px] text-[#888a97]">#FFFFFF</span></div></div>
            </div>
          </div>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
          <div className="order-2 rounded-[22px] border border-[#e0e1e7] bg-white p-6 shadow-[0_24px_70px_rgba(31,32,52,.1)] lg:order-1">
            <div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Campaign performance</p><p className="mt-1 text-[10px] text-[#9698a5]">Last 30 days</p></div><span className="rounded-lg border border-[#e3e4e9] px-2.5 py-1.5 text-[9px]">30 days</span></div>
            <div className="mt-6 grid grid-cols-4 gap-3">{[["Delivered","98.2%","+1.4%"],["Opened","49.2%","+8.6%"],["Clicked","12.8%","+2.1%"],["Replied","6.4%","+0.8%"]].map(([label,value,delta])=><div key={label}><p className="text-[8px] text-[#9698a5]">{label}</p><p className="mt-1 text-sm font-semibold sm:text-lg">{value}</p><p className="text-[7px] font-medium text-[#3c9160]">{delta}</p></div>)}</div>
            <div className="mt-7 flex h-40 items-end gap-1.5 border-b border-[#e8e9ee]">{[24,31,27,45,40,52,48,69,56,73,64,84,78,96,88,103,90,118,108,132,121,145,137,154,146,165,158,178].map((height,index)=><div key={index} className="group relative flex-1"><div className="rounded-t-[3px] bg-[#7770f7] opacity-80 transition-opacity group-hover:opacity-100" style={{height:`${height}px`,maxHeight:"100%"}} /></div>)}</div>
            <div className="mt-3 flex justify-between text-[8px] text-[#a0a2ad]"><span>Jul 01</span><span>Jul 08</span><span>Jul 15</span><span>Jul 22</span><span>Jul 29</span></div>
          </div>
          <div className="order-1 lg:order-2"><FeatureHeading eyebrow="Campaign analytics" title="Send. Measure. Improve." copy="See the whole journey from delivery to reply. Compare campaigns, spot momentum and turn every send into a better next one." /></div>
        </div>
      </div>
    </section>
  );
}
