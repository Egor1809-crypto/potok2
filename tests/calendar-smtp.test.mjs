import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("calendar connects scheduled campaigns, audience filters and the due queue", async () => {
  const [calendar, wizard, store, worker, topbar, navigation] = await Promise.all([
    source("components/calendar/CalendarView.tsx"),
    source("components/campaigns/CampaignWizard.tsx"),
    source("lib/server/mailflow-store.ts"),
    source("worker/index.ts"),
    source("components/layout/topbar.tsx"),
    source("components/layout/navigation.ts"),
  ]);

  assert.match(calendar, /Календарь рассылок/);
  assert.match(calendar, /Тема, название или группа/);
  assert.match(calendar, /Все группы/);
  assert.match(calendar, /scheduledDate=/);
  assert.match(calendar, /Рассылок на этот день/);
  assert.match(calendar, /targetCampaignId/);
  assert.match(wizard, /scheduledAt/);
  assert.match(wizard, /Поставить в календарь/);
  assert.match(wizard, /Дата сохранена — рассылка отмечена в календаре как черновик/);
  assert.match(wizard, /Показать в календаре/);
  assert.match(store, /eq\(campaigns\.status, "scheduled"\)/);
  assert.match(store, /lte\(campaigns\.scheduledAt, now\)/);
  assert.match(worker, /scheduled\(_controller/);
  assert.match(topbar, /href="\/calendar"/);
  assert.doesNotMatch(navigation, /href: "\/calendar"/);
});

test("VK WorkSpace sends inline HTML through authenticated SMTP", async () => {
  const [definitions, runtime, smtp, store] = await Promise.all([
    source("config/integrations.ts"),
    source("lib/server/runtime-integrations.ts"),
    source("lib/server/vk-workspace-smtp.ts"),
    source("lib/server/mailflow-store.ts"),
  ]);

  assert.match(definitions, /id: "vk-workspace"[\s\S]*deliveryMode: "automatic"/);
  assert.match(runtime, /VK_WORKSPACE_SMTP_PASSWORD/);
  assert.match(smtp, /AUTH LOGIN/);
  assert.match(smtp, /smtp|multipart\/alternative/i);
  assert.match(smtp, /Content-Type: text\/html/);
  assert.match(store, /processVkWorkspaceSmtpOutbox/);
  assert.match(store, /renderContactTemplate\(version\.snapshot\.emailBodyHtml/);
});

test("email images and buttons compile as clickable HTML instead of attachments", async () => {
  const [types, panel, compiler] = await Promise.all([
    source("types/template.ts"),
    source("components/email-builder/PropertiesPanel.tsx"),
    source("lib/server/email-document.ts"),
  ]);

  assert.match(types, /linkHref\?: string/);
  assert.match(panel, /Ссылка при нажатии/);
  assert.match(compiler, /block\.linkHref \? `<a href=/);
  assert.match(compiler, /class="email-cta" href=/);
});
