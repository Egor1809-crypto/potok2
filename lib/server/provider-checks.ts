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
    const senderEmail = integration.publicConfig.senderEmail?.trim();
    if (!senderEmail) return { ok: false, message: "Укажите полный адрес корпоративного ящика VK WorkSpace." };
    return checkVkWorkspaceSmtp({
      host: "smtp.mail.ru",
      port: 465,
      username: senderEmail,
      password: runtimeSecret("VK_WORKSPACE_SMTP_PASSWORD"),
      timeoutMs: CHECK_TIMEOUT_MS,
    });
  }
  if (!hasRuntimeCredentials(integration.providerId)) {
    return {
      ok: false,
      message: "В серверном окружении отсутствуют обязательные секреты провайдера.",
    };
  }
  if (integration.providerId === "telegram-bot-api") {
    return checkTelegramBot({
      token: runtimeSecret("TELEGRAM_BOT_TOKEN"),
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

export function automaticProviderSecrets(providerId: IntegrationProviderId) {
  if (providerId === "vk-workspace") {
    return { password: runtimeSecret("VK_WORKSPACE_SMTP_PASSWORD") };
  }
  if (providerId === "telegram-bot-api") {
    return { token: runtimeSecret("TELEGRAM_BOT_TOKEN") };
  }
  if (providerId === "vk-api") {
    return { accessToken: runtimeSecret("VK_COMMUNITY_ACCESS_TOKEN") };
  }
  if (providerId === "unisender") {
    return { apiKey: runtimeSecret("UNISENDER_API_KEY") };
  }
  return {};
}
