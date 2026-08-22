import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("search fields reserve space for their leading icons across the platform", async () => {
  const [styles, input, campaigns, contacts, segments, companies] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/input.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/campaigns/CampaignWizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/contacts/ContactsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/segments/SegmentsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/companies/CompaniesView.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(styles, /\.input\.input-with-leading-icon/);
  assert.match(styles, /padding-left: 42px !important/);
  for (const source of [input, campaigns, contacts, segments, companies]) {
    assert.match(source, /input-with-leading-icon/);
  }
});
