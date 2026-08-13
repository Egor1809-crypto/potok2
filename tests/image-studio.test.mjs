import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("image studio uses the real NavyAI image endpoint and durable media store", async () => {
  const [server, route, store] = await Promise.all([
    readFile(new URL("../lib/server/image-studio.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/image-studio/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/email-asset-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(server, /\/images\/generations/);
  assert.match(server, /NAVYAI_IMAGE_MODEL/);
  assert.match(server, /storeGeneratedEmailAsset/);
  assert.match(server, /storeGeneratedEmailAssetBytes/);
  assert.match(server, /referenceImageSupported: false/);
  assert.match(server, /image-to-image/);
  assert.match(route, /generateStudioImage/);
  assert.match(store, /bucket\(\)\.put/);
  assert.match(store, /getDb\(\)\.insert\(emailAssets\)/);
  assert.match(store, /Content-Disposition/);
});

test("image studio connects its gallery to download and the email builder", async () => {
  const [view, builder] = await Promise.all([
    readFile(new URL("../components/image-studio/ImageStudioView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/EmailBuilderView.tsx", import.meta.url), "utf8"),
  ]);
  for (const control of ["Арт-направление", "Формат", "Качество", "Создать и сохранить"]) {
    assert.match(view, new RegExp(control));
  }
  assert.match(view, /download=1/);
  assert.match(view, /\/email-builder\?new=1&asset=/);
  assert.match(builder, /createDocumentWithStudioAsset/);
  assert.match(builder, /window\.location\.origin/);
  assert.match(builder, /\/api\/assets\/\$\{encodeURIComponent\(assetId\)\}/);
});

test("image generation authenticates before provider spend and persists abuse controls", async () => {
  const [server, route, schema, database, view] = await Promise.all([
    readFile(new URL("../lib/server/image-studio.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/image-studio/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/image-studio/ImageStudioView.tsx", import.meta.url), "utf8"),
  ]);
  const generateStart = server.indexOf("export async function generateStudioImage");
  const generateBody = server.slice(generateStart);
  assert.ok(generateBody.indexOf("await ensureDatabase(request)") < generateBody.indexOf("const active = provider()"));
  assert.match(server, /GENERATION_LIMIT = 6/);
  assert.match(server, /INSERT INTO ai_request_limits/);
  assert.match(server, /INSERT OR IGNORE INTO ai_idempotency/);
  assert.match(server, /Idempotency-Key/);
  assert.match(server, /status = 'completed'/);
  assert.match(schema, /export const aiRequestLimits/);
  assert.match(schema, /export const aiIdempotency/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS ai_request_limits/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS ai_idempotency/);
  assert.match(view, /"Idempotency-Key": crypto\.randomUUID\(\)/);
  assert.match(route, /MAX_REQUEST_BYTES = 20_000/);
  assert.match(route, /request\.body\.getReader\(\)/);
  assert.match(route, /total > MAX_REQUEST_BYTES/);
  assert.match(route, /status.*413|413/);
});

test("provider timeout and oversized provider output fail explicitly", async () => {
  const server = await readFile(new URL("../lib/server/image-studio.ts", import.meta.url), "utf8");
  assert.match(server, /AbortSignal\.timeout\(120_000\)/);
  assert.match(server, /NavyAI не ответил за две минуты/);
  assert.match(server, /timedOut \? 504 : 502/);
  assert.match(server, /MAX_BASE64_LENGTH/);
});

test("image studio controls and gallery selection expose accessible state", async () => {
  const view = await readFile(new URL("../components/image-studio/ImageStudioView.tsx", import.meta.url), "utf8");
  assert.match(view, /htmlFor="image-studio-aspect"/);
  assert.match(view, /id="image-studio-aspect"/);
  assert.match(view, /htmlFor="image-studio-quality"/);
  assert.match(view, /id="image-studio-quality"/);
  assert.match(view, /aria-pressed=\{selectedAsset\?\.id === asset\.id\}/);
  assert.match(view, /aria-label=\{`Выбрать \$\{asset\.filename\}`\}/);
  assert.match(view, /<Card role="status"/);
});
