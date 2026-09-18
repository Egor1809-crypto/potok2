import type { CampaignStatus } from "@/types";

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  draft: "Черновик",
  ready: "Готова",
  blocked: "Нужна настройка",
  scheduled: "Запланирована",
  sending: "Отправляется",
  paused: "На паузе",
  stopping: "Останавливается",
  completed: "Завершена",
  cancelled: "Отменена",
};

export const formatCampaignNumber = (value: number) =>
  value.toLocaleString("ru-RU");

export const formatCampaignPercent = (value: number) =>
  `${value.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
