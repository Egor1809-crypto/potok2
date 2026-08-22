import assert from "node:assert/strict";
import test from "node:test";

import {
  createBlankDocument,
  createBlock,
} from "../components/email-builder/builder-types.ts";
import {
  analyzeEmailQuality,
  applyEmailDesignSystem,
  applyEmailQualityFix,
  applyNarrativeRecipe,
  previewNarrativeRecipe,
} from "../components/email-builder/email-design-director.ts";

function workingDocument() {
  const document = createBlankDocument();
  const heading = createBlock("heading");
  const text = createBlock("text");
  const button = createBlock("button");
  return {
    ...document,
    subject: "Что изменится в договорной работе с 1 сентября",
    previewText: "Три изменения, сроки и следующий шаг для юридической команды.",
    blocks: [
      { ...heading, content: "Изменения в договорной работе" },
      {
        ...text,
        content:
          "Здравствуйте, {{first_name}}. С 1 сентября меняется порядок согласования. Ниже — факты и действия для команды.",
      },
      {
        ...button,
        content: "Открыть памятку",
        label: "Открыть памятку",
        href: "https://example.test/memo",
      },
      { ...createBlock("footer"), content: "Поток · Настроить подписку · Отписаться" },
    ],
  };
}

test("quality director prioritizes empty, placeholder and AI-like drafts", () => {
  const empty = analyzeEmailQuality(createBlankDocument());
  assert.equal(empty.score, 0);
  assert.ok(empty.issues.some((issue) => issue.id === "empty"));

  const draft = workingDocument();
  draft.blocks[1].content =
    "В современном мире мы рады сообщить об уникальной возможности выйти на новый уровень.";
  const report = analyzeEmailQuality(draft);
  assert.ok(report.signals.aiCliches >= 3);
  assert.ok(report.issues.some((issue) => issue.id === "ai-cliches"));

  const cleaned = applyEmailQualityFix(draft, "humanize-copy");
  assert.doesNotMatch(cleaned.blocks[1].content, /рады сообщить|уникальной возможности|новый уровень/i);
});

test("design systems update the complete visual language without changing copy", () => {
  const document = workingDocument();
  const copy = document.blocks.map((block) => block.content);
  const styled = applyEmailDesignSystem(document, "editorial-paper");

  assert.equal(styled.accentColor, "#A23D2B");
  assert.equal(styled.bodyBackground, "#FBF8F1");
  assert.equal(styled.blocks[0].fontFamily, "Georgia");
  assert.deepEqual(styled.blocks.map((block) => block.content), copy);
  assert.ok(new Set(styled.blocks.map((block) => block.borderRadius)).size <= 3);
});

test("narrative recipes move only existing blocks and preserve their complete design", () => {
  const source = workingDocument();
  const logo = { ...createBlock("logo"), content: "Поток" };
  const signature = {
    ...createBlock("signature"),
    content: "Егор|Основатель|egor@example.test",
  };
  const image = {
    ...createBlock("image"),
    content: "Фотография команды",
    href: "https://example.test/team.jpg",
  };
  const document = {
    ...source,
    accentColor: "#D64F87",
    blocks: [
      source.blocks[2],
      source.blocks[1],
      source.blocks[0],
      image,
      source.blocks[3],
      logo,
      signature,
    ],
  };
  const originals = new Map(document.blocks.map((block) => [block.id, block]));
  const directed = applyNarrativeRecipe(document, "founder-note");

  assert.deepEqual(
    directed.blocks.map((block) => block.type),
    ["logo", "heading", "image", "text", "signature", "button", "footer"],
  );
  assert.equal(directed.blocks.length, document.blocks.length);
  assert.deepEqual(
    new Set(directed.blocks.map((block) => block.id)),
    new Set(document.blocks.map((block) => block.id)),
  );
  for (const block of directed.blocks) assert.equal(block, originals.get(block.id));
  assert.equal(directed.accentColor, "#D64F87");
  assert.deepEqual(
    applyNarrativeRecipe(directed, "founder-note").blocks.map((block) => block.id),
    directed.blocks.map((block) => block.id),
  );
});

test("event dramaturgy understands program and audience roles without inventing placeholders", () => {
  const blocks = [
    createBlock("footer"),
    createBlock("button"),
    { ...createBlock("columns"), content: "Для руководителей|Для специалистов" },
    { ...createBlock("timeline"), content: "18:00|Сбор гостей|19:00|Ужин" },
    { ...createBlock("text"), content: "Обсудим тему в спокойной обстановке." },
    { ...createBlock("hero"), content: "Закрытый ужин|7 сентября в Москве" },
    createBlock("logo"),
    { ...createBlock("image"), href: "https://example.test/event.jpg" },
  ];
  const document = { ...createBlankDocument(), blocks };
  const preview = previewNarrativeRecipe(document, "event-arc");
  const directed = applyNarrativeRecipe(document, "event-arc");

  assert.ok(preview.movedBlocks > 0);
  assert.equal(preview.hasOpener, true);
  assert.equal(preview.hasAction, true);
  assert.deepEqual(
    directed.blocks.map((block) => block.type),
    ["logo", "hero", "image", "text", "timeline", "columns", "button", "footer"],
  );
  assert.deepEqual(
    directed.blocks.map((block) => block.content).sort(),
    blocks.map((block) => block.content).sort(),
  );
});
