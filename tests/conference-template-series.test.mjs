import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("conference sales chain ships thirty art-directed and image-backed email templates", async () => {
  const [series, expansion, templates, database] = await Promise.all([
    readFile(
      new URL("../data/conference-template-series.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../data/conference-sales-expansion.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../data/templates.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/server/database-init.ts", import.meta.url),
      "utf8",
    ),
  ]);

  const ids = series.match(/id: "template-v10-conference-chain-[^"]+"/g) ?? [];
  assert.equal(ids.length, 5);
  assert.match(series, /Цепочка 1\/30 · Неоновый анонс/);
  assert.match(series, /Цепочка 2\/30 · Гжель-техно/);
  assert.match(series, /Цепочка 3\/30 · Маршрут участника/);
  assert.match(series, /Цепочка 4\/30 · Кому стоит приехать/);
  assert.match(series, /Цепочка 5\/30 · Красные Ворота/);
  const expandedSteps = expansion.match(/step: \d+/g) ?? [];
  assert.equal(expandedSteps.length, 25);
  assert.match(expansion, /Цепочка \$\{spec\.step\}\/30/);
  assert.match(expansion, /template-v11-conference-chain-/);
  assert.match(expansion, /ПРОЕКТ: ИССЛЕДОВАНИЯ/);
  assert.match(expansion, /ПРОЕКТ: АКАДЕМИЯ/);
  assert.match(expansion, /ПРОЕКТ: ТРЕНАЖЁР/);
  assert.match(expansion, /ПРОЕКТ: КНИГА/);
  assert.match(expansion, /ПРОЕКТ: ЧЕК-ЛИСТЫ/);
  assert.match(expansion, /ПРОЕКТ: NEUROPRAVO/);
  assert.match(expansion, /Купить билет на конференцию/);
  assert.match(series, /6 тематических потоков/);
  assert.match(series, /80\+ спикеров/);
  assert.match(series, /1500\+ участников/);
  assert.match(series, /https:\/\/tech-pravo\.ru\/conference/);
  assert.match(templates, /\.\.\.conferenceTemplateSeries/);
  assert.match(templates, /\.\.\.conferenceSalesExpansion/);
  assert.match(database, /email-template-library-v10-conference-series/);
  assert.match(
    database,
    /email-template-library-v11-conference-sales-expansion/,
  );

  for (const asset of [
    "cyber-justice.jpg",
    "gzhel-mascot.jpg",
    "tech-pravo-logo.jpg",
    "red-gate-hero.jpg",
  ]) {
    const details = await stat(
      new URL(`../public/conference-series/${asset}`, import.meta.url),
    );
    assert.ok(details.size > 5_000, `${asset} should contain a real image`);
    assert.ok(details.size < 400_000, `${asset} should be optimized for email`);
  }
});
