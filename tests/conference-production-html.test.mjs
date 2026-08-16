import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ten conference HTML letters are seeded as editable user templates", async () => {
  const [generated, database, compiler, preview] = await Promise.all([
    readFile(new URL("../data/conference-production-templates.generated.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/templates/TemplatePreview.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal((generated.match(/"name": "ТП Конференция /g) ?? []).length, 10);
  assert.equal((generated.match(/"rawHtml":/g) ?? []).length, 10);
  assert.doesNotMatch(generated, /\{\{Имя\}\}/);
  assert.match(generated, /\{\{first_name\}\}/);
  assert.match(generated, /https:\/\/tech-pravo\.ru\/conference/);
  assert.match(generated, /https:\/\/t\.me\/NeuroPravo_Bot/);
  assert.match(database, /conference-production-html-v1/);
  assert.match(database, /runtime-schema-v3-team-contacts/);
  assert.match(compiler, /if \(document\.rawHtml\) return document\.rawHtml/);
  assert.match(preview, /srcDoc=\{template\.emailBodyHtml\}/);
});
