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
 * Главный продукт — визуальная студия писем. Аудитории и доставка вынесены
 * в отдельные группы, чтобы отправка не затмевала создание макета.
 */
export const productNavigation: ProductNavGroup[] = [
  {
    label: "Студия писем",
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
    ],
  },
  {
    label: "Аудитории",
    items: [
      {
        label: "Контакты",
        description: "Люди, команды, фильтры и согласия",
        href: "/contacts",
        icon: ContactRound,
        keywords: ["люди", "crm", "база", "импорт", "команды"],
      },
      {
        label: "Сегменты",
        description: "Динамические аудитории по правилам",
        href: "/segments",
        icon: UsersRound,
        keywords: ["аудитория", "фильтры", "команды"],
      },
    ],
  },
  {
    label: "Доставка · дополнительно",
    items: [
      {
        label: "Кампании",
        description: "Отправка уже готового письма",
        href: "/campaigns",
        icon: Megaphone,
        keywords: ["рассылка", "email", "telegram", "вконтакте"],
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
    label: "Создать письмо",
    description: "Собрать красивое письмо с нуля или с ИИ",
    href: "/email-builder?new=1",
    icon: PenLine,
    exact: true,
    keywords: ["новое", "создать", "дизайн", "ии"],
  },
];

export const secondaryProductRoutes: ProductNavItem[] = [
  {
    label: "Импорт контактов",
    description: "Загрузить CSV, XLSX, XLS или TSV",
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
