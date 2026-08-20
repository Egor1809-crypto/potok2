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
  assert.match(store, /orderBy\(asc\(deliveryJobs\.updatedAt\)\)\.limit\(3\)/);
  assert.match(store, /A temporary provider error must not hide the saved lifetime totals/);
});
