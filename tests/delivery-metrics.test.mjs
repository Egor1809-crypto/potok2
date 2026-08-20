import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isUniSenderAggregateFinal,
  uniqueAcceptedContactIds,
} from "../lib/server/delivery-metrics.ts";

test("multichannel accepted attempts count one unique campaign recipient", () => {
  const acceptedContactIds = uniqueAcceptedContactIds([
    { contactId: "contact-1", status: "accepted", channel: "email" },
    { contactId: "contact-1", status: "accepted", channel: "telegram" },
    { contactId: "contact-1", status: "accepted", channel: "vk" },
    { contactId: "contact-2", status: "rejected", channel: "email" },
  ]);

  assert.deepEqual(acceptedContactIds, ["contact-1"]);
  assert.ok(acceptedContactIds.length <= 2);
});

test("zero UniSender deliveries stay processing after the five minute notice window", async () => {
  const [store, detail] = await Promise.all([
    readFile(new URL("../lib/server/mailflow-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/campaigns/CampaignDetailRoute.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(store, /deliveryCountersSettling/);
  assert.match(store, /reportAgeMs < 5 \* 60_000/);
  assert.match(store, /Поток проверит статус автоматически/);
  assert.match(store, /Письма не считаются отклонёнными/);
  assert.match(detail, /body\.deliveryJob\?\.status === "processing"/);
  assert.match(detail, /15_000/);
});

test("UniSender aggregate zero is not final without per-recipient evidence", () => {
  assert.equal(isUniSenderAggregateFinal({
    providerStatus: "analysed",
    sent: 68,
    delivered: 0,
    reportAgeMs: 30 * 60_000,
  }), false);
  assert.equal(isUniSenderAggregateFinal({
    providerStatus: "analysed",
    sent: 68,
    delivered: 67,
    reportAgeMs: 5 * 60_000,
  }), true);
  assert.equal(isUniSenderAggregateFinal({
    providerStatus: "analysed",
    sent: 68,
    delivered: 1,
    reportAgeMs: 2 * 60_000,
  }), false);
});

test("mass UniSender outbox updates are chunked for D1", async () => {
  const store = await readFile(
    new URL("../lib/server/mailflow-store.ts", import.meta.url),
    "utf8",
  );
  assert.match(store, /chunksOf\(rows, 40\)/);
  assert.match(store, /chunksOf\(selectedRows, 40\)/);
  assert.match(store, /chunksOf\(acceptedContactIds, 40\)/);
});
