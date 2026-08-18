import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contacts page uses server pagination and database-side filtering", async () => {
  const [view, store, route] = await Promise.all([
    readFile(new URL("../components/contacts/ContactsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/mailflow-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/contacts/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(view, /pageSize: "100"/);
  assert.match(view, /setTotalPages\(payload\.totalPages\)/);
  assert.match(view, /Страница \{page\} из \{totalPages\}/);
  assert.match(store, /CONTACTS_PAGE_SIZE = 100/);
  assert.match(store, /\.limit\(pageSize\)/);
  assert.match(store, /\.offset\(\(page - 1\) \* pageSize\)/);
  assert.match(route, /scope === "endpoints"/);
});

test("large contact payloads are loaded only by workflows that require them", async () => {
  const [store, wizard, importer] = await Promise.all([
    readFile(new URL("../lib/server/mailflow-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/campaigns/CampaignWizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/imports/import-api.ts", import.meta.url), "utf8"),
  ]);

  assert.match(store, /include === "contacts" \|\| include === "export"/);
  assert.match(store, /Promise\.resolve\(\[\] as ContactRow\[\]\)/);
  assert.match(wizard, /\/api\/workspace\?include=contacts/);
  assert.match(importer, /\/api\/contacts\?scope=endpoints/);
});

test("contact filters and ordering have database indexes", async () => {
  const [schema, runtimeSchema, migration] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0012_handy_may_parker.sql", import.meta.url), "utf8"),
  ]);

  for (const indexName of [
    "idx_contacts_workspace_status_updated",
    "idx_contacts_workspace_updated",
    "idx_contacts_workspace_city",
    "idx_contacts_workspace_company_name",
  ]) {
    assert.match(schema, new RegExp(indexName));
    assert.match(runtimeSchema, new RegExp(indexName));
    assert.match(migration, new RegExp(indexName));
  }
});

test("campaign dispatch loads only selected contacts and reconciles UniSender delivery", async () => {
  const [store, detail] = await Promise.all([
    readFile(new URL("../lib/server/mailflow-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/campaigns/CampaignDetailRoute.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(store, /chunksOf\(Array\.from\(new Set\(rows\.map\(\(row\) => row\.contactId\)\)\)\)/);
  assert.match(store, /getUniSenderCampaignStats/);
  assert.match(store, /action !== "sync_delivery"/);
  assert.match(detail, /action: "sync_delivery"/);
});
