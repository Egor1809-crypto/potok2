const HANDOFF_TOKEN = /^[a-zA-Z0-9_-]{1,160}$/;

export const CAMPAIGN_HANDOFF_STORAGE_PREFIX = "mailflow:campaign-wizard-handoff:";

export function normalizeCampaignHandoffToken(
  value: string | null | undefined,
): string | undefined {
  return value && HANDOFF_TOKEN.test(value) ? value : undefined;
}

export function campaignHandoffStorageKey(token: string): string {
  const normalized = normalizeCampaignHandoffToken(token);
  if (!normalized) throw new Error("Некорректный ключ черновика кампании.");
  return `${CAMPAIGN_HANDOFF_STORAGE_PREFIX}${normalized}`;
}

export function createCampaignHandoffToken(seed?: string): string {
  const generated = seed ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const safe = generated.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 148);
  return `wizard-${safe || Date.now()}`;
}

export type CampaignHandoffStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readCampaignHandoffSnapshot(
  storage: CampaignHandoffStorage,
  token: string,
): string | undefined {
  return storage.getItem(campaignHandoffStorageKey(token)) ?? undefined;
}

export function writeCampaignHandoffSnapshot(
  storage: CampaignHandoffStorage,
  token: string,
  snapshot: string,
): void {
  storage.setItem(campaignHandoffStorageKey(token), snapshot);
}
