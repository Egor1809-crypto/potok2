const SITE_ORIGIN = "https://mailflow-outreach.isakovegor820.chatgpt.site";

export type EmailPatternCategory = "light" | "dark" | "networks" | "security" | "systems";

export type EmailPatternPreset = {
  id: string;
  name: string;
  category: EmailPatternCategory;
  imageUrl: string;
  textColor: string;
  content: string;
  fontSize: number;
  letterSpacing: number;
};

export type EmailBackgroundPreset = {
  id: string;
  name: string;
  imageUrl: string;
  bodyBackground: string;
  workspaceBackground: string;
};

export const emailPatternCategoryLabels: Record<EmailPatternCategory, string> = {
  light: "Светлые технологии",
  dark: "Тёмные технологии",
  networks: "Сети и данные",
  security: "Безопасность",
  systems: "Системы и инфраструктура",
};

const patternNames = [
  "Схема и импульс", "Технологическое кольцо", "Сеть и полигоны",
  "Ночная плата", "Воздушные волны", "Цифровой рельеф",
  "Облачный контур", "Градиентный поток", "Соты и связи",
  "Радар", "Глобальная сеть", "Процессорная шина",
  "Микроточки", "Фиолетовая волна", "Поток частиц",
  "Облачная система", "Механизмы", "Граф связей",
  "Защищённый контур", "Архитектурные полосы", "Светлая плата",
  "Скоростной вектор", "Точки и узлы", "Золотая плата",
  "Экосистема устройств", "Цифровые слои", "Полигональный свет",
  "Двоичный поток", "Цикл данных", "Умный город",
] as const;

const darkPatternNumbers = new Set([4, 6, 10, 14, 16, 18, 22, 24, 26, 28, 30]);
const categories: EmailPatternCategory[] = [
  "light", "systems", "networks", "dark", "light", "dark",
  "systems", "light", "networks", "dark", "networks", "systems",
  "light", "dark", "networks", "dark", "systems", "dark",
  "security", "light", "systems", "dark", "networks", "dark",
  "systems", "dark", "light", "dark", "networks", "dark",
];

export const emailPatternPresets: EmailPatternPreset[] = patternNames.map((name, index) => {
  const number = index + 1;
  const filename = String(number).padStart(2, "0");
  return {
    id: `tech-pattern-${filename}`,
    name,
    category: categories[index],
    imageUrl: `${SITE_ORIGIN}/email-brand/patterns/tech-pattern-${filename}.jpg`,
    textColor: darkPatternNumbers.has(number) ? "#ffffff" : "#0b2344",
    content: "Ваш текст поверх узора",
    fontSize: 18,
    letterSpacing: 0,
  };
});

const backgroundNames = [
  "Неоновое правосудие", "Светлая Гжель", "Архитектурные волны",
  "Маскот и Москва", "Киберправо", "Два помощника",
  "Выставочная рамка", "Неоновая орбита", "Гжель и технологии",
  "Городской поток", "Цифровой юрист",
] as const;

export const emailBackgroundPresets: EmailBackgroundPreset[] = backgroundNames.map((name, index) => {
  const filename = String(index + 1).padStart(2, "0");
  const dark = index === 0;
  return {
    id: `tech-pravo-background-${filename}`,
    name,
    imageUrl: `${SITE_ORIGIN}/email-brand/backgrounds/tech-pravo-${filename}.jpg`,
    bodyBackground: dark ? "#020b1f" : "#eaf6ff",
    workspaceBackground: dark ? "#010713" : "#dfefff",
  };
});
