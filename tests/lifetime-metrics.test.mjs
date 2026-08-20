import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../lib/server/lifetime-metrics.ts", import.meta.url), "utf8");

test("lifetime UniSender totals include the four requested provider counters", () => {
  for (const counter of ["sent", "delivered", "opened", "clicked"]) {
    assert.match(source, new RegExp(`${counter}: total\\.${counter} \\+ Math\\.max\\(0, campaign\\.metrics\\.${counter}\\)`));
  }
  assert.match(source, /deliveryChannels\.includes\("email"\)/);
});

test("dashboard refresh is bounded and provider failures preserve saved totals", async () => {
  const store = await readFile(new URL("../lib/server/mailflow-store.ts", import.meta.url), "utf8");
  assert.match(store, /const batchSize = fullRefresh \? 12 : 6/);
  assert.match(store, /status} <> 'processing'/);
  assert.match(store, /Promise\.allSettled/);
  assert.match(store, /A temporary provider error must not hide the saved lifetime totals/);
});

test("provider refresh keeps total and unique clicks separate", async () => {
  const [provider, store] = await Promise.all([
    readFile(new URL("../lib/server/provider-adapters.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/mailflow-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(provider, /clickedAll: Number\(stats\.clicked_all \?\? stats\.clicked_unique \?\? 0\)/);
  assert.match(store, /clicked: report\.clickedAll/);
  assert.match(store, /clickedUnique: report\.clickedUnique/);
});

test("provider metrics are grouped by campaign author instead of contact owner", () => {
  assert.match(source, /sumUniSenderMetricsByParticipant/);
  assert.match(source, /campaign\.participantId/);
  assert.match(source, /campaignsByParticipant/);
});
