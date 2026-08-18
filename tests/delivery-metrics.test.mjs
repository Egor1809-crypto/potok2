import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { uniqueAcceptedContactIds } from "../lib/server/delivery-metrics.ts";

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

test("fresh UniSender aggregate counters are treated as settling, not failed", async () => {
  const [store, detail] = await Promise.all([
    readFile(new URL("../lib/server/mailflow-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/campaigns/CampaignDetailRoute.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(store, /deliveryCountersSettling/);
  assert.match(store, /reportAgeMs < 2 \* 60_000/);
  assert.match(store, /Поток проверит статус автоматически/);
  assert.match(detail, /body\.deliveryJob\?\.status === "processing"/);
  assert.match(detail, /15_000/);
});
