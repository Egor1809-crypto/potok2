import type { EmailBlock, EmailTemplate, TemplateCategory } from "@/types";

type CreativeSystem = {
  id: string;
  name: string;
  accent: string;
  workspace: string;
  body: string;
  text: string;
  soft: string;
  frame: NonNullable<EmailTemplate["frameStyle"]>;
  radius: number;
  pattern: string;
  font: "Arial" | "Georgia" | "Verdana" | "Trebuchet MS";
  mood: string;
};

type CreativeStory = {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  subject: string;
  preview: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  facts: [string, string, string, string];
  action: string;
  supporting: string[];
};

const systems: CreativeSystem[] = [
  { id: "memphis", name: "Memphis Play", accent: "#FF5C35", workspace: "#FFF2D9", body: "#FFFDF8", text: "#202047", soft: "#FFE4A8", frame: "offset", radius: 18, pattern: "●  ╱  ▲  ~  ■  ╲  ●  ~  ▲", font: "Trebuchet MS", mood: "цветные фигуры и энергичная модульная сетка" },
  { id: "bauhaus", name: "Bauhaus 26", accent: "#E8312F", workspace: "#E7E2D4", body: "#F5F0E4", text: "#171717", soft: "#F6C445", frame: "editorial", radius: 0, pattern: "●  ■  ▲     ●  ■  ▲     ●", font: "Arial", mood: "геометрия Баухауса и жёсткий ритм" },
  { id: "cinema", name: "Cinema Noir", accent: "#E4C47A", workspace: "#09090B", body: "#17171A", text: "#F7F2E8", soft: "#27272C", frame: "double", radius: 0, pattern: "✦       ·       ✦       ·       ✦", font: "Georgia", mood: "кинематографичный свет и титры" },
  { id: "botanical", name: "Botanical Press", accent: "#397A54", workspace: "#E2EBDE", body: "#F7F5EA", text: "#26362A", soft: "#DCE8D8", frame: "inset", radius: 22, pattern: "❦    ︵    ❧    ︵    ❦", font: "Georgia", mood: "ботанические знаки и мягкая печатная бумага" },
  { id: "neo-tokyo", name: "Neo Tokyo", accent: "#FF2E8A", workspace: "#111225", body: "#17182E", text: "#F6F5FF", soft: "#24264A", frame: "top-accent", radius: 8, pattern: "東京  //  未来  //  026  //  東京", font: "Verdana", mood: "ночной интерфейс, маджента и технические метки" },
  { id: "paper-cut", name: "Paper Cut", accent: "#6B48D7", workspace: "#E8DDF5", body: "#FFF9F0", text: "#332744", soft: "#EFE4FF", frame: "soft", radius: 28, pattern: "╭─✂─╮    ╭────╮    ╭─✂─╮", font: "Trebuchet MS", mood: "слои цветной бумаги и мягкие вырезы" },
  { id: "nordic", name: "Nordic Air", accent: "#1D6D72", workspace: "#E9F1F0", body: "#FFFFFF", text: "#203537", soft: "#E3F0EF", frame: "hairline", radius: 16, pattern: "—   ○   —   ○   —   ○   —", font: "Arial", mood: "северный воздух, спокойствие и ясная сетка" },
  { id: "ledger", name: "The Ledger", accent: "#9A2B2B", workspace: "#D8D1C3", body: "#F4EDDE", text: "#302820", soft: "#E8DDC8", frame: "stamp", radius: 0, pattern: "№ 026  :::::  ARCHIVE  :::::  PAGE 01", font: "Georgia", mood: "архивная ведомость и документальные штампы" },
  { id: "holo", name: "Holo Future", accent: "#5B5AF7", workspace: "#E7F3FF", body: "#FBFDFF", text: "#1E2350", soft: "#E9E5FF", frame: "capsule", radius: 30, pattern: "◇  ◈  ◇  /  SIGNAL  /  ◇  ◈  ◇", font: "Verdana", mood: "иридисцентные сигналы и объёмные капсулы" },
  { id: "mono", name: "Editorial Mono", accent: "#2F55FF", workspace: "#E5E5E5", body: "#FAFAF8", text: "#111111", soft: "#ECECEC", frame: "top-bottom", radius: 0, pattern: "A01      B02      C03      D04", font: "Arial", mood: "монохромная типографика с одним синим сигналом" },
  { id: "atelier", name: "Atelier Rouge", accent: "#B9263F", workspace: "#EEDFD8", body: "#FFF9F4", text: "#2A1820", soft: "#F4D8D6", frame: "luxury", radius: 10, pattern: "❦  ATELIER  ❦  ÉDITION 026  ❦", font: "Georgia", mood: "кутюрная редакционность, тонкий кант и красный штамп" },
  { id: "circuit", name: "Circuit Lab", accent: "#00A67E", workspace: "#071B1B", body: "#0B2422", text: "#E8FFF8", soft: "#123C37", frame: "blueprint", radius: 0, pattern: "○─┬─●──┬──○  /  SIGNAL_READY", font: "Verdana", mood: "схемы, сигналы и инженерная точность" },
  { id: "postal", name: "Air Mail", accent: "#3156A6", workspace: "#E8E1D6", body: "#FFFDF5", text: "#252B3B", soft: "#E8EEF9", frame: "postcard", radius: 22, pattern: "▥  AIR MAIL  ·  PRIORITY  ·  PAR AVION  ▥", font: "Trebuchet MS", mood: "почтовая открытка, марки и рукописный ритм" },
  { id: "festival", name: "Festival Pop", accent: "#FF3D67", workspace: "#FFE86B", body: "#FFFDF1", text: "#31144A", soft: "#8CE6D1", frame: "poster", radius: 0, pattern: "▲  ●  ■  ✦  ▲  ●  ■  ✦", font: "Trebuchet MS", mood: "фестивальный постер, крупная типографика и контрастные фигуры" },
  { id: "gallery", name: "Gallery Note", accent: "#DC5A32", workspace: "#DAD6CF", body: "#F7F3EA", text: "#282520", soft: "#EAE0CF", frame: "window", radius: 18, pattern: "EXHIBITION  /  ROOM 04  /  13—26", font: "Georgia", mood: "музейная этикетка, свободное поле и кураторская подача" },
  { id: "alpine", name: "Alpine Signal", accent: "#E4372F", workspace: "#E8EDF0", body: "#FFFFFF", text: "#17202A", soft: "#E9F0F4", frame: "railway", radius: 0, pattern: "↑  NORTH  /  026  /  ALT. 1850  ↑", font: "Arial", mood: "швейцарская навигация, маршрутные метки и чистый воздух" },
  { id: "receipt", name: "Receipt Club", accent: "#2A2A2A", workspace: "#D6D2C8", body: "#FFFDF4", text: "#202020", soft: "#EFEBDD", frame: "ticket", radius: 12, pattern: "--------------------------------\nNO. 026  ·  AUTHORIZED", font: "Arial", mood: "кассовый чек, моноширинные детали и честная функциональность" },
  { id: "lunar", name: "Lunar Orbit", accent: "#A9FF66", workspace: "#050713", body: "#0E1224", text: "#F3F5FF", soft: "#1A2241", frame: "focus", radius: 8, pattern: "◉  ◌  ◎  /  ORBIT 026  /  ◎  ◌  ◉", font: "Verdana", mood: "космический интерфейс, орбиты и кислотный сигнал" },
  { id: "ceramic", name: "Ceramic Blue", accent: "#215DA8", workspace: "#DBE8ED", body: "#FFFDF7", text: "#17314A", soft: "#DDEBF3", frame: "side-lines", radius: 0, pattern: "✣  ❧  ✣  AZULEJO  ✣  ❧  ✣", font: "Georgia", mood: "синяя керамика, симметричный орнамент и ремесленный характер" },
  { id: "newsflash", name: "Newsflash", accent: "#F01818", workspace: "#E2E2E2", body: "#FFFFFF", text: "#0B0B0B", soft: "#F1F1F1", frame: "top-ribbon", radius: 16, pattern: "BREAKING  •  EDITION 026  •  LIVE", font: "Arial", mood: "новостная срочность, бегущая строка и модульные заголовки" },
];

