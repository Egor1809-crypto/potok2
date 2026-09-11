import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { loadAiServer } from "./helpers/ai-server-harness.mjs";
import { openTelegramToken, sealTelegramToken, sha256, telegramAction, telegramApi, validateTelegramToken } from "../lib/server/telegram-api.ts";
import { consentState } from "../lib/communications/rules.ts";

const token = "123456:" + "a".repeat(35), key = "ab".repeat(32), workspace = "workspace-main";
const json = result => new Response(JSON.stringify({ ok: true, result }));
const req = () => new Request("https://potok.example/api/integrations/telegram", { method: "POST", headers: { origin: "https://potok.example" } });
function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle").filter(f => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  sqlite.prepare("INSERT INTO workspaces(id,name,company_name) VALUES(?,?,?)").run(workspace, "Тест", "Тестовая организация");
  sqlite.prepare("INSERT INTO integrations(id,workspace_id,provider_id) VALUES(?,?,?)").run("integration-telegram", workspace, "telegram-bot-api");
  const d1 = { prepare(sql) {
    let values = [];
    return { bind(...args) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
    };
  }, async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
  return { sqlite, d1 };
}
async function harness(fetchFn, extra = {}) {
  const { sqlite, d1 } = database();
  const options = { env: { TELEGRAM_CREDENTIAL_KEY: key, TELEGRAM_WEBHOOK_ORIGIN: "https://potok.example" }, fetch: fetchFn,
    overrides: { "@/db": { getD1: () => d1 }, "./database-init": { ensureDatabase: async () => ({ participant: { id: "member" } }), WORKSPACE_ID: workspace }, ...extra } };
  const connection = await loadAiServer("lib/server/telegram-connection.ts", options);
  const webhook = await loadAiServer("lib/server/telegram-webhook.ts", options);
  return { sqlite, connection, webhook };
}
function provider() {
  let url = ""; const calls = []; let secret = "";
  return { calls, secret: () => secret, fetch: async (address, options) => {
    const method = String(address).split("/").at(-1); const body = JSON.parse(options.body); calls.push({ method, body });
    if (method === "getMe") return json({ id: 123456, is_bot: true, username: "potok_test_bot", first_name: "Поток тест" });
    if (method === "getWebhookInfo") return json({ url, pending_update_count: 0 });
    if (method === "setWebhook") { url = body.url; secret = body.secret_token; return json(true); }
    if (method === "deleteWebhook") { url = ""; return json(true); }
    throw new Error(`Unexpected provider call: ${method}`);
  } };
}
const user = { id: 42, first_name: "Иван", last_name: "Иванов", username: "ivan", is_bot: false };
const message = (updateId, text, date = Math.floor(Date.now() / 1000)) => ({ update_id: updateId, message: { from: user, chat: { id: 42, type: "private" }, text, date } });
const subscribe = (updateId, nonce) => ({ update_id: updateId, callback_query: { id: `callback-${updateId}`, from: user, message: { from: { id: 123456, is_bot: true }, chat: { id: 42, type: "private" } }, data: `potok_subscribe:${nonce}` } });

test("Telegram credential vault authenticates workspace and bot, and never leaks tokens in errors", async () => {
  const sealed = await sealTelegramToken(token, key, "workspace:bot");
  assert.ok(!sealed.includes(token));
  assert.equal(await openTelegramToken(sealed, key, "workspace:bot"), token);
  await assert.rejects(openTelegramToken(sealed, key, "other:bot"), /прочитать токен/);
  await assert.rejects(openTelegramToken(sealed, "cd".repeat(32), "workspace:bot"), /прочитать токен/);
  await assert.rejects(telegramApi(token, "getMe", {}, async url => { throw new Error(String(url)); }), error => !error.message.includes(token) && error.status === 502);
  await assert.rejects(telegramApi(token, "getMe", {}, async () => new Response('{"ok":false,"error_code":401}', { status: 401 })), /Токен не принят/);
  assert.equal(validateTelegramToken(` ${token} `), token);
  assert.throws(() => validateTelegramToken("https://evil.test/bot"), /полный токен/);
});

