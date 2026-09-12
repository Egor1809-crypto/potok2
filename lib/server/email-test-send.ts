import { asObject, ApiRequestError, normalizeEmail } from "./api-utils";
import { listIntegrations } from "./mailflow-store";
import { automaticProviderSecrets } from "./provider-checks";
import { isIntegrationReadyForChannel } from "./runtime-integrations";
import { compileEmailDocument, parseEmailBuilderDocument } from "./email-document";
import { renderMergeTemplate, unknownMergeTokens, sendUniSenderTransactionalEmail } from "./provider-adapters";

/** The provider expands its own unsubscribe URL after our contact fields. */
export function renderEmailTestFields(value: string) {
  const segments = value.split("{{UnsubscribeUrl}}");
  const unknown = unknownMergeTokens(...segments);
  if (unknown.length) throw new ApiRequestError(`Замените неизвестные поля в письме: ${unknown.join(", ")}. Поддерживаются first_name, last_name, company, position и city.`, 422);
  return segments.map(segment => renderMergeTemplate(segment, {})).join("{{UnsubscribeUrl}}");
}

/** Explicit single-address test delivery through the workspace's configured provider. */
export async function sendEmailBuilderTest(request: Request, value: unknown) {
  const { integrations } = await listIntegrations(request);
  const input = asObject(value); const email = normalizeEmail(input.email);
  const document = parseEmailBuilderDocument(input.document);
  if (!document) throw new ApiRequestError("Откройте письмо для тестовой отправки.");
  const sources = [document.backgroundImageUrl, ...document.blocks.flatMap(block => [block.href, block.imageHref, block.linkHref])].filter(Boolean);
  if (sources.some(url => /^(?:blob:|file:|https?:\/\/(?:localhost|127\.|\[::1\]))/i.test(url!))) throw new ApiRequestError("Загрузите изображения на платформу перед отправкой.", 422);
  const integration = integrations.find(item => item.providerId === "unisender" && isIntegrationReadyForChannel(item, "email"));
  if (!integration) throw new ApiRequestError("Для тестовой отправки подключите UniSender в настройках интеграций.", 422);
  const senderEmail = integration.publicConfig.transactionalSenderEmail || integration.publicConfig.senderEmail;
  if (!senderEmail || !integration.publicConfig.listId) throw new ApiRequestError("В интеграции укажите подтверждённый адрес отправителя и список UniSender.", 422);
  const credentials = automaticProviderSecrets("unisender") as { apiKey?: string };
  if (!credentials.apiKey) throw new ApiRequestError("В интеграции отсутствует ключ отправки.", 422);
  const html = compileEmailDocument(document);
  if (/(?:src|href)=["'](?:blob:|file:|https?:\/\/(?:localhost|127\.0\.0\.1))/i.test(html)) throw new ApiRequestError("Загрузите изображения на платформу перед отправкой.", 422);
  const result = await sendUniSenderTransactionalEmail({ apiKey: credentials.apiKey, listId: integration.publicConfig.listId, senderName: integration.publicConfig.senderName || "Поток", senderEmail, recipientEmail: email, subject: `[Тест] ${renderEmailTestFields(document.subject)}`, htmlBody: renderEmailTestFields(html), signal: AbortSignal.timeout(30000) });
  if (result.status === "rejected") throw new ApiRequestError("UniSender отклонил тестовое письмо. Проверьте подтверждение адреса отправителя, список и доступ к отправке в интеграции.", 422);
  if (result.status !== "accepted") throw new ApiRequestError("Провайдер не подтвердил отправку. Проверьте статус в UniSender перед повторной попыткой.", 502);
  return { message: "UniSender принял тестовое письмо к отправке. Проверьте указанный почтовый ящик." };
}
