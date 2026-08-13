import {
  BarChart3,
  Cable,
  ContactRound,
  FolderOpen,
  FileUp,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  PenLine,
  Presentation,
  ScanSearch,
  Settings,
  UsersRound,
  Wrench,
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
 * Главный продукт — единая творческая студия. Письма, презентации и
 * изображения используют общие материалы. Аудитория и доставка остаются
 * следующим, а не первым шагом.
 */
export const productNavigation: ProductNavGroup[] = [
  {
    label: "Творческая студия",
    items: [
      {
        label: "Главная",
        description: "Проекты, материалы и следующие действия",
        href: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
        keywords: ["главная", "сводка"],
      },
      {
        label: "Шаблоны",
        description: "Готовые основы для трёх форматов",
        href: "/templates",
        icon: FolderOpen,
        keywords: ["библиотека", "макеты", "основы"],
        children: [
          { label: "Шаблоны писем", description: "Библиотека email-макетов", href: "/templates", icon: LayoutTemplate, exact: true, keywords: ["письмо", "email", "макет"] },
          { label: "Шаблоны презентаций", description: "Сценарии и темы слайдов", href: "/presentations?view=templates", icon: Presentation, exact: true, keywords: ["слайды", "pptx", "powerpoint"] },
          { label: "Шаблоны фотографий", description: "Сохранённые визуалы и референсы", href: "/image-studio?view=library", icon: Images, exact: true, keywords: ["фото", "изображение", "медиатека", "референс"] },
        ],
      },
      {
        label: "Конструктор",
        description: "Создать письмо, слайды или изображение",
        href: "/email-builder",
        icon: Wrench,
        keywords: ["редактор", "создать", "типограф", "ии"],
        children: [
          { label: "Конструктор писем", description: "Блоки, оформление и ИИ", href: "/email-builder?new=1", icon: PenLine, exact: true, keywords: ["письмо", "email", "блоки", "типограф"] },
          { label: "Конструктор презентаций", description: "Редактируемые слайды и ИИ", href: "/presentations?new=1", icon: Presentation, exact: true, keywords: ["презентация", "слайды", "pptx"] },
          { label: "Конструктор изображений", description: "Генерация визуалов по описанию", href: "/image-studio?view=create", icon: Images, exact: true, keywords: ["фото", "картинка", "визуал", "обложка", "ии"] },
        ],
      },
    ],
  },
  {
    label: "Аудитории и данные",
    items: [
      {
        label: "Контакты",
        description: "Люди, команды, фильтры и согласия",
        href: "/contacts",
        icon: ContactRound,
        keywords: ["люди", "crm", "база", "импорт", "команды"],
      },
      {
        label: "Поиск контактов",
        description: "Найти публичные email и телефоны",
        href: "/contact-finder",
        icon: ScanSearch,
        exact: true,
        keywords: ["парсинг", "сайт", "номер", "телефон", "email", "поиск"],
      },
      {
        label: "Импорт",
        description: "Загрузить CSV, XLSX, XLS или TSV",
        href: "/import",
        icon: FileUp,
        exact: true,
        keywords: ["таблица", "загрузка", "добавить контакты"],
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
    label: "Проверка и отправка",
    items: [
      {
        label: "Тест и отправка",
        description: "Проверить письмо и передать провайдеру",
        href: "/campaigns",
        icon: Megaphone,
        keywords: ["рассылка", "email", "telegram", "вконтакте"],
      },
      {
        label: "Подключения",
        description: "Настроить реальных провайдеров доставки",
        href: "/integrations",
        icon: Cable,
        keywords: ["vk workspace", "telegram", "вконтакте", "smtp", "api", "интеграции"],
      },
      {
        label: "История",
        description: "Переданные задания и ошибки",
        href: "/analytics",
        icon: BarChart3,
        keywords: ["аналитика", "отчёты", "задания", "ошибки", "экспорт"],
      },
    ],
  },
  {
    label: "Рабочее пространство",
    items: [
      {
        label: "Настройки",
        description: "Компания, отправитель и аккаунт",
        href: "/settings",
        icon: Settings,
        exact: true,
        keywords: ["аккаунт", "профиль", "часовой пояс", "данные"],
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
  {
    label: "Создать презентацию",
    description: "Собрать слайды вручную, из письма или с ИИ",
    href: "/presentations?new=1",
    icon: Presentation,
    exact: true,
    keywords: ["новая", "создать", "слайды", "pptx", "ии"],
  },
  {
    label: "Создать изображение",
    description: "Сгенерировать визуал и сохранить в библиотеку",
    href: "/image-studio?new=1",
    icon: Images,
    exact: true,
    keywords: ["новое", "создать", "фото", "картинка", "ии"],
  },
  {
    label: "Найти контакты",
    description: "Извлечь публичные email и телефоны для проверки",
    href: "/contact-finder",
    icon: ScanSearch,
    exact: true,
    keywords: ["парсинг", "сайт", "email", "телефон"],
  },
  {
    label: "Отправить тест",
    description: "Проверить письмо на одном реальном адресе",
    href: "/campaigns/new?channel=email",
    icon: Megaphone,
    exact: true,
    keywords: ["тест", "проверка", "отправка"],
  },
];

export const secondaryProductRoutes: ProductNavItem[] = [];

function routeParts(value: string) {
  const parsed = new URL(value, "https://potok.local");
  return { pathname: parsed.pathname, searchParams: parsed.searchParams };
}

function isOwnRouteActive(location: string, item: ProductNavItem) {
  const current = routeParts(location);
  const target = routeParts(item.href);
  const pathnameMatches = item.exact
    ? current.pathname === target.pathname
    : current.pathname === target.pathname || current.pathname.startsWith(`${target.pathname}/`);
  if (!pathnameMatches) return false;
  return [...target.searchParams.entries()].every(([key, value]) => current.searchParams.get(key) === value);
}

export function isProductRouteActive(location: string, item: ProductNavItem) {
  return isOwnRouteActive(location, item) || item.children?.some((child) => isOwnRouteActive(location, child)) === true;
}

export function getProductSection(pathname: string) {
  if (pathname === "/campaigns/new") return "Новая кампания";
  if (pathname.startsWith("/settings")) return "Настройки";
  if (pathname.startsWith("/import")) return "Импорт контактов";
  if (pathname.startsWith("/templates")) return "Шаблоны";
  if (pathname.startsWith("/email-builder")) return "Редактор писем";
  if (pathname.startsWith("/presentations")) return "Презентации";
  if (pathname.startsWith("/image-studio")) return "Студия изображений";
  if (pathname.startsWith("/contact-finder")) return "Поиск контактов";
  return productRoutes.slice().reverse().find((item) => isOwnRouteActive(pathname, item))?.label ?? "Обзор";
}
