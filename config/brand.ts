/** Product identity and safe fallbacks shown before the workspace API loads. */
export const brandConfig = {
  name: "MAILFLOW",
  legalName: "MAILFLOW",
  tagline: "Студия красивых писем и управляемой доставки.",
  description:
    "Создавайте красивые персональные письма, управляйте контактами и передавайте готовые кампании проверенным провайдерам.",
  shortDescription: "Дизайн писем, аудитории и доставка в одном пространстве.",
  accentColor: "#635BFF",
  secondaryAccentColor: "#34B6E4",
  logoMark: "M",
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
