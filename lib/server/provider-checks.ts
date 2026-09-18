import type { IntegrationProviderId } from "@/config/integrations";
import type { IntegrationRecord } from "@/types/api";
import {
  checkTelegramBot,
  checkUniSender,
  checkVkCommunity,
  type ProviderCheckResult,
} from "./provider-adapters";
import { hasRuntimeCredentials, runtimeSecret } from "./runtime-integrations";
import { checkVkWorkspaceSmtp } from "./vk-workspace-smtp";
import { checkTelegramConnection } from "./telegram-connection";
import { resolveVkWorkspaceQueueConfig } from "./vk-workspace-queue";

const CHECK_TIMEOUT_MS = 10_000;

function timeoutSignal() {
  return AbortSignal.timeout(CHECK_TIMEOUT_MS);
}

export async function checkProviderConnection(
  integration: IntegrationRecord,
): Promise<ProviderCheckResult> {
  if (!integration.enabled) {
    return { ok: false, message: "Интеграция выключена." };
  }
  if (integration.providerId === "vk-workspace") {
    if (!hasRuntimeCredentials(integration.providerId)) {
      return { ok: false, message: "Добавьте пароль приложения VK WorkSpace в защищённую конфигурацию сервера." };
    }
    const config = resolveVkWorkspaceQueueConfig(integration.publicConfig, runtimeSecret);
    const primary = config.accounts.find((account) => account.id === "primary");
    if (!primary) return { ok: false, message: "Укажите адрес и пароль приложения основного ящика VK WorkSpace." };
    const checked = await checkVkWorkspaceSmtp({
      host: "smtp.mail.ru",
      port: 465,
      username: primary.email,
      password: primary.password,
      timeoutMs: CHECK_TIMEOUT_MS,
    });
    if (!checked.ok) return checked;
    return {
      ...checked,
      message: `SMTP-подключение подтверждено. Доступно ящиков: ${config.accounts.length}; дневная ёмкость: ${Math.min(config.totalDailyLimit, config.accounts.reduce((total, account) => total + account.dailyLimit, 0))}.`,
    };
  }
  if (!hasRuntimeCredentials(integration.providerId, integration.publicConfig)) {
    return {
      ok: false,
      message: "В серверном окружении отсутствуют обязательные секреты провайдера.",
    };
  }
  if (integration.providerId === "telegram-bot-api") {
    if (integration.publicConfig.credentialSource === "vault") return checkTelegramConnection();
    return checkTelegramBot({
      token: runtimeSecret(integration.publicConfig.botSlot === "secondary" ? "TELEGRAM_BOT_TOKEN_2" : "TELEGRAM_BOT_TOKEN"),
      expectedUsername: integration.publicConfig.botUsername,
      signal: timeoutSignal(),
    });
  }
  if (integration.providerId === "vk-api") {
    const communityId = integration.publicConfig.communityId?.trim();
    if (!communityId) return { ok: false, message: "Укажите ID сообщества VK." };
    return checkVkCommunity({
      accessToken: runtimeSecret("VK_COMMUNITY_ACCESS_TOKEN"),
      communityId,
      signal: timeoutSignal(),
    });
  }
  if (integration.providerId === "unisender") {
    const listId = integration.publicConfig.listId?.trim();
    if (!listId) return { ok: false, message: "Укажите ID списка UniSender." };
    return checkUniSender({
      apiKey: runtimeSecret("UNISENDER_API_KEY"),
      expectedListId: listId,
      signal: timeoutSignal(),
    });
  }
  return {
    ok: false,
    message: "Для выбранного провайдера нет реализованного маршрута.",
  };
}

export function automaticProviderSecrets(
  providerId: IntegrationProviderId,
  publicConfig: Record<string, string> = {},
) {
  if (providerId === "vk-workspace") {
    return {
      password: runtimeSecret("VK_WORKSPACE_SMTP_PASSWORD"),
      password2: runtimeSecret("VK_WORKSPACE_SMTP_PASSWORD_2"),
      email: runtimeSecret("VK_WORKSPACE_SMTP_EMAIL"),
      email2: runtimeSecret("VK_WORKSPACE_SMTP_EMAIL_2"),
    };
  }
  if (providerId === "telegram-bot-api") {
    return { token: runtimeSecret(publicConfig.botSlot === "secondary" ? "TELEGRAM_BOT_TOKEN_2" : "TELEGRAM_BOT_TOKEN") };
  }
  if (providerId === "vk-api") {
    return { accessToken: runtimeSecret("VK_COMMUNITY_ACCESS_TOKEN") };
  }
  if (providerId === "unisender") {
    return { apiKey: runtimeSecret("UNISENDER_API_KEY") };
  }
  return {};
}
