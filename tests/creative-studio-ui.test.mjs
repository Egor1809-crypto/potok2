import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("both constructors use the shared studio visual language", async () => {
  const [email, presentations, styles] = await Promise.all([
    readFile(
      new URL("../components/email-builder/EmailBuilderView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/presentations/PresentationStudio.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(email, /studio-shell/);
  assert.match(email, /studio-modebar/);
  assert.match(presentations, /studio-shell/);
  assert.match(presentations, /presentation-studio-home/);
  assert.match(styles, /@keyframes studio-enter/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("art director leads the user through diagnosis, style and dramaturgy", async () => {
  const panel = await readFile(
    new URL(
      "../components/email-builder/CreativeDirectorPanel.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(panel, /Режиссёрский пульт/);
  assert.match(panel, /Исправить безопасные замечания/);
  assert.match(panel, /applySafeFixes/);
  assert.match(panel, /01 Разбор/);
  assert.match(panel, /02 Стиль/);
  assert.match(panel, /03 Сюжет/);
  assert.match(panel, /director-stage/);
});

test("email AI form keeps every choice full-height inside its own scroll area", async () => {
  const assistant = await readFile(
    new URL(
      "../components/email-builder/AiEmailAssistant.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(assistant, /flex-1 auto-rows-max content-start/);
  assert.match(assistant, /overflow-y-auto overscroll-contain/);
  assert.match(assistant, /scrollbar-gutter:stable/);
  assert.match(assistant, /pb-24/);
  assert.doesNotMatch(assistant, /grid h-full min-h-0 w-full max-w-4xl/);
});
