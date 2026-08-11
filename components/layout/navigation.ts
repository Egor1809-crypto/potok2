import {
  BarChart3,
  Cable,
  ContactRound,
  LayoutDashboard,
  Megaphone,
  Shapes,
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
  children?: ProductNavItem[];
};

export type ProductNavGroup = {
  label: string;
  items: ProductNavItem[];
};

/**
 * Шесть разделов повторяют реальный рабочий маршрут: база → аудитория →
 * кампания → каналы → результат. Импорт, шаблоны и редактор открываются
 * из контекста задачи и не перегружают навигацию.
 */
export const productNavigation: ProductNavGroup[] = [
  {
    label: "Рабочий процесс",
    items: [
      {
        label: "Обзор",
        description: "Что требует внимания сейчас",
        href: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
        keywords: ["главная", "сводка"],
      },
      {
        label: "Контакты",
        description: "Люди, каналы связи и согласия",
        href: "/contacts",
        icon: ContactRound,
        keywords: ["люди", "crm", "база", "импорт"],
      },
      {
        label: "Аудитории",
        description: "Сегменты по правилам контактов",
        href: "/segments",
        icon: UsersRound,
        keywords: ["сегменты", "аудитория", "фильтры"],
      },
      {
        label: "Кампании",
        description: "Сообщения, проверка и запуск",
        href: "/campaigns",
        icon: Megaphone,
        keywords: ["рассылка", "email", "telegram", "вконтакте", "шаблоны"],
      },
      {
        label: "Каналы",
        description: "Провайдеры email, Telegram и ВК",
        href: "/integrations",
        icon: Cable,
        keywords: ["vk workspace", "telegram", "вконтакте", "smtp", "api", "интеграции"],
      },
      {
        label: "Результаты",
        description: "Доставка и отклик по кампаниям",
        href: "/analytics",
        icon: BarChart3,
        keywords: ["аналитика", "отчёты", "метрики", "эффективность"],
      },
    ],
  },
];

export const primaryProductRoutes = productNavigation.flatMap((group) => group.items);

export const productRoutes = primaryProductRoutes.flatMap((item) => [
  item,
  ...(item.children ?? []),
]);

export const quickCreateRoutes: ProductNavItem[] = [
  {
    label: "Создать кампанию",
    description: "Выбрать аудиторию, сообщение и каналы",
    href: "/campaigns/new",
    icon: Shapes,
    exact: true,
    keywords: ["новая", "создать", "отправить"],
  },
];

function isOwnRouteActive(pathname: string, item: ProductNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function isProductRouteActive(pathname: string, item: ProductNavItem) {
  return isOwnRouteActive(pathname, item) || item.children?.some((child) => isOwnRouteActive(pathname, child)) === true;
}

export function getProductSection(pathname: string) {
  if (pathname === "/campaigns/new") return "Новая кампания";
  if (pathname.startsWith("/settings")) return "Настройки";
  if (pathname.startsWith("/import")) return "Импорт контактов";
  if (pathname.startsWith("/templates")) return "Шаблоны";
  if (pathname.startsWith("/email-builder")) return "Редактор писем";
  return productRoutes.slice().reverse().find((item) => isOwnRouteActive(pathname, item))?.label ?? "Обзор";
}