test("connection checks bot identity, installs authenticated webhook, returns no secret and disconnects", async () => {
  const api = provider(), h = await harness(api.fetch);
  try {
    const result = await h.connection.manageTelegramConnection(req(), { action: "connect", token });
    assert.equal(result.connected, true); assert.equal(result.subscribers, 0);
    assert.equal(result.subscribeUrl, "https://t.me/potok_test_bot?start=potok");
    assert.ok(!JSON.stringify(result).includes(token));
    const hook = api.calls.find(c => c.method === "setWebhook").body;
    assert.deepEqual(hook.allowed_updates, ["message", "callback_query", "my_chat_member"]);
    assert.equal(hook.max_connections, 1); assert.ok(hook.secret_token.length >= 32);
    assert.ok(!api.calls.some(c => ["sendMessage", "sendDocument"].includes(c.method)));
    const publicConfig = JSON.parse(h.sqlite.prepare("SELECT public_config FROM integrations").get().public_config);
    assert.equal(await h.connection.resolveTelegramToken(publicConfig), token);
    assert.equal((await h.connection.checkTelegramConnection()).ok, true);
    await h.connection.manageTelegramConnection(req(), { action: "disconnect" });
    assert.equal((await h.connection.telegramConnectionInfo()).connected, false);
    assert.equal(h.sqlite.prepare("SELECT encrypted_token FROM telegram_connections").get().encrypted_token, "");
    await assert.rejects(h.connection.resolveTelegramToken(publicConfig), /отключён/);
  } finally { h.sqlite.close(); }
});

test("connection refuses another service's webhook and requires authenticated same-origin writes", async () => {
  const api = provider();
  const h = await harness(async (url, init) => String(url).endsWith("getWebhookInfo") ? json({ url: "https://other.example/webhook" }) : api.fetch(url, init));
  try {
    await assert.rejects(h.connection.manageTelegramConnection(req(), { action: "connect", token }), /другому сервису/);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM telegram_connections").get().n, 0);
    assert.ok(!api.calls.some(c => c.method === "setWebhook"));
    await assert.rejects(h.connection.manageTelegramConnection(new Request(req().url, { headers: { origin: "https://evil.example" } }), { action: "connect", token }), /другого сайта/);
  } finally { h.sqlite.close(); }
  const denied = await harness(api.fetch, { "./database-init": { WORKSPACE_ID: workspace, ensureDatabase: async () => { throw new Error("Authentication required"); } } });
  try { await assert.rejects(denied.connection.manageTelegramConnection(req(), { action: "connect", token }), /Authentication/); }
  finally { denied.sqlite.close(); }
});

test("subscription creates one contact with evidence; replay, stale events, stop and bot switching are safe", async () => {
  const api = provider(), h = await harness(api.fetch);
  try {
    await h.connection.manageTelegramConnection(req(), { action: "connect", token });
    const bot = await h.connection.telegramConnection();
    const config = { credentialSource: "vault", botId: "123456" };
    const start = await h.webhook.processTelegramUpdate(bot, message(10, "/start potok"));
    assert.match(start.text, /Тестовая организация/);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM contacts").get().n, 0);
    const nonce = start.reply_markup.inline_keyboard[0][0].callback_data.split(":")[1];
    await h.webhook.processTelegramUpdate(bot, subscribe(11, nonce));
    await h.webhook.processTelegramUpdate(bot, subscribe(11, nonce));
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM contacts").get().n, 1);
    const contact = h.sqlite.prepare("SELECT * FROM contacts").get();
    assert.equal(contact.telegram_consent, 1); assert.equal(contact.email_consent, 0);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM communication_consents").get().n, 2);
    const evidence = h.sqlite.prepare("SELECT * FROM communication_consents").all();
    const record = { status: "active", telegramChatId: "42", telegramConsent: true };
    assert.equal(consentState(record, "telegram", "marketing", evidence, new Date().toISOString()), "confirmed");
    assert.equal(consentState(record, "telegram", "data_processing", evidence, new Date().toISOString()), "confirmed");
    assert.equal((await h.connection.telegramConnectionInfo()).subscribers, 1);
    assert.equal(await h.connection.telegramRecipientAllowed(config, "42"), true);
    assert.equal(await h.connection.telegramRecipientAllowed({ ...config, botId: "another" }, "42"), false);
    assert.equal((await h.connection.telegramSubscribedChatIds({ ...config, botId: "another" })).size, 0);
    await h.webhook.processTelegramUpdate(bot, message(12, "/stop"));
    assert.equal(await h.connection.telegramRecipientAllowed(config, "42"), false);
    assert.equal((await h.connection.telegramConnectionInfo()).subscribers, 0);
    await h.webhook.processTelegramUpdate(bot, subscribe(11, nonce));
    await h.webhook.processTelegramUpdate(bot, message(9, "/start", Math.floor(Date.now() / 1000) - 100));
    assert.equal(await h.connection.telegramRecipientAllowed(config, "42"), false);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM communication_consents WHERE kind='revoke'").get().n, 1);
    const next = await h.webhook.processTelegramUpdate(bot, message(13, "/start"));
    await h.webhook.processTelegramUpdate(bot, subscribe(14, next.reply_markup.inline_keyboard[0][0].callback_data.split(":")[1]));
    assert.equal(await h.connection.telegramRecipientAllowed(config, "42"), true);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM contacts").get().n, 1);
    await h.connection.disconnectTelegramConnection();
    assert.equal(await h.connection.telegramRecipientAllowed(config, "42"), false);
  } finally { h.sqlite.close(); }
});

