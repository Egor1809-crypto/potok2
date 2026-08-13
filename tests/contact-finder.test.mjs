import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contact finder is source-bound, robots-aware, and never auto-persists", async () => {
  const [server, route, view] = await Promise.all([
    readFile(new URL("../lib/server/contact-finder.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/contact-finder/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/contact-finder/ContactFinderView.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(server, /SAME_SITE_PAGE_LIMIT = 5/);
  assert.match(server, /robots\.txt/);
  assert.match(server, /robotsAllows/);
  assert.match(server, /url\.origin !== base\.origin/);
  assert.match(server, /protocol !== "https:"/);
  assert.match(server, /isUnsafeIpv6/);
  assert.match(server, /cloudflare-dns\.com\/dns-query/);
  assert.match(server, /ipv4\.some\(isPrivateIpv4\)/);
  assert.match(server, /next\.origin !== origin/);
  assert.match(server, /robots\.txt недоступен — проверка остановлена/);
  assert.match(server, /groupAgents/);
  assert.match(server, /REQUEST_LIMIT = 20/);
  assert.match(server, /persisted: false/);
  assert.match(server, /acknowledgedResponsibleUse !== true/);
  assert.match(route, /ensureDatabase/);
  assert.match(route, /MAX_REQUEST_BYTES = 420_000/);
  assert.match(route, /request\.body\.getReader\(\)/);
  assert.match(route, /total > MAX_REQUEST_BYTES/);
  assert.match(view, /Ничего не импортируется автоматически/);
  assert.match(view, /emailConsent: false/);
  assert.match(view, /Добавить выбранные в контакты/);
  assert.match(view, /role="tabpanel"/);
  assert.match(view, /aria-live="polite"/);
  assert.match(view, /clearResults\(\)/);
  assert.match(view, /function contactInputs/);
  assert.match(view, /до четырёх связанных/);
});

test("phone-only discoveries can be explicitly stored and deduplicated", async () => {
  const [store, schema, runtimeSchema] = await Promise.all([
    readFile(new URL("../lib/server/mailflow-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
  ]);
  assert.match(store, /!email && !phone && !telegramChatId && !vkUserId/);
  assert.match(store, /left\.phone && right\.phone/);
  assert.match(store, /input\.phone \? eq\(contacts\.phone/);
  assert.match(store, /inArray\(contacts\.phone, phoneChunk\)/);
  assert.ok((store.match(/\.onConflictDoNothing\(\)/g) ?? []).length >= 2);
  assert.match(store, /Email, телефон и идентификаторы мессенджеров/);
  assert.match(schema, /index\("idx_contacts_workspace_phone"\)/);
  assert.match(runtimeSchema, /CREATE INDEX IF NOT EXISTS idx_contacts_workspace_phone/);
  assert.doesNotMatch(runtimeSchema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_phone/);
});
