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
