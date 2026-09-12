import type { EmailBuilderDocumentInput } from "./api";

export type AiEmailGoal = "sale" | "invite" | "announcement" | "reminder" | "welcome" | "reactivation" | "promo" | "education" | "custom";
export type AiEmailTone = "business" | "friendly" | "premium" | "tech" | "energetic" | "minimal" | "expert";
export type AiEmailBlockType = "header" | "hero" | "text" | "image" | "benefits" | "cards" | "stats" | "speakers" | "products" | "quote" | "review" | "divider" | "urgency" | "cta" | "ps" | "footer" | "spacer" | "pattern";
export type AiEmailAsset = { id: string; filename: string; kind: "logo" | "photo"; url: string };
export type AiEmailBrief = {
  description: string;
  goal: AiEmailGoal;
  audience: string;
  primaryAction: string;
  cta: { text: string; url: string };
  tone: AiEmailTone;
  length: "short" | "medium" | "long";
  designStyle: "auto" | "minimal" | "premium" | "tech" | "bold" | "corporate" | "editorial";
  brand: { name: string; website: string; primaryColor: string; accentColor: string; textColor: string; backgroundColor: string; companyName: string; address: string; privacyUrl: string; socialLinks?: Array<{ label: string; url: string }> };
  requiredContent: string;
  requiredFacts: string[];
  forbiddenClaims: string[];
  deadline: string;
  visuals: "auto" | "image" | "pattern" | "none";
  assets: AiEmailAsset[];
};
export type AiEmailImage = { assetId: string | null; alt: string; prompt: string | null };
export type AiEmailBlock = {
  id: string;
  type: AiEmailBlockType;
  variant: string;
  title: string;
  text: string;
  badge: string;
  items: Array<{ title: string; text: string; value: string; label: string }>;
  button: { text: string; url: string } | null;
  image: AiEmailImage | null;
  backgroundColor: string | null;
  textColor: string | null;
};
export type AiEmailDocument = {
  version: "1.0";
  subject: string;
  preheader: string;
  meta: { goal: AiEmailGoal; language: string; tone: AiEmailTone; length: AiEmailBrief["length"] };
  theme: { emailWidth: number; backgroundColor: string; contentBackgroundColor: string; textColor: string; mutedTextColor: string; primaryColor: string; accentColor: string; borderColor: string; borderRadius: number; fontFamily: "Arial" | "Georgia" | "Verdana" | "Trebuchet MS" };
  blocks: AiEmailBlock[];
};
export type AiEmailReview = {
  score: number | null;
  issues: Array<{ severity: "low" | "medium" | "high"; blockId?: string; message: string; evidence?: string; suggestion?: string; source?: "rule" | "editor" }>;
  suggestions: string[];
  unavailable?: boolean;
  rubricVersion?: "rules-v1";
  fingerprint?: string;
  checkedAt?: string;
  checks?: Array<{ id: string; title: string; status: "pass" | "fail" | "not_checked"; points: number; maximum: number; detail: string }>;
};
export type AiEmailEditorialReview = { findings: Array<{ category: "clarity" | "repetition" | "brief" | "cta"; blockId: string | null; evidence: string; message: string; suggestion: string }> };
export type AiEmailMetadata = { brief: AiEmailBrief; generationId: string; generatedAt: string; model: string; review?: AiEmailReview };
export type AiEmailStudioResponse = { document?: EmailBuilderDocumentInput; review?: AiEmailReview; variants?: Array<{ subject: string; preheader: string }>; changedBlockId?: string; message?: string };