const stories: CreativeStory[] = [
  { id: "private-invite", name: "Закрытое приглашение", category: "Events", description: "Персональное приглашение с программой, билетом и одним главным действием.", subject: "{{first_name}}, ваше персональное приглашение", preview: "Камерная встреча для тех, кто принимает решения.", eyebrow: "PRIVATE / 26", title: "Встреча без сцены и общих слов", subtitle: "Один вечер для практиков, которым важны честные кейсы и содержательные знакомства.", facts: ["18:30", "сбор гостей", "19:00", "закрытая дискуссия"], action: "Подтвердить участие", supporting: ["Практический разбор вместо докладов", "Разговор с авторами решений", "Ужин и профессиональные знакомства"] },
  { id: "product-drop", name: "Продуктовый дроп", category: "Business", description: "Запуск продукта с демонстрацией ценности, показателями и быстрым стартом.", subject: "Новый рабочий модуль уже доступен", preview: "От идеи до готового письма в одном процессе.", eyebrow: "DROP / 01", title: "Меньше сборки. Больше сильных писем.", subtitle: "Новая студия объединяет дизайн, содержание, сохранение и экспорт без потери макета.", facts: ["50+", "новых арт-систем", "1 окно", "для всего процесса"], action: "Открыть студию", supporting: ["Редактируемые дизайнерские системы", "Настоящие ссылки и готовый HTML", "Сохранение собственных шаблонов"] },
  { id: "weekly-signal", name: "Еженедельный сигнал", category: "Newsletter", description: "Содержательный выпуск с редакционным тезисом, фактами и заметкой автора.", subject: "Weekly Signal — три идеи на эту неделю", preview: "Коротко о том, что действительно влияет на работу.", eyebrow: "ISSUE / 18", title: "Три сигнала, которые стоит обсудить с командой", subtitle: "Не поток новостей, а редакционный выбор фактов, меняющих ежедневные решения.", facts: ["01", "новый стандарт", "02", "практика недели"], action: "Читать выпуск", supporting: ["Как проверять результат ИИ", "Где автоматизация создаёт риск", "Что закрепить в командном процессе"] },
  { id: "personal-pitch", name: "Личное предложение", category: "Outreach", description: "Короткое персональное обращение с конкретным наблюдением и спокойным следующим шагом.", subject: "{{first_name}}, идея для {{company}}", preview: "Предлагаю проверить её на одном реальном процессе.", eyebrow: "PERSONAL / NOTE", title: "Есть конкретная идея для вашей команды", subtitle: "Я изучил открытые материалы {{company}} и увидел сценарий, где можно сократить рутину без потери контроля.", facts: ["7 дней", "до прототипа", "1 процесс", "для честной проверки"], action: "Выбрать время", supporting: ["Без длинной презентации", "На реальных данных команды", "С понятным критерием результата"] },
  { id: "status-update", name: "Статус и результат", category: "Transactional", description: "Сервисное письмо со статусом, деталями операции и ясным следующим действием.", subject: "Готово: статус запроса обновлён", preview: "Результат, документ и следующий шаг внутри.", eyebrow: "STATUS / READY", title: "Запрос проверен и готов", subtitle: "Все материалы обработаны. Результат сохранён в рабочем пространстве.", facts: ["13.08", "дата обновления", "READY", "текущий статус"], action: "Открыть результат", supporting: ["Проверка завершена", "Документ сформирован", "Следующее действие доступно"] },
  { id: "research-brief", name: "Исследовательский бриф", category: "Newsletter", description: "Аналитическая записка с главным выводом, двумя фактами и ссылкой на полную версию.", subject: "Новый бриф: что изменилось за месяц", preview: "Один вывод, два сигнала и практическое следствие.", eyebrow: "RESEARCH / 08", title: "Главное изменение скрыто не в цифре", subtitle: "Мы собрали короткую записку о том, как новый подход влияет на ежедневные решения команды.", facts: ["12 источников", "проверено", "3 сценария", "для применения"], action: "Открыть исследование", supporting: ["Главный вывод на первой странице", "Методология без чёрного ящика", "Практический чек-лист внутри"] },
  { id: "award-note", name: "Награда и достижение", category: "Business", description: "Праздничное письмо о результате команды с благодарностью и следующим ориентиром.", subject: "Этот результат — заслуга всей команды", preview: "Фиксируем достижение и благодарим каждого участника.", eyebrow: "MILESTONE / 026", title: "Мы сделали это вместе", subtitle: "Важная точка пройдена — время отметить людей, решения и смелость, которые привели к результату.", facts: ["100%", "цель достигнута", "26 дней", "командной работы"], action: "Посмотреть историю", supporting: ["Спасибо каждому участнику", "Главные моменты собраны внутри", "Следующая цель уже определена"] },
];

