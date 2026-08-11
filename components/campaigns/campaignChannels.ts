import {
  getProvidersForChannel,
  type DeliveryChannelId,
  type IntegrationProviderId,
} from "@/config/integrations";

export type CampaignChannel = DeliveryChannelId;

export interface CampaignChannelDefinition {
  id: CampaignChannel;
  label: string;
  shortLabel: string;
  description: string;
  identityLabel: string;
  consentHint: string;
}

export interface CampaignChannelProvider {
  id: IntegrationProviderId;
  label: string;
  description: string;
}

export const campaignChannelDefinitions: CampaignChannelDefinition[] = [
  {
    id: "email",
    label: "Электронная почта",
    shortLabel: "Email",
    description: "HTML-письмо с темой, прехедером и персонализацией.",
    identityLabel: "Корректный email",
    consentHint:
      "Отправляйте только контактам с основанием для рассылки; система исключит отписавшихся и недоставляемые адреса.",
  },
  {
    id: "telegram",
    label: "Telegram",
    shortLabel: "Telegram",
    description: "Короткое сообщение через бота или подключённую платформу.",
    identityLabel: "chat_id и диалог с ботом",
    consentHint:
      "Для Telegram нужен chat_id: получатель должен сам запустить бота и разрешить коммуникацию.",
  },
  {
    id: "vk",
    label: "ВКонтакте",
    shortLabel: "ВК",
    description: "Сообщение от имени сообщества через API сообщений ВК.",
    identityLabel: "VK ID и разрешение сообществу",
    consentHint:
      "Сообщество может писать только получателям, которые разрешили сообщения; нужны VK ID и доступ сообщества.",
  },
];

const campaignProviderDescriptions: Partial<
  Record<IntegrationProviderId, string>
> = {
  "vk-workspace":
    "Только CSV для ручного импорта и запуска в VK WorkSpace; автоматической отправки нет.",
  "telegram-bot-api": "Прямая отправка от бота по сохранённому chat_id.",
  "vk-api": "Сообщения от имени сообщества пользователям с разрешением.",
  unisender: "Массовая email-кампания через importContacts, createEmailMessage и createCampaign.",
  sendpulse: "Проверка ключей доступна, адаптер отправки находится в плане развития.",
};

function campaignProvidersFor(channel: CampaignChannel): CampaignChannelProvider[] {
  return getProvidersForChannel(channel).map((provider) => ({
    id: provider.id,
    label: `${provider.name}${provider.deliveryMode === "manual_export" ? " · вручную" : provider.deliveryMode === "roadmap" ? " · в плане" : ""}`,
    description: campaignProviderDescriptions[provider.id] ?? provider.summary,
  }));
}

export const campaignChannelProviders: Record<
  CampaignChannel,
  CampaignChannelProvider[]
> = {
  email: campaignProvidersFor("email"),
  telegram: campaignProvidersFor("telegram"),
  vk: campaignProvidersFor("vk"),
};

export const defaultCampaignChannelProvider: Record<
  CampaignChannel,
  IntegrationProviderId
> = {
  email: "unisender",
  telegram: "telegram-bot-api",
  vk: "vk-api",
};

export function getCampaignChannelDefinition(channel: CampaignChannel) {
  return campaignChannelDefinitions.find((item) => item.id === channel)!;
}

export function getCampaignChannelProvider(
  channel: CampaignChannel,
  providerId: string,
) {
  return campaignChannelProviders[channel].find((item) => item.id === providerId);
}
