import assert from "node:assert/strict";
import test from "node:test";

import {
  campaignEmailPatchFromTemplate,
  overlayEmailDocumentMetadata,
  patchEmailDocumentMetadata,
  resolveCampaignTemplateId,
  shouldApplyTemplateQuery,
  unlinkEmailTemplateDocument,
} from "../lib/campaign-email-draft.ts";

test("manual subject and preheader edits preserve the visual document", () => {
  const document = {
    subject: "Старая тема",
    previewText: "Старый прехедер",
    blocks: [{ id: "hero", type: "heading", content: "Дизайн" }],
  };
  const patched = patchEmailDocumentMetadata(document, {
    subject: "Новая тема",
    previewText: "Новый прехедер",
  });

  assert.equal(patched?.subject, "Новая тема");
  assert.equal(patched?.previewText, "Новый прехедер");
  assert.equal(patched?.blocks, document.blocks);
  assert.equal(document.subject, "Старая тема");
});

test("explicitly unlinking a template cannot resurrect the previous document id", () => {
  const unlinked = unlinkEmailTemplateDocument({
    templateId: "template-old",
    subject: "Тема",
  });
  assert.equal(unlinked?.templateId, "");
  assert.equal(resolveCampaignTemplateId({
    builderRootTemplateId: null,
    builderDocumentTemplateId: "template-old",
    draftTemplateId: "template-old",
  }), null);
});

test("an already consumed template query does not overwrite recovered edits on reload", () => {
  assert.equal(shouldApplyTemplateQuery("template-legal", null), true);
  assert.equal(shouldApplyTemplateQuery("template-legal", "template-legal"), false);
  assert.equal(shouldApplyTemplateQuery("template-new", "template-legal"), true);
});

test("applying a library template preserves recovered audience and channels", () => {
  const recoveredCampaign = {
    audienceType: "segment",
    segmentId: "segment-legal",
    contactIds: [],
    channels: ["email", "telegram"],
    providers: { email: "unisender", telegram: "telegram-bot-api" },
    campaignName: "Юристы",
  };
  const templatePatch = campaignEmailPatchFromTemplate({
    id: "template-legal",
    subject: "Приглашение",
    previewText: "Важная встреча",
    emailBodyText: "Здравствуйте",
    builderDocument: { blocks: [{ id: "hero", content: "Конференция" }] },
  });
  const roundTrip = { ...recoveredCampaign, ...templatePatch };

  assert.equal(roundTrip.segmentId, "segment-legal");
  assert.deepEqual(roundTrip.channels, ["email", "telegram"]);
  assert.equal(roundTrip.providers.telegram, "telegram-bot-api");
  assert.equal(roundTrip.templateId, "template-legal");
  assert.equal(roundTrip.emailBuilderDocument.blocks[0].content, "Конференция");
});

test("handoff metadata overlays the visual document without replacing blocks", () => {
  const document = {
    subject: "Тема шаблона",
    previewText: "Прехедер шаблона",
    blocks: [{ id: "body", type: "text", content: "Текст" }],
  };
  const overlaid = overlayEmailDocumentMetadata(document, {
    subject: "Тема кампании",
    previewText: "Прехедер кампании",
  });

  assert.equal(overlaid.subject, "Тема кампании");
  assert.equal(overlaid.previewText, "Прехедер кампании");
  assert.equal(overlaid.blocks, document.blocks);
});
