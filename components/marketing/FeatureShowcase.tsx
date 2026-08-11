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
          <FeatureHeading eyebrow="Контактная база" title="Все деловые связи — в одном месте." copy="Люди, компании, история общения и важные сигналы всегда под рукой. Команда понимает, к кому обратиться и почему." />
          <div className="rounded-[20px] border border-[#e2e3e9] bg-[#f8f9fb] p-3 shadow-[0_22px_60px_rgba(31,32,52,.09)]">
            <div className="overflow-hidden rounded-[14px] border border-[#e4e5eb] bg-white">
              <div className="flex items-center justify-between border-b border-[#ececf1] px-4 py-3"><div><p className="text-xs font-semibold">Участники конференции</p><p className="text-[10px] text-[#9799a5]">3 921 контакт</p></div><button className="rounded-lg bg-[#625cf6] px-3 py-2 text-[9px] font-semibold text-white">Добавить контакт</button></div>
              <div className="grid grid-cols-[1.5fr_1fr_.8fr] bg-[#fafafb] px-4 py-2.5 text-[8px] font-semibold uppercase tracking-[.08em] text-[#9698a5]"><span>Контакт</span><span>Компания</span><span>Статус</span></div>
              {[
                ["Майя Чен", "Проксима Лигал", "Спикер", "МЧ"], ["Артур Белл", "Брайтвелл", "Партнёр", "АБ"], ["Надия Волкова", "Некса Консалтинг", "Приоритет", "НВ"], ["Ноа Уильямс", "Кайт и Финч", "Активен", "НУ"],
              ].map(([name, company, status, initials], index) => (
                <div key={name} className="grid grid-cols-[1.5fr_1fr_.8fr] items-center border-t border-[#efeff3] px-4 py-3 text-[10px]"><span className="flex items-center gap-2 font-medium"><span className={`grid size-7 place-items-center rounded-full text-[8px] font-semibold ${index % 2 ? "bg-[#e8f6ff] text-[#2672a8]" : "bg-[#eeeaff] text-[#5c55d8]"}`}>{initials}</span>{name}</span><span className="text-[#717380]">{company}</span><span className="w-fit rounded-md bg-[#eef7f2] px-2 py-1 text-[8px] font-semibold text-[#39805a]">{status}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div id="solutions" className="grid items-center gap-12 lg:grid-cols-[1.16fr_.84fr] lg:gap-20">
          <div className="order-2 rounded-[22px] border border-[#dedfe7] bg-white p-5 shadow-[0_24px_70px_rgba(31,32,52,.1)] lg:order-1">
            <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[#242631]">Найдите именно тех, кто вам нужен</p><p className="mt-1 text-[11px] text-[#9698a5]">Все условия должны совпасть</p></div><button className="rounded-lg border border-[#e2e3e9] px-2.5 py-1.5 text-[9px] font-semibold text-[#555765]">Сбросить</button></div>
            <div className="mt-5 space-y-2.5">
              {[
                ["Должность", "равно", "Юрист"], ["Город", "равно", "Москва"], ["Статус", "равно", "Активен"],
              ].map((row, index) => (
                <div key={row[0]} className="flex items-center gap-2"><span className="w-9 text-[8px] font-semibold text-[#625cf6]">{index === 0 ? "ГДЕ" : "И"}</span>{row.map((cell) => <button key={cell} className="flex flex-1 items-center justify-between rounded-lg border border-[#e2e3e9] bg-[#fafafb] px-3 py-2.5 text-left text-[10px] font-medium text-[#454754]">{cell}<ChevronDown size={12} className="text-[#9698a5]" /></button>)}</div>
              ))}
              <button className="ml-11 flex items-center gap-1.5 py-2 text-[10px] font-semibold text-[#5d57dc]"><Plus size={13} /> Добавить фильтр</button>
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#deddfd] bg-[#f7f6ff] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] text-[#77798a]">Аудитория готова</p><p className="text-xl font-semibold tracking-[-.03em] text-[#252632]">843 контакта</p></div><div className="flex gap-2"><button className="rounded-lg border border-[#d9d8f8] bg-white px-3 py-2 text-[10px] font-semibold text-[#5752c5]">Сохранить сегмент</button><Link href="/campaigns/new?audience=segment-moscow-lawyers&count=843" className="flex items-center gap-2 rounded-lg bg-[#625cf6] px-3 py-2 text-[10px] font-semibold text-white">Создать кампанию <ArrowRight size={13} /></Link></div></div>
          </div>
          <div className="order-1 lg:order-2"><FeatureHeading eyebrow="Динамические аудитории" title="Найдите именно тех, кто вам нужен." copy="Комбинируйте любые параметры по гибким правилам «И» и «ИЛИ». Сохраните аудиторию один раз — и она будет обновляться вместе с базой." /></div>
        </div>

        <div id="templates" className="grid items-center gap-12 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
          <FeatureHeading eyebrow="Редактор писем" title="Красивые письма без помощи дизайнера." copy="Собирайте аккуратные письма из привычных блоков, добавляйте персонализацию и настраивайте только то, что действительно важно." />
          <div className="overflow-hidden rounded-[22px] border border-[#dfe0e7] bg-[#edeef3] shadow-[0_25px_75px_rgba(31,32,52,.12)]">
            <div className="flex h-11 items-center justify-between border-b border-[#dddfe6] bg-white px-4"><div><p className="text-[10px] font-semibold">Приглашение на юридическую конференцию</p><p className="text-[8px] text-[#999ba7]">Только что сохранено</p></div><div className="flex gap-1.5"><button className="rounded-md border border-[#e3e4e9] px-2 py-1.5 text-[8px]">Предпросмотр</button><button className="rounded-md bg-[#625cf6] px-2 py-1.5 text-[8px] font-semibold text-white">Продолжить</button></div></div>
            <div className="grid h-[440px] grid-cols-[72px_1fr] sm:grid-cols-[108px_1fr_132px]">
              <div className="border-r border-[#dddfe6] bg-white p-2.5"><p className="mb-2 text-[7px] font-semibold uppercase tracking-wider text-[#a0a2ad]">Блоки</p>{[[Type,"Текст"],[Type,"Заголовок"],[ImageIcon,"Изображение"],[MousePointer2,"Кнопка"],[Columns3,"Колонки"]].map(([Icon,label]) => { const BlockIcon=Icon as typeof Type; return <div key={label as string} className="mb-1.5 flex flex-col items-center gap-1 rounded-lg border border-[#e6e7ec] px-2 py-2 text-center text-[7px] text-[#666875]"><BlockIcon size={13} />{label as string}</div>; })}</div>
              <div className="overflow-hidden p-4 sm:p-7"><div className="mx-auto min-h-[380px] max-w-[330px] bg-white p-8 shadow-sm"><div className="mb-9 text-[8px] font-semibold tracking-[.15em]">NORTHSTAR <span className="text-[#625cf6]">LEGAL</span></div><p className="text-[9px] font-medium text-[#625cf6]">25–26 СЕНТЯБРЯ · МОСКВА</p><h3 className="mt-3 text-[25px] font-medium leading-[1.08] tracking-[-.04em] text-[#242530]">Вы приглашены.</h3><p className="mt-4 text-[9px] leading-4 text-[#71737f]">Здравствуйте, <span className="rounded bg-[#eeedff] px-1 text-[#5b55d8]">{`{{first_name}}`}</span>. Два насыщенных дня с лидерами юридической отрасли о будущем технологий и практики.</p><button className="mt-6 rounded-md bg-[#242530] px-4 py-2.5 text-[8px] font-semibold text-white">Забронировать место</button><div className="mt-10 border-t border-[#ebebef] pt-4 text-[7px] leading-3 text-[#a0a2ad]">Northstar Legal · Тверская ул., 18<br />Москва, 125009</div></div></div>
              <div className="hidden border-l border-[#dddfe6] bg-white p-3 sm:block"><p className="text-[7px] font-semibold uppercase tracking-wider text-[#a0a2ad]">Параметры</p><p className="mt-4 text-[8px] font-medium">Выравнивание</p><div className="mt-2 flex rounded-md border border-[#e5e6eb] p-1"><span className="grid flex-1 place-items-center rounded bg-[#f1f1f6] py-1"><AlignCenter size={11} /></span><span className="grid flex-1 place-items-center"><Link2 size={11} /></span></div><p className="mt-4 text-[8px] font-medium">Отступы</p><div className="mt-2 h-7 rounded-md border border-[#e5e6eb] bg-[#fafafb]" /><p className="mt-4 text-[8px] font-medium">Фон</p><div className="mt-2 flex h-7 items-center gap-2 rounded-md border border-[#e5e6eb] px-2"><span className="size-3 rounded border bg-white" /><span className="text-[7px] text-[#888a97]">#FFFFFF</span></div></div>
            </div>
          </div>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
          <div className="order-2 rounded-[22px] border border-[#e0e1e7] bg-white p-6 shadow-[0_24px_70px_rgba(31,32,52,.1)] lg:order-1">
            <div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Эффективность кампаний</p><p className="mt-1 text-[10px] text-[#9698a5]">За последние 30 дней</p></div><span className="rounded-lg border border-[#e3e4e9] px-2.5 py-1.5 text-[9px]">30 дней</span></div>
            <div className="mt-6 grid grid-cols-4 gap-3">{[["Доставлено","98,2%","+1,4%"],["Открыто","49,2%","+8,6%"],["Переходы","12,8%","+2,1%"],["Ответы","6,4%","+0,8%"]].map(([label,value,delta])=><div key={label}><p className="text-[8px] text-[#9698a5]">{label}</p><p className="mt-1 text-sm font-semibold sm:text-lg">{value}</p><p className="text-[7px] font-medium text-[#3c9160]">{delta}</p></div>)}</div>
            <div className="mt-7 flex h-40 items-end gap-1.5 border-b border-[#e8e9ee]">{[24,31,27,45,40,52,48,69,56,73,64,84,78,96,88,103,90,118,108,132,121,145,137,154,146,165,158,178].map((height,index)=><div key={index} className="group relative flex-1"><div className="rounded-t-[3px] bg-[#7770f7] opacity-80 transition-opacity group-hover:opacity-100" style={{height:`${height}px`,maxHeight:"100%"}} /></div>)}</div>
            <div className="mt-3 flex justify-between text-[8px] text-[#a0a2ad]"><span>1 июля</span><span>8 июля</span><span>15 июля</span><span>22 июля</span><span>29 июля</span></div>
          </div>
          <div className="order-1 lg:order-2"><FeatureHeading eyebrow="Аналитика кампаний" title="Отправляйте. Измеряйте. Улучшайте." copy="Видьте весь путь письма — от доставки до ответа. Сравнивайте кампании, замечайте динамику и делайте каждую следующую рассылку точнее." /></div>
        </div>
      </div>
    </section>
  );
}
