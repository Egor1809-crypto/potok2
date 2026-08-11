/**
 * Product identity and demo-workspace defaults.
 * Keep product copy and branding imports pointed here so MAILFLOW can be
 * rebranded without hunting through feature code.
 */
export const brandConfig = {
  name: "MAILFLOW",
  legalName: "MAILFLOW",
  tagline: "Рассылки по email и в мессенджерах. Всё в порядке.",
  description:
    "Управляйте контактами и запускайте персональные кампании по email, в Telegram и ВКонтакте из единого рабочего пространства.",
  shortDescription: "Контакты, сообщения и все каналы в одном пространстве.",
  accentColor: "#635BFF",
  secondaryAccentColor: "#34B6E4",
  logoMark: "M",
  website: "https://mailflow.example",
  supportEmail: "hello@mailflow.example",
  social: {
    linkedin: "https://linkedin.com/company/mailflow-demo",
    x: "https://x.com/mailflow_demo",
  },
} as const;

export const workspaceConfig = {
  id: "workspace-legal-team",
  name: "Юридическая команда",
  plan: "Масштаб",
  timezone: "Europe/Moscow",
  locale: "ru-RU",
  contactLimit: 50_000,
  monthlySendLimit: 250_000,
} as const;

export const demoUser = {
  id: "user-egor-sabalin",
  name: "Егор Сабалин",
  firstName: "Егор",
  email: "egor@mailflow.example",
  initials: "ЕС",
  role: "Администратор пространства",
  avatarColor: "#675CF5",
} as const;

export const BRAND_NAME = brandConfig.name;

export default brandConfig;
