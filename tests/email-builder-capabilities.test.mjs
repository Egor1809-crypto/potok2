import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("expanded starter library contains varied production templates", async () => {
  const source = await readFile(new URL("../data/templates.ts", import.meta.url), "utf8");
  assert.ok((source.match(/\bid:\s*"template-/g) ?? []).length >= 16);
  for (const type of ["hero", "quote", "checklist", "stats", "product", "signature"]) assert.match(source, new RegExp(`type: "${type}"`));
});

test("new editor blocks have server-side email compilation", async () => {
  const source = await readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8");
  for (const type of ["hero", "quote", "checklist", "stats", "product"]) assert.match(source, new RegExp(`block\\.type === "${type}"`));
  assert.match(source, /<table role="presentation"/);
  assert.match(source, /escapeHtml\(block\.href/);
});

test("uploaded logos are compiled as real images", async () => {
  const source = await readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8");
  assert.match(source, /block\.type === "logo" && block\.href/);
  assert.match(source, /max-width:220px/);
});

test("advanced editor controls and new content blocks compile into email-safe HTML", async () => {
  const [compiler, properties, library] = await Promise.all([
    readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/PropertiesPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/BlockLibrary.tsx", import.meta.url), "utf8"),
  ]);
  for (const type of ["banner", "timeline", "faq", "coupon", "video"]) {
    assert.match(compiler, new RegExp(`block\\.type === "${type}"`));
    assert.match(library, new RegExp(`type: "${type}"`));
  }
  for (const control of ["fontFamily", "fontWeight", "lineHeight", "letterSpacing", "widthPercent", "buttonStyle"]) {
    assert.match(properties, new RegExp(control));
  }
});

test("AI design remains a separate version until the user chooses it", async () => {
  const [assistant, builder, server] = await Promise.all([
    readFile(new URL("../components/email-builder/AiEmailAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/EmailBuilderView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/email-ai.ts", import.meta.url), "utf8"),
  ]);
  assert.match(builder, /Собрать вручную/);
  assert.match(builder, /Создать с ИИ/);
  assert.match(assistant, /Сравнение редакций/);
  assert.match(assistant, /Продолжить с моим/);
  assert.match(assistant, /Заменить на вариант ИИ/);
  assert.match(assistant, /Опишите задачу, настроение, стиль и желаемые цвета/);
  assert.match(assistant, /ИИ создаст одну предметную иллюстрацию/);
  assert.match(server, /api\.openverse\.org/);
  assert.match(server, /license_type/);
  assert.match(server, /aspect_ratio/);
  assert.match(server, /images\/generations/);
  assert.match(server, /storeGeneratedEmailAsset/);
});

test("AI brief asks follow-up questions and accepts dragged user images", async () => {
  const [assistant, server] = await Promise.all([
    readFile(new URL("../components/email-builder/AiEmailAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/email-ai.ts", import.meta.url), "utf8"),
  ]);
  assert.match(assistant, /Продолжить — уточнить детали/);
  assert.match(assistant, /Ответьте на вопросы по смыслу и предложению/);
  assert.match(assistant, /Цвета повторно не спрашиваем/);
  assert.match(assistant, /Перетащите изображение сюда/);
  assert.match(assistant, /imageSource: \/без/);
  assert.match(assistant, /: "generate"/);
  assert.match(assistant, /prepareImageFile/);
  assert.match(assistant, /if \(!value\.trim\(\)\) return ""/);
  assert.match(assistant, /createImageBitmap/);
  assert.match(server, /выразительных приёма/);
  assert.match(server, /availableAssets/);
  assert.match(server, /Не спрашивай цвета/);
  assert.match(server, /Каждый непустой ответ briefAnswers обязан быть заметно отражён/);
  assert.match(server, /visibleBlockContent/);
  assert.match(server, /creativeBlockStyle/);
  assert.match(server, /artDirection/);
  assert.match(server, /contentStrategy/);
  assert.match(assistant, /Сравнение редакций/);
  assert.match(assistant, /какой контекст использовал/);
  assert.doesNotMatch(assistant, /Основной цвет/);
  assert.doesNotMatch(assistant, /Фоновый цвет/);
});

test("manual controls and export are wired to live updates without popup PDF", async () => {
  const [properties, exports] = await Promise.all([
    readFile(new URL("../components/email-builder/PropertiesPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/EmailExportMenu.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(properties, /onInput=.*onChange/);
  assert.match(exports, /Количество копий/);
  assert.match(exports, /contentDocument/);
  assert.match(exports, /html2canvas/);
  assert.match(exports, /application\/pdf/);
  assert.doesNotMatch(exports, /window\.open/);
});

test("starter edits become personal templates and uploads work in every manual editor", async () => {
  const [builder, library, picker, store] = await Promise.all([
    readFile(new URL("../components/email-builder/EmailBuilderView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/templates/TemplatesView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/ImageAssetPicker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/template-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(builder, /Сохранить в мои шаблоны/);
  assert.match(builder, /Сохраните результат как рабочий шаблон/);
  assert.match(builder, /Текущий дизайн, текст, логотипы и фотографии появятся/);
  assert.match(builder, /editingStarter \? null/);
  assert.match(library, /Мои шаблоны/);
  assert.match(library, /!template\.isStarter/);
  assert.match(picker, /onDrop=/);
  assert.match(picker, /onPaste=/);
  assert.match(picker, /Перетащите/);
  assert.match(store, /isStarterEmailTemplateId/);
});

test("visible typography properties drive the live canvas", async () => {
  const canvas = await readFile(new URL("../components/email-builder/EmailCanvas.tsx", import.meta.url), "utf8");
  assert.ok((canvas.match(/lineHeight: block\.lineHeight \/ 100/g) ?? []).length >= 8);
  assert.ok((canvas.match(/letterSpacing: block\.letterSpacing/g) ?? []).length >= 8);
  assert.ok((canvas.match(/fontWeight: block\.fontWeight/g) ?? []).length >= 4);
});

test("new templates expose a clear name field and resolve occupied names", async () => {
  const builder = await readFile(new URL("../components/email-builder/EmailBuilderView.tsx", import.meta.url), "utf8");
  assert.match(builder, /label="Имя шаблона"/);
  assert.match(builder, /Так он появится в разделе «Мои шаблоны»/);
  assert.match(builder, /occupied\.has\(saveName\.toLocaleLowerCase/);
  assert.match(builder, /Название было занято/);
});

test("pattern gallery offers varied email-safe designs", async () => {
  const [presets, properties, canvas, compiler] = await Promise.all([
    readFile(new URL("../components/email-builder/pattern-presets.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/PropertiesPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/EmailCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8"),
  ]);
  assert.ok((presets.match(/id: "/g) ?? []).length >= 12);
  for (const name of ["Искры", "Точки", "Сетка", "Ромбы", "Волны", "Конфетти"]) assert.match(presets, new RegExp(name));
  assert.match(properties, /title="Рисунок узора"/);
  assert.match(properties, /label="Масштаб"/);
  assert.match(properties, /label="Расстояние"/);
  assert.match(canvas, /whitespace-pre-line/);
  assert.match(compiler, /letter-spacing:\$\{tracking\}px/);
});
