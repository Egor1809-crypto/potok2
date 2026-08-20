export type DeliveryMetricRow = {
  contactId: string;
  status: string;
};

export function uniqueAcceptedContactIds(
  rows: DeliveryMetricRow[],
): string[] {
  return [
    ...new Set(
      rows
        .filter((row) => row.status === "accepted")
        .map((row) => row.contactId),
    ),
  ];
}

export function isUniSenderAggregateFinal(input: {
  providerStatus?: string;
  sent: number;
  delivered: number;
  reportAgeMs: number;
}): boolean {
  if (input.providerStatus !== "analysed") return false;

  // UniSender can mark a campaign as analysed before its aggregate delivery
  // counters are populated. Give non-zero counters five minutes to settle, and
  // never treat an aggregate zero as evidence that every recipient bounced.
  if (input.sent > 0 && input.delivered === 0) return false;
  return input.sent === 0 || input.reportAgeMs >= 5 * 60_000;
}
