import type {
  CampaignRecord,
  ParticipantRecord,
  ParticipantUniSenderStats,
  UniSenderLifetimeStats,
} from "@/types/api";

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
    clickedUnique: (total.clickedUnique ?? 0) + Math.max(0, campaign.metrics.clickedUnique ?? campaign.metrics.clicked),
    updatedAt: !total.updatedAt || campaign.updatedAt > total.updatedAt
      ? campaign.updatedAt
      : total.updatedAt,
  }), {
    campaigns: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    clickedUnique: 0,
    updatedAt: null,
  });
}

/** Attribute provider results to the campaign author, never to a contact owner. */
export function sumUniSenderMetricsByParticipant(
  campaigns: Pick<CampaignRecord, "participantId" | "deliveryChannels" | "metrics" | "updatedAt">[],
  participants: Pick<ParticipantRecord, "id" | "displayName" | "color">[],
): ParticipantUniSenderStats[] {
  const campaignsByParticipant = new Map<string, typeof campaigns>();
  for (const campaign of campaigns) {
    const values = campaignsByParticipant.get(campaign.participantId) ?? [];
    values.push(campaign);
    campaignsByParticipant.set(campaign.participantId, values);
  }

  return participants.map((participant) => ({
    participantId: participant.id,
    displayName: participant.displayName,
    color: participant.color,
    ...sumUniSenderLifetimeMetrics(campaignsByParticipant.get(participant.id) ?? []),
  })).sort((left, right) => right.sent - left.sent || left.displayName.localeCompare(right.displayName, "ru"));
}
