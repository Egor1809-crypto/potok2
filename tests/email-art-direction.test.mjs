import assert from "node:assert/strict";
import test from "node:test";

import {
  decorativePatternFor,
  distributeEditorialBody,
  fallbackEmailImagePrompt,
  normalizeDisplayHeading,
  resolveEmailVisualPalette,
  semanticOverlap,
} from "../lib/server/email-art-direction.ts";

test("a named color in the brief controls the complete minimal palette", () => {
  const palette = resolveEmailVisualPalette({
    goal: "Приглашение на первое свидание",
    designBrief: "Минималистичный стиль в розовом цвете",
    visualStyle: "minimal",
    modelAccent: "#3157D5",
    modelBody: "#FFFFFF",
  });

  assert.equal(palette.name, "Пудровый розовый");
  assert.equal(palette.accent, "#D64F87");
  assert.equal(palette.soft, "#FCEBF2");
  assert.notEqual(palette.workspace, "#F6F8FC");
});

test("headings are capitalized and copied brief headings are detectable", () => {
  assert.equal(
    normalizeDisplayHeading("приглашение на ужин|давай выберем дату"),
    "Приглашение на ужин|Давай выберем дату",
  );
  assert.ok(
    semanticOverlap(
      "приглашение на ужин девушке",
      "Сделай приглашение на ужин девушке в романтичном стиле",
    ) >= 0.55,
  );
});

test("a blue-pink brief produces a visible two-color design system", () => {
  const palette = resolveEmailVisualPalette({
    goal: "Приглашение на встречу",
    designBrief: "Минималистичный стиль в голубо-розовых цветах",
    visualStyle: "minimal",
  });

  assert.equal(palette.name, "Голубой + розовый");
  assert.equal(palette.accent, "#D64F87");
  assert.equal(palette.secondaryAccent, "#4F83D6");
  assert.equal(palette.soft, "#EAF2FD");
  assert.equal(palette.patternBackground, "#FCEBF2");
});

test("the visual director supplies a themed pattern and image prompt", () => {
  const palette = resolveEmailVisualPalette({
    goal: "Первое свидание в ресторане",
    designBrief: "Розовый минимализм",
    visualStyle: "minimal",
  });
  const pattern = decorativePatternFor("Первое свидание в ресторане");
  const prompt = fallbackEmailImagePrompt(
    "Первое свидание в ресторане",
    "Ужин вдвоём",
    "minimal",
    palette,
  );

  assert.match(pattern, /♡/);
  assert.match(prompt, /столик на двоих/);
  assert.match(prompt, /#D64F87/);
  assert.match(prompt, /Без текста/);
});

test("approved editorial copy replaces every text slot without duplicating raw notes", () => {
  const parts = distributeEditorialBody(
    "Первый авторский абзац.\n\nВторой абзац с деталями.\n\nТретий абзац с действием.",
    2,
  );
  assert.equal(parts.length, 2);
  assert.match(parts[0], /Первый авторский/);
  assert.match(parts[1], /Третий абзац/);
});
