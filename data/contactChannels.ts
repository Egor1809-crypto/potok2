import type { DeliveryChannelId } from "@/config/integrations";
import type { Contact } from "@/types";

export type ContactChannelStatus = "ready" | "missing-consent" | "unavailable";

export type ContactChannelEndpoint = {
  channel: DeliveryChannelId;
  label: string;
  address: string | null;
  status: ContactChannelStatus;
  statusLabel: string;
  hint: string;
};

function stableScore(value: string, salt: number) {
  return Array.from(value).reduce(
    (score, character) => (score * 31 + character.charCodeAt(0) + salt) % 10_007,
    salt,
  );
}

export function getContactChannelEndpoints(
  contact: Contact,
): ContactChannelEndpoint[] {
  const canReceiveEmail = contact.status === "active";
  // Consent is channel-specific: an email bounce or unsubscribe must not erase
  // a separately granted Telegram/VK permission.
  const telegramOptIn = stableScore(contact.id, 17) % 100 < 58;
  const vkOptIn = stableScore(contact.id, 43) % 100 < 49;

  return [
    {
      channel: "email",
      label: "Электронная почта",
      address: contact.email,
      status: canReceiveEmail ? "ready" : "unavailable",
      statusLabel: canReceiveEmail ? "Готов" : "Недоступен",
      hint: canReceiveEmail
        ? "Адрес активен и не находится в списке отписавшихся."
        : "Контакт отписался либо адрес помечен как недоставляемый.",
    },
    {
      channel: "telegram",
      label: "Telegram",
      address: telegramOptIn
        ? `chat_id ${1_000_000_000 + stableScore(contact.id, 61)}`
        : null,
      status: telegramOptIn ? "ready" : "missing-consent",
      statusLabel: telegramOptIn ? "Есть согласие" : "Нет согласия",
      hint: telegramOptIn
        ? "Контакт запустил бота; идентификатор чата сохранён."
        : "Попросите контакт запустить бота, прежде чем писать ему.",
    },
    {
      channel: "vk",
      label: "ВКонтакте",
      address: vkOptIn
        ? `vk.com/id${100_000 + stableScore(contact.id, 79)}`
        : null,
      status: vkOptIn ? "ready" : "missing-consent",
      statusLabel: vkOptIn ? "Разрешено" : "Нет разрешения",
      hint: vkOptIn
        ? "Пользователь разрешил сообщения от подключённого сообщества."
        : "Сообщество сможет написать после разрешения пользователя.",
    },
  ];
}

export function getContactChannelEndpoint(
  contact: Contact,
  channel: DeliveryChannelId,
) {
  return getContactChannelEndpoints(contact).find(
    (endpoint) => endpoint.channel === channel,
  )!;
}

export function countReachableContacts(
  sourceContacts: Contact[],
  channel: DeliveryChannelId,
) {
  return sourceContacts.filter(
    (contact) => getContactChannelEndpoint(contact, channel).status === "ready",
  ).length;
}
