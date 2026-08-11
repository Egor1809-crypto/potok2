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
  demoCoverageRate: number;
}

export interface CampaignChannelProvider {
  id: IntegrationProviderId;
  label: string;
  description: string;
}

export interface CampaignDeliveryPlan {
  demo: true;
  channels: Array<{
    channel: CampaignChannel;
    provider: IntegrationProviderId;
    estimatedCoverage: number;
  }>;
  messengerMessage: string;
  consentConfirmed: boolean;
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
    demoCoverageRate: 0.96,
  },
  {
    id: "telegram",
    label: "Telegram",
    shortLabel: "Telegram",
    description: "Короткое сообщение через бота или подключённую платформу.",
    identityLabel: "chat_id и диалог с ботом",
    consentHint:
      "Для Telegram нужен chat_id: получатель должен сам запустить бота и разрешить коммуникацию.",
    demoCoverageRate: 0.54,
  },
  {
    id: "vk",
    label: "ВКонтакте",
    shortLabel: "ВК",
    description: "Сообщение от имени сообщества через API сообщений ВК.",
    identityLabel: "VK ID и разрешение сообществу",
    consentHint:
      "Сообщество может писать только получателям, которые разрешили сообщения; нужны VK ID и доступ сообщества.",
    demoCoverageRate: 0.47,
  },
];

const campaignProviderDescriptions: Partial<
  Record<IntegrationProviderId, string>
> = {
  "vk-workspace":
    "SMTP после серверного подключения; для нативных «Рассылок» — экспорт получателей.",
  "telegram-bot-api": "Прямая отправка от бота по сохранённому chat_id.",
  "vk-api": "Сообщения от имени сообщества пользователям с разрешением.",
  unisender: "Email-рассылки через API и проверенный домен.",
  sendpulse: "Email или Telegram через подключённый канал SendPulse.",
};

function campaignProvidersFor(channel: CampaignChannel): CampaignChannelProvider[] {
  return getProvidersForChannel(channel).map((provider) => ({
    id: provider.id,
    label: provider.name,
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
  email: "vk-workspace",
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

export function estimateCampaignChannelCoverage(
  channel: CampaignChannel,
  recipientCount: number,
) {
  const definition = getCampaignChannelDefinition(channel);
  return Math.min(
    recipientCount,
    Math.max(0, Math.round(recipientCount * definition.demoCoverageRate)),
  );
}
