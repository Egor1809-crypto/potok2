import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("calendar connects scheduled campaigns, audience filters and the due queue", async () => {
  const [calendar, wizard, store, worker, assets, timezone, topbar, navigation] = await Promise.all([
    source("components/calendar/CalendarView.tsx"),
    source("components/campaigns/CampaignWizard.tsx"),
    source("lib/server/mailflow-store.ts"),
    source("worker/index.ts"),
    source("lib/server/email-asset-store.ts"),
    source("lib/client-timezone.ts"),
    source("components/layout/topbar.tsx"),
    source("components/layout/navigation.ts"),
  ]);

  assert.match(calendar, /Календарь рассылок/);
  assert.match(calendar, /Тема, название или группа/);
  assert.match(calendar, /Все группы/);
  assert.match(calendar, /scheduledDate=/);
  assert.match(calendar, /Рассылок на этот день/);
  assert.match(calendar, /targetCampaignId/);
  assert.match(calendar, /setInterval\(refresh, 30_000\)/);
  assert.match(calendar, /items\.map\(\(campaign\)/);
  assert.doesNotMatch(calendar, /Проверить очередь/);
  assert.doesNotMatch(calendar, /fetch\("\/api\/scheduler"/);
  assert.doesNotMatch(calendar, /items\.slice\(0, 3\)/);
  assert.match(wizard, /scheduledAt/);
  assert.match(wizard, /scheduledTimes/);
  assert.match(wizard, /Добавить время/);
  assert.match(wizard, /волна \$\{index \+ 1\}\/\$\{launchTimes\.length\}/);
  assert.match(wizard, /recipientCount \* waveCount/);
  assert.match(wizard, /Каждый получатель получит это письмо во все выбранные периоды/);
  assert.match(wizard, /createdWaveIds/);
  assert.match(wizard, /Незавершённые дополнительные волны удалены/);
  assert.match(wizard, /formatWaveCount\(scheduledTimes\.length\).*в календарь/);
  assert.match(wizard, /Времена волн.*сохранены/);
  assert.match(wizard, /Показать в календаре/);
  assert.match(store, /eq\(campaigns\.status, "scheduled"\)/);
  assert.match(store, /lte\(campaigns\.scheduledAt, now\)/);
  assert.match(store, /providerScheduledAt/);
  assert.match(store, /provider_schedule_created/);
  assert.match(store, /member\.status === "active"/);
  assert.match(worker, /scheduled\(_controller/);
  assert.match(worker, /url\.pathname === "\/api\/workspace"/);
  assert.match(worker, /runDueCampaignsInBackground\(ctx\)/);
  assert.match(assets, /storeInlineEmailAsset[\s\S]*ensureSystemDatabase\(\)/);
  assert.match(timezone, /resolvedOptions\(\)\.timeZone/);
  assert.match(calendar, /formatTime\(campaign\.scheduledAt!, timeZone\)/);
  assert.match(calendar, /Часовой пояс определён автоматически/);
  assert.match(wizard, /Часовой пояс:/);
  assert.match(wizard, /Базы ответственных/);
  assert.match(wizard, /Выбрать базу/);
  assert.match(wizard, /Все ответственные/);
  assert.match(wizard, /Все команды/);
  assert.match(wizard, /Все листы баз/);
  assert.match(wizard, /Есть Email/);
  assert.match(wizard, /Ответственный:/);
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
  assert.match(smtp, /multipart\/related/);
  assert.match(smtp, /Content-ID:/);
  assert.match(smtp, /Content-Disposition: inline/);
  assert.match(smtp, /Content-Type: text\/html/);
  assert.match(store, /processVkWorkspaceSmtpOutbox/);
  assert.match(store, /prepareEmailHtmlForDelivery\(version\.snapshot\.emailBodyHtml, "cid"\)/);
  assert.match(store, /inlineImages: preparedEmail\.images/);
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
