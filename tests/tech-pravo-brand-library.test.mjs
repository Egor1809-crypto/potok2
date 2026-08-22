import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("brand library ships eleven background templates and thirty extracted patterns", async () => {
  const [brand, templates, database, compiler, library] = await Promise.all([
    readFile(new URL("../data/tech-pravo-brand-templates.ts", import.meta.url), "utf8"),
    readFile(new URL("../data/templates.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/email-builder/BlockLibrary.tsx", import.meta.url), "utf8"),
  ]);

  const specs = brand.match(/slug: "[^"]+"/g) ?? [];
  assert.equal(specs.length, 11);
  assert.match(brand, /backgroundImageUrl:/);
  assert.match(brand, /Ваш текст поверх узора|type: "pattern"/);
  assert.match(templates, /\.\.\.techPravoBrandTemplates/);
  assert.match(database, /email-template-library-v12-tech-pravo-brand/);
  assert.match(compiler, /background-repeat:no-repeat/);
  assert.match(library, /Текст и кнопки остаются отдельными редактируемыми блоками/);

  for (let index = 1; index <= 11; index += 1) {
    const name = `tech-pravo-${String(index).padStart(2, "0")}.jpg`;
    const details = await stat(new URL(`../public/email-brand/backgrounds/${name}`, import.meta.url));
    assert.ok(details.size > 50_000, `${name} should contain a real background`);
    assert.ok(details.size < 400_000, `${name} should stay optimized`);
  }
  for (let index = 1; index <= 30; index += 1) {
    const name = `tech-pattern-${String(index).padStart(2, "0")}.jpg`;
    const details = await stat(new URL(`../public/email-brand/patterns/${name}`, import.meta.url));
    assert.ok(details.size > 4_000, `${name} should contain an extracted pattern`);
    assert.ok(details.size < 90_000, `${name} should stay email-friendly`);
  }
});

test("general email decor adds a large licensed pattern library", async () => {
  const [catalog, presets, license] = await Promise.all([
    import("../data/email-pattern-library.ts"),
    readFile(
      new URL("../components/email-builder/pattern-presets.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../public/email-patterns/PATTERN-MONSTER-LICENSE.txt",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.equal(catalog.emailPatternLibrary.length, 48);
  assert.match(presets, /78 фонов и орнаментов|emailPatternLibrary/);
  assert.match(license, /MIT License/);
  const monster = catalog.emailPatternLibrary.filter(
    (pattern) => pattern.source === "pattern-monster",
  );
  assert.equal(monster.length, 36);
  for (const pattern of monster) {
    const filename = pattern.imageUrl.split("/").at(-1);
    const details = await stat(
      new URL(`../public/email-patterns/${filename}`, import.meta.url),
    );
    assert.ok(details.size > 30_000, `${filename} should be a real pattern`);
    assert.ok(details.size < 450_000, `${filename} should stay optimized`);
  }
});
