export type DeliveryChannelId = "email" | "telegram" | "vk";

export const INTEGRATION_DEMO_ROUTES_STORAGE_KEY = "mailflow:demo-routes";

export type IntegrationProviderId =
  | "vk-workspace"
  | "telegram-bot-api"
  | "vk-api"
  | "unisender"
  | "sendpulse";

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
};

export const deliveryChannels: DeliveryChannelDefinition[] = [
  {
    id: "email",
    label: "Электронная почта",
    shortLabel: "Email",
    description:
      "Письма с корпоративного домена через почтовый или маркетинговый сервис.",
    contactField: "Рабочий email",
    providerIds: ["vk-workspace", "unisender", "sendpulse"],
  },
  {
    id: "telegram",
    label: "Telegram",
    shortLabel: "Telegram",
    description:
      "Сообщения подписчикам бота, которые сами начали диалог и дали согласие.",
    contactField: "Идентификатор чата Telegram",
    providerIds: ["telegram-bot-api", "sendpulse"],
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
    category: "Корпоративная почта и «Рассылки»",
    summary:
      "Автоматическая отправка из корпоративного ящика по SMTP или экспорт получателей в нативный модуль «Рассылки» VK WorkSpace.",
    channelIds: ["email"],
    accent: "#1777ff",
    initials: "VK",
    recommendedFor: "Деловых писем и управляемых рассылок с корпоративного домена",
    credentials: [
      "Адрес и имя корпоративного отправителя",
      "SMTP smtp.mail.ru:465 с SSL/TLS и паролем приложения",
      "Проверенный домен и общий ящик для нативных «Рассылок»",
    ],
    setupSteps: [
      "Подготовить отдельный ящик для рассылок в VK WorkSpace.",
      "Для автоматической отправки передать SMTP-доступ в защищённую серверную конфигурацию.",
      "Для нативных «Рассылок» выгрузить список получателей и завершить запуск в интерфейсе VK WorkSpace.",
      "Проверить подпись отправителя, прогрев домена, тестовую доставку и лимиты.",
    ],
    limitations: [
      "У нативных «Рассылок» VK WorkSpace нет задокументированного публичного API: MAILFLOW готовит экспорт, а запуск выполняется в VK WorkSpace.",
      "SMTP — это обычная отправка из ящика; скорость и объём ограничены правилами домена и почтового сервиса.",
      "Новый домен начинает с прогрева, а доступная скорость увеличивается постепенно.",
    ],
    route: "MAILFLOW → SMTP или TXT/CSV-экспорт → VK WorkSpace",
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
      "Адрес webhook и секрет проверки, если принимаются ответы",
    ],
    setupSteps: [
      "Создать или выбрать бота и описать правила подписки.",
      "Собрать chat ID только после первого сообщения от пользователя.",
      "Проверить тестовую отправку и обработку ответов на сервере.",
    ],
    limitations: [
      "Бот не может первым написать пользователю, который не начал диалог.",
      "Общий лимит Telegram Bot API по умолчанию — около 30 сообщений в секунду.",
    ],
    route: "MAILFLOW → серверный адаптер → Telegram Bot API",
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
      "Настройки Callback API для ответов и статусов",
    ],
    setupSteps: [
      "Включить сообщения сообщества и получить серверный ключ доступа.",
      "Сохранять идентификаторы только тех пользователей, кто разрешил сообщения.",
      "Проверить тестовый диалог и события Callback API.",
    ],
    limitations: [
      "Получатель должен разрешить сообщения от сообщества.",
      "Массовая отправка должна соблюдать правила платформы и её лимиты.",
    ],
    route: "MAILFLOW → серверный адаптер → VK API",
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
  },
  {
    id: "sendpulse",
    name: "SendPulse",
    category: "Мультиканальный сервис",
    summary:
      "Единая внешняя платформа для email и сценариев Telegram с раздельной настройкой каждого канала.",
    channelIds: ["email", "telegram"],
    accent: "#16a66a",
    initials: "SP",
    recommendedFor: "Команд, которым нужен один кабинет для нескольких каналов",
    credentials: [
      "Идентификатор и секрет API рабочей учётной записи",
      "Проверенный email-отправитель или подключённый Telegram-бот",
      "Списки получателей с согласием по каждому каналу",
    ],
    setupSteps: [
      "Подключить нужный канал в кабинете SendPulse.",
      "Передать ключи в защищённую серверную конфигурацию.",
      "Отдельно проверить тестовый маршрут, статусы и отписки каждого канала.",
    ],
    limitations: [
      "Возможности, тарифы и лимиты отличаются для email и Telegram.",
      "Получатели должны дать согласие в соответствующем канале.",
    ],
    route: "MAILFLOW → серверный адаптер → SendPulse",
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
