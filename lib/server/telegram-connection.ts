import { getD1 } from "@/db";
import type { TelegramConnectionInfo } from "@/types/telegram";
import { ApiRequestError, asObject } from "./api-utils";
import { ensureDatabase, WORKSPACE_ID } from "./database-init";
import { runtimeSecret } from "./runtime-integrations";
import { openTelegramToken, sealTelegramToken, sha256, telegramApi, validateTelegramToken, type TelegramUser } from "./telegram-api";

export type TelegramConnection = {
  workspace_id: string; bot_id: string; username: string; display_name: string;
  encrypted_token: string; webhook_id: string; webhook_secret_hash: string; webhook_url: string;
  state: string; operation_id: string; operator: string; last_received_at: string | null; updated_at: string;
};
const vaultSecret = () => runtimeSecret("TELEGRAM_CREDENTIAL_KEY");
export const telegramTokenScope = (workspaceId: string, botId: string) => `telegram:${workspaceId}:${botId}`;
export const telegramConnection = () => getD1().prepare("SELECT * FROM telegram_connections WHERE workspace_id=?").bind(WORKSPACE_ID).first<TelegramConnection>();

export async function resolveTelegramToken(config: Record<string, string>): Promise<string> {
  if (config.credentialSource !== "vault") return runtimeSecret(config.botSlot === "secondary" ? "TELEGRAM_BOT_TOKEN_2" : "TELEGRAM_BOT_TOKEN");
  const connection = await telegramConnection();
  if (!connection || connection.state !== "connected" || connection.bot_id !== config.botId) throw new ApiRequestError("Бот отключён или заменён. Проверьте подключение Telegram.", 409);
  return openTelegramToken(connection.encrypted_token, vaultSecret(), telegramTokenScope(WORKSPACE_ID, connection.bot_id));
}

export async function telegramConnectionInfo(request?: Request): Promise<TelegramConnectionInfo> {
  if (request) await ensureDatabase(request);
  const connection = await telegramConnection();
  const integration = await getD1().prepare("SELECT enabled,check_status,check_message FROM integrations WHERE workspace_id=? AND provider_id='telegram-bot-api'").bind(WORKSPACE_ID).first<{ enabled: number; check_status: string; check_message: string }>();
  const connected = Boolean(connection?.state === "connected" && integration?.enabled && integration.check_status === "connected");
  const count = connection ? await getD1().prepare(`SELECT count(*) AS n FROM telegram_subscribers s JOIN contacts c ON c.workspace_id=s.workspace_id AND c.telegram_chat_id=s.chat_id
    WHERE s.workspace_id=? AND s.bot_id=? AND s.status='subscribed' AND c.status='active' AND c.telegram_consent=1`).bind(WORKSPACE_ID, connection.bot_id).first<{ n: number }>() : null;
  return { configured: Boolean(vaultSecret()), connected, username: connection?.username ?? "", displayName: connection?.display_name ?? "",
    subscribeUrl: connected ? `https://t.me/${connection!.username}?start=potok` : "", subscribers: count?.n ?? 0,
    lastReceivedAt: connection?.last_received_at ?? null, message: connection ? integration?.check_message ?? "Проверьте подключение." : "Подключите бота, чтобы получить ссылку подписки." };
}

async function integrationState(enabled: boolean, status: string, message: string) {
  await getD1().prepare("UPDATE integrations SET enabled=?,check_status=?,check_message=?,last_checked_at=?,updated_at=? WHERE workspace_id=? AND provider_id='telegram-bot-api'")
    .bind(Number(enabled), status, message, new Date().toISOString(), new Date().toISOString(), WORKSPACE_ID).run();
}

export async function checkTelegramConnection(): Promise<{ ok: boolean; message: string }> {
  const connection = await telegramConnection();
  if (!connection || connection.state !== "connected") return { ok: false, message: "Подключите бота в разделе Telegram." };
  try {
    const token = await resolveTelegramToken({ credentialSource: "vault", botId: connection.bot_id });
    const [bot, hook] = await Promise.all([
      telegramApi<TelegramUser>(token, "getMe"),
      telegramApi<{ url: string; pending_update_count?: number; last_error_date?: number }>(token, "getWebhookInfo"),
    ]);
    if (String(bot.id) !== connection.bot_id || !bot.is_bot || hook.url !== connection.webhook_url) return { ok: false, message: "Приём подписок отключён или перенесён. Подключите бота повторно." };
    if (hook.pending_update_count && hook.last_error_date && hook.last_error_date * 1000 > Date.now() - 10 * 60_000) return { ok: false, message: "Telegram не может передать новые подписки. Повторите проверку через минуту." };
    return { ok: true, message: `@${bot.username}: подключён, приём подписок включён.` };
  } catch (error) {
    return { ok: false, message: error instanceof ApiRequestError ? error.message : "Не удалось проверить Telegram." };
  }
}