function logo(prefix: string, system: CreativeSystem, story: CreativeStory): EmailBlock {
  return { id: `${prefix}-logo`, type: "logo", content: `${system.name.toUpperCase()}  /  ${story.eyebrow}`, alignment: system.id === "cinema" || system.id === "botanical" ? "center" : "left", backgroundColor: system.body, textColor: system.accent, fontFamily: system.font, fontWeight: 700, fontSize: 11, letterSpacing: 3, paddingTop: 28, paddingBottom: 18 };
}

function scenarioMiddle(prefix: string, system: CreativeSystem, story: CreativeStory): EmailBlock[] {
  if (story.id === "private-invite") return [
    { id: `${prefix}-timeline`, type: "timeline", content: `${story.facts[0]}|${story.facts[1]}|${story.facts[2]}|${story.facts[3]}|20:30|ужин и нетворкинг`, alignment: "left", backgroundColor: system.soft, textColor: system.text, fontFamily: system.font, borderColor: system.accent, borderWidth: 1, borderRadius: system.radius },
    { id: `${prefix}-coupon`, type: "coupon", content: `ПЕРСОНАЛЬНЫЙ БИЛЕТ|${system.id.toUpperCase()}—026|Покажите код при регистрации`, alignment: "center", backgroundColor: system.soft, textColor: system.text, fontFamily: system.font, borderRadius: system.radius },
  ];
  if (story.id === "product-drop") return [
    { id: `${prefix}-stats`, type: "stats", content: story.facts.join("|"), alignment: "center", backgroundColor: system.soft, textColor: system.text, borderRadius: system.radius },
    { id: `${prefix}-product`, type: "product", content: `Поток Studio|${story.supporting.join(" · ")}|Доступно сейчас`, label: story.action, href: "https://tech-pravo.ru/", alignment: "left", backgroundColor: system.soft, textColor: system.text, borderColor: system.accent, borderWidth: 1, borderRadius: system.radius },
  ];
  if (story.id === "weekly-signal") return [
    { id: `${prefix}-columns`, type: "columns", content: `${story.facts[0]} / ${story.facts[1]}\n${story.supporting[0]}|${story.facts[2]} / ${story.facts[3]}\n${story.supporting[1]}`, alignment: "left", backgroundColor: system.soft, textColor: system.text, fontFamily: system.font, borderColor: system.accent, borderWidth: 1, borderRadius: system.radius },
    { id: `${prefix}-quote`, type: "quote", content: `${story.supporting[2]}|Редакция Поток`, alignment: "left", backgroundColor: system.soft, textColor: system.text, fontFamily: system.font, borderRadius: system.radius },
  ];
  if (story.id === "personal-pitch") return [
    { id: `${prefix}-text`, type: "text", content: "{{first_name}}, предлагаю не демонстрацию, а короткий разбор одного реального сценария вашей команды — с готовым макетом и измеримым результатом.", alignment: "left", backgroundColor: "transparent", textColor: system.text, fontFamily: system.font, fontSize: 17, lineHeight: 170 },
    { id: `${prefix}-comparison`, type: "comparison", content: `ОБЫЧНО|Длинная презентация без привязки к процессу|ПРЕДЛАГАЮ|Рабочий прототип на одном сценарии {{company}}`, alignment: "left", backgroundColor: system.soft, textColor: system.text, borderColor: system.accent, borderWidth: 1, borderRadius: system.radius },
  ];
  return [
    { id: `${prefix}-notice`, type: "notice", content: `${story.eyebrow}|${story.subtitle}|Дополнительных действий до проверки не требуется`, alignment: "left", backgroundColor: system.soft, textColor: system.text, borderColor: system.accent, borderWidth: 1, borderRadius: system.radius },
    { id: `${prefix}-document`, type: "document", content: `Результат проверки|PDF · 6 страниц|Готов к просмотру`, label: "Открыть документ", href: "https://tech-pravo.ru/", alignment: "left", backgroundColor: system.soft, textColor: system.text, borderColor: system.accent, borderWidth: 1, borderRadius: system.radius },
  ];
}

