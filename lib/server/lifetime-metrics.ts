import type { CampaignRecord, UniSenderLifetimeStats } from "@/types/api";

/**
 * Campaign metrics are persisted after UniSender status synchronization. The
 * lifetime view adds the provider's unique counters campaign by campaign.
 * This intentionally does not count non-email campaigns.
 */
export function sumUniSenderLifetimeMetrics(
  campaigns: Pick<CampaignRecord, "deliveryChannels" | "metrics" | "updatedAt">[],
): UniSenderLifetimeStats {
  const emailCampaigns = campaigns.filter((campaign) =>
    campaign.deliveryChannels.includes("email") && campaign.metrics.sent > 0,
  );

  return emailCampaigns.reduce<UniSenderLifetimeStats>((total, campaign) => ({
    campaigns: total.campaigns + 1,
    sent: total.sent + Math.max(0, campaign.metrics.sent),
    delivered: total.delivered + Math.max(0, campaign.metrics.delivered),
    opened: total.opened + Math.max(0, campaign.metrics.opened),
    clicked: total.clicked + Math.max(0, campaign.metrics.clicked),
    updatedAt: !total.updatedAt || campaign.updatedAt > total.updatedAt
      ? campaign.updatedAt
      : total.updatedAt,
  }), {
    campaigns: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    updatedAt: null,
  });
}
