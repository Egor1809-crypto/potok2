import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const img = (name, mime = 'image/jpeg') => `data:${mime};base64,${fs.readFileSync(path.join(dir, 'assets', name)).toString('base64')}`;
const wide = img('conference-hero-wide.jpg');
const portrait = img('conference-hero-portrait.jpg');
const banner = img('conference-hero-banner.jpg');

const links = {
  site: 'https://tech-pravo.ru/conference',
  tickets: 'https://tech-pravo.ru/conference/uchastnik',
  standard: 'https://tech-pravo.ru/conference/uchastnik?tariff=standard',
  business: 'https://tech-pravo.ru/conference/uchastnik?tariff=business',
  fullpass: 'https://tech-pravo.ru/conference/uchastnik?tariff=fullpass',
  corporate: 'https://tech-pravo.ru/conference/uchastnik?tariff=corporate',
  program: 'https://tech-pravo.ru/programma-tehnologii-prava-2026.pdf',
  news: 'https://t.me/ainovaci',
  conference: 'https://t.me/TechPravoAI',
  bot: 'https://t.me/NeuroPravo_Bot',
};

const base = (title, preheader, bg, body) => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{margin:0!important;padding:0!important;background:${bg};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;word-break:normal}.pre{display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent}.wrap{width:100%;background:${bg};padding:24px 0}.card{width:640px;max-width:640px}.px{padding-left:42px;padding-right:42px}.muted{color:#718096}.btn{display:inline-block;text-decoration:none;font-weight:800;border-radius:10px;padding:16px 25px}.small{font-size:13px;line-height:19px}.copy{font-size:17px;line-height:27px}.h1{font-size:40px;line-height:44px;letter-spacing:-1.5px;margin:0}.h2{font-size:26px;line-height:32px;margin:0}.pill{display:inline-block;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:800;letter-spacing:.5px}.rule{height:1px;background:#dbe5ee}.col{vertical-align:top}.social-link{text-decoration:none;font-weight:800}.social-note{font-size:11px;line-height:16px;font-weight:400;display:block;margin-top:3px}
@media(max-width:680px){.wrap{padding:0}.card{width:100%!important;max-width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:32px!important;line-height:36px!important}.stack{display:block!important;width:100%!important;box-sizing:border-box}.mobile-gap{padding-top:12px!important;padding-left:0!important;padding-right:0!important}.hide-mobile{display:none!important}.social-cell{display:block!important;width:100%!important;padding:7px 0!important}.logo-img{width:255px!important;max-width:82%!important;height:auto!important}}
</style></head><body><div class="pre">${preheader}</div>${body}</body></html>`;

const logo = (width=270) => {
  const size = Math.max(18, Math.round(width / 12.4));
  const type = `font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:${size}px;line-height:${size+4}px;font-weight:900;letter-spacing:-1.1px`;
  return `<a href="${links.site}" target="_blank" aria-label="ТехнологИИ Права" style="display:inline-block;text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0" style="width:auto;max-width:100%"><tr><td nowrap style="${type};color:#29e0e5">ТЕХНОЛОГ</td><td nowrap style="${type};color:#ff3aa7">ИИ</td><td nowrap style="${type};color:#29e0e5">&nbsp;ПРАВА</td></tr><tr><td height="3" bgcolor="#29e0e5" style="font-size:0;line-height:0">&nbsp;</td><td height="3" bgcolor="#ff3aa7" style="font-size:0;line-height:0">&nbsp;</td><td height="3" bgcolor="#29e0e5" style="font-size:0;line-height:0">&nbsp;</td></tr></table></a>`;
};
const legal = (dark=false, align='center') => `<tr><td class="px" style="padding-top:22px;padding-bottom:30px;color:${dark?'#8495aa':'#75869a'};font-size:11px;line-height:17px;text-align:${align}"><b style="color:${dark?'#b8c5d5':'#53667c'}">© 2026 ООО «АСПБ» · Платформа «ТехнологИИ Права»</b><br>Москва · 25–26 сентября 2026 · БЦ «Красные Ворота»<br><a href="mailto:info@tech-pravo.ru" style="color:${dark?'#5de1e6':'#087f8c'}">info@tech-pravo.ru</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${links.site}" target="_blank" style="color:${dark?'#5de1e6':'#087f8c'}">tech-pravo.ru/conference</a></td></tr>`;

const footerPersonal = () => `<tr><td class="px" style="padding-top:32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="62%" height="3" bgcolor="#29e0e5"></td><td width="12%" height="3" bgcolor="#ff3aa7"></td><td width="26%" height="3" bgcolor="#29e0e5"></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1d31"><tr><td style="padding:22px 20px 13px;color:#fff"><b style="font-size:19px">Продолжим разговор в Telegram</b><div style="color:#91a4ba;font-size:13px;line-height:20px;margin-top:5px">Выберите канал под Вашу задачу.</div></td></tr>${[
['01','Новости платформы','@ainovaci',links.news],['02','Канал конференции','@TechPravoAI',links.conference],['03','AI-бот конференции','@NeuroPravo_Bot',links.bot]
].map(([n,t,h,u])=>`<tr><td style="padding:0 20px"><a href="${u}" target="_blank" style="display:block;text-decoration:none;border-top:1px solid #24364d;padding:13px 0;color:#fff"><span style="color:#5de1e6;font-weight:900;margin-right:13px">${n}</span><b>${t}</b><span style="float:right;color:#ff65b5;font-size:12px">${h} →</span></a></td></tr>`).join('')}<tr><td height="10"></td></tr></table></td></tr>${legal(true)}`;

const footerAudience = () => `<tr><td class="px" style="padding-top:34px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom:14px"><b style="font-size:20px;color:#10213b">Вся конференция — в Telegram</b><br><span style="font-size:13px;color:#718096">Три пространства без лишних уведомлений</span></td></tr>${[
['#e5fbfc','Новости и разборы','@ainovaci','Материалы об ИИ и юридическом бизнесе',links.news],['#fff0f7','Анонсы конференции','@TechPravoAI','Спикеры, темы и изменения программы',links.conference],['#eef2ff','Бот участника','@NeuroPravo_Bot','Билеты, навигация и ответы на вопросы',links.bot]
].map(([bg,t,h,n,u])=>`<tr><td style="padding-bottom:9px"><a href="${u}" target="_blank" style="display:block;text-decoration:none;background:${bg};border-radius:10px;padding:14px 16px;color:#10213b"><b>${t}</b><span style="float:right;color:#087f8c;font-size:12px">${h} ↗</span><span style="display:block;color:#65788d;font-size:12px;margin-top:4px">${n}</span></a></td></tr>`).join('')}</table></td></tr>${legal(false,'left')}`;

const footerTickets = () => `<tr><td class="px" style="padding-top:32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1b2e;border-radius:14px"><tr><td style="padding:21px 20px 8px;color:#fff"><span style="font-size:11px;color:#5de1e6;font-weight:900;letter-spacing:1px">ПОСЛЕ ОФОРМЛЕНИЯ</span><h3 style="font-size:20px;margin:7px 0 5px">Подключитесь к контуру конференции</h3><p style="font-size:13px;line-height:20px;color:#9fb0c4;margin:0">Следите за программой и задавайте вопросы до поездки.</p></td></tr><tr><td style="padding:13px 14px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${[
['Канал','@TechPravoAI',links.conference],['Бот','@NeuroPravo_Bot',links.bot],['Новости','@ainovaci',links.news]
].map(([t,h,u])=>`<td class="social-cell" width="33.33%" style="padding:6px"><a href="${u}" target="_blank" style="display:block;text-decoration:none;text-align:center;background:#162840;border:1px solid #29415c;border-radius:9px;padding:12px 7px;color:#fff"><b>${t}</b><span style="display:block;color:#5de1e6;font-size:11px;margin-top:4px">${h}</span></a></td>`).join('')}</tr></table></td></tr></table></td></tr>${legal(false)}`;

const footerBusiness = () => `<tr><td class="px" style="padding-top:34px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2a3d55"><tr><td style="padding:24px 0 13px;color:#fff"><b style="font-size:20px">Деловая навигация</b><p style="margin:6px 0 0;color:#91a4ba;font-size:13px;line-height:20px">Короткий путь к программе, ответам и отраслевым материалам.</p></td></tr><tr><td><table role="presentation" width="100%"><tr><td class="stack" width="50%" valign="top" style="padding:0 7px 10px 0"><a href="${links.conference}" target="_blank" style="display:block;text-decoration:none;background:#13233a;border-left:3px solid #ff3aa7;padding:15px;color:#fff"><b>Канал конференции</b><span style="display:block;color:#ff65b5;font-size:12px;margin-top:5px">@TechPravoAI →</span></a></td><td class="stack mobile-gap" width="50%" valign="top" style="padding:0 0 10px 7px"><a href="${links.bot}" target="_blank" style="display:block;text-decoration:none;background:#13233a;border-left:3px solid #29e0e5;padding:15px;color:#fff"><b>Бот участника</b><span style="display:block;color:#5de1e6;font-size:12px;margin-top:5px">@NeuroPravo_Bot →</span></a></td></tr></table></td></tr><tr><td style="padding-top:7px;color:#91a4ba;font-size:12px">Аналитика и новости платформы: <a href="${links.news}" target="_blank" style="color:#5de1e6;font-weight:800">@ainovaci ↗</a></td></tr></table></td></tr>${legal(true,'left')}`;

const footerDeadline = () => `<tr><td class="px" style="padding-top:34px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ecd7e1;border-radius:12px;overflow:hidden"><tr><td colspan="2" height="5" bgcolor="#ff3aa7"></td></tr><tr><td colspan="2" style="padding:18px 18px 10px"><b style="font-size:18px;color:#10213b">Не пропустите изменения программы</b></td></tr>${[
['@TechPravoAI','Официальный канал конференции',links.conference],['@NeuroPravo_Bot','Бот: вопросы, билеты и навигация',links.bot],['@ainovaci','Новости ИИ и юридического бизнеса',links.news]
].map(([h,n,u])=>`<tr><td style="padding:9px 18px;border-top:1px solid #f1e4ea"><a href="${u}" target="_blank" style="color:#10213b;text-decoration:none"><b style="color:#087f8c">${h}</b><span style="display:block;color:#718096;font-size:12px;margin-top:3px">${n}</span></a></td><td align="right" style="padding:9px 18px;border-top:1px solid #f1e4ea"><a href="${u}" target="_blank" style="color:#ff3aa7;text-decoration:none;font-size:20px">↗</a></td></tr>`).join('')}<tr><td height="8"></td></tr></table></td></tr>${legal(false)}`;

const t1 = base('Личное приглашение — ТехнологИИ Права','Два дня практики БФЛ, LegalTech и ИИ. Выберите билет до повышения цены.','#07101f',`
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" class="card" cellpadding="0" cellspacing="0" style="background:#0b172a;color:#fff;border-radius:18px;overflow:hidden">
<tr><td class="px" style="padding-top:24px;padding-bottom:21px;text-align:center;background:#2e2b36">${logo(286)}</td></tr>
<tr><td><a href="${links.tickets}" target="_blank"><img src="${wide}" width="640" alt="Конференция ТехнологИИ Права" style="width:100%;height:auto;display:block;border:0"></a></td></tr>
<tr><td class="px" style="padding-top:34px"><span class="pill" style="background:#18334a;color:#66e8ef">ЛИЧНОЕ ПРИГЛАШЕНИЕ</span><h1 class="h1" style="margin-top:16px">Будущее юридической практики уже стало рабочим инструментом</h1></td></tr>
<tr><td class="px copy" style="padding-top:22px;color:#d8e4ef">Здравствуйте, {{Имя}}!</td></tr>
<tr><td class="px copy" style="padding-top:10px;color:#d8e4ef">Приглашаем Вас на флагманскую конференцию «ТехнологИИ Права» — для юристов в сфере БФЛ, арбитражных управляющих и СРО, руководителей юридического бизнеса и практикующих юристов.</td></tr>
<tr><td class="px" style="padding-top:24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111f34;border:1px solid #24415c;border-radius:14px"><tr><td style="padding:20px"><b style="font-size:21px">25–26 сентября 2026</b><br><span style="color:#aebdd0;line-height:25px">Москва · БЦ «Красные Ворота»<br>Два дня практики, знакомств и решений для роста</span></td></tr></table></td></tr>
<tr><td class="px" style="padding-top:26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" class="stack col" style="padding-right:10px"><b style="color:#66e8ef">В программе</b><p style="line-height:24px;color:#d8e4ef">БФЛ, ИИ в юрбизнесе, автоматизация, LegalTech, данные и безопасность.</p></td><td width="50%" class="stack col mobile-gap" style="padding-left:10px"><b style="color:#ff73bf">Для Вашей практики</b><p style="line-height:24px;color:#d8e4ef">Реальные кейсы, рабочие инструменты и профессиональные связи.</p></td></tr></table></td></tr>
<tr><td class="px" style="padding-top:10px;padding-bottom:14px;text-align:center"><a class="btn" href="${links.tickets}" target="_blank" style="background:#65e8ef;color:#06111d">Выбрать билет →</a><p class="small" style="color:#93a4b8">Текущие цены действуют до 31 августа</p></td></tr>${footerPersonal()}</table></td></tr></table>`);

const roleCard = (title, who, text, href, color) => `<tr><td style="padding:20px;border:1px solid #dce7ef;border-left:5px solid ${color};border-radius:12px;background:#fff"><b style="font-size:20px;color:#10213b">${title}</b><div style="font-size:13px;color:#68788c;margin-top:4px">${who}</div><p style="margin:12px 0 15px;line-height:23px;color:#34465d">${text}</p><a href="${href}" target="_blank" style="color:#087f8c;font-weight:800;text-decoration:none">Подобрать участие →</a></td></tr><tr><td height="12"></td></tr>`;
const t2 = base('Выберите свой результат — ТехнологИИ Права','Конференция для специалистов БФЛ, руководителей и практикующих юристов.','#eef5f8',`
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" class="card" cellpadding="0" cellspacing="0" style="background:#f9fcfd;color:#10213b;border-radius:18px;overflow:hidden">
<tr><td class="px" style="padding-top:22px;padding-bottom:20px;background:#2e2b36"><table role="presentation" width="100%"><tr><td>${logo(258)}</td><td class="hide-mobile" align="right" style="font-size:12px;color:#c5d0dc">25–26.09 · Москва</td></tr></table></td></tr>
<tr><td><img src="${banner}" width="640" alt="Технологии и право" style="width:100%;height:auto;display:block"></td></tr>
<tr><td class="px" style="padding-top:32px"><span class="pill" style="background:#dffbfc;color:#087f8c">КОНФЕРЕНЦИЯ ДЛЯ ВАШЕЙ РОЛИ</span><h1 class="h1" style="margin-top:15px">Что именно Вы увезёте с конференции?</h1><p class="copy" style="color:#40536b">Здравствуйте, {{Имя}}! Выберите свою профессиональную задачу — программа построена так, чтобы каждый участник нашёл прикладные решения для своей практики.</p></td></tr>
<tr><td class="px" style="padding-top:8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${roleCard('БФЛ, арбитражное управление и СРО','Для профильных специалистов','Судебная практика, автоматизация подготовки документов, поиск активов и масштабирование БФЛ-практики.',links.standard,'#13c7d1')}
${roleCard('Руководитель юридического бизнеса','Для собственников и руководителей команд','Как внедрять ИИ в процессы, управлять изменениями, повышать эффективность и развивать продукт.',links.business,'#ff43ae')}
${roleCard('Практикующий юрист','Для специалистов разных отраслей права','LegalTech-инструменты, ИИ-ассистенты, работа с договорами, данными, рисками и клиентским сервисом.',links.tickets,'#5978f3')}
</table></td></tr>
<tr><td class="px" style="padding-top:10px;padding-bottom:18px;text-align:center"><a class="btn" href="${links.program}" target="_blank" style="background:#10213b;color:#fff">Посмотреть полную программу</a><p class="small muted">Билеты — от 25 000 ₽. Цены действуют до 31 августа.</p></td></tr>${footerAudience()}</table></td></tr></table>`);

const tariff = (name, role, price, later, href, accent, rows) => `<tr><td style="padding:20px;background:#fff;border:1px solid #dae5ed;border-top:5px solid ${accent};border-radius:12px"><table role="presentation" width="100%"><tr><td><b style="font-size:23px;color:#10213b">${name}</b><br><span style="font-size:13px;color:#718096">${role}</span></td><td align="right"><b style="font-size:22px;color:#10213b">${price}</b><br><span style="font-size:11px;color:#b34a73">${later}</span></td></tr></table><p style="color:#40536b;line-height:23px">${rows}</p><a href="${href}" target="_blank" style="display:block;text-align:center;text-decoration:none;background:${accent};color:${accent==='#66e8ef'?'#07101f':'#fff'};font-weight:800;padding:13px;border-radius:8px">Выбрать ${name}</a></td></tr><tr><td height="12"></td></tr>`;
const t3 = base('Билеты на конференцию — ТехнологИИ Права','Сравните 4 формата и зафиксируйте текущую стоимость до 31 августа.','#e8eef3',`
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" class="card" cellpadding="0" cellspacing="0" style="background:#f4f8fa;border-radius:18px;overflow:hidden">
<tr><td class="px" style="background:#2e2b36;padding-top:23px;padding-bottom:22px;text-align:center">${logo(278)}<p style="color:#c3cedb;margin:10px 0 0;font-size:13px">БИЛЕТЫ · 25–26 СЕНТЯБРЯ · МОСКВА</p></td></tr>
<tr><td><a href="${links.tickets}" target="_blank"><img src="${banner}" width="640" alt="Конференция ТехнологИИ Права" style="width:100%;height:auto;display:block;border:0"></a></td></tr>
<tr><td class="px" style="padding-top:34px"><h1 class="h1" style="color:#10213b">Выберите формат участия под Вашу задачу</h1><p class="copy" style="color:#40536b">Здравствуйте, {{Имя}}! На конференции предусмотрены четыре тарифа — от одного дня для специалиста до синхронного погружения всей команды.</p><div style="background:#fff0f7;border:1px solid #ffc4df;color:#7c264d;border-radius:10px;padding:14px 16px;line-height:22px"><b>До 31 августа — текущие цены.</b><br>С 1 сентября стоимость «Стандарта» вырастет на 50%, «Бизнеса» — на 30%, Full Pass — на 20%.</div></td></tr>
<tr><td class="px" style="padding-top:22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${tariff('Стандарт','1 день на выбор','25 000 ₽','затем 37 500 ₽',links.standard,'#66e8ef','Выступления экспертов, практикумы и AI-воркшопы, выставка сервисов, speed networking и приложение конференции.')}
${tariff('Бизнес','оба дня','45 000 ₽','затем 58 500 ₽',links.business,'#167d9b','Всё из «Стандарта» на два дня, материалы практикумов и приоритетные места в основных залах.')}
${tariff('Full Pass','для топ-менеджмента','88 000 ₽','затем 105 600 ₽',links.fullpass,'#7557c8','Видеозаписи и презентации, консультация по внедрению ИИ номиналом 50 000 ₽, спикерская и закрытые встречи.')}
${tariff('Корпоративный','команда из 5 человек','99 000 ₽','пакет вместо 208 000 ₽',links.corporate,'#ff43ae','Full Pass + Бизнес + 3 Стандарта. Один заказ и именные QR-билеты каждому участнику.')}
</table></td></tr>${footerTickets()}</table></td></tr></table>`);

const outcome = (n,title,text) => `<tr><td width="46" valign="top"><div style="width:34px;height:34px;line-height:34px;text-align:center;border-radius:50%;background:#66e8ef;color:#07101f;font-weight:900">${n}</div></td><td style="padding-bottom:19px"><b style="font-size:18px">${title}</b><div style="color:#bdc9d8;line-height:23px;margin-top:5px">${text}</div></td></tr>`;
const t4 = base('Для руководителя: конференция ТехнологИИ Права','Не просто узнать об ИИ — собрать решения для внедрения в юридический бизнес.','#050c18',`
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" class="card" cellpadding="0" cellspacing="0" style="background:#0a1525;color:#fff;border-radius:18px;overflow:hidden">
<tr><td class="px" style="padding-top:22px;padding-bottom:20px;background:#2e2b36"><table role="presentation" width="100%"><tr><td>${logo(246)}</td><td class="hide-mobile" align="right"><a href="${links.business}" target="_blank" style="color:#66e8ef;font-size:13px;font-weight:800;text-decoration:none">Билет для руководителя →</a></td></tr></table></td></tr>
<tr><td><img src="${portrait}" width="640" alt="Юридический бизнес и технологии" style="width:100%;height:auto;display:block"></td></tr>
<tr><td class="px" style="padding-top:33px"><span class="pill" style="background:#291a3c;color:#ff73bf">ДЛЯ РУКОВОДИТЕЛЕЙ</span><h1 class="h1" style="margin-top:15px">Два дня, чтобы превратить технологии в управленческие решения</h1><p class="copy" style="color:#d6dfeb">Здравствуйте, {{Имя}}! Если Вы отвечаете за рост юридической практики или команды, конференция поможет увидеть не отдельные сервисы, а систему внедрения.</p></td></tr>
<tr><td class="px" style="padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${outcome('1','Сверить стратегию','Понять, где ИИ уже даёт эффект в юридическом бизнесе, а где создаёт новые риски.')}
${outcome('2','Выбрать процессы для автоматизации','CRM, документооборот, договоры, аналитика и клиентский сервис — через реальные кейсы.')}
${outcome('3','Подготовить команду','Разобрать сопротивление изменениям и синхронизировать руководителей со специалистами практики.')}
${outcome('4','Найти партнёров','Познакомиться с коллегами, поставщиками LegalTech и представителями рынка БФЛ.')}
</table></td></tr>
<tr><td class="px" style="padding-top:7px"><table role="presentation" width="100%" style="background:#111f34;border-radius:12px"><tr><td style="padding:18px"><b>Рекомендуемый формат: «Бизнес»</b><br><span style="color:#9fb1c5;line-height:22px">Оба дня, практикумы, материалы и приоритетные места — 45 000 ₽ до 31 августа.</span></td></tr></table></td></tr>
<tr><td class="px" style="padding-top:26px;text-align:center"><a class="btn" href="${links.business}" target="_blank" style="background:#ff43ae;color:#fff">Получить билет «Бизнес» →</a><p class="small" style="color:#9fb1c5">Для команды из 5 человек доступен корпоративный пакет за 99 000 ₽</p><a href="${links.corporate}" target="_blank" style="color:#66e8ef;font-weight:800">Запросить корпоративный тариф</a></td></tr>${footerBusiness()}</table></td></tr></table>`);

const priceRow = (name,now,later,href,accent) => `<tr><td style="padding:15px 0;border-bottom:1px solid #dce5ec"><b>${name}</b></td><td align="right" style="padding:15px 0;border-bottom:1px solid #dce5ec"><b style="color:${accent};font-size:19px">${now}</b><br><span style="font-size:11px;color:#8a6573">с 1 сентября ${later}</span></td><td align="right" style="padding:15px 0 15px 12px;border-bottom:1px solid #dce5ec"><a href="${href}" target="_blank" style="font-weight:800;color:#10213b">Выбрать →</a></td></tr>`;
const t5 = base('Зафиксируйте цену билета до 31 августа','После 31 августа билеты подорожают до 50%. Выберите формат участия сейчас.','#f5ecef',`
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" class="card" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;color:#10213b">
<tr><td class="px" style="padding-top:22px;padding-bottom:20px;text-align:center;background:#2e2b36">${logo(280)}</td></tr>
<tr><td class="px" style="background:#ff43ae;padding-top:17px;padding-bottom:17px;text-align:center;color:#fff;font-weight:900;letter-spacing:.6px">ТЕКУЩИЕ ЦЕНЫ — ДО 31 АВГУСТА ВКЛЮЧИТЕЛЬНО</td></tr>
<tr><td><a href="${links.tickets}" target="_blank"><img src="${banner}" width="640" alt="ТехнологИИ Права" style="width:100%;height:auto;display:block"></a></td></tr>
<tr><td class="px" style="padding-top:32px"><h1 class="h1">Зафиксируйте стоимость билета до повышения</h1><p class="copy" style="color:#40536b">Здравствуйте, {{Имя}}! 25–26 сентября в Москве встретятся специалисты БФЛ, арбитражные управляющие, руководители юридического бизнеса и практикующие юристы.</p><p class="copy" style="color:#40536b">В центре программы — решения, которые можно применять в работе: ИИ-ассистенты, автоматизация практики, LegalTech, данные и безопасность, рост и масштабирование.</p></td></tr>
<tr><td class="px" style="padding-top:6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">
${priceRow('Стандарт','25 000 ₽','37 500 ₽',links.standard,'#087f8c')}
${priceRow('Бизнес','45 000 ₽','58 500 ₽',links.business,'#087f8c')}
${priceRow('Full Pass','88 000 ₽','105 600 ₽',links.fullpass,'#ff299b')}
</table></td></tr>
<tr><td class="px" style="padding-top:25px"><div style="background:#effbfc;border-radius:12px;padding:18px;line-height:24px"><b>Почему лучше оформить билет сейчас?</b><br>Оплаченный билет сохраняет условия после повышения. Все билеты именные и входят в единый реестр на 111 мест.</div></td></tr>
<tr><td class="px" style="padding-top:25px;padding-bottom:10px;text-align:center"><a class="btn" href="${links.tickets}" target="_blank" style="background:#10213b;color:#fff">Выбрать билет и оставить заявку →</a><p class="small muted">После заявки менеджер предложит счёт для юридического лица или оплату картой.</p></td></tr>${footerDeadline()}</table></td></tr></table>`);

const files = {
  'conference-01-personal-invitation.html': t1,
  'conference-02-by-audience.html': t2,
  'conference-03-ticket-selector.html': t3,
  'conference-04-business-roi.html': t4,
  'conference-05-price-deadline.html': t5,
};
for (const [name, html] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), html);
console.log(`Built ${Object.keys(files).length} templates`);
