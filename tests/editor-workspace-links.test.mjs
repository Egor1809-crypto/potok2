import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("creative editors lock the page viewport and scroll inside their workspaces", async () => {
  const [shell, emailPage, presentationsPage, imageStudio, emailBuilder] =
    await Promise.all([
      readFile(
        new URL("../components/layout/AppShell.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/email-builder/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/presentations/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../components/image-studio/ImageStudioView.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../components/email-builder/EmailBuilderView.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(shell, /viewportLocked\?: boolean/);
  assert.match(shell, /fixed inset-0 h-dvh w-full overflow-hidden/);
  assert.match(emailPage, /fixed inset-0 h-dvh w-full overflow-hidden/);
  assert.match(presentationsPage, /viewportLocked/);
  assert.match(imageStudio, /viewportLocked/);
  assert.match(imageStudio, /overflow-y-auto overscroll-contain/);
  assert.match(emailBuilder, /h-full min-h-0 flex-col overflow-hidden/);
});

test("AI briefs preserve design, CTA and social links in emails and presentations", async () => {
  const [
    emailUi,
    emailAi,
    emailCompiler,
    presentationUi,
    presentationAi,
    pptx,
  ] = await Promise.all([
    readFile(
      new URL(
        "../components/email-builder/AiEmailAssistant.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/server/email-ai.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/server/email-document.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../components/presentations/PresentationStudio.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/presentation-ai.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/server/presentation-pptx.ts", import.meta.url),
      "utf8",
    ),
  ]);

  for (const label of [
    "Как должно выглядеть письмо",
    "Текст основной кнопки",
    "HTTPS-ссылка кнопки",
    "Telegram",
    "ВКонтакте",
    "Сайт",
  ]) {
    assert.match(emailUi, new RegExp(label));
  }
  assert.match(emailAi, /designBrief/);
  assert.match(emailAi, /socialLinks/);
  assert.match(
    emailCompiler,
    /<a href="\$\{escapeHtml\(items\[index \+ 1\]\)\}"/,
  );

  for (const label of [
    "Как должна выглядеть презентация",
    "Текст кнопки",
    "HTTPS-ссылка кнопки",
    "Дизайн, кнопка и социальные сети",
  ]) {
    assert.match(presentationUi, new RegExp(label));
  }
  assert.match(presentationAi, /designBrief/);
  assert.match(presentationAi, /socialLinks/);
  assert.match(pptx, /TargetMode="External"/);
  assert.match(pptx, /hyperlinkId/);
});
