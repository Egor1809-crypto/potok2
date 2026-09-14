import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("presentation projects are durable and can originate from an email template", async () => {
  const [schema, database, store, route] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/server/database-init.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/presentation-store.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/presentations/route.ts", import.meta.url),
      "utf8",
    ),
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
    readFile(
      new URL(
        "../components/presentations/PresentationStudio.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/image-studio/ImageStudioView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  for (const control of [
    "Новая презентация",
    "Создать с ИИ",
    "Из письма",
    "Сохранить",
    "PPTX",
    "Дублировать",
    "Удалить",
    "Заметки выступающего",
  ]) {
    assert.match(view, new RegExp(control));
  }
  assert.match(view, /searchParams\.get\("new"\) === "1"/);
  assert.match(view, /router\.replace\(\s*`\/presentations\?id=/);
  assert.match(view, /safeAssetQueryId/);
  assert.match(view, /slidesWithAsset\(requestedAssetId\)/);
  assert.match(
    view,
    /imageUrl: `\/api\/assets\/\$\{encodeURIComponent\(assetId\)\}`/,
  );
  assert.match(
    imageStudio,
    /\/presentations\?new=1&asset=\$\{encodeURIComponent\(selectedAsset\.id\)\}/,
  );
  assert.match(imageStudio, /Использовать в презентации/);
  assert.doesNotMatch(view, /beforeunload|window\.confirm/);
  assert.match(view, /useEditorDraft/);
  assert.match(view, /editRevisionRef/);
  assert.match(view, /sourceLabels\[project\.sourceType\]/);
  assert.match(view, /ImageAssetPicker/);
  assert.match(view, /destinationLabel="презентации"/);
  assert.match(view, /Новая с ИИ/);
  assert.match(view, /\/presentations\?create=ai/);
  assert.match(view, /onDoubleClick/);
  assert.match(view, /Быстро изменить слайд/);
  assert.match(view, /Добавить изображение/);
  assert.match(view, /slide\.backgroundColor \?\?/);
  assert.match(view, /slide\.themeId \?\? baseProject\.themeId/);
  assert.match(view, /slidesPanelOpen/);
  assert.match(view, /Скрыть панель слайдов/);
  assert.match(view, /xl:grid-cols-\[148px_minmax\(0,1fr\)_272px\]/);
  assert.match(view, /xl:grid-cols-\[minmax\(0,1fr\)_272px\]/);
  assert.match(view, /aria-label="Дублировать слайд"/);
  assert.doesNotMatch(view, /Готово — следующий слайд/);
  assert.doesNotMatch(view, /confirmCurrentSlide/);
  assert.match(view, /Все слайды доступны/);
  assert.match(view, /changeSlideTheme/);
});

test("presentation library offers varied scenarios and practical filters", async () => {
  const [templates, view, catalog] = await Promise.all([
    readFile(
      new URL("../data/presentation-templates.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/presentations/PresentationStudio.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    import("../data/presentation-templates.ts"),
  ]);
  assert.equal(catalog.presentationTemplates.length, 61);
  assert.equal(catalog.presentationThemes.length, 27);
  assert.ok((templates.match(/presentation-template-/g) ?? []).length >= 12);
  assert.match(templates, /styleTemplateSpecs/);
  assert.match(templates, /slug: "product-glass"/);
  assert.match(templates, /slug: "cyber-neon"/);
  assert.match(templates, /slug: "brand-editorial"/);
  for (const layout of [
    "process",
    "comparison",
    "agenda",
    "gallery",
    "chart",
    "callout",
  ]) {
    assert.match(templates, new RegExp(`"${layout}"`));
  }
  assert.match(view, /filteredPresentationTemplates/);
  assert.match(view, /auto-rows-max content-start/);
  assert.match(view, /min-h-\[50px\] w-full shrink-0 overflow-x-auto/);
  assert.match(view, /libraryStyles.collections/);
  assert.match(view, /Поиск шаблонов презентаций/);
  assert.match(view, /Все задачи/);
  assert.match(view, /Действие после презентации/);
  assert.match(view, /Факты и исходные данные/);
  for (const blockLabel of [
    "Таймлайн",
    "Процесс",
    "Сравнение",
    "Повестка",
    "Галерея",
    "Диаграмма",
    "Таблица",
    "Акцент",
  ]) {
    assert.match(view, new RegExp(blockLabel));
  }
});

test("email template editor keeps metadata secondary to the canvas", async () => {
  const view = await readFile(
    new URL(
      "../components/email-builder/EmailBuilderView.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(view, /<Modal open=\{templateSettingsOpen\}/);
  assert.match(view, /О шаблоне/);
  assert.doesNotMatch(view, /Сохраните результат как рабочий шаблон/);
});

test("image studio can apply a generated asset as a real email background", async () => {
  const [studio, builder, compiler] = await Promise.all([
    readFile(
      new URL(
        "../components/image-studio/ImageStudioView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/email-builder/EmailBuilderView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/email-document.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(studio, /Фон для письма/);
  assert.match(studio, /assetMode=background/);
  assert.match(builder, /backgroundImageUrl: assetUrl/);
  assert.match(compiler, /background-image:url/);
  assert.match(compiler, /background=/);
});

test("AI presentation outline follows a narrative and does not invent evidence", async () => {
  const [server, route, schema, database, view] = await Promise.all([
    readFile(
      new URL("../lib/server/presentation-ai.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/ai/presentations/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/server/database-init.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/presentations/PresentationStudio.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(server, /chat\/completions/);
  assert.match(server, /gpt-5\.6-terra/);
  assert.match(
    server,
    /Не выдумывай достижения, клиентов, цитаты, источники, стоимость или гарантии/,
  );
  assert.match(server, /suggestedLayouts/);
  assert.match(
    server,
    /обязательны layout, eyebrow, title, body, bullets, themeId, patternId, imagePrompt, speakerNotes/,
  );
  assert.match(server, /generatePresentationImages/);
  assert.match(server, /images\/generations/);
  assert.match(server, /PRESENTATION_IMAGE_LIMIT = 2/);
  assert.match(server, /patternLibrary/);
  assert.match(
    server,
    /presentationVisualIssues\(slides\)/,
  );
  assert.match(server, /safeFallbackOutline/);
  assert.match(server, /function resolvedThemeId/);
  assert.match(server, /return "premium"/);
  assert.match(server, /return "modern"/);
  assert.match(server, /senior presentation designer/);
  assert.match(server, /Криптовалюты: возможности, риски и осознанные решения/);
  assert.match(
    server,
    /Цифровой рубль: как устроена третья форма российской валюты/,
  );
  assert.match(server, /generationMode: "topic_fallback"/);
  assert.match(server, /NAVYAI_EMAIL_MODEL\?\.trim\(\)\s*\|\|\s*"gpt-5\.6-sol"/);
  assert.match(server, /GENERATION_LIMIT = 8/);
  assert.match(server, /INSERT INTO ai_request_limits/);
  assert.match(server, /INSERT OR IGNORE INTO ai_idempotency/);
  assert.match(server, /result_json/);
  assert.match(server, /AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/);
  assert.match(server, /MAX_PROVIDER_RESPONSE_BYTES/);
  assert.match(server, /timedOut \? 504 : 502/);
  assert.match(server, /ИИ временно перегружен/);
  assert.match(schema, /resultJson: text\("result_json"\)/);
  assert.match(
    database,
    /ALTER TABLE ai_idempotency ADD COLUMN result_json TEXT/,
  );
  assert.match(view, /"Idempotency-Key": aiIdempotencyKeyRef\.current/);
  assert.match(route, /generatePresentationOutline/);
  assert.match(route, /MAX_REQUEST_BYTES = 12_000/);
  assert.match(route, /request\.body\.getReader\(\)/);
  assert.match(route, /reader\.cancel\(\)/);
  assert.match(route, /413/);
});

test("presentation AI supports library-guided and fully original composition", async () => {
  const [view, server] = await Promise.all([
    readFile(
      new URL(
        "../components/presentations/PresentationStudio.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/server/presentation-ai.ts", import.meta.url), "utf8"),
  ]);
  assert.match(view, /aiCreativeSource/);
  assert.match(view, /aiTemplateId/);
  assert.match(view, /AiCreationModePicker/);
  assert.match(view, /Управляемая адаптация/);
  assert.match(server, /selectedPresentationTemplate/);
  assert.match(server, /applyPresentationTemplateBlueprint/);
  assert.match(server, /templateBlueprint/);
  assert.match(server, /Режим композиции — полностью оригинальная арт-дирекция/);
});

test("PowerPoint export builds OOXML and only fetches same-origin library assets", async () => {
  const [exporter, route, store, patternCatalog] = await Promise.all([
    readFile(
      new URL("../lib/server/presentation-pptx.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/presentations/export/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/presentation-store.ts", import.meta.url),
      "utf8",
    ),
    import("../data/presentation-patterns.ts"),
  ]);
  assert.equal(patternCatalog.presentationPatternCatalog.length, 64);
  assert.match(exporter, /0x04034b50/);
  assert.match(exporter, /presentationml\.presentation\.main\+xml/);
  assert.match(exporter, /slideMasters\/slideMaster1\.xml/);
  assert.match(
    exporter,
    /if \(!slide\.imageUrl\) return undefined/,
  );
  assert.match(
    exporter,
    /new URL\(expectedPath, requestUrl\.origin\)/,
  );
  assert.match(exporter, /redirect: "error"/);
  assert.match(exporter, /url\.origin !== requestUrl\.origin/);
  assert.match(exporter, /isPresentationTemplate/);
  assert.match(exporter, /presentationPatternShapes/);
  assert.match(
    exporter,
    /slide\.backgroundColor \?\?/,
  );
  assert.match(exporter, /themeId: slide\.themeId \?\? project\.themeId/);
  assert.doesNotMatch(exporter, /new URL\(slide\.imageUrl/);
  assert.match(
    await readFile(
      new URL(
        "../components/presentations/PresentationStudio.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    /presentationPatternStyle/,
  );
  const studio = await readFile(
    new URL(
      "../components/presentations/PresentationStudio.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(studio, /presentationPatterns/);
  assert.match(studio, /aurora-mesh/);
  assert.match(studio, /topography/);
  assert.match(studio, /paper-grain/);
  assert.match(studio, /terrazzo/);
  assert.match(studio, /64 адаптивных мотива/);
  assert.match(studio, /Инструменты слайда/);
  assert.match(studio, /Добавить на слайд/);
  assert.doesNotMatch(studio, /sticky bottom-0/);
  assert.doesNotMatch(studio, /Презентация готова для письма/);
  assert.match(
    store,
    /Для слайда можно выбрать только изображение из общей медиатеки Поток/,
  );
  assert.match(
    route,
    /application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation/,
  );
  assert.match(exporter, /presentationPatternShapes\(project, id, slide\.patternId\)/);
});

test("presentation library persists project and template favorites", async () => {
  const [schema, database, store, route, studio] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/presentation-store.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/presentations/favorites/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/presentations/PresentationStudio.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(schema, /export const presentationFavorites/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS presentation_favorites/);
  assert.match(store, /setPresentationFavorite/);
  assert.match(route, /setPresentationFavorite/);
  assert.match(studio, /Избранные презентации/);
  assert.match(studio, /Избранное/);
  assert.match(studio, /\/api\/presentations\/favorites/);
});
