import assert from "node:assert/strict";
import test from "node:test";

import {
  decorativePatternFor,
  distributeEditorialBody,
  fallbackEmailImagePrompt,
  normalizeDisplayHeading,
  resolveEmailTypography,
  resolveEmailVisualPalette,
  selectEmailPatternArtwork,
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

test("exact user colors override automatic named palettes", () => {
  const palette = resolveEmailVisualPalette({
    goal: "Закрытый деловой завтрак",
    designBrief: "Редакционный кобальтовый журнал с тёплым терракотовым акцентом",
    visualStyle: "editorial",
    primaryColor: "#173A67",
    secondaryColor: "#C96A4A",
    modelAccent: "#3157D5",
  });

  assert.equal(palette.name, "Два точных цвета пользователя");
  assert.equal(palette.accent, "#173A67");
  assert.equal(palette.secondaryAccent, "#C96A4A");
  assert.notEqual(palette.workspace, "#3157D5");
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

test("romantic art direction selects a restrained editorial type system and raster ornament", () => {
  const typography = resolveEmailTypography({
    goal: "Приглашение на первое свидание в ресторане",
    designBrief: "Романтичный минимализм",
    visualStyle: "minimal",
  });
  const artwork = selectEmailPatternArtwork(
    "Приглашение на первое свидание в ресторане",
    "minimal",
  );

  assert.equal(typography.headingFont, "Georgia");
  assert.equal(typography.bodyFont, "Trebuchet MS");
  assert.ok(typography.heroSize <= 31);
  assert.equal(artwork.id, "romantic-ribbon");
  assert.match(artwork.imageUrl, /\/email-patterns\/romantic-ribbon\.jpg$/);
});

test("pattern artwork follows the subject instead of showing generic emoji", () => {
  assert.equal(
    selectEmailPatternArtwork("Новый ИИ-сервис для аналитики", "minimal").id,
    "signal-grid",
  );
  assert.equal(
    selectEmailPatternArtwork("Чайная церемония в саду", "minimal").id,
    "botanical-herbarium",
  );
  assert.equal(
    selectEmailPatternArtwork("Летний фестиваль", "bold").id,
    "terrazzo-studio",
  );
  assert.equal(
    selectEmailPatternArtwork(
      "Деловой завтрак. Редакционный журнал и тонкий архитектурный узор",
      "editorial",
    ).id,
    "moroccan-arches",
  );
});

test("topic patterns do not mistake ordinary Russian word endings for AI", () => {
  assert.match(
    decorativePatternFor("Лимитированная коллекция чая и ботанический стиль"),
    /❦/,
  );
  assert.doesNotMatch(
    decorativePatternFor("Лимитированная коллекция чая"),
    /─/,
  );
  assert.match(decorativePatternFor("Новый ИИ-сервис для аналитики"), /─/);
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
