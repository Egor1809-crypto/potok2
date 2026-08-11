export type EmailDocumentMetadata = {
  subject: string;
  previewText: string;
};

export function patchEmailDocumentMetadata<
  Document extends EmailDocumentMetadata,
>(
  document: Document | null,
  patch: Partial<EmailDocumentMetadata>,
): Document | null {
  return document ? { ...document, ...patch } : null;
}

export function overlayEmailDocumentMetadata<
  Document extends EmailDocumentMetadata,
>(
  document: Document,
  draft: Partial<EmailDocumentMetadata>,
): Document {
  return {
    ...document,
    subject: draft.subject ?? document.subject,
    previewText: draft.previewText ?? document.previewText,
  };
}

export function campaignEmailPatchFromTemplate<
  Block extends object,
  Document extends { blocks: Block[] },
>(template: {
  id: string;
  subject: string;
  previewText: string;
  emailBodyText: string;
  builderDocument: Document;
}) {
  return {
    templateId: template.id,
    subject: template.subject,
    previewText: template.previewText,
    emailBodyText: template.emailBodyText,
    emailBuilderDocument: {
      ...template.builderDocument,
      blocks: template.builderDocument.blocks.map((block) => ({ ...block })),
    } as Document,
  };
}

export function unlinkEmailTemplateDocument<
  Document extends { templateId: string },
>(document: Document | null): Document | null {
  return document ? { ...document, templateId: "" } : null;
}

export function resolveCampaignTemplateId(input: {
  builderRootTemplateId?: string | null;
  builderDocumentTemplateId?: string;
  queryTemplateId?: string | null;
  draftTemplateId?: string | null;
}): string | null {
  if (input.builderRootTemplateId !== undefined) {
    return input.builderRootTemplateId || null;
  }
  if (input.builderDocumentTemplateId !== undefined) {
    return input.builderDocumentTemplateId || null;
  }
  if (input.queryTemplateId) return input.queryTemplateId;
  if (input.draftTemplateId !== undefined) return input.draftTemplateId || null;
  return null;
}

export function shouldApplyTemplateQuery(
  queryTemplateId: string | null,
  consumedTemplateQueryId: string | null | undefined,
): boolean {
  return Boolean(queryTemplateId && queryTemplateId !== consumedTemplateQueryId);
}
