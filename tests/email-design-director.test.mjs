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

test("narrative recipes preserve existing content and supply missing email roles", () => {
  const document = workingDocument();
  const originalText = document.blocks[1].content;
  const directed = applyNarrativeRecipe(document, "founder-note");

  assert.equal(directed.blocks[0].type, "logo");
  assert.ok(directed.blocks.some((block) => block.type === "signature"));
  assert.equal(directed.blocks.at(-1).type, "footer");
  assert.ok(directed.blocks.some((block) => block.content === originalText));
});
