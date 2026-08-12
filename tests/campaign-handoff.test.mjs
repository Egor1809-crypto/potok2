import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  campaignHandoffStorageKey,
  createCampaignHandoffToken,
  normalizeCampaignHandoffToken,
  readCampaignHandoffSnapshot,
  writeCampaignHandoffSnapshot,
} from "../lib/campaign-handoff.ts";

test("two campaign wizard tokens use isolated storage snapshots", () => {
  const firstToken = createCampaignHandoffToken("tab-a");
  const secondToken = createCampaignHandoffToken("tab-b");
  const firstKey = campaignHandoffStorageKey(firstToken);
  const secondKey = campaignHandoffStorageKey(secondToken);
  const storage = new Map();

  storage.set(firstKey, JSON.stringify({ audienceType: "segment", segmentId: "segment-a" }));
  storage.set(secondKey, JSON.stringify({ audienceType: "contacts", contactIds: ["contact-b"] }));

  assert.notEqual(firstKey, secondKey);
  assert.deepEqual(JSON.parse(storage.get(firstKey)), { audienceType: "segment", segmentId: "segment-a" });
  assert.deepEqual(JSON.parse(storage.get(secondKey)), { audienceType: "contacts", contactIds: ["contact-b"] });
  assert.equal(normalizeCampaignHandoffToken("../shared"), undefined);
});

test("wizard to editor to wizard round-trip updates only its token snapshot", () => {
  const token = createCampaignHandoffToken("roundtrip");
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const wizardDraft = {
    audienceType: "segment",
    segmentId: "segment-legal",
    channels: ["email", "telegram"],
    subject: "Старая тема",
  };
  writeCampaignHandoffSnapshot(storage, token, JSON.stringify(wizardDraft));

  const editorSource = JSON.parse(readCampaignHandoffSnapshot(storage, token));
  writeCampaignHandoffSnapshot(storage, token, JSON.stringify({
    ...editorSource,
    subject: "Новая тема",
    emailBodyText: "Готовое письмо",
    builderDocument: { templateId: "template-1", blocks: [{ id: "body" }] },
  }));
  const returnedDraft = JSON.parse(readCampaignHandoffSnapshot(storage, token));

  assert.equal(returnedDraft.subject, "Новая тема");
  assert.equal(returnedDraft.emailBodyText, "Готовое письмо");
  assert.equal(returnedDraft.segmentId, "segment-legal");
  assert.deepEqual(returnedDraft.channels, ["email", "telegram"]);
});

test("a deleted recovered campaign is recreated instead of failing readiness", async () => {
  const wizard = await readFile(new URL("../components/campaigns/CampaignWizard.tsx", import.meta.url), "utf8");
  assert.match(wizard, /Предыдущий серверный черновик уже удалён/);
  assert.match(wizard, /updateResponse\.status === 404/);
  assert.match(wizard, /id = await createDraft\(\)/);
  assert.match(wizard, /Название рассылки/);
  assert.match(wizard, /Подготовить запуск через VK WorkSpace/);
});