export async function disconnectTelegramConnection() {
  const connection = await telegramConnection();
  if (!connection) return;
  if (connection.state === "connecting" && Date.parse(connection.updated_at) > Date.now() - 120_000) throw new ApiRequestError("Дождитесь завершения подключения.", 409);
  // Disable dispatch before contacting Telegram, even when the provider is down.
  await integrationState(false, "disconnected", "Telegram отключён. Рассылки через бота остановлены.");
  let message = "Telegram отключён. Подписчики сохранены для повторного подключения этого бота.";
  try {
    const token = await openTelegramToken(connection.encrypted_token, vaultSecret(), telegramTokenScope(WORKSPACE_ID, connection.bot_id));
    const hook = await telegramApi<{ url: string }>(token, "getWebhookInfo");
    if (hook.url === connection.webhook_url) await telegramApi(token, "deleteWebhook");
  } catch { message = "Рассылки остановлены. Telegram не подтвердил отключение приёма подписок; при необходимости отзовите токен в BotFather."; }
  await getD1().batch([
    getD1().prepare("UPDATE telegram_connections SET state='disconnected',encrypted_token='',webhook_secret_hash='',updated_at=? WHERE workspace_id=?").bind(new Date().toISOString(), WORKSPACE_ID),
    getD1().prepare("UPDATE integrations SET public_config='{}',enabled=0,check_status='disconnected',check_message=? WHERE workspace_id=? AND provider_id='telegram-bot-api'").bind(message, WORKSPACE_ID),
  ]);
}

