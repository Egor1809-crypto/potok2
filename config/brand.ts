/** Product identity and safe fallbacks shown before the workspace API loads. */
export const brandConfig = {
  name: "Поток",
  legalName: "Поток",
  tagline: "Письма, презентации и изображения в одном пространстве.",
  description:
    "Создавайте письма, презентации и изображения с ИИ, редактируйте материалы и работайте с командой в Потоке.",
  shortDescription: "Творческая студия для вас и вашей команды.",
  accentColor: "#635BFF",
  secondaryAccentColor: "#34B6E4",
  logoMark: "П",
  logoPath: "/potok-logo.png",
  website: "https://tech-pravo.ru/",
  supportEmail: "info@tech-pravo.ru",
  social: {
    linkedin: "",
    x: "",
  },
} as const;

export const workspaceConfig = {
  id: "workspace-main",
  name: "ТехнологИИ права",
  plan: "Масштаб",
  timezone: "Europe/Moscow",
  locale: "ru-RU",
  contactLimit: 50_000,
  monthlySendLimit: 250_000,
} as const;

export const demoUser = {
  id: "participant-main",
  name: "Участник",
  firstName: "Участник",
  email: "info@tech-pravo.ru",
  initials: "У",
  role: "Участник · полный доступ",
  avatarColor: "#675CF5",
} as const;

export const BRAND_NAME = brandConfig.name;

export default brandConfig;
