import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("presentation projects are durable and can originate from an email template", async () => {
  const [schema, database, store, route] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/presentation-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/presentations/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /export const presentationProjects/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS presentation_projects/);
  assert.match(store, /slidesFromEmailTemplate/);
  assert.match(store, /sourceEmailTemplateId/);
  assert.match(store, /expectedUpdatedAt/);
  assert.match(route, /createPresentationProject/);
  assert.match(route, /updatePresentationProject/);
  assert.match(route, /deletePresentationProject/);
});

test("presentation studio exposes real creation, editing and save flows", async () => {
  const [view, imageStudio] = await Promise.all([
    readFile(new URL("../components/presentations/PresentationStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/image-studio/ImageStudioView.tsx", import.meta.url), "utf8"),
  ]);
  for (const control of ["Новая презентация", "Создать с ИИ", "Из письма", "Сохранить", "PPTX", "Дублировать", "Удалить", "Заметки выступающего"]) {
    assert.match(view, new RegExp(control));
  }
  assert.match(view, /searchParams\.get\("new"\) === "1"/);
  assert.match(view, /router\.replace\(`\/presentations\?id=/);
  assert.match(view, /safeAssetQueryId/);
  assert.match(view, /slidesWithAsset\(requestedAssetId\)/);
  assert.match(view, /imageUrl: `\/api\/assets\/\$\{encodeURIComponent\(assetId\)\}`/);
  assert.match(imageStudio, /\/presentations\?new=1&asset=\$\{encodeURIComponent\(selectedAsset\.id\)\}/);
  assert.match(imageStudio, /Использовать в презентации/);
  assert.match(view, /beforeunload/);
  assert.match(view, /editRevisionRef/);
  assert.match(view, /sourceLabels\[project\.sourceType\]/);
  assert.match(view, /ImageAssetPicker/);
  assert.match(view, /destinationLabel="презентации"/);
  assert.match(view, /Новая с ИИ/);
  assert.match(view, /\/presentations\?create=ai/);
});

test("presentation library offers varied scenarios and practical filters", async () => {
  const [templates, view] = await Promise.all([
    readFile(new URL("../data/presentation-templates.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/presentations/PresentationStudio.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok((templates.match(/presentation-template-/g) ?? []).length >= 12);
  assert.match(view, /filteredPresentationTemplates/);
  assert.match(view, /Найти шаблон/);
  assert.match(view, /Все задачи/);
  assert.match(view, /Действие после презентации/);
  assert.match(view, /Факты и исходные данные/);
});

test("image studio can apply a generated asset as a real email background", async () => {
  const [studio, builder, compiler] = await Promise.all([
    readFile(new URL("../components/image-studio/ImageStudioView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/EmailBuilderView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /Фон для письма/);
  assert.match(studio, /assetMode=background/);
  assert.match(builder, /backgroundImageUrl: assetUrl/);
  assert.match(compiler, /background-image:url/);
  assert.match(compiler, /background=/);
});

test("AI presentation outline follows a narrative and does not invent evidence", async () => {
  const [server, route, schema, database, view] = await Promise.all([
    readFile(new URL("../lib/server/presentation-ai.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/presentations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/presentations/PresentationStudio.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(server, /chat\/completions/);
  assert.match(server, /gemini-2\.5-flash-lite/);
  assert.match(server, /Не выдумывай конкретные цифры, даты, отзывы, клиентов или результаты/);
  assert.match(server, /suggestedLayouts/);
  assert.match(server, /обязательны layout, eyebrow, title, body, bullets, speakerNotes/);
  assert.match(server, /slides\[index\]\.layout !== slides\[index - 1\]\.layout/);
  assert.match(server, /safeFallbackOutline/);
  assert.match(server, /Криптовалюты: возможности, риски и осознанные решения/);
  assert.match(server, /Цифровой рубль: как устроена третья форма российской валюты/);
  assert.match(server, /generationMode: "topic_fallback"/);
  assert.match(server, /NAVYAI_EMAIL_MODEL\?\.trim\(\) \|\| "gpt-5\.2"/);
  assert.match(server, /GENERATION_LIMIT = 8/);
  assert.match(server, /INSERT INTO ai_request_limits/);
  assert.match(server, /INSERT OR IGNORE INTO ai_idempotency/);
  assert.match(server, /result_json/);
  assert.match(server, /AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/);
  assert.match(server, /MAX_PROVIDER_RESPONSE_BYTES/);
  assert.match(server, /timedOut \? 504 : 502/);
  assert.match(server, /ИИ временно перегружен/);
  assert.match(schema, /resultJson: text\("result_json"\)/);
  assert.match(database, /ALTER TABLE ai_idempotency ADD COLUMN result_json TEXT/);
  assert.match(view, /"Idempotency-Key": aiIdempotencyKeyRef\.current/);
  assert.match(route, /generatePresentationOutline/);
  assert.match(route, /MAX_REQUEST_BYTES = 12_000/);
  assert.match(route, /request\.body\.getReader\(\)/);
  assert.match(route, /reader\.cancel\(\)/);
  assert.match(route, /413/);
});

test("PowerPoint export builds OOXML and only fetches same-origin library assets", async () => {
  const [exporter, route, store] = await Promise.all([
    readFile(new URL("../lib/server/presentation-pptx.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/presentations/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/presentation-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(exporter, /0x04034b50/);
  assert.match(exporter, /presentationml\.presentation\.main\+xml/);
  assert.match(exporter, /slideMasters\/slideMaster1\.xml/);
  assert.match(exporter, /if \(!slide\.assetId \|\| !slide\.imageUrl\) return undefined/);
  assert.match(exporter, /new URL\(`\/api\/assets\/\$\{encodeURIComponent\(slide\.assetId\)\}`/);
  assert.match(exporter, /redirect: "error"/);
  assert.match(exporter, /presentationPatternShapes/);
  assert.doesNotMatch(exporter, /new URL\(slide\.imageUrl/);
  assert.match(await readFile(new URL("../components/presentations/PresentationStudio.tsx", import.meta.url), "utf8"), /presentationPatternStyle/);
  assert.match(store, /Для слайда можно выбрать только изображение из общей медиатеки Поток/);
  assert.match(route, /application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation/);
});
