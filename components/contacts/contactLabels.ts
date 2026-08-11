import type { Contact } from "@/types";

export const contactCategoryLabels: Record<Contact["category"], string> = {
  Lawyer: "Юрист",
  Partner: "Партнёр",
  Client: "Клиент",
  Speaker: "Спикер",
  "Arbitration Manager": "Менеджер по арбитражу",
  Investor: "Инвестор",
  Marketing: "Маркетинг",
  Operations: "Операции",
};

export const contactTagLabels: Record<Contact["tags"][number], string> = {
  VIP: "Ключевой",
  Conference: "Конференция",
  Moscow: "Москва",
  Partner: "Партнёр",
  Hot: "Горячий",
  Warm: "Тёплый",
  Speaker: "Спикер",
  Client: "Клиент",
  "Legal Tech": "Юртех",
  "Follow-up": "Повторный контакт",
};

export const contactStatusLabels: Record<Contact["status"], string> = {
  active: "Активен",
  unsubscribed: "Отписан",
  bounced: "Возврат",
  invalid: "Некорректный",
};

export const formatContactCount = (value: number) =>
  value.toLocaleString("ru-RU");

export const shortContactDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
