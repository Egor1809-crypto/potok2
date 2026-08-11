export type DeliveryChannelId = "email" | "telegram" | "vk";

export const PREFERRED_PROVIDERS_STORAGE_KEY = "mailflow:preferred-providers";

export type IntegrationProviderId =
  | "vk-workspace"
  | "telegram-bot-api"
  | "vk-api"
  | "unisender";

export type DeliveryChannelDefinition = {
  id: DeliveryChannelId;
  label: string;
  shortLabel: string;
  description: string;
  contactField: string;
  providerIds: IntegrationProviderId[];
};

export type IntegrationProviderDefinition = {
  id: IntegrationProviderId;
  name: string;
  category: string;
  summary: string;
  channelIds: DeliveryChannelId[];
  accent: string;
  initials: string;
  recommendedFor: string;
  credentials: string[];
  setupSteps: string[];
  limitations: string[];
  route: string;
  deliveryMode: "automatic" | "manual_export" | "roadmap";
};

export const deliveryChannels: DeliveryChannelDefinition[] = [
  {
    id: "email",
    label: "Электронная почта",
    shortLabel: "Email",
    description:
      "Письма с корпоративного домена через почтовый или маркетинговый сервис.",
    contactField: "Рабочий email",
    providerIds: ["vk-workspace", "unisender"],
  },
  {
    id: "telegram",
    label: "Telegram",
    shortLabel: "Telegram",
    description:
      "Сообщения подписчикам бота, которые сами начали диалог и дали согласие.",
    contactField: "Идентификатор чата Telegram",
    providerIds: ["telegram-bot-api"],
  },
  {
    id: "vk",
    label: "ВКонтакте",
    shortLabel: "ВКонтакте",
    description:
      "Сообщения от сообщества пользователям, разрешившим общение с ним.",
    contactField: "Идентификатор пользователя ВКонтакте",
    providerIds: ["vk-api"],
  },
];

export const integrationProviders: IntegrationProviderDefinition[] = [
  {
    id: "vk-workspace",
    name: "VK WorkSpace",
    category: "Ручной импорт в «Рассылки»",
    summary:
      "MAILFLOW готовит CSV получателей для ручного импорта в модуль «Рассылки» VK WorkSpace.",
    channelIds: ["email"],
    accent: "#1777ff",
    initials: "VK",
    recommendedFor: "Команд, которые запускают email-рассылку вручную в VK WorkSpace",
    credentials: [
      "Активные контакты с email и согласием",
      "Доступ участника к модулю «Рассылки» VK WorkSpace",
      "Проверенный отправитель в кабинете VK WorkSpace",
    ],
    setupSteps: [
      "Проверить согласия и email выбранной аудитории в MAILFLOW.",
      "Скачать CSV из готовой кампании.",
      "Импортировать файл и завершить настройку письма в VK WorkSpace.",
      "Запустить рассылку и сверять результаты в кабинете VK WorkSpace.",
    ],
    limitations: [
      "У модуля «Рассылки» VK WorkSpace нет используемого здесь публичного API: MAILFLOW не выдаёт ручной экспорт за автоматическую отправку.",
      "Контент, отправитель, запуск и статистика остаются в интерфейсе VK WorkSpace.",
    ],
    route: "MAILFLOW → CSV → ручной импорт в VK WorkSpace",
    deliveryMode: "manual_export",
  },
  {
    id: "telegram-bot-api",
    name: "Telegram Bot API",
    category: "Официальный API ботов",
    summary:
      "Прямая отправка сообщений через вашего Telegram-бота по разрешённым идентификаторам чатов.",
    channelIds: ["telegram"],
    accent: "#229ed9",
    initials: "TG",
    recommendedFor: "Сервисных уведомлений и диалогов с подписчиками бота",
    credentials: [
      "Токен Telegram-бота",
      "Идентификаторы чатов получателей",
    ],
    setupSteps: [
      "Создать или выбрать бота и описать правила подписки.",
      "Собрать chat ID только после первого сообщения от пользователя.",
      "Проверить доступ бота read-only запросом перед запуском.",
    ],
    limitations: [
      "Бот не может первым написать пользователю, который не начал диалог.",
      "Общий лимит Telegram Bot API по умолчанию — около 30 сообщений в секунду.",
    ],
    route: "MAILFLOW → серверный адаптер → Telegram Bot API",
    deliveryMode: "automatic",
  },
  {
    id: "vk-api",
    name: "VK API",
    category: "Сообщения сообщества",
    summary:
      "Отправка персональных сообщений от имени сообщества ВКонтакте пользователям с разрешением на переписку.",
    channelIds: ["vk"],
    accent: "#0077ff",
    initials: "VK",
    recommendedFor: "Коммуникаций с аудиторией сообщества ВКонтакте",
    credentials: [
      "Идентификатор сообщества",
      "Серверный ключ доступа сообщества",
    ],
    setupSteps: [
      "Включить сообщения сообщества и получить серверный ключ доступа.",
      "Сохранять идентификаторы только тех пользователей, кто разрешил сообщения.",
      "Проверить сообщество read-only запросом перед запуском.",
    ],
    limitations: [
      "Получатель должен разрешить сообщения от сообщества.",
      "Массовая отправка должна соблюдать правила платформы и её лимиты.",
    ],
    route: "MAILFLOW → серверный адаптер → VK API",
    deliveryMode: "automatic",
  },
  {
    id: "unisender",
    name: "UniSender",
    category: "Сервис email-рассылок",
    summary:
      "Маркетинговые и транзакционные email-кампании через готовую инфраструктуру доставки.",
    channelIds: ["email"],
    accent: "#7b43f6",
    initials: "US",
    recommendedFor: "Массовых email-кампаний с отчётами о доставке",
    credentials: [
      "Ключ API рабочей учётной записи",
      "Проверенный адрес или домен отправителя",
      "Список контактов с подтверждённым согласием",
    ],
    setupSteps: [
      "Проверить отправителя и домен в кабинете сервиса.",
      "Сохранить ключ API только в серверной конфигурации.",
      "Сопоставить контакты, статусы доставки и отписки.",
    ],
    limitations: [
      "Отправка разрешена только контактам с законным основанием и согласием.",
      "Тариф и модерация сервиса определяют доступный объём.",
    ],
    route: "MAILFLOW → серверный адаптер → UniSender",
    deliveryMode: "automatic",
  },
];

export const integrationProviderById = Object.fromEntries(
  integrationProviders.map((provider) => [provider.id, provider]),
) as Record<IntegrationProviderId, IntegrationProviderDefinition>;

export const deliveryChannelById = Object.fromEntries(
  deliveryChannels.map((channel) => [channel.id, channel]),
) as Record<DeliveryChannelId, DeliveryChannelDefinition>;

export function getProvidersForChannel(channelId: DeliveryChannelId) {
  return integrationProviders.filter((provider) =>
    provider.channelIds.includes(channelId),
  );
}
