import assert from "node:assert/strict";
import test from "node:test";

import {
  createUniSenderCampaign,
  deterministicVkRandomId,
  renderMergeTemplate,
  sendTelegramMessage,
  sendVkMessage,
  unknownMergeTokens,
} from "../lib/server/provider-adapters.ts";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("Telegram accepts a message and exposes provider message_id", async () => {
  let calls = 0;
  const result = await sendTelegramMessage({
    token: "test-token",
    chatId: "42",
    text: "Привет",
    fetchFn: async (url, init) => {
      calls += 1;
      assert.match(String(url), /\/bottest-token\/sendMessage$/);
      assert.deepEqual(JSON.parse(String(init.body)), {
        chat_id: "42",
        text: "Привет",
      });
      return jsonResponse({ ok: true, result: { message_id: 77 } });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "accepted");
  assert.equal(result.externalId, "77");
});

test("Telegram 5xx is ambiguous and is never retried blindly", async () => {
  let calls = 0;
  const result = await sendTelegramMessage({
    token: "test-token",
    chatId: "42",
    text: "Привет",
    fetchFn: async () => {
      calls += 1;
      return jsonResponse({ ok: false }, 503);
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "ambiguous");
});

test("VK uses a deterministic non-zero random_id", async () => {
  const key = "version:vk:contact";
  const expected = deterministicVkRandomId(key);
  assert.equal(expected, deterministicVkRandomId(key));
  assert.ok(expected > 0);
  const result = await sendVkMessage({
    accessToken: "secret",
    peerId: "123",
    message: "Здравствуйте",
    idempotencyKey: key,
    fetchFn: async (url, init) => {
      assert.match(String(url), /\/messages\.send$/);
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get("random_id"), String(expected));
      assert.equal(body.get("peer_id"), "123");
      return jsonResponse({ response: 991 });
    },
  });
  assert.equal(result.status, "accepted");
  assert.equal(result.externalId, "991");
});

test("direct routes render supported contact merge fields deterministically", () => {
  const rendered = renderMergeTemplate(
    "Здравствуйте, {{first_name}} {{last_name}} из {{company}}! {{city|город не указан}}",
    {
      first_name: "Иван",
      last_name: "Петров",
      company: "Право и партнёры",
    },
  );
  assert.equal(
    rendered,
    "Здравствуйте, Иван Петров из Право и партнёры! город не указан",
  );
  assert.deepEqual(unknownMergeTokens("{{unknown_field}}"), ["unknown_field"]);
  assert.throws(
    () => renderMergeTemplate("{{unknown_field}}", {}),
    /Неизвестные поля персонализации/,
  );
});

test("UniSender maps MAILFLOW merge fields into imported provider fields", async () => {
  const methods = [];
  const result = await createUniSenderCampaign({
    apiKey: "api-key",
    listId: "88",
    senderName: "MAILFLOW",
    senderEmail: "sender@example.test",
    subject: "Для {{first_name}} из {{company}}",
    textBody: "Здравствуйте, {{first_name}} {{last_name}}",
    campaignTag: "mailflow_merge",
    recipients: [{
      email: "ivan@example.test",
      name: "Иван Петров",
      outboxId: "outbox-merge",
      mergeFields: {
        first_name: "Иван",
        last_name: "Петров",
        company: "Право и партнёры",
      },
    }],
    fetchFn: async (url, init) => {
      const method = String(url).split("/").at(-1);
      methods.push(method);
      const body = new URLSearchParams(String(init.body));
      if (method === "getFields") return jsonResponse({ result: [] });
      if (method === "createField") return jsonResponse({ result: { id: methods.length } });
      if (method === "importContacts") {
        assert.equal(body.get("field_names[4]"), "mailflow_first_name");
        assert.equal(body.get("field_names[5]"), "mailflow_company");
        assert.equal(body.get("field_names[6]"), "mailflow_last_name");
        assert.equal(body.get("data[0][4]"), "Иван");
        assert.equal(body.get("data[0][5]"), "Право и партнёры");
        assert.equal(body.get("data[0][6]"), "Петров");
        return jsonResponse({ result: { invalid: 0, log: [] } });
      }
      if (method === "createEmailMessage") {
        assert.equal(
          body.get("subject"),
          "Для {{mailflow_first_name}} из {{mailflow_company}}",
        );
        assert.equal(
          body.get("text_body"),
          "Здравствуйте, {{mailflow_first_name}} {{mailflow_last_name}}",
        );
        return jsonResponse({ result: { message_id: 1234 } });
      }
      assert.equal(method, "createCampaign");
      return jsonResponse({ result: { campaign_id: 5678 } });
    },
  });
  assert.equal(result.status, "accepted");
  assert.deepEqual(result.acceptedOutboxIds, ["outbox-merge"]);
  assert.deepEqual(methods, [
    "getFields",
    "createField",
    "createField",
    "createField",
    "importContacts",
    "createEmailMessage",
    "createCampaign",
  ]);
});

test("UniSender imports in batches of at most 500 then creates one campaign", async () => {
  const recipients = Array.from({ length: 501 }, (_, index) => ({
    email: `user${index}@example.test`,
    name: `Пользователь ${index}`,
    outboxId: `outbox-${index}`,
  }));
  const methods = [];
  const batchSizes = [];
  const result = await createUniSenderCampaign({
    apiKey: "api-key",
    listId: "88",
    senderName: "MAILFLOW",
    senderEmail: "sender@example.test",
    subject: "Тема",
    textBody: "Текст",
    campaignTag: "mailflow_test",
    recipients,
    fetchFn: async (url, init) => {
      const method = String(url).split("/").at(-1);
      methods.push(method);
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get("api_key"), "api-key");
      if (method === "importContacts") {
        const count = [...body.keys()].filter((key) => /^data\[\d+\]\[0\]$/.test(key)).length;
        batchSizes.push(count);
        return jsonResponse({ result: { invalid: 0, log: [] } });
      }
      if (method === "createEmailMessage") {
        assert.equal(body.get("tag"), "mailflow_test");
        return jsonResponse({ result: { message_id: 1234 } });
      }
      assert.equal(method, "createCampaign");
      assert.equal(body.get("message_id"), "1234");
      return jsonResponse({ result: { campaign_id: 5678 } });
    },
  });
  assert.deepEqual(batchSizes, [500, 1]);
  assert.deepEqual(methods, [
    "importContacts",
    "importContacts",
    "createEmailMessage",
    "createCampaign",
  ]);
  assert.equal(result.status, "accepted");
  assert.equal(result.acceptedOutboxIds.length, 501);
  assert.equal(result.campaignId, "5678");
});

test("UniSender does not mark recipients accepted when createCampaign is ambiguous", async () => {
  let calls = 0;
  const result = await createUniSenderCampaign({
    apiKey: "api-key",
    listId: "88",
    senderName: "MAILFLOW",
    senderEmail: "sender@example.test",
    subject: "Тема",
    textBody: "Текст",
    campaignTag: "mailflow_test",
    recipients: [{ email: "one@example.test", name: "Один", outboxId: "outbox-1" }],
    fetchFn: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ result: { invalid: 0, log: [] } });
      if (calls === 2) return jsonResponse({ result: { message_id: 1234 } });
      return jsonResponse({ error: "temporary" }, 503);
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.acceptedOutboxIds, []);
  assert.equal(result.messageId, "1234");
});
