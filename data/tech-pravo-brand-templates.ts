import type { EmailBlock, EmailTemplate } from "@/types";

const SITE_ORIGIN = "https://mailflow-outreach.isakovegor820.chatgpt.site";
const CONFERENCE_URL = "https://tech-pravo.ru/conference";

type BrandTemplateSpec = {
  slug: string;
  name: string;
  description: string;
  background: number;
  dark: boolean;
  accent: string;
  card: string;
  text: string;
  title: string;
  subtitle: string;
  eyebrow: string;
};

const specs: BrandTemplateSpec[] = [
  { slug: "neon-justice", name: "Технологии права · Неоновое правосудие", description: "Тёмная технологичная сцена с маскотом, архитектурой и неоновыми контурами.", background: 1, dark: true, accent: "#16C8FF", card: "#07172F", text: "#FFFFFF", eyebrow: "ТЕХНОЛОГИИ · ПРАВО · БУДУЩЕЕ", title: "Право встречается с технологиями", subtitle: "Два дня практики, сильных кейсов и решений, которые уже меняют юридическую работу." },
  { slug: "light-gzhel", name: "Технологии права · Светлая Гжель", description: "Воздушная сине-белая композиция с гжельским маскотом и аккуратными карточками.", background: 2, dark: false, accent: "#0477D8", card: "#FFFFFF", text: "#102445", eyebrow: "ПРИГЛАШЕНИЕ НА КОНФЕРЕНЦИЮ", title: "Разберём технологии без лишнего шума", subtitle: "Практические сценарии, понятные выводы и люди, с которыми стоит познакомиться лично." },
  { slug: "architectural-waves", name: "Технологии права · Архитектурные волны", description: "Светлая московская архитектура, динамичные бирюзово-розовые линии и чистая типографика.", background: 3, dark: false, accent: "#00B8C8", card: "#FFFFFF", text: "#17324D", eyebrow: "МОСКВА · 25–26 СЕНТЯБРЯ", title: "Главная встреча юридических команд", subtitle: "Собираем лидеров практики, LegalTech-команды и экспертов по искусственному интеллекту." },
  { slug: "mascot-city", name: "Технологии права · Маскот и Москва", description: "Фирменный маскот на фоне высотки и цветных диагоналей для яркого приглашения.", background: 4, dark: false, accent: "#F335A2", card: "#FFFFFF", text: "#122B45", eyebrow: "ВАШ БИЛЕТ В ПРОФЕССИОНАЛЬНОЕ СООБЩЕСТВО", title: "Встречаемся там, где появляется будущее права", subtitle: "Выберите билет, соберите команду и получите рабочие идеи для следующего квартала." },
  { slug: "cyber-law", name: "Технологии права · Киберправо", description: "Кинематографичный образ цифрового юриста с холодным синим светом и неоновым акцентом.", background: 5, dark: true, accent: "#20D8FF", card: "#071D35", text: "#FFFFFF", eyebrow: "AI · COMPLIANCE · LEGAL OPERATIONS", title: "Не наблюдать за переменами — управлять ими", subtitle: "Покажем, как внедрять искусственный интеллект и автоматизацию без потери контроля." },
  { slug: "dual-assistants", name: "Технологии права · Два помощника", description: "Светлая технологичная сцена с двумя фирменными героями и мягкой гжельской рамкой.", background: 6, dark: false, accent: "#1586E8", card: "#F8FCFF", text: "#102747", eyebrow: "ЛЮДИ + ТЕХНОЛОГИИ", title: "Команда сильнее, когда инструменты понятны", subtitle: "Сравним подходы, разберём кейсы и соберём личный маршрут внедрения для вашей команды." },
  { slug: "exhibition-frame", name: "Технологии права · Выставочная рамка", description: "Музейная подача с металлической рамой, архитектурой и гжельским орнаментом.", background: 7, dark: false, accent: "#1B66C9", card: "#FFFFFF", text: "#142746", eyebrow: "КОЛЛЕКЦИЯ ПРАКТИЧЕСКИХ РЕШЕНИЙ", title: "Сохраните место в программе", subtitle: "Доступ к докладам, закрытым разборам и профессиональному кругу участников конференции." },
  { slug: "neon-orbit", name: "Технологии права · Неоновая орбита", description: "Динамичная световая орбита, цифровой юрист и маскот для энергичного продающего письма.", background: 8, dark: false, accent: "#E13A9D", card: "#F9FCFF", text: "#152A4A", eyebrow: "БИЛЕТЫ УЖЕ ДОСТУПНЫ", title: "Войдите в круг тех, кто задаёт правила", subtitle: "Два насыщенных дня, новые деловые связи и концентрат прикладного опыта." },
  { slug: "gzhel-tech", name: "Технологии права · Гжель и технологии", description: "Богатая гжельская окантовка в паре с неоновыми интерфейсами и героями конференции.", background: 9, dark: false, accent: "#176FD2", card: "#FFFFFF", text: "#11294A", eyebrow: "РУССКИЙ КОД · ЦИФРОВОЕ ПРАВО", title: "Традиция качества в новом технологическом контексте", subtitle: "Обсудим решения, которые выдерживают проверку практикой, безопасностью и здравым смыслом." },
  { slug: "city-flow", name: "Технологии права · Городской поток", description: "Архитектурный постер с крупными цветовыми потоками и строгой деловой карточкой.", background: 10, dark: false, accent: "#00BFC8", card: "#FFFFFF", text: "#11304E", eyebrow: "В ЦЕНТРЕ МОСКВЫ", title: "Два дня, которые обновят рабочую оптику", subtitle: "Конференция для тех, кто отвечает за право, процессы, риски и цифровые продукты." },
  { slug: "digital-lawyer", name: "Технологии права · Цифровой юрист", description: "Контрастный образ цифрового юриста на светлом архитектурном фоне с розово-бирюзовой динамикой.", background: 11, dark: false, accent: "#F233A0", card: "#FFFFFF", text: "#102A47", eyebrow: "ДЛЯ ЛИДЕРОВ ЮРИДИЧЕСКИХ КОМАНД", title: "Соберите преимущество до того, как оно станет стандартом", subtitle: "Кейсы, инструменты и контакты для уверенной работы с правом и технологиями." },
];

