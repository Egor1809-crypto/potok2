import assert from "node:assert/strict";
import test from "node:test";

import {
  createUniSenderCampaign,
  checkUniSenderEmail,
  deterministicVkRandomId,
  getUniSenderCampaignStats,
  renderMergeTemplate,
  sendUniSenderTransactionalEmail,
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
        assert.equal(body.get("field_names[3]"), "mailflow_first_name");
        assert.equal(body.get("field_names[4]"), "mailflow_company");
        assert.equal(body.get("field_names[5]"), "mailflow_last_name");
        assert.equal(body.get("data[0][3]"), "Иван");
        assert.equal(body.get("data[0][4]"), "Право и партнёры");
        assert.equal(body.get("data[0][5]"), "Петров");
        return jsonResponse({ result: { invalid: 0, log: [] } });
      }
      if (method === "createEmailMessage") {
        assert.equal(body.get("images_as"), null);
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
      assert.equal(body.get("contacts"), "ivan@example.test");
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

test("UniSender attaches a generated PowerPoint file to the email message", async () => {
  let attachmentEncoded = false;
  const result = await createUniSenderCampaign({
    apiKey: "api-key",
    listId: "88",
    senderName: "Поток",
    senderEmail: "sender@example.test",
    subject: "Презентация",
    textBody: "Файл во вложении",
    attachments: [{ filename: "Доклад Поток.pptx", bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) }],
    recipients: [{ email: "reader@example.test", name: "Получатель", outboxId: "outbox-pptx" }],
    fetchFn: async (url, init) => {
      const method = String(url).split("/").at(-1);
      if (method === "importContacts") return jsonResponse({ result: { invalid: 0, log: [] } });
      if (method === "createEmailMessage") {
        const body = String(init.body);
        attachmentEncoded = body.includes("attachments%5B") && body.includes("%50%4B%03%04") === false && body.includes("PK%03%04");
        return jsonResponse({ result: { message_id: 1234 } });
      }
      return jsonResponse({ result: { campaign_id: 5678 } });
    },
  });
  assert.equal(result.status, "accepted");
  assert.equal(attachmentEncoded, true);
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
        return jsonResponse({ result: { message_id: 1234 } });
      }
      assert.equal(method, "createCampaign");
      assert.equal(body.get("message_id"), "1234");
      assert.equal(body.get("contacts"), recipients.map((recipient) => recipient.email).join(","));
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

test("UniSender campaign contacts exclude addresses rejected during import", async () => {
  const recipients = [
    { email: "valid@example.test", name: "Валидный", outboxId: "outbox-valid" },
    { email: "invalid@example.test", name: "Ошибка", outboxId: "outbox-invalid" },
  ];
  const result = await createUniSenderCampaign({
    apiKey: "api-key",
    listId: "88",
    senderName: "MAILFLOW",
    senderEmail: "sender@example.test",
    subject: "Тема",
    textBody: "Текст",
    recipients,
    fetchFn: async (url, init) => {
      const method = String(url).split("/").at(-1);
      if (method === "importContacts") {
        return jsonResponse({ result: { invalid: 1, log: [{ index: 1, code: "e_email_invalid" }] } });
      }
      if (method === "createEmailMessage") {
        return jsonResponse({ result: { message_id: 1234 } });
      }
      assert.equal(method, "createCampaign");
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get("contacts"), "valid@example.test");
      assert.doesNotMatch(body.get("contacts"), /invalid@example\.test/);
      return jsonResponse({ result: { campaign_id: 5678 } });
    },
  });

  assert.equal(result.status, "accepted");
  assert.deepEqual(result.acceptedOutboxIds, ["outbox-valid"]);
  assert.deepEqual(result.rejectedOutboxIds, ["outbox-invalid"]);
});

test("UniSender exposes sanitized import error codes when an entire audience is rejected", async () => {
  const result = await createUniSenderCampaign({
    apiKey: "api-key",
    listId: "88",
    senderName: "MAILFLOW",
    senderEmail: "sender@example.test",
    subject: "Тема",
    textBody: "Текст",
    recipients: [
      { email: "one@example.test", name: "Один", outboxId: "outbox-1" },
      { email: "two@example.test", name: "Два", outboxId: "outbox-2" },
    ],
    fetchFn: async () => jsonResponse({
      result: {
        invalid: 2,
        log: [
          { index: 0, code: "e_address_is_role_based", message: "contains an email" },
          { index: 1, code: "e_address_is_role_based", message: "contains an email" },
        ],
      },
    }),
  });
  assert.equal(result.status, "rejected");
  assert.match(result.message, /e_address_is_role_based \(2\)/);
  assert.doesNotMatch(result.message, /example\.test/);
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

test("UniSender delivery reconciliation uses the provider's final statistics", async () => {
  const methods = [];
  const result = await getUniSenderCampaignStats({
    apiKey: "api-key",
    campaignId: "372377546",
    fetchFn: async (url) => {
      const method = String(url).split("/").at(-1);
      methods.push(method);
      if (method === "getCampaignStatus") {
        return jsonResponse({ result: { status: "analysed", status_comment: "" } });
      }
      assert.equal(method, "getCampaignCommonStats");
      return jsonResponse({ result: {
        total: 3,
        sent: 3,
        delivered: 2,
        read_unique: 1,
        clicked_unique: 1,
        unsubscribed: 0,
        spam: 0,
      } });
    },
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.providerStatus, "analysed");
  assert.equal(result.sent, 3);
  assert.equal(result.delivered, 2);
  assert.deepEqual(methods.sort(), ["getCampaignCommonStats", "getCampaignStatus"]);
});

test("UniSender service email disables marketing tracking and includes unsubscribe", async () => {
  const result = await sendUniSenderTransactionalEmail({
    apiKey: "api-key",
    listId: "88",
    senderName: "ТехнологИИ Права",
    senderEmail: "orders@example.test",
    recipientEmail: "buyer@example.test",
    recipientName: "Покупатель",
    subject: "Оплата получена",
    htmlBody: "<p>Ваш билет готов.</p>",
    fetchFn: async (url, init) => {
      assert.match(String(url), /\/sendEmail$/);
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get("track_read"), "0");
      assert.equal(body.get("track_links"), "0");
      assert.match(body.get("body"), /\{\{UnsubscribeUrl\}\}/);
      return jsonResponse({ result: { email_id: 37930068326 } });
    },
  });
  assert.equal(result.status, "accepted");
  assert.equal(result.externalId, "37930068326");
});

test("UniSender service delivery uses checkEmail final status", async () => {
  const result = await checkUniSenderEmail({
    apiKey: "api-key",
    emailId: "37930068326",
    fetchFn: async () => jsonResponse({ result: { statuses: [{ id: 37930068326, status: "ok_read" }] } }),
  });
  assert.equal(result.status, "accepted");
  assert.equal(result.delivered, true);
  assert.equal(result.opened, true);
});
