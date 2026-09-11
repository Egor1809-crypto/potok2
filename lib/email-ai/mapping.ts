import type { AiEmailBlock, AiEmailBrief, AiEmailDocument, AiEmailMetadata } from "@/types/email-ai";
import type { EmailBuilderBlockInput, EmailBuilderDocumentInput } from "@/types/api";
import { readableColor } from "@/lib/design-readability";

const join = (...parts: string[]) => parts.filter(Boolean).join("\n\n");
const part = (value: string) => value.replaceAll("|", "¦");

/** The adapter ends the AI format's lifetime: all subsequent edits target builder blocks. */
export function mapAiEmailToBuilderDocument(ai: AiEmailDocument, brief: AiEmailBrief, assets: Map<string, string>, metadata?: AiEmailMetadata): EmailBuilderDocumentInput {
  const theme = ai.theme;
  const blocks: EmailBuilderBlockInput[] = [];
  const reservedIds = new Set(ai.blocks.map(block => block.id));
  const childId = (id: string, suffix: string) => {
    let value = `${id.slice(0, 95)}-${suffix}`; let index = 2;
    while (reservedIds.has(value)) value = `${id.slice(0, 90)}-${suffix}-${index++}`;
    reservedIds.add(value); return value;
  };
  for (const source of ai.blocks) {
    const dark = source.variant.endsWith("-dark");
    const background = source.backgroundColor || (dark ? "#18212D" : theme.contentBackgroundColor);
    const base: EmailBuilderBlockInput = {
      id: source.id, type: "text", aiRole: source.type, variant: source.variant, badge: source.badge, content: join(source.title, source.text),
      alignment: source.variant.includes("centered") ? "center" : "left", paddingTop: 20, paddingBottom: 20, paddingLeft: 36, paddingRight: 36,
      backgroundColor: background, textColor: readableColor(source.textColor || (dark ? "#FFFFFF" : theme.textColor), background), accentColor: theme.primaryColor,
      fontSize: 16, fontFamily: theme.fontFamily, fontWeight: 400, lineHeight: 155, letterSpacing: 0, borderWidth: 0, borderColor: theme.borderColor, borderRadius: theme.borderRadius, widthPercent: 100, buttonStyle: "solid",
    };
    const image = source.image?.assetId ? assets.get(source.image.assetId) : undefined;
    if (source.image && !image) throw new Error("Изображение письма не подготовлено.");
    if (source.type === "header") {
      base.type = "logo"; base.content = brief.brand.name || source.title || source.text; base.fontSize = 18;
      if (image) { base.href = image; base.content = source.image?.alt || base.content; }
      if (brief.brand.website) base.linkHref = brief.brand.website;
    } else if (source.type === "hero") {
      base.type = "hero"; base.content = [source.title, source.text].map(part).join("|"); base.fontSize = 32; base.fontWeight = 700; base.lineHeight = 120; base.paddingTop = 30; base.paddingBottom = 30;
      base.imageHref = image; base.imageAlt = source.image?.alt;
      if (source.button) { base.href = source.button.url; base.label = source.button.text; }
    } else if (["image", "pattern"].includes(source.type)) {
      if (!image) continue;
      base.type = source.type as "image" | "pattern"; base.content = source.image?.alt || ""; base.href = image; base.paddingTop = 8; base.paddingBottom = 8;
    } else if (["benefits", "cards", "speakers", "products"].includes(source.type)) {
      if (source.title) blocks.push({ ...base, id: childId(source.id, "heading"), type: "heading", aiRole: "text", variant: "text-default", content: source.title, fontSize: 24, fontWeight: 700, paddingBottom: 8 });
      if (source.text && source.items.length) blocks.push({ ...base, id: childId(source.id, "intro"), content: source.text, aiRole: "text", variant: "text-default", paddingBottom: 8 });
      base.type = source.variant.endsWith("list") ? "checklist" : "columns";
      base.content = source.items.map(item => part(join(item.title, item.text, item.value, item.label))).join("|");
      if (!base.content) base.content = source.text;
    } else if (source.type === "stats") {
      if (source.title || source.text) blocks.push({ ...base, id: childId(source.id, "intro"), content: join(source.title, source.text), aiRole: "text", variant: "text-default" });
      base.type = "stats"; base.content = source.items.flatMap(item => [part(item.value), part(join(item.label, item.title === item.label ? "" : item.title, item.text))]).join("|");
    } else if (source.type === "quote" || source.type === "review") {
      base.type = "quote"; base.content = [source.text, source.title].map(part).join("|");
    } else if (source.type === "urgency") {
      base.type = "notice"; base.content = [source.badge || "Важно", source.title, source.text].map(part).join("|");
    } else if (source.type === "cta") {
      if (source.button && (source.title || source.text)) blocks.push({ ...base, id: childId(source.id, "intro"), type: "text", aiRole: "text", variant: "text-centered", content: join(source.title, source.text), alignment: "center", paddingBottom: 8 });
      if (source.button) { base.type = "button"; base.content = source.button.text; base.label = source.button.text; base.href = source.button.url; base.textColor = readableColor("#FFFFFF", theme.primaryColor); base.alignment = "center"; }
      else base.content = join(source.title, source.text);
    } else if (source.type === "footer") {
      base.type = "footer"; base.fontSize = 12; base.textColor = readableColor(theme.mutedTextColor, background);
      const company = brief.brand.companyName || brief.brand.name;
      base.content = join(source.title, source.text, source.text.includes(company) ? "" : company, source.text.includes(brief.brand.address) ? "" : brief.brand.address);
      // Links are separately editable blocks; the platform substitutes this existing send token.
      if (brief.brand.website || brief.brand.privacyUrl || brief.brand.socialLinks?.length) blocks.push({ ...base, id: childId(source.id, "links"), type: "social", aiRole: undefined, variant: undefined, content: [brief.brand.website ? `Сайт|${brief.brand.website}` : "", brief.brand.privacyUrl ? `Конфиденциальность|${brief.brand.privacyUrl}` : "", ...(brief.brand.socialLinks || []).map(link => `${part(link.label)}|${link.url}`)].filter(Boolean).join("|") });
    } else if (source.type === "ps") {
      base.content = `P.S. ${join(source.title, source.text).replace(/^P\.?S\.?\s*/i, "")}`;
    } else if (source.type === "spacer" || source.type === "divider") {
      base.type = source.type; base.content = ""; base.paddingTop = source.variant === "spacer-large" ? 24 : 8; base.paddingBottom = base.paddingTop;
      if (source.type === "divider") base.textColor = theme.borderColor;
    }
    if (base.content || ["spacer", "divider", "image", "pattern", "footer"].includes(base.type)) blocks.push(base);
  }
  if (!blocks.length) throw new Error("В письме нет содержимого.");
  return { templateId: "", subject: ai.subject, previewText: ai.preheader, accentColor: theme.primaryColor, bodyBackground: theme.contentBackgroundColor, workspaceBackground: theme.backgroundColor, contentWidth: theme.emailWidth, frameStyle: "none", frameColor: theme.borderColor, frameRadius: theme.borderRadius, blocks, ...(metadata ? { aiMetadata: metadata } : {}) };
}