function blocks(spec: BrandTemplateSpec): EmailBlock[] {
  const muted = spec.dark ? "#C6D8EE" : "#425A75";
  return [
    { id: `${spec.slug}-eyebrow`, type: "pattern", content: spec.eyebrow, href: `${SITE_ORIGIN}/email-brand/patterns/tech-pattern-${String(spec.background).padStart(2, "0")}.jpg`, alignment: "center", backgroundColor: spec.card, textColor: spec.accent, fontSize: 12, fontWeight: 700, letterSpacing: 2, borderRadius: 12, paddingTop: 12, paddingBottom: 12 },
    { id: `${spec.slug}-hero`, type: "hero", content: `${spec.title}|${spec.subtitle}`, alignment: "left", backgroundColor: spec.card, textColor: spec.text, fontSize: 32, fontWeight: 700, lineHeight: 120, borderColor: spec.accent, borderWidth: 1, borderRadius: 20, paddingTop: 28, paddingBottom: 28 },
    { id: `${spec.slug}-text`, type: "text", content: "{{first_name}}, это письмо — приглашение не просто послушать доклады, а найти решения для задач вашей команды и познакомиться с людьми, которые уже внедряют их на практике.", alignment: "left", backgroundColor: spec.card, textColor: spec.text, fontSize: 16, lineHeight: 165, borderRadius: 16, paddingTop: 22, paddingBottom: 22 },
    { id: `${spec.slug}-list`, type: "checklist", content: "Практические кейсы без рекламной воды|Сильные эксперты и руководители практик|Новые контакты и идеи для внедрения", alignment: "left", backgroundColor: spec.card, textColor: spec.text, fontSize: 15, lineHeight: 155, borderColor: spec.accent, borderWidth: 1, borderRadius: 16, paddingTop: 20, paddingBottom: 20 },
    { id: `${spec.slug}-button`, type: "button", content: "Выбрать билет", label: "Выбрать билет", href: CONFERENCE_URL, alignment: "center", backgroundColor: "transparent", textColor: "#FFFFFF", fontSize: 15, fontWeight: 700, borderRadius: 10, paddingTop: 18, paddingBottom: 24 },
    { id: `${spec.slug}-footer`, type: "footer", content: "Технологии права · Москва · 25–26 сентября\nВы получили письмо, потому что интересовались профессиональными событиями. Отписаться", alignment: "center", backgroundColor: spec.card, textColor: muted, fontSize: 12, lineHeight: 150, borderRadius: 14, paddingTop: 18, paddingBottom: 18 },
  ];
}

export const techPravoBrandTemplates: EmailTemplate[] = specs.map((spec, index) => ({
  id: `template-v12-tech-pravo-brand-${String(index + 1).padStart(2, "0")}-${spec.slug}`,
  name: spec.name,
  category: "Events",
  description: spec.description,
  subject: `${spec.title} — приглашение на конференцию`,
  previewText: spec.subtitle,
  accentColor: spec.accent,
  backgroundColor: spec.dark ? "#010713" : "#E8F3FC",
  bodyBackground: spec.dark ? "#020B1F" : "#EAF6FF",
  backgroundImageUrl: `${SITE_ORIGIN}/email-brand/backgrounds/tech-pravo-${String(spec.background).padStart(2, "0")}.jpg`,
  contentWidth: 620,
  frameStyle: "hairline",
  frameColor: spec.accent,
  frameRadius: 18,
  thumbnailVariant: spec.dark ? "bold" : "editorial",
  blocks: blocks(spec),
  isFavorite: false,
  updatedAt: "2026-08-15T15:20:00Z",
}));
