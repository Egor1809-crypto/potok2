import assert from "node:assert/strict";
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
