import { getD1 } from "@/db";
import { ApiRequestError } from "./api-utils";
import { sha256, telegramAction, type TelegramUpdate } from "./telegram-api";
import type { TelegramConnection } from "./telegram-connection";

export const TELEGRAM_CONSENT_VERSION = "telegram-subscription-v1";
export function telegramConsentStatement(operator: string) {
  return `Я разрешаю организации «${operator}» обрабатывать моё имя и идентификатор Telegram для ведения подписки и согласен получать от неё в этом боте новости, приглашения и предложения. Отказаться от сообщений можно в любой момент командой /stop.`;
}

export async function readTelegramBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiRequestError("Пустой запрос.");
  const parts: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64_000) { await reader.cancel(); throw new ApiRequestError("Слишком большой запрос.", 413); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiRequestError("Некорректный JSON."); }
}

export async function receiveTelegramUpdate(request: Request, webhookId: string) {
  const db = getD1();
  const connection = await db.prepare("SELECT * FROM telegram_connections WHERE webhook_id=?").bind(webhookId).first<TelegramConnection>();
  const secret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!connection || !secret || secret.length > 256 || await sha256(secret) !== connection.webhook_secret_hash) throw new ApiRequestError("Недействительная подпись Telegram.", 401);
  if (connection.state !== "connected") throw new ApiRequestError("Подключение Telegram ещё не готово.", 503);
  return processTelegramUpdate(connection, await readTelegramBody(request) as TelegramUpdate);
}

