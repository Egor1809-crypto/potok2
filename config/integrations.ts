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
    category: "Автоматическая SMTP-отправка",
    summary:
      "Поток отправляет готовое HTML-письмо напрямую через корпоративный ящик VK WorkSpace.",
    channelIds: ["email"],
    accent: "#1777ff",
    initials: "VK",
    recommendedFor: "Индивидуальных и групповых писем с корпоративного домена",
    credentials: [
      "Полный адрес корпоративного ящика VK WorkSpace",
      "Пароль приложения для почтового клиента",
      "Разрешение на SMTP-доступ в настройках домена",
    ],
    setupSteps: [
      "Создать пароль приложения в настройках безопасности VK WorkSpace.",
      "Добавить пароль как защищённый секрет VK_WORKSPACE_SMTP_PASSWORD на сервере Потока.",
      "Указать полный адрес ящика и проверить подключение.",
      "Выбрать письмо, аудиторию и время в календаре Потока.",
    ],
    limitations: [
      "Это обычная отправка через корпоративный SMTP, а не API модуля «Рассылки» VK WorkSpace.",
      "Лимиты и антиспам-правила задаёт VK WorkSpace; большие базы отправляются очередью по расписанию.",
    ],
    route: "Поток → защищённый SMTP → почтовый ящик получателя",
    deliveryMode: "automatic",
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
    route: "Поток → серверный адаптер → Telegram Bot API",
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
    route: "Поток → серверный адаптер → VK API",
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
    route: "Поток → серверный адаптер → UniSender",
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