/** Preserve builder IDs/content in edit context instead of regenerating the source brief. */
export function builderToAiEmail(document: EmailBuilderDocumentInput, brief: AiEmailBrief): { email: AiEmailDocument; assets: Map<string, string> } {
  const assets = new Map<string, string>();
  const blocks: AiEmailBlock[] = document.blocks.map(block => {
    const fallback = ({ logo: "header", heading: "text", button: "cta", columns: "cards", checklist: "benefits", signature: "text", notice: "urgency" } as Record<string, AiEmailBlock["type"]>)[block.type] || (["hero", "image", "pattern", "stats", "quote", "footer", "divider", "spacer"].includes(block.type) ? block.type as AiEmailBlock["type"] : "text");
    const type = block.aiRole || fallback;
    const imageUrl = block.imageHref || (["image", "logo", "pattern"].includes(block.type) ? block.href : undefined);
    const assetId = imageUrl ? `existing-${block.id}` : null;
    if (imageUrl && assetId) assets.set(assetId, imageUrl);
    const parts = block.content.split("|");
    const items = block.type === "stats" ? parts.flatMap((value, index) => index % 2 ? [] : [{ value, label: parts[index + 1] || "", title: "", text: "" }]) : ["columns", "checklist"].includes(block.type) ? parts.map(value => ({ title: "", text: value, value: "", label: "" })) : [];
    return { id: block.id, type, variant: block.variant || defaultVariant(type), title: block.type === "hero" ? parts[0] : block.type === "quote" ? parts[1] || "" : block.type === "notice" ? parts[1] || "" : block.type === "logo" ? block.content : "", text: block.type === "hero" ? parts.slice(1).join("|") : block.type === "quote" ? parts[0] : block.type === "notice" ? parts.slice(2).join("|") : items.length || block.type === "button" ? "" : block.content, badge: block.type === "notice" ? parts[0] : block.badge || "", items, button: (block.type === "button" || block.type === "hero") && block.href ? { text: block.label || block.content, url: block.href } : null, image: assetId ? { assetId, alt: block.imageAlt || block.content, prompt: null } : null, backgroundColor: block.backgroundColor === "transparent" ? null : block.backgroundColor, textColor: block.textColor };
  });
  return { email: { version: "1.0", subject: document.subject, preheader: document.previewText, meta: { goal: brief.goal, language: "ru", tone: brief.tone, length: brief.length }, theme: { emailWidth: Math.max(600, Math.min(680, document.contentWidth)), backgroundColor: document.workspaceBackground, contentBackgroundColor: document.bodyBackground, textColor: "#202632", mutedTextColor: "#667080", primaryColor: document.accentColor, accentColor: document.accentColor, borderColor: document.frameColor || "#E5E7EB", borderRadius: document.frameRadius || 0, fontFamily: document.blocks[0]?.fontFamily || "Arial" }, blocks }, assets };
}

import { emailBlockVariants } from "./variants";
function defaultVariant(type: AiEmailBlock["type"]) { return emailBlockVariants[type][0]; }
