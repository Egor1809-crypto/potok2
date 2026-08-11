import {
  BarChart3,
  Cable,
  ContactRound,
  FileUp,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  PenLine,
  Settings,
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
 * Разделы повторяют реальный рабочий маршрут: база → аудитория → сообщение →
 * кампания → каналы → результат. Инструменты подготовки письма должны быть
 * видны постоянно, а не прятаться внутри мастера кампании.
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
        label: "Шаблоны писем",
        description: "Создание и редактирование писем",
        href: "/templates",
        icon: LayoutTemplate,
        keywords: ["письмо", "дизайн", "типограф", "редактор", "email"],
        children: [
          {
            label: "Конструктор писем",
            description: "Собрать письмо из блоков",
            href: "/email-builder",
            icon: PenLine,
            exact: true,
            keywords: ["редактор", "контент", "блоки", "email"],
          },
        ],
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
        description: "Задания провайдерам и ошибки",
        href: "/analytics",
        icon: BarChart3,
        keywords: ["аналитика", "отчёты", "задания", "ошибки", "экспорт"],
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

export const secondaryProductRoutes: ProductNavItem[] = [
  {
    label: "Импорт контактов",
    description: "Загрузить и проверить файл CSV",
    href: "/import",
    icon: FileUp,
    exact: true,
    keywords: ["csv", "загрузка", "добавить контакты"],
  },
  {
    label: "Настройки",
    description: "Аккаунт, отправитель и данные",
    href: "/settings",
    icon: Settings,
    exact: true,
    keywords: ["аккаунт", "профиль", "часовой пояс", "экспорт"],
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
