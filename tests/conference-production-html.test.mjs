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
  assert.doesNotMatch(generated, /PRACTICE MODE: ON/);
  assert.doesNotMatch(generated, /Private executive note · №07/);
  assert.match(generated, /Конференция руководителей в большом зале/);
  assert.match(generated, /background:#dffbfc;color:#10213b/);
  assert.equal((generated.match(/ООО «АСПБ»/g) ?? []).length, 21);
  assert.match(generated, /На втором дне конференции «ТехнологИИ Права»/);
  assert.match(generated, /Маняша — AI-ассистент конференции/);
  assert.match(generated, /—ДЛЯ руководителей юридического бизнеса и практикующих юристов/);
  assert.match(generated, /АВТОМАТИЗАЦИЯ БФЛ, ИИ в юрбизнесе, LegalTech, данные и безопасность\./);
  assert.match(generated, /© 2026 ООО «ТехнологИИ Права»/);
  assert.match(generated, /Здравствуйте, \{\{first_name\}\}! Конференция «ТехнологИИ Права» собирает лучших экспертов ИИ-индустрии/);
  assert.match(generated, /объединяет их с представителями юридического сообщества: юристами-практиками/);
  assert.match(database, /conference-production-html-v1/);
  assert.match(database, /conference-production-html-v2-practice-lab/);
  assert.match(database, /conference-production-html-v3-executive-memo/);
  assert.match(database, /conference-production-html-v4-personal-invitation/);
  assert.match(database, /conference-production-html-v5-professional-circle/);
  assert.match(database, /runtime-schema-v13-professional-circle-correction/);
  assert.match(database, /https:\/\/t\.me\/TechPravoAI/);
  assert.match(compiler, /if \(document\.rawHtml\) return document\.rawHtml/);
  assert.match(preview, /srcDoc=\{template\.emailBodyHtml\}/);
});
