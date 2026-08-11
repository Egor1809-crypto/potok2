import { env } from "cloudflare:workers";
import {
  integrationProviders,
  type IntegrationProviderId,
} from "@/config/integrations";
import type {
  IntegrationConnectionStatus,
  IntegrationRecord,
} from "@/types/api";

type RuntimeEnv = Record<string, string | undefined>;

const requiredSecretKeys: Record<IntegrationProviderId, string[]> = {
  "vk-workspace": [],
  "telegram-bot-api": ["TELEGRAM_BOT_TOKEN"],
  "vk-api": ["VK_COMMUNITY_ACCESS_TOKEN"],
  unisender: ["UNISENDER_API_KEY"],
  sendpulse: ["SENDPULSE_CLIENT_ID", "SENDPULSE_CLIENT_SECRET"],
};

const requiredPublicFields: Record<
  IntegrationProviderId,
  Partial<Record<"email" | "telegram" | "vk", string[]>>
> = {
  "vk-workspace": { email: [] },
  "telegram-bot-api": { telegram: ["botUsername"] },
  "vk-api": { vk: ["communityId"] },
  unisender: { email: ["senderEmail", "listId"] },
  sendpulse: {
    email: ["senderEmail"],
    telegram: ["botUsername"],
  },
};

export type StoredIntegration = {
  id: string;
  workspaceId: string;
  providerId: IntegrationProviderId;
  enabled: boolean;
  publicConfig: Record<string, string>;
  lastCheckedAt: string | null;
  checkStatus: IntegrationConnectionStatus;
  checkMessage: string;
  updatedAt: string;
};

function runtimeEnvironment(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function hasRuntimeCredentials(providerId: IntegrationProviderId) {
  const runtime = runtimeEnvironment();
  return requiredSecretKeys[providerId].every((key) => Boolean(runtime[key]?.trim()));
}

export function runtimeSecret(key: string): string {
  return runtimeEnvironment()[key]?.trim() ?? "";
}

function hasRequiredPublicConfig(
  providerId: IntegrationProviderId,
  publicConfig: Record<string, string>,
) {
  return Object.values(requiredPublicFields[providerId]).some((fields) =>
    fields?.every((key) => Boolean(publicConfig[key]?.trim())),
  );
}

export function isIntegrationReadyForChannel(
  integration: IntegrationRecord,
  channel: "email" | "telegram" | "vk",
): boolean {
  const fields = requiredPublicFields[integration.providerId][channel];
  const definition = integrationProviders.find(
    (provider) => provider.id === integration.providerId,
  );
  return Boolean(
    integration.enabled &&
      definition?.deliveryMode !== "roadmap" &&
      integration.credentialsConfigured &&
      integration.status === "connected" &&
      fields?.every((key) => Boolean(integration.publicConfig[key]?.trim())),
  );
}

export function connectionStatus(
  integration: StoredIntegration,
): IntegrationConnectionStatus {
  if (!integration.enabled) return "disconnected";

  const credentials = hasRuntimeCredentials(integration.providerId);
  const publicConfigReady = hasRequiredPublicConfig(
    integration.providerId,
    integration.publicConfig,
  );
  if (!credentials || !publicConfigReady) return "needs_attention";
  return integration.checkStatus;
}

export function toIntegrationRecord(
  integration: StoredIntegration,
): IntegrationRecord {
  const definition = integrationProviders.find(
    (provider) => provider.id === integration.providerId,
  );
  if (!definition) {
    throw new Error(`Unknown integration provider: ${integration.providerId}`);
  }

  const credentialsConfigured = hasRuntimeCredentials(integration.providerId);
  const status = connectionStatus(integration);
  const statusMessage =
    !credentialsConfigured
      ? "Добавьте секреты в защищённую конфигурацию сервера и запустите проверку."
      : !hasRequiredPublicConfig(integration.providerId, integration.publicConfig)
        ? "Заполните открытые параметры и запустите проверку."
        : integration.checkMessage;

  return {
    id: integration.id,
    workspaceId: integration.workspaceId,
    providerId: integration.providerId,
    name: definition.name,
    channels: definition.channelIds,
    enabled: integration.enabled,
    status,
    credentialsConfigured,
    publicConfig: integration.publicConfig,
    statusMessage,
    lastCheckedAt: integration.lastCheckedAt,
    updatedAt: integration.updatedAt,
    deliveryMode: definition.deliveryMode,
  };
}

export function assertProviderSupportsChannel(
  providerId: IntegrationProviderId,
  channel: "email" | "telegram" | "vk",
) {
  const provider = integrationProviders.find((item) => item.id === providerId);
  return Boolean(provider?.channelIds.includes(channel));
}
