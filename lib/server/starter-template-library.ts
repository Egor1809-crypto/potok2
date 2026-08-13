import { templates } from "@/data/templates";
import type {
  EmailBuilderBlockInput,
  EmailBuilderDocumentInput,
} from "@/types/api";

import {
  compileEmailDocument,
  emailDocumentPlainText,
  parseEmailBuilderDocument,
} from "./email-document";

const STARTER_EMAIL_TEMPLATE_IDS = new Set(
  templates.map((template) => template.id),
);

export function isStarterEmailTemplateId(id: string): boolean {
  return STARTER_EMAIL_TEMPLATE_IDS.has(id);
}

type BlockStyle = Pick<
  EmailBuilderBlockInput,
  | "paddingTop"
  | "paddingBottom"
  | "backgroundColor"
  | "textColor"
  | "fontSize"
  | "borderRadius"
>;

const BLOCK_STYLES: Record<EmailBuilderBlockInput["type"], BlockStyle> = {
  logo: {
    paddingTop: 28,
    paddingBottom: 14,
    backgroundColor: "transparent",
    textColor: "#1f2937",
    fontSize: 12,
    borderRadius: 0,
  },
  heading: {
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: "transparent",
    textColor: "#111827",
    fontSize: 38,
    borderRadius: 0,
  },
  text: {
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "transparent",
    textColor: "#4b5563",
    fontSize: 15,
    borderRadius: 0,
  },
  image: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#6b7280",
    fontSize: 13,
    borderRadius: 14,
  },
  button: {
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: "transparent",
    textColor: "#ffffff",
    fontSize: 14,
    borderRadius: 9,
  },
  columns: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#374151",
    fontSize: 14,
    borderRadius: 10,
  },
  divider: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#e5e7eb",
    fontSize: 8,
    borderRadius: 0,
  },
  spacer: {
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "transparent",
    textColor: "#ffffff",
    fontSize: 8,
    borderRadius: 0,
  },
  social: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#64748b",
    fontSize: 12,
    borderRadius: 8,
  },
  footer: {
    paddingTop: 22,
    paddingBottom: 28,
    backgroundColor: "transparent",
    textColor: "#8b91a1",
    fontSize: 11,
    borderRadius: 0,
  },
  hero: {
    paddingTop: 34,
    paddingBottom: 34,
    backgroundColor: "#f3f2ff",
    textColor: "#171927",
    fontSize: 34,
    borderRadius: 16,
  },
  quote: {
    paddingTop: 22,
    paddingBottom: 22,
    backgroundColor: "#f8f8fb",
    textColor: "#303447",
    fontSize: 18,
    borderRadius: 12,
  },
  checklist: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#374151",
    fontSize: 15,
    borderRadius: 10,
  },
  stats: {
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#f7f8fc",
    textColor: "#111827",
    fontSize: 14,
    borderRadius: 12,
  },
  product: {
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#f8f8fb",
    textColor: "#1f2937",
    fontSize: 15,
    borderRadius: 14,
  },
  signature: {
    paddingTop: 18,
    paddingBottom: 24,
    backgroundColor: "transparent",
    textColor: "#475569",
    fontSize: 13,
    borderRadius: 10,
  },
  pattern: {
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#f3edff",
    textColor: "#7c3aed",
    fontSize: 18,
    borderRadius: 12,
  },
  banner: { paddingTop: 18, paddingBottom: 18, backgroundColor: "#1f1433", textColor: "#ffffff", fontSize: 16, borderRadius: 14 },
  timeline: { paddingTop: 20, paddingBottom: 20, backgroundColor: "transparent", textColor: "#302938", fontSize: 14, borderRadius: 12 },
  faq: { paddingTop: 18, paddingBottom: 18, backgroundColor: "#f8f6fb", textColor: "#302938", fontSize: 14, borderRadius: 12 },
  coupon: { paddingTop: 20, paddingBottom: 20, backgroundColor: "#f3edff", textColor: "#24182d", fontSize: 18, borderRadius: 14 },
  video: { paddingTop: 18, paddingBottom: 18, backgroundColor: "#17121c", textColor: "#ffffff", fontSize: 15, borderRadius: 14 },
};

export type StarterEmailTemplateValue = {
  id: string;
  name: string;
  nameKey: string;
  description: string;
  category: (typeof templates)[number]["category"];
  subject: string;
  previewText: string;
  builderDocument: EmailBuilderDocumentInput;
  emailBodyHtml: string;
  emailBodyText: string;
  createdAt: string;
  updatedAt: string;
};

export function starterEmailTemplateValues(): StarterEmailTemplateValue[] {
  return templates.map((template) => {
    const rawDocument: EmailBuilderDocumentInput = {
      templateId: template.id,
      subject: template.subject,
      previewText: template.previewText,
      accentColor: template.accentColor,
      bodyBackground: template.bodyBackground ?? "#ffffff",
      workspaceBackground: template.backgroundColor,
      contentWidth: template.contentWidth ?? 640,
      frameStyle: template.frameStyle ?? "none",
      frameColor: template.frameColor ?? template.accentColor,
      frameRadius: template.frameRadius ?? 0,
      blocks: template.blocks.map((block) => ({
        ...BLOCK_STYLES[block.type],
        ...block,
        alignment: block.alignment ?? "left",
      })),
    };
    const builderDocument = parseEmailBuilderDocument(rawDocument);
    if (!builderDocument) {
      throw new Error(`Starter email template ${template.id} is invalid`);
    }
    return {
      id: template.id,
      name: template.name,
      nameKey: template.name.normalize("NFKC").toLocaleLowerCase("ru-RU"),
      description: template.description,
      category: template.category,
      subject: template.subject,
      previewText: template.previewText,
      builderDocument,
      emailBodyHtml: compileEmailDocument(builderDocument),
      emailBodyText: emailDocumentPlainText(builderDocument),
      createdAt: template.updatedAt,
      updatedAt: template.updatedAt,
    };
  });
}
