import type { CampaignStatus } from "@/types";

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  sending: "Отправляется",
  completed: "Завершена",
};

export const formatCampaignNumber = (value: number) =>
  value.toLocaleString("ru-RU");

export const formatCampaignPercent = (value: number) =>
  `${value.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
