import type { CampaignMetrics } from "@/types";

export function percentage(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1_000) / 10;
}

export function createCampaignMetrics(
  counts: Omit<
    CampaignMetrics,
    "deliveryRate" | "openRate" | "clickRate" | "replyRate"
  >,
): CampaignMetrics {
  return {
    ...counts,
    deliveryRate: percentage(counts.delivered, counts.sent),
    openRate: percentage(counts.opened, counts.delivered),
    clickRate: percentage(counts.clicked, counts.delivered),
    replyRate: percentage(counts.replies, counts.delivered),
  };
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
