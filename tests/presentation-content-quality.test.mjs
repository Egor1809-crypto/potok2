import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePresentationBody,
  normalizePresentationBullet,
  normalizePresentationEyebrow,
  normalizePresentationTitle,
} from "../lib/presentation-content-quality.ts";

test("presentation titles become slide-ready instead of copying the user command", () => {
  assert.equal(
    normalizePresentationTitle(
      "нужно сделать презентацию про цифровую трансформацию юридической функции",
    ),
    "Цифровую трансформацию юридической функции",
  );
  assert.equal(
    normalizePresentationTitle("презентация на тему: работа с клиентами"),
    "Работа с клиентами",
  );
  assert.equal(
    normalizePresentationTitle("Создать презентацию о внедрении ИИ в договорную работу"),
    "О внедрении ИИ в договорную работу",
  );
});

test("normalization preserves complete text and whole Russian words for the layout review", () => {
  const longText = "Очень подробное объяснение ".repeat(40).trim();
  assert.equal(normalizePresentationTitle(longText), longText);
  assert.equal(normalizePresentationBody(longText), longText);
  assert.equal(normalizePresentationBullet(longText), longText);
  assert.equal(normalizePresentationEyebrow("ключевая мысль"), "КЛЮЧЕВАЯ МЫСЛЬ");
  for (const title of ["Проверка договоров", "Продолжение пилота", "Проект нового договора"]) {
    assert.equal(normalizePresentationTitle(title), title);
  }
});
