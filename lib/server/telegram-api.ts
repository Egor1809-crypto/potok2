import { ApiRequestError } from "./api-utils";

export function validateTelegramToken(value: unknown): string {
  if (typeof value !== "string" || !/^\d{5,20}:[A-Za-z0-9_-]{30,100}$/.test(value.trim())) {
    throw new ApiRequestError("Вставьте полный токен бота, полученный у @BotFather.");
  }
  return value.trim();
}

// Never propagate fetch errors: Telegram puts the credential in the URL.
export async function telegramApi<T>(token: string, method: string, parameters: object = {}, fetchFn = fetch): Promise<T> {
  try {
    const response = await fetchFn(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parameters), signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json() as { ok?: boolean; result?: T; error_code?: number };
    if (!response.ok || !body.ok) {
      if (response.status === 401 || body.error_code === 401) throw new ApiRequestError("Токен не принят Telegram. Скопируйте действующий токен из @BotFather.", 422);
      if (response.status === 429 || body.error_code === 429) throw new ApiRequestError("Telegram просит подождать. Повторите подключение через минуту.", 429);
      throw new ApiRequestError("Telegram не выполнил запрос. Проверьте бота и повторите попытку.", 502);
    }
    return body.result as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("Не удалось связаться с Telegram. Повторите попытку позже.", 502);
  }
}

export async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function vaultKey(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new ApiRequestError("Защищённое хранилище Telegram ещё не настроено. Обратитесь к администратору платформы.", 503);
  return crypto.subtle.importKey("raw", Uint8Array.from(secret.match(/../g)!, x => parseInt(x, 16)), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealTelegramToken(token: string, secret: string, scope: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(scope) }, await vaultKey(secret), new TextEncoder().encode(token)));
  return `v1.${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...cipher))}`;
}

export async function openTelegramToken(sealed: string, secret: string, scope: string) {
  try {
    const [version, iv, cipher] = sealed.split(".");
    if (version !== "v1" || !iv || !cipher) throw new Error("Invalid envelope");
    const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(iv), x => x.charCodeAt(0)), additionalData: new TextEncoder().encode(scope) }, await vaultKey(secret), Uint8Array.from(atob(cipher), x => x.charCodeAt(0)));
    return new TextDecoder().decode(bytes);
  } catch {
    throw new ApiRequestError("Не удалось прочитать токен бота. Подключите его повторно.", 503);
  }
}

export type TelegramUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type Chat = { id: number; type: string };
type Message = { chat: Chat; from?: TelegramUser; text?: string; date?: number };
export type TelegramUpdate = {
  update_id: number;
  message?: Message;
  callback_query?: { id: string; from: TelegramUser; message?: Message; data?: string };
  my_chat_member?: { chat: Chat; from: TelegramUser; date: number; new_chat_member: { status: string } };
};

export function telegramAction(update: TelegramUpdate, botId: string) {
  if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0) return null;
  const callback = update.callback_query;
  const message = update.message;
  const member = update.my_chat_member;
  const chat = callback?.message?.chat ?? message?.chat ?? member?.chat;
  const user = callback?.from ?? message?.from ?? member?.from;
  if (!chat || chat.type !== "private" || !user || user.is_bot || !Number.isSafeInteger(user.id) || user.id <= 0 || chat.id !== user.id) return null;
  if (callback && String(callback.message?.from?.id) !== botId) return null;
  const command = (message?.text ?? "").trim().split(/\s/)[0].split("@")[0].toLowerCase();
  const action = callback?.data?.startsWith("potok_subscribe:") ? "subscribe"
    : ["/stop", "/unsubscribe"].includes(command) || member?.new_chat_member.status === "kicked" ? "stop"
    : ["/start", "/subscribe", "/help"].includes(command) ? "start" : null;
  if (!action) return null;
  const timestamp = callback ? Math.floor(Date.now() / 1000) : message?.date ?? member?.date;
  if (!Number.isSafeInteger(timestamp) || timestamp! <= 0 || timestamp! > Date.now() / 1000 + 300) return null;
  return { action, chatId: String(chat.id), user, nonce: callback?.data?.slice("potok_subscribe:".length) ?? "", callbackId: callback?.id, blocked: Boolean(member), at: timestamp! };
}
