import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("conference sales chain ships five art-directed and image-backed email templates", async () => {
  const [series, templates, database] = await Promise.all([
    readFile(
      new URL("../data/conference-template-series.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../data/templates.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
  ]);

  const ids = series.match(/id: "template-v10-conference-chain-[^"]+"/g) ?? [];
  assert.equal(ids.length, 5);
  assert.match(series, /Цепочка 1\/5 · Неоновый анонс/);
  assert.match(series, /Цепочка 2\/5 · Гжель-техно/);
  assert.match(series, /Цепочка 3\/5 · Маршрут участника/);
  assert.match(series, /Цепочка 4\/5 · Кому стоит приехать/);
  assert.match(series, /Цепочка 5\/5 · Красные Ворота/);
  assert.match(series, /6 тематических потоков/);
  assert.match(series, /80\+ спикеров/);
  assert.match(series, /1500\+ участников/);
  assert.match(series, /https:\/\/tech-pravo\.ru\/conference/);
  assert.match(templates, /\.\.\.conferenceTemplateSeries/);
  assert.match(database, /email-template-library-v10-conference-series/);

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
