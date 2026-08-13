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
];

const stories: CreativeStory[] = [
  { id: "private-invite", name: "Закрытое приглашение", category: "Events", description: "Персональное приглашение с программой, билетом и одним главным действием.", subject: "{{first_name}}, ваше персональное приглашение", preview: "Камерная встреча для тех, кто принимает решения.", eyebrow: "PRIVATE / 26", title: "Встреча без сцены и общих слов", subtitle: "Один вечер для практиков, которым важны честные кейсы и содержательные знакомства.", facts: ["18:30", "сбор гостей", "19:00", "закрытая дискуссия"], action: "Подтвердить участие", supporting: ["Практический разбор вместо докладов", "Разговор с авторами решений", "Ужин и профессиональные знакомства"] },
  { id: "product-drop", name: "Продуктовый дроп", category: "Business", description: "Запуск продукта с демонстрацией ценности, показателями и быстрым стартом.", subject: "Новый рабочий модуль уже доступен", preview: "От идеи до готового письма в одном процессе.", eyebrow: "DROP / 01", title: "Меньше сборки. Больше сильных писем.", subtitle: "Новая студия объединяет дизайн, содержание, сохранение и экспорт без потери макета.", facts: ["50+", "новых арт-систем", "1 окно", "для всего процесса"], action: "Открыть студию", supporting: ["Редактируемые дизайнерские системы", "Настоящие ссылки и готовый HTML", "Сохранение собственных шаблонов"] },
  { id: "weekly-signal", name: "Еженедельный сигнал", category: "Newsletter", description: "Содержательный выпуск с редакционным тезисом, фактами и заметкой автора.", subject: "Weekly Signal — три идеи на эту неделю", preview: "Коротко о том, что действительно влияет на работу.", eyebrow: "ISSUE / 18", title: "Три сигнала, которые стоит обсудить с командой", subtitle: "Не поток новостей, а редакционный выбор фактов, меняющих ежедневные решения.", facts: ["01", "новый стандарт", "02", "практика недели"], action: "Читать выпуск", supporting: ["Как проверять результат ИИ", "Где автоматизация создаёт риск", "Что закрепить в командном процессе"] },
  { id: "personal-pitch", name: "Личное предложение", category: "Outreach", description: "Короткое персональное обращение с конкретным наблюдением и спокойным следующим шагом.", subject: "{{first_name}}, идея для {{company}}", preview: "Предлагаю проверить её на одном реальном процессе.", eyebrow: "PERSONAL / NOTE", title: "Есть конкретная идея для вашей команды", subtitle: "Я изучил открытые материалы {{company}} и увидел сценарий, где можно сократить рутину без потери контроля.", facts: ["7 дней", "до прототипа", "1 процесс", "для честной проверки"], action: "Выбрать время", supporting: ["Без длинной презентации", "На реальных данных команды", "С понятным критерием результата"] },
  { id: "status-update", name: "Статус и результат", category: "Transactional", description: "Сервисное письмо со статусом, деталями операции и ясным следующим действием.", subject: "Готово: статус запроса обновлён", preview: "Результат, документ и следующий шаг внутри.", eyebrow: "STATUS / READY", title: "Запрос проверен и готов", subtitle: "Все материалы обработаны. Результат сохранён в рабочем пространстве.", facts: ["13.08", "дата обновления", "READY", "текущий статус"], action: "Открыть результат", supporting: ["Проверка завершена", "Документ сформирован", "Следующее действие доступно"] },
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
    { id: `${prefix}-product`, type: "product", content: `MAILFLOW Studio|${story.supporting.join(" · ")}|Доступно сейчас`, label: story.action, href: "https://tech-pravo.ru/", alignment: "left", backgroundColor: system.soft, textColor: system.text, borderColor: system.accent, borderWidth: 1, borderRadius: system.radius },
  ];
  if (story.id === "weekly-signal") return [
    { id: `${prefix}-columns`, type: "columns", content: `${story.facts[0]} / ${story.facts[1]}\n${story.supporting[0]}|${story.facts[2]} / ${story.facts[3]}\n${story.supporting[1]}`, alignment: "left", backgroundColor: system.soft, textColor: system.text, fontFamily: system.font, borderColor: system.accent, borderWidth: 1, borderRadius: system.radius },
    { id: `${prefix}-quote`, type: "quote", content: `${story.supporting[2]}|Редакция MAILFLOW`, alignment: "left", backgroundColor: system.soft, textColor: system.text, fontFamily: system.font, borderRadius: system.radius },
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