test("failed webhook setup cannot enable sending and retry completes the connection", async () => {
  const api = provider(); let fail = true;
  const h = await harness((url, init) => fail && String(url).endsWith("setWebhook") ? new Response('{"ok":false}', { status: 500 }) : api.fetch(url, init));
  try {
    await assert.rejects(h.connection.manageTelegramConnection(req(), { action: "connect", token }), /не выполнил/);
    assert.equal((await h.connection.telegramConnectionInfo()).connected, false);
    assert.equal(h.sqlite.prepare("SELECT enabled FROM integrations").get().enabled, 0);
    assert.equal(h.sqlite.prepare("SELECT state FROM telegram_connections").get().state, "error");
    fail = false;
    assert.equal((await h.connection.manageTelegramConnection(req(), { action: "connect", token })).connected, true);
  } finally { h.sqlite.close(); }
});

test("blocking bot revokes Telegram only; existing contact and email status are preserved", async () => {
  const api = provider(), h = await harness(api.fetch);
  try {
    await h.connection.manageTelegramConnection(req(), { action: "connect", token });
    const bot = await h.connection.telegramConnection();
    h.sqlite.prepare("INSERT INTO contacts(id,workspace_id,first_name,last_name,full_name,email,email_consent,telegram_chat_id,status) VALUES(?,?,?,?,?,?,1,?,'unsubscribed')")
      .run("existing", workspace, "Иван", "Иванов", "Иван Иванов", "ivan@example.test", "42");
    const start = await h.webhook.processTelegramUpdate(bot, message(20, "/start"));
    await h.webhook.processTelegramUpdate(bot, subscribe(21, start.reply_markup.inline_keyboard[0][0].callback_data.split(":")[1]));
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM contacts").get().n, 1);
    assert.equal(h.sqlite.prepare("SELECT status FROM contacts").get().status, "unsubscribed");
    await h.webhook.processTelegramUpdate(bot, { update_id: 22, my_chat_member: { chat: { id: 42, type: "private" }, from: user, date: Math.floor(Date.now() / 1000), new_chat_member: { status: "kicked" } } });
    const contact = h.sqlite.prepare("SELECT * FROM contacts").get();
    assert.equal(contact.telegram_consent, 0); assert.equal(contact.email_consent, 1);
    assert.equal(contact.id, "existing"); assert.equal(contact.email, "ivan@example.test");
  } finally { h.sqlite.close(); }
});

test("webhook rejects forged secret, group events and mismatched callback sender", async () => {
  const api = provider(), h = await harness(api.fetch);
  try {
    await h.connection.manageTelegramConnection(req(), { action: "connect", token });
    const bot = await h.connection.telegramConnection();
    assert.equal(bot.webhook_secret_hash, await sha256(api.secret()));
    const request = secret => new Request(bot.webhook_url, { method: "POST", headers: { "x-telegram-bot-api-secret-token": secret }, body: JSON.stringify(message(1, "/start")) });
    await assert.rejects(h.webhook.receiveTelegramUpdate(request("wrong"), bot.webhook_id), /подпись/);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM telegram_updates").get().n, 0);
    assert.equal((await h.webhook.receiveTelegramUpdate(request(api.secret()), bot.webhook_id)).method, "sendMessage");
    const group = message(2, "/start"); group.message.chat.type = "group";
    assert.equal(telegramAction(group, bot.bot_id), null);
    const forged = subscribe(3, "nonce"); forged.callback_query.from.id = 999;
    assert.equal(telegramAction(forged, bot.bot_id), null);
    assert.equal(telegramAction({ update_id: "bad" }, bot.bot_id), null);
  } finally { h.sqlite.close(); }
});
