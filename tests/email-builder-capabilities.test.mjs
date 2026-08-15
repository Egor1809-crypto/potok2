import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("expanded starter library contains varied production templates", async () => {
  const source = await readFile(
    new URL("../data/templates.ts", import.meta.url),
    "utf8",
  );
  assert.ok((source.match(/\bid:\s*"template-/g) ?? []).length >= 16);
  for (const type of [
    "hero",
    "quote",
    "checklist",
    "stats",
    "product",
    "signature",
  ])
    assert.match(source, new RegExp(`type: "${type}"`));
});

test("new editor blocks have server-side email compilation", async () => {
  const source = await readFile(
    new URL("../lib/server/email-document.ts", import.meta.url),
    "utf8",
  );
  for (const type of ["hero", "quote", "checklist", "stats", "product"])
    assert.match(source, new RegExp(`block\\.type === "${type}"`));
  assert.match(source, /<table role="presentation"/);
  assert.match(source, /escapeHtml\(block\.href/);
  assert.match(source, /class="email-shell"/);
  assert.match(source, /class="email-cta"/);
  assert.match(source, /@media only screen and \(max-width:680px\)/);
});

test("uploaded logos are compiled as real images", async () => {
  const source = await readFile(
    new URL("../lib/server/email-document.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /block\.type === "logo" && block\.href/);
  assert.match(source, /max-width:220px/);
});

test("advanced editor controls and new content blocks compile into email-safe HTML", async () => {
  const [compiler, properties, library] = await Promise.all([
    readFile(
      new URL("../lib/server/email-document.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/email-builder/PropertiesPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/BlockLibrary.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  for (const type of ["banner", "timeline", "faq", "coupon", "video"]) {
    assert.match(compiler, new RegExp(`block\\.type === "${type}"`));
    assert.match(library, new RegExp(`type: "${type}"`));
  }
  for (const control of [
    "fontFamily",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "widthPercent",
    "buttonStyle",
  ]) {
    assert.match(properties, new RegExp(control));
  }
});

test("legal collection adds original scenarios and editable legal blocks", async () => {
  const [templates, compiler, library, properties, seed] = await Promise.all([
    readFile(new URL("../data/templates.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/server/email-document.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/BlockLibrary.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/email-builder/PropertiesPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/database-init.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.ok((templates.match(/id: "template-v4-legal-/g) ?? []).length >= 8);
  for (const type of ["notice", "comparison", "document", "compliance"]) {
    assert.match(compiler, new RegExp(`block\\.type === "${type}"`));
    assert.match(library, new RegExp(`type: "${type}"`));
    assert.match(properties, new RegExp(`${type}: \\[`));
  }
  for (const scenario of [
    "Обновление условий",
    "Политика конфиденциальности",
    "Документ на подпись",
    "Статус дела",
    "Правила использования ИИ",
    "Подтверждение согласия",
  ]) {
    assert.match(templates, new RegExp(scenario));
  }
  assert.match(seed, /email-template-library-v4-legal/);
});

test("every starter template has a real branded header in its saved document", async () => {
  const [starter, database, preview] = await Promise.all([
    readFile(
      new URL("../lib/server/starter-template-library.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/database-init.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/templates/TemplatePreview.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(starter, /ensureStarterHeader/);
  assert.match(starter, /TECH‑PRAVO/);
  assert.match(starter, /blocks\[0\]\?\.type === "logo"/);
  assert.match(database, /email-template-library-headers-v1/);
  assert.match(preview, /blocks\.slice\(0, 9\)/);
});

test("AI design remains a separate version until the user chooses it", async () => {
  const [assistant, builder, server] = await Promise.all([
    readFile(
      new URL(
        "../components/email-builder/AiEmailAssistant.tsx",
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
    readFile(new URL("../lib/server/email-ai.ts", import.meta.url), "utf8"),
  ]);
  assert.match(builder, /Собрать вручную/);
  assert.match(builder, /Создать с ИИ/);
  assert.match(assistant, /Сравнение редакций/);
  assert.match(assistant, /Продолжить с моим/);
  assert.match(assistant, /Заменить на вариант ИИ/);
  assert.match(assistant, /аккуратный современный SaaS-email/);
  assert.match(assistant, /ИИ создаст одну предметную иллюстрацию/);
  assert.match(server, /api\.openverse\.org/);
  assert.match(server, /license_type/);
  assert.match(server, /aspect_ratio/);
  assert.match(server, /images\/generations/);
  assert.match(server, /storeGeneratedEmailAsset/);
});

test("AI brief asks follow-up questions and accepts dragged user images", async () => {
  const [assistant, server] = await Promise.all([
    readFile(
      new URL(
        "../components/email-builder/AiEmailAssistant.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/server/email-ai.ts", import.meta.url), "utf8"),
  ]);
  assert.match(assistant, /Продолжить — уточнить детали/);
  assert.match(assistant, /Ответьте на вопросы по смыслу и предложению/);
  assert.match(assistant, /Визуальную систему ИИ подберёт автоматически/);
  assert.match(assistant, /Перетащите изображение сюда/);
  assert.match(assistant, /imageSource: \/без/);
  assert.match(assistant, /: "generate"/);
  assert.match(assistant, /prepareImageFile/);
  assert.match(assistant, /setQuestions\(fallbackBriefQuestions\(goal\)\)/);
  assert.match(assistant, /setStage\("questions"\)/);
  assert.match(assistant, /if \(!value\.trim\(\)\) return ""/);
  assert.match(assistant, /createImageBitmap/);
  assert.match(server, /clean modern SaaS email/);
  assert.match(server, /classifyEmailType/);
  assert.match(server, /saasEmailBlockStyle/);
  assert.match(server, /contentWidth: cleanSaas \? 620/);
  assert.match(server, /frameStyle: cleanSaas \? "hairline"/);
  assert.match(server, /availableAssets/);
  assert.match(server, /Не спрашивай цвета/);
  assert.match(server, /suggestion: fallbackBriefQuestions\(input\.goal\)/);
  assert.match(server, /createEditorialCopy/);
  assert.match(server, /сырьё и ограничения, а не текст для копирования/);
  assert.match(server, /Каждую загруженную фотографию/);
  assert.match(server, /blocks\.splice\(heroIndex/);
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
    readFile(
      new URL(
        "../components/email-builder/PropertiesPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/email-builder/EmailExportMenu.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(properties, /onInput=.*onChange/);
  assert.match(exports, /Количество копий/);
  assert.match(exports, /contentDocument/);
  assert.match(exports, /html2canvas/);
  assert.match(exports, /application\/pdf/);
  assert.match(exports, /email-export\?portable=1/);
  assert.doesNotMatch(exports, /window\.open/);
});

test("starter edits become personal templates and uploads work in every manual editor", async () => {
  const [builder, library, picker, store] = await Promise.all([
    readFile(
      new URL(
        "../components/email-builder/EmailBuilderView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../components/templates/TemplatesView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/email-builder/ImageAssetPicker.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/template-store.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(builder, /Сохранить в мои шаблоны/);
  assert.match(builder, /Категория и описание шаблона/);
  assert.match(builder, /Вы редактируете готовый макет/);
  assert.match(builder, /editingStarter \? null/);
  assert.match(library, /Мои шаблоны/);
  assert.match(library, /!template\.isStarter/);
  assert.match(picker, /onDrop=/);
  assert.match(picker, /onPaste=/);
  assert.match(picker, /Перетащите/);
  assert.match(store, /isStarterEmailTemplateId/);
});

test("visible typography properties drive the live canvas", async () => {
  const canvas = await readFile(
    new URL("../components/email-builder/EmailCanvas.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    (canvas.match(/lineHeight: block\.lineHeight \/ 100/g) ?? []).length >= 8,
  );
  assert.ok(
    (canvas.match(/letterSpacing: block\.letterSpacing/g) ?? []).length >= 8,
  );
  assert.ok((canvas.match(/fontWeight: block\.fontWeight/g) ?? []).length >= 4);
});

test("new templates expose a clear name field and resolve occupied names", async () => {
  const builder = await readFile(
    new URL(
      "../components/email-builder/EmailBuilderView.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(builder, /"Название шаблона"/);
  assert.match(builder, /onCampaignNameChange=\{setCampaignNameDirty\}/);
  assert.match(builder, /occupied\.has\(saveName\.toLocaleLowerCase/);
  assert.match(builder, /Название было занято/);
});

test("pattern gallery offers varied email-safe designs", async () => {
  const [presets, properties, canvas, compiler] = await Promise.all([
    readFile(
      new URL(
        "../components/email-builder/pattern-presets.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/email-builder/PropertiesPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/EmailCanvas.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/email-document.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.ok((presets.match(/id: "/g) ?? []).length >= 32);
  for (const name of [
    "Искры",
    "Точки",
    "Сетка",
    "Ромбы",
    "Волны",
    "Конфетти",
    "Арт-деко",
    "Мягкие углы",
    "Техноуглы",
    "Микропечать",
  ])
    assert.match(presets, new RegExp(name));
  assert.match(properties, /title="Рисунок узора"/);
  assert.match(properties, /label="Масштаб"/);
  assert.match(properties, /label="Расстояние"/);
  assert.match(canvas, /whitespace-pre-line/);
  assert.match(compiler, /letter-spacing:\$\{tracking\}px/);
});

test("a new letter starts empty and offers full-email frame presets", async () => {
  const [builderTypes, canvas, library, frames, compiler] = await Promise.all([
    readFile(
      new URL("../components/email-builder/builder-types.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/EmailCanvas.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/BlockLibrary.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/frame-presets.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/email-document.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(builderTypes, /blocks: \[\]/);
  assert.match(canvas, /Пустой холст/);
  assert.match(canvas, /Добавить первый блок/);
  assert.match(library, />Окантовки</);
  assert.ok((frames.match(/id: "/g) ?? []).length >= 16);
  assert.match(compiler, /emailFrameInlineCss/);
});

test("visual systems library contains reference-inspired but original editable layouts", async () => {
  const [templates, database, library, frames] = await Promise.all([
    readFile(new URL("../data/templates.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/server/database-init.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/BlockLibrary.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/frame-presets.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.ok((templates.match(/id: "template-v5-visual-/g) ?? []).length >= 8);
  for (const layout of [
    "Сервисное событие",
    "Оценка опыта",
    "Подтверждение доступа",
    "Юридическое досье",
    "Приглашение · Ticket",
    "Меморандум",
  ]) {
    assert.match(templates, new RegExp(layout));
  }
  for (const frame of [
    "capsule",
    "stamp",
    "offset",
    "inset",
    "top-accent",
    "right-band",
    "editorial",
  ]) {
    assert.match(frames, new RegExp(`"${frame}"`));
  }
  assert.match(library, />Декор</);
  assert.match(library, /emailPatternCategoryLabels/);
  assert.match(database, /email-template-library-v5-visual/);
});

test("scaled library offers 150+ original templates and useful discovery filters", async () => {
  const [generated, templatesView, database, dashboard, builder] =
    await Promise.all([
      readFile(
        new URL("../data/generated-template-library.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../components/templates/TemplatesView.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../lib/server/database-init.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../components/dashboard/DashboardView.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../components/email-builder/EmailBuilderView.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
  assert.match(generated, /themes\.flatMap/);
  assert.ok(
    (
      generated.match(
        /id: "(?:violet|cobalt|emerald|coral|amber|rose|sky|plum|ink|noir|sand|lime)"/g,
      ) ?? []
    ).length >= 12,
  );
  assert.ok(
    (
      generated.match(
        /id: "(?:service-status|event-invite|editorial-digest|product-launch|feedback|personal-outreach|security|case-update|webinar)"/g,
      ) ?? []
    ).length >= 9,
  );
  for (const filter of [
    "StyleFilter",
    "DensityFilter",
    "PaletteFilter",
    "Поиск по задаче",
    "Минималистичный",
    "Редакционный",
    "Тёмная",
    "Тёплая",
    "Холодная",
    "Подробный · 9+ блоков",
  ])
    assert.match(templatesView, new RegExp(filter.replace(/[+]/g, "\\+")));
  assert.match(templatesView, /Импортировать шаблон/);
  assert.match(templatesView, /\.mailflow\.json/);
  assert.doesNotMatch(templatesView, /Юридическая коллекция/);
  assert.match(database, /email-template-library-v6-scale/);
  assert.match(dashboard, /Выбрать шаблон/);
  assert.match(dashboard, /Импортировать свой макет/);
  assert.match(builder, /С чего начнём письмо/);
  assert.match(builder, /150\+ готовых макетов/);
});

test("studio picks use distinct art directions instead of palette duplicates", async () => {
  const [studio, templatesView, preview, database] = await Promise.all([
    readFile(
      new URL("../data/studio-template-library.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/templates/TemplatesView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/templates/TemplatePreview.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/database-init.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.ok(
    (
      studio.match(
        /id: "(?:swiss-red-grid|editorial-gazette|neon-terminal|museum-invitation|bento-quarterly|document-dossier|brutalist-notice|midnight-gala|blueprint-process|soft-service-card|kinetic-poster|travel-feedback|security-obsidian)"/g,
      ) ?? []
    ).length >= 13,
  );
  for (const direction of [
    "Swiss Grid",
    "Газетный выпуск",
    "Neon Terminal",
    "Премиальное приглашение",
    "Bento Board",
    "Юридическое досье",
    "Brutalist",
    "Midnight Gala",
    "Blueprint",
    "Soft Cloud",
    "Kinetic Type",
  ]) {
    assert.match(studio, new RegExp(direction));
  }
  assert.match(templatesView, /Подборка студии/);
  assert.match(templatesView, /Не шаблоны по палитрам/);
  assert.match(preview, /Выбор студии/);
  assert.match(database, /email-template-library-v7-studio/);
});

test("creative collection adds fifty art-directed templates, not palette clones", async () => {
  const [creative, templates, templatesView, preview, database] =
    await Promise.all([
      readFile(
        new URL("../data/creative-template-library.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../data/templates.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../components/templates/TemplatesView.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../components/templates/TemplatePreview.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../lib/server/database-init.ts", import.meta.url),
        "utf8",
      ),
    ]);
  for (const system of [
    "memphis",
    "bauhaus",
    "cinema",
    "botanical",
    "neo-tokyo",
    "paper-cut",
    "nordic",
    "ledger",
    "holo",
    "mono",
  ]) {
    assert.match(creative, new RegExp(`id: "${system}"`));
  }
  for (const story of [
    "private-invite",
    "product-drop",
    "weekly-signal",
    "personal-pitch",
    "status-update",
  ]) {
    assert.match(creative, new RegExp(`id: "${story}"`));
  }
  assert.match(creative, /systems\.flatMap/);
  assert.match(creative, /stories\.map/);
  assert.match(templates, /\.\.\.creativeTemplates/);
  assert.match(templatesView, /template-v8-creative-/);
  assert.match(preview, /template-v8-creative-/);
  assert.match(database, /email-template-library-v8-creative/);
});

test("email action blocks are real links in the canvas and compiled email", async () => {
  const [canvas, properties, compiler] = await Promise.all([
    readFile(
      new URL("../components/email-builder/EmailCanvas.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/email-builder/PropertiesPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/email-document.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(properties, /Куда ведёт нажатие/);
  assert.match(properties, /normalizedActionUrl/);
  assert.match(properties, /Проверить ссылку в новой вкладке/);
  assert.ok((canvas.match(/target="_blank"/g) ?? []).length >= 5);
  assert.ok(
    (canvas.match(/href=\{block\.href \|\| undefined\}/g) ?? []).length >= 5,
  );
  assert.match(compiler, /<a href="\$\{escapeHtml\(block\.href \?\? ""\)\}"/);
  assert.match(compiler, /safeHttpsUrl\(block\.href, `Ссылка кнопки/);
});

test("NavyAI uses its supported chat endpoint and a working structured-output fallback", async () => {
  const server = await readFile(
    new URL("../lib/server/email-ai.ts", import.meta.url),
    "utf8",
  );
  assert.match(server, /\/chat\/completions/);
  assert.match(server, /gemini-2\.5-flash-lite/);
  assert.match(server, /choices/);
  assert.match(server, /response_format/);
  assert.match(server, /\(\?:responses\|chat\\\/completions\)/);
});

test("decor library now contains sixty-four motifs and twenty-eight email frames", async () => {
  const [patterns, frames, compiler, builder, library] = await Promise.all([
    readFile(
      new URL(
        "../components/email-builder/pattern-presets.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../components/email-builder/frame-presets.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/email-document.ts", import.meta.url),
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
      new URL("../components/email-builder/BlockLibrary.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.equal((patterns.match(/\{ id: "/g) ?? []).length, 64);
  assert.equal((frames.match(/\{ id: "/g) ?? []).length, 28);
  for (const category of [
    "Ботанические",
    "Ретро и печать",
    "Цифровые",
    "Праздничные",
  ])
    assert.match(patterns, new RegExp(category));
  for (const name of [
    "Вьюнок",
    "Почтовые марки",
    "Микросхема",
    "Фейерверк",
    "Билет",
    "Окно",
    "Архив",
    "Премиальная",
    "Открытка",
  ]) {
    assert.match(`${patterns}\n${frames}`, new RegExp(name));
  }
  for (const id of [
    "ticket",
    "window",
    "railway",
    "archive",
    "corner-cut",
    "luxury",
    "blueprint",
    "postcard",
    "focus",
  ]) {
    assert.match(compiler, new RegExp(`"${id}"`));
    assert.match(builder, new RegExp(`"${id}"`));
  }
  assert.match(library, /64 орнамента и контура/);
});

test("creative expansion adds seventy more scenario-led studio templates", async () => {
  const [creative, database] = await Promise.all([
    readFile(
      new URL("../data/creative-template-library.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/database-init.ts", import.meta.url),
      "utf8",
    ),
  ]);
  for (const direction of [
    "Atelier Rouge",
    "Circuit Lab",
    "Air Mail",
    "Festival Pop",
    "Gallery Note",
    "Alpine Signal",
    "Receipt Club",
    "Lunar Orbit",
    "Ceramic Blue",
    "Newsflash",
  ]) {
    assert.match(creative, new RegExp(direction));
  }
  assert.match(creative, /id: "research-brief"/);
  assert.match(creative, /id: "award-note"/);
  assert.match(database, /email-template-library-v9-creative-expansion/);
});
