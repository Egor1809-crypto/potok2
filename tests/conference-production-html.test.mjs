import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("conference HTML letters are seeded as editable user templates", async () => {
  const [generated, database, compiler, preview, personalInvitation] = await Promise.all([
    readFile(new URL("../data/conference-production-templates.generated.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/templates/TemplatePreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../email-templates/conference/conference-01-personal-invitation.html", import.meta.url), "utf8"),
  ]);
  assert.equal((generated.match(/"name": "ТП Конференция /g) ?? []).length, 11);
  assert.equal((generated.match(/"rawHtml":/g) ?? []).length, 11);
  assert.doesNotMatch(generated, /\{\{Имя\}\}/);
  assert.match(generated, /\{\{first_name\}\}/);
  assert.match(generated, /https:\/\/tech-pravo\.ru\/conference/);
  assert.match(generated, /https:\/\/t\.me\/NeuroPravo_Bot/);
  assert.doesNotMatch(generated, /PRACTICE MODE: ON/);
  assert.doesNotMatch(generated, /Private executive note · №07/);
  assert.match(generated, /Конференция руководителей в большом зале/);
  assert.match(generated, /background:#dffbfc;color:#10213b/);
  assert.doesNotMatch(generated, /ООО «АСПБ»/);
  assert.equal((generated.match(/© 2026 ООО «ТехнологИИ Права»/g) ?? []).length, 33);
  assert.doesNotMatch(generated, /https:\/\/tech-pravo\.ru\/conference\/uchastnik/);
  assert.doesNotMatch(generated, /https:\/\/tech-pravo\.ru\/programma-tehnologii-prava-2026\.pdf/);
  assert.match(generated, /На втором дне конференции «ТехнологИИ Права»/);
  assert.match(generated, /Маняша — AI-ассистент конференции/);
  assert.match(generated, /— для руководителей юридического бизнеса, практикующих юристов, юристов в сфере БФЛ/);
  assert.match(generated, /арбитражных управляющих и представителей СРО\./);
  assert.match(generated, /Автоматизация БФЛ, ИИ в юридическом бизнесе, LegalTech, данные и безопасность\./);
  assert.match(generated, /© 2026 ООО «ТехнологИИ Права»/);
  assert.match(generated, /Здравствуйте, \{\{first_name\}\}! Конференция «ТехнологИИ Права» собирает лучших экспертов ИИ-индустрии/);
  assert.match(generated, /объединяет их с представителями юридического сообщества: юристами-практиками/);
  assert.match(generated, /12 сервисов для автоматизации работы юриста с помощью ИИ/);
  assert.match(generated, /В кризис конкуренция становится всё жёстче и всё меньше прощает ошибки/);
  assert.match(generated, /абсолютное конкурентное преимущество в эпоху перемен/);
  assert.match(generated, /Вы первыми увидите, что делает лидеров первыми\./);
  assert.match(generated, /Здравствуйте, \{\{first_name\}\}! Пока одни обсуждают ИИ, другие уже перестраивают процессы, продукт и команду\./);
  assert.match(generated, /На конференции «ТехнологИИ Права» Вы увидите, как это делают лидеры БФЛ и юридического бизнеса\./);
  assert.match(generated, /ТП Конференция 11 — Сокращение расходов на 50%/);
  assert.match(generated, /Как сократить расходы на почтовые отправления на 50%/);
  assert.match(generated, /более чем на 5 млн рублей в год/);
  assert.match(generated, /25–26 сентября 2026 года/);
  assert.match(database, /conference-production-html-v1/);
  assert.match(database, /conference-production-html-v2-practice-lab/);
  assert.match(database, /conference-production-html-v3-executive-memo/);
  assert.match(database, /conference-production-html-v4-personal-invitation/);
  assert.match(database, /conference-production-html-v5-professional-circle/);
  assert.match(database, /conference-production-html-v6-market-race/);
  assert.match(database, /conference-production-html-v7-company-name/);
  assert.match(database, /conference-production-html-v8-practice-market-copy/);
  assert.match(database, /conference-production-html-v9-personal-invitation-copy/);
  assert.match(database, /conference-production-html-v10-inbox-friendly-personal-invitation/);
  assert.match(database, /conference-production-html-v11-restore-personal-invitation-design/);
  assert.match(database, /conference-production-html-v12-links-and-cost-template/);
  assert.match(database, /runtime-schema-v20-conference-links-cost-template-inline-images/);
  assert.match(database, /template-user-conference-11-cost-reduction/);
  assert.match(database, /isFavorite: true/);
  assert.match(database, /https:\/\/t\.me\/TechPravoAI/);
  assert.match(compiler, /if \(document\.rawHtml\) return document\.rawHtml/);
  assert.match(preview, /srcDoc=\{template\.emailBodyHtml\}/);
  assert.match(personalInvitation, /<img\b/i);
  assert.match(personalInvitation, /Маняша — AI-ассистент конференции/);
  assert.match(personalInvitation, /https:\/\/t\.me\/TechPravoAI/);
});