function blocksFor(system: CreativeSystem, story: CreativeStory): EmailBlock[] {
  const prefix = `creative-${system.id}-${story.id}`;
  const heroType = ["bauhaus", "neo-tokyo", "mono"].includes(system.id) ? "banner" as const : "hero" as const;
  const aligned = ["cinema", "botanical", "holo"].includes(system.id) ? "center" as const : "left" as const;
  const titleSize = ["bauhaus", "neo-tokyo", "mono"].includes(system.id) ? 46 : system.id === "cinema" ? 43 : 39;
  return [
    logo(prefix, system, story),
    { id: `${prefix}-pattern`, type: "pattern", content: system.pattern, alignment: "center", backgroundColor: system.id === "neo-tokyo" || system.id === "cinema" ? system.soft : "transparent", textColor: system.accent, fontFamily: system.font, fontSize: 14, letterSpacing: 3, borderRadius: system.radius },
    { id: `${prefix}-hero`, type: heroType, content: `${story.title}|${story.subtitle}`, alignment: aligned, backgroundColor: system.id === "bauhaus" || system.id === "memphis" ? system.soft : system.id === "mono" ? system.accent : system.body, textColor: system.id === "mono" ? "#FFFFFF" : system.text, fontFamily: system.font, fontWeight: system.id === "cinema" || system.id === "botanical" ? 400 : 700, fontSize: titleSize, lineHeight: 105, borderColor: system.accent, borderWidth: system.id === "bauhaus" || system.id === "ledger" ? 2 : 0, borderRadius: system.radius, paddingTop: 34, paddingBottom: 34 },
    ...scenarioMiddle(prefix, system, story),
    { id: `${prefix}-checklist`, type: "checklist", content: story.supporting.join("|"), alignment: "left", backgroundColor: system.id === "memphis" ? system.soft : "transparent", textColor: system.text, fontFamily: system.font, borderRadius: system.radius },
    { id: `${prefix}-button`, type: "button", content: story.action, label: story.action, href: "https://tech-pravo.ru/", alignment: aligned, buttonStyle: system.id === "cinema" || system.id === "botanical" || system.id === "ledger" ? "outline" : "solid", backgroundColor: "transparent", textColor: system.id === "holo" || system.id === "nordic" ? "#FFFFFF" : system.id === "memphis" || system.id === "bauhaus" ? system.text : "#FFFFFF", fontFamily: system.font, borderRadius: system.radius > 20 ? 14 : system.radius },
    { id: `${prefix}-footer`, type: "footer", content: `${system.name} · ${system.mood} · Настроить подписку · Отписаться`, alignment: aligned, backgroundColor: system.id === "cinema" || system.id === "neo-tokyo" ? system.soft : "transparent", textColor: system.id === "cinema" || system.id === "neo-tokyo" ? "#A8A8B6" : system.text, fontFamily: system.font, fontSize: 10, paddingTop: 24, paddingBottom: 30 },
  ];
}

export const creativeTemplates: EmailTemplate[] = systems.flatMap((system, systemIndex) =>
  stories.map((story, storyIndex) => ({
    id: `template-v8-creative-${system.id}-${story.id}`,
    name: `${system.name} · ${story.name}`,
    category: story.category,
    description: `${story.description} Арт-направление: ${system.mood}.`,
    subject: story.subject,
    previewText: story.preview,
    accentColor: system.accent,
    backgroundColor: system.workspace,
    bodyBackground: system.body,
    contentWidth: system.id === "botanical" || system.id === "cinema" ? 580 : 620,
    frameStyle: system.frame,
    frameColor: system.accent,
    frameRadius: system.radius,
    thumbnailVariant: ["bauhaus", "neo-tokyo", "memphis", "mono"].includes(system.id) ? "bold" : ["cinema", "botanical", "ledger"].includes(system.id) ? "editorial" : "classic",
    blocks: blocksFor(system, story),
    isFavorite: false,
    updatedAt: new Date(Date.UTC(2026, 7, 13, 15, systemIndex, storyIndex)).toISOString(),
  })),
);
