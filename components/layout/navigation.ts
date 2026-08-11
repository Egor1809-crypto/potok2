import {
  BarChart3,
  Building2,
  Cable,
  ContactRound,
  FileText,
  LayoutDashboard,
  MailOpen,
  Megaphone,
  Settings,
  Shapes,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ProductNavItem = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  keywords?: string[];
};

export type ProductNavGroup = {
  label: string;
  items: ProductNavItem[];
};

export const productNavigation: ProductNavGroup[] = [
  {
    label: "Рабочее пространство",
    items: [
      {
        label: "Обзор",
        description: "Активность и показатели команды",
        href: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
        keywords: ["главная", "обзор", "дашборд"],
      },
      {
        label: "Контакты",
        description: "Люди, сохранённые виды и история общения",
        href: "/contacts",
        icon: ContactRound,
        keywords: ["люди", "crm", "база"],
      },
      {
        label: "Компании",
        description: "Организации и связанные с ними контакты",
        href: "/companies",
        icon: Building2,
        keywords: ["аккаунты", "организации"],
      },
      {
        label: "Сегменты",
        description: "Сохранённые и динамические аудитории",
        href: "/segments",
        icon: UsersRound,
        keywords: ["аудитории", "списки", "фильтры"],
      },
    ],
  },
  {
    label: "Рассылки",
    items: [
      {
        label: "Кампании",
        description: "Email, Telegram и ВКонтакте в одной кампании",
        href: "/campaigns",
        icon: Megaphone,
        keywords: ["почта", "telegram", "вконтакте", "отправить", "рассылка"],
      },
      {
        label: "Каналы и интеграции",
        description: "VK WorkSpace, Telegram, ВКонтакте и сервисы отправки",
        href: "/integrations",
        icon: Cable,
        keywords: ["vk workspace", "telegram", "вконтакте", "unisender", "sendpulse", "smtp", "api"],
      },
      {
        label: "Редактор писем",
        description: "Дизайн и персонализация писем",
        href: "/email-builder",
        icon: MailOpen,
        keywords: ["редактор", "письмо", "дизайн"],
      },
      {
        label: "Шаблоны",
        description: "Готовые дизайны писем",
        href: "/templates",
        icon: FileText,
        keywords: ["библиотека", "дизайны"],
      },
      {
        label: "Аналитика",
        description: "Доставка, вовлечённость и ответы",
        href: "/analytics",
        icon: BarChart3,
        keywords: ["отчёты", "метрики", "эффективность"],
      },
    ],
  },
  {
    label: "Управление",
    items: [
      {
        label: "Импорт",
        description: "Перенос контактов в рабочее пространство",
        href: "/import",
        icon: UploadCloud,
        keywords: ["csv", "xlsx", "загрузка"],
      },
      {
        label: "Настройки",
        description: "Команда, рассылки и рабочее пространство",
        href: "/settings",
        icon: Settings,
        keywords: ["оплата", "домены", "бренд", "участники"],
      },
    ],
  },
];

export const productRoutes: ProductNavItem[] = productNavigation.flatMap(
  (group) => group.items,
);

export const quickCreateRoutes: ProductNavItem[] = [
  {
    label: "Новая кампания",
    description: "Выберите аудиторию и начните письмо",
    href: "/campaigns/new",
    icon: Shapes,
    exact: true,
    keywords: ["создать", "письмо", "отправить"],
  },
];

export function isProductRouteActive(
  pathname: string,
  item: ProductNavItem,
) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getProductSection(pathname: string) {
  if (pathname === "/campaigns/new") return "Новая кампания";
  return (
    productRoutes.find((item) => isProductRouteActive(pathname, item))?.label ??
    "Обзор"
  );
}