export async function processTelegramUpdate(connection: TelegramConnection, update: TelegramUpdate) {
  const action = telegramAction(update, connection.bot_id);
  if (!action) return { ok: true };
  const db = getD1(), workspace = connection.workspace_id, botId = connection.bot_id;
  const id = `${workspace}:${botId}:${action.chatId}`, eventId = `${workspace}:${botId}:${update.update_id}`;
  const existing = await db.prepare("SELECT status,pending_nonce,event_at,update_id FROM telegram_subscribers WHERE id=?").bind(id)
    .first<{ status: string; pending_nonce: string; event_at: number; update_id: number }>();
  if (action.action === "subscribe" && (!action.nonce || existing?.pending_nonce !== action.nonce)) {
    return { method: "answerCallbackQuery", callback_query_id: action.callbackId, text: "Эта кнопка уже использована. Отправьте /start для новой подписки.", show_alert: true };
  }
  const now = new Date().toISOString(), nonce = crypto.randomUUID(), challenge = crypto.randomUUID();
  const eventGuard = "EXISTS (SELECT 1 FROM telegram_updates WHERE id=? AND nonce=?)";
  const statements = [db.prepare("INSERT OR IGNORE INTO telegram_updates (id,nonce,created_at) VALUES (?,?,?)").bind(eventId, nonce, now)];
  if (action.action === "subscribe") {
    statements.push(db.prepare(`UPDATE telegram_subscribers SET status='subscribed',pending_nonce='',event_at=?,update_id=?,event_nonce=?,updated_at=?
      WHERE id=? AND pending_nonce=? AND ${eventGuard} AND (event_at<? OR (event_at=? AND update_id<?))`)
      .bind(action.at, update.update_id, nonce, now, id, action.nonce, eventId, nonce, action.at, action.at, update.update_id));
  } else {
    statements.push(db.prepare(`INSERT INTO telegram_subscribers (id,workspace_id,bot_id,chat_id,status,pending_nonce,event_at,update_id,event_nonce,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${eventGuard}
      ON CONFLICT(id) DO UPDATE SET status=${action.action === "stop" ? "'unsubscribed'" : "telegram_subscribers.status"},pending_nonce=excluded.pending_nonce,event_at=excluded.event_at,update_id=excluded.update_id,event_nonce=excluded.event_nonce,updated_at=excluded.updated_at
      WHERE telegram_subscribers.event_at<excluded.event_at OR (telegram_subscribers.event_at=excluded.event_at AND telegram_subscribers.update_id<excluded.update_id)`)
      .bind(id, workspace, botId, action.chatId, action.action === "stop" ? "unsubscribed" : "pending", action.action === "stop" ? "" : challenge, action.at, update.update_id, nonce, now, now, eventId, nonce));
  }
  const subscriberGuard = "EXISTS (SELECT 1 FROM telegram_subscribers WHERE id=? AND event_nonce=?)";
  if (action.action === "subscribe") {
    const first = (action.user.first_name ?? "Подписчик").slice(0, 100), last = (action.user.last_name ?? "").slice(0, 100);
    // Link by numeric chat ID only. A mutable @username is never an identity key.
    statements.push(db.prepare(`INSERT OR IGNORE INTO contacts (id,workspace_id,first_name,last_name,full_name,telegram_chat_id,telegram_consent,tags,custom_fields,created_at,updated_at)
      SELECT ?,?,?,?,?,?,1,?,?,?,? WHERE ${subscriberGuard}`)
      .bind(`telegram-${crypto.randomUUID()}`, workspace, first, last, `${first} ${last}`.trim(), action.chatId, JSON.stringify(["Telegram"]), JSON.stringify({ telegramUsername: action.user.username ?? "", source: `Telegram @${connection.username}` }), now, now, id, nonce));
  }
  if (action.action !== "start") {
    statements.push(db.prepare(`UPDATE contacts SET telegram_consent=?,custom_fields=json_set(custom_fields,'$.telegramSubscriptionBotId',?),updated_at=? WHERE workspace_id=? AND telegram_chat_id=? AND ${subscriberGuard}`)
      .bind(action.action === "subscribe" ? 1 : 0, botId, now, workspace, action.chatId, id, nonce));
    const statement = action.action === "subscribe" ? telegramConsentStatement(connection.operator) : action.blocked ? "Пользователь заблокировал бота в Telegram." : "Пользователь отписался командой /stop или /unsubscribe.";
    const source = `https://t.me/${connection.username} · bot ${botId} · update ${update.update_id}`;
    // Store exactly the statement displayed by this consent version. Do not infer
    // email permission or change the contact's global/email unsubscribe status.
    for (const purpose of action.action === "subscribe" ? ["marketing", "data_processing"] : ["marketing"]) {
      const digest = await sha256(JSON.stringify({ endpoint: action.chatId, channel: "telegram", purpose, source, version: TELEGRAM_CONSENT_VERSION, statement, operator: connection.operator, obtainedAt: now, expiresAt: null }));
      statements.push(db.prepare(`INSERT OR IGNORE INTO communication_consents (id,workspace_id,contact_id,endpoint,channel,purpose,kind,source,obtained_at,expires_at,version,statement,operator,digest,actor_id,created_at)
        SELECT ?,?,c.id,?,'telegram',?,?,?,?,NULL,?,?,?,?,?,? FROM contacts c WHERE c.workspace_id=? AND c.telegram_chat_id=? AND ${subscriberGuard}`)
        .bind(`${eventId}:${purpose}`, workspace, action.chatId, purpose, action.action === "subscribe" ? "grant" : "revoke", source, now, TELEGRAM_CONSENT_VERSION, statement, connection.operator, digest, `telegram:${action.chatId}`, now, workspace, action.chatId, id, nonce));
    }
  }
  statements.push(db.prepare(`UPDATE telegram_connections SET last_received_at=? WHERE workspace_id=? AND bot_id=? AND ${eventGuard}`).bind(now, workspace, botId, eventId, nonce));
  const result = await db.batch(statements);
  if (!result[0].meta.changes || !result[1].meta.changes) return { ok: true };
  if (action.blocked) return { ok: true };
  if (action.action === "subscribe") return { method: "answerCallbackQuery", callback_query_id: action.callbackId, text: "Подписка оформлена. Для отмены отправьте /stop.", show_alert: true };
  if (action.action === "stop") return { method: "sendMessage", chat_id: action.chatId, text: "Вы отписались. Новые рассылки от этого бота приходить не будут. Подписаться снова: /start." };
  return { method: "sendMessage", chat_id: action.chatId,
    text: `${existing?.status === "subscribed" ? "Вы уже подписаны. Отписаться: /stop.\n\n" : ""}Подписка на сообщения «${connection.operator}».\n\n${telegramConsentStatement(connection.operator)}\n\nНажмите «Согласиться и подписаться», чтобы подтвердить.`,
    reply_markup: { inline_keyboard: [[{ text: "Согласиться и подписаться", callback_data: `potok_subscribe:${challenge}` }]] } };
}