export async function manageTelegramConnection(request: Request, payload: unknown) {
  await ensureDatabase(request);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiRequestError("Запрос с другого сайта отклонён.", 403);
  const input = asObject(payload);
  if (input.action === "disconnect") { await disconnectTelegramConnection(); return telegramConnectionInfo(); }
  if (input.action === "check") {
    const checked = await checkTelegramConnection();
    await integrationState(true, checked.ok ? "connected" : "needs_attention", checked.message);
    return telegramConnectionInfo();
  }
  if (input.action !== "connect") throw new ApiRequestError("Неизвестное действие.");
  const token = validateTelegramToken(input.token);
  const bot = await telegramApi<TelegramUser>(token, "getMe");
  if (!bot.is_bot || !Number.isSafeInteger(bot.id) || !/^[A-Za-z0-9_]{5,32}$/.test(bot.username ?? "")) throw new ApiRequestError("Telegram не вернул данные бота.", 502);
  const botId = String(bot.id), db = getD1(), previous = await telegramConnection();
  if (previous && previous.bot_id !== botId && previous.state !== "disconnected") throw new ApiRequestError("Сначала отключите текущего бота. Подписчики одного бота не переносятся другому.", 409);
  const hook = await telegramApi<{ url: string }>(token, "getWebhookInfo");
  if (hook.url && !(previous?.bot_id === botId && hook.url === previous.webhook_url)) throw new ApiRequestError("Этот бот уже подключён к другому сервису. Создайте отдельного бота в BotFather или сначала отключите его в прежнем сервисе.", 409);
  const configuredOrigin = runtimeSecret("TELEGRAM_WEBHOOK_ORIGIN");
  if (!configuredOrigin || !/^https:\/\/[a-z0-9.-]+$/i.test(configuredOrigin)) throw new ApiRequestError("Приём подписок ещё не настроен на сервере платформы.", 503);
  const webhookId = previous?.bot_id === botId ? previous.webhook_id : crypto.randomUUID();
  const webhookUrl = `${configuredOrigin}/api/telegram/webhook/${webhookId}`;
  const webhookSecret = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const encrypted = await sealTelegramToken(token, vaultSecret(), telegramTokenScope(WORKSPACE_ID, botId));
  const workspace = await db.prepare("SELECT company_name,name FROM workspaces WHERE id=?").bind(WORKSPACE_ID).first<{ company_name: string; name: string }>();
  const operator = workspace?.company_name || workspace?.name;
  if (!operator) throw new ApiRequestError("Заполните название организации в настройках рабочего пространства.", 422);
  const now = new Date().toISOString(), operation = crypto.randomUUID();
  const lock = await db.prepare(`INSERT INTO telegram_connections (workspace_id,bot_id,username,display_name,encrypted_token,webhook_id,webhook_secret_hash,webhook_url,state,operation_id,operator,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,'connecting',?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET bot_id=excluded.bot_id,username=excluded.username,display_name=excluded.display_name,encrypted_token=excluded.encrypted_token,
    webhook_id=excluded.webhook_id,webhook_secret_hash=excluded.webhook_secret_hash,webhook_url=excluded.webhook_url,state='connecting',operation_id=excluded.operation_id,operator=excluded.operator,updated_at=excluded.updated_at
    WHERE (telegram_connections.state<>'connecting' OR telegram_connections.updated_at<?) AND (telegram_connections.bot_id=excluded.bot_id OR telegram_connections.state='disconnected')`)
    .bind(WORKSPACE_ID, botId, bot.username!, bot.first_name ?? bot.username!, encrypted, webhookId, await sha256(webhookSecret), webhookUrl, operation, operator, now, now, new Date(Date.now() - 120_000).toISOString()).run();
  if (!lock.meta.changes) throw new ApiRequestError("Подключение уже выполняется. Дождитесь результата и обновите статус.", 409);
  await integrationState(false, "needs_attention", "Подключаем Telegram…");
  try {
    await telegramApi(token, "setWebhook", { url: webhookUrl, secret_token: webhookSecret, allowed_updates: ["message", "callback_query", "my_chat_member"], max_connections: 1 });
    const verified = await telegramApi<{ url: string }>(token, "getWebhookInfo");
    if (verified.url !== webhookUrl) throw new ApiRequestError("Telegram не подтвердил приём подписок. Повторите подключение.", 502);
    await db.batch([
      db.prepare("UPDATE telegram_subscribers SET pending_nonce='' WHERE workspace_id=? AND bot_id=?").bind(WORKSPACE_ID, botId),
      db.prepare("UPDATE telegram_connections SET state='connected',updated_at=? WHERE workspace_id=? AND operation_id=?").bind(now, WORKSPACE_ID, operation),
      db.prepare("UPDATE integrations SET enabled=1,public_config=?,check_status='connected',check_message=?,last_checked_at=?,updated_at=? WHERE workspace_id=? AND provider_id='telegram-bot-api'")
        .bind(JSON.stringify({ credentialSource: "vault", botId, botUsername: bot.username! }), `@${bot.username}: подключён, приём подписок включён.`, now, now, WORKSPACE_ID),
    ]);
  } catch (error) {
    await db.prepare("UPDATE telegram_connections SET state='error',updated_at=? WHERE workspace_id=? AND operation_id=?").bind(new Date().toISOString(), WORKSPACE_ID, operation).run();
    await integrationState(false, "needs_attention", "Подключение не завершено. Повторите его с токеном бота.");
    throw error;
  }
  return telegramConnectionInfo();
}

export async function telegramRecipientAllowed(config: Record<string, string>, chatId: string) {
  const db = getD1();
  const integration = await db.prepare("SELECT enabled,check_status,public_config FROM integrations WHERE workspace_id=? AND provider_id='telegram-bot-api'").bind(WORKSPACE_ID).first<{ enabled: number; check_status: string; public_config: string }>();
  if (!integration?.enabled || integration.check_status !== "connected") return false;
  const current = JSON.parse(integration.public_config) as Record<string, string>;
  if (current.credentialSource !== config.credentialSource || current.botId !== config.botId || current.botSlot !== config.botSlot) return false;
  const contact = await db.prepare("SELECT telegram_consent,status FROM contacts WHERE workspace_id=? AND telegram_chat_id=?").bind(WORKSPACE_ID, chatId).first<{ telegram_consent: number; status: string }>();
  if (!contact?.telegram_consent || contact.status !== "active") return false;
  if (config.credentialSource !== "vault") return true;
  return Boolean(await db.prepare("SELECT 1 FROM telegram_subscribers WHERE workspace_id=? AND bot_id=? AND chat_id=? AND status='subscribed'").bind(WORKSPACE_ID, config.botId, chatId).first());
}

export async function telegramSubscribedChatIds(config: Record<string, string>): Promise<Set<string> | null> {
  if (config.credentialSource !== "vault") return null;
  const rows = await getD1().prepare("SELECT chat_id FROM telegram_subscribers WHERE workspace_id=? AND bot_id=? AND status='subscribed'").bind(WORKSPACE_ID, config.botId).all<{ chat_id: string }>();
  return new Set(rows.results.map(row => row.chat_id));
}
