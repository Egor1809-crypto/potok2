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

test("presentation typography has enforced readable content budgets", () => {
  const longText = "очень подробное объяснение ".repeat(40);
  assert.ok(normalizePresentationTitle(longText).length <= 89);
  assert.ok(normalizePresentationBody(longText).length <= 361);
  assert.ok(normalizePresentationBullet(longText).length <= 111);
  assert.equal(normalizePresentationEyebrow("ключевая мысль"), "КЛЮЧЕВАЯ МЫСЛЬ");
  assert.equal(
    normalizePresentationTitle(
      "Пилотируем AI в договорах как систему контроля качества, а не как автоматизацию ради автоматизации",
    ),
    "Пилотируем AI в договорах как систему контроля качества",
  );
});
