import { emailIconIds } from "@/lib/email-icons";
import type { AiEmailBlock, AiEmailBlockType, AiEmailBrief, AiEmailDocument, AiEmailReview } from "@/types/email-ai";
import { emailBlockVariants } from "./variants";
import { safeEmailUrl } from "./urls";

const goals = ["sale", "invite", "announcement", "reminder", "welcome", "reactivation", "promo", "education", "custom"] as const;
const tones = ["business", "friendly", "premium", "tech", "energetic", "minimal", "expert"] as const;
const lengths = ["short", "medium", "long"] as const;
const fonts = ["Arial", "Georgia", "Verdana", "Trebuchet MS"] as const;
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ожидался документ письма.");
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 5000, optional = false): string {
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string" || value.length > max) throw new Error("Некорректная длина текста письма.");
  return value.trim();
}
function choice<T extends string>(value: unknown, options: readonly T[], fallback?: T): T {
  if (value === undefined && fallback) return fallback;
  if (typeof value !== "string" || !options.includes(value as T)) throw new Error("Неизвестный вариант настройки письма.");
  return value as T;
}
function color(value: unknown, optional = false) {
  const result = string(value, 7, optional);
  if (optional && !result) return "";
  if (!/^#[a-f\d]{6}$/i.test(result)) throw new Error("Цвет должен быть в формате #RRGGBB.");
  return result;
}
function number(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error("Размер элемента письма выходит за допустимые границы.");
  return Math.round(value);
}
function list(value: unknown, max = 20): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error("Слишком много элементов письма или неверный формат списка.");
  return value;
}
function optionalUrl(value: unknown) { const url = string(value, 2000, true); return url ? safeEmailUrl(url) : ""; }

export function parseAiEmailBrief(value: unknown): AiEmailBrief {
  const row = object(value); const brand = object(row.brand ?? {}); const cta = object(row.cta ?? {});
  const description = string(row.description, 12000);
  if (description.length < 8) throw new Error("Опишите задачу письма хотя бы в нескольких словах.");
  return {
    description, goal: choice(row.goal, goals, "custom"), audience: string(row.audience, 1500, true), primaryAction: string(row.primaryAction, 300, true),
    cta: { text: string(cta.text, 100, true), url: optionalUrl(cta.url) },
    tone: choice(row.tone, tones, "expert"), length: choice(row.length, lengths, "medium"),
    designStyle: choice(row.designStyle, ["auto", "minimal", "premium", "tech", "bold", "corporate", "editorial"] as const, "auto"),
    brand: { name: string(brand.name, 150, true), website: optionalUrl(brand.website), primaryColor: color(brand.primaryColor, true), accentColor: color(brand.accentColor, true), textColor: color(brand.textColor, true), backgroundColor: color(brand.backgroundColor, true), companyName: string(brand.companyName, 200, true), address: string(brand.address, 500, true), privacyUrl: optionalUrl(brand.privacyUrl), socialLinks: list(brand.socialLinks ?? [], 8).filter(value => { const link = object(value); return link.label || link.url; }).map(value => { const link = object(value); return { label: string(link.label, 80), url: safeEmailUrl(link.url) }; }) },
    requiredContent: string(row.requiredContent, 5000, true), requiredFacts: list(row.requiredFacts ?? [], 40).map(x => string(x, 1000)), forbiddenClaims: list(row.forbiddenClaims ?? [], 30).map(x => string(x, 1000)), deadline: string(row.deadline, 1000, true),
    visuals: choice(row.visuals, ["auto", "image", "pattern", "none"] as const, "auto"),
    assets: list(row.assets ?? [], 12).map(value => { const asset = object(value); return { id: string(asset.id, 160), filename: string(asset.filename, 300), kind: choice(asset.kind, ["logo", "photo"] as const), url: safeEmailUrl(asset.url, true, process.env.NODE_ENV === "development") }; }),
  };
}

export function parseAiEmailBlock(value: unknown): AiEmailBlock {
  const row = object(value);
  const type = choice(row.type, Object.keys(emailBlockVariants) as AiEmailBlockType[]);
  const id = string(row.id, 120);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Блоку нужен уникальный идентификатор.");
  const variant = choice(row.variant, emailBlockVariants[type]);
  const image = row.image == null ? null : object(row.image);
  const button = row.button == null ? null : object(row.button);
  const result: AiEmailBlock = {
    id, type, variant, title: string(row.title, 500), text: string(row.text, 6000), badge: string(row.badge, 150),
    items: list(row.items, 12).map(value => { const item = object(value); return { title: string(item.title, 300), text: string(item.text, 1500), value: string(item.value, 100), label: string(item.label, 300), iconId: item.iconId == null ? null : choice(item.iconId, emailIconIds) }; }),
    button: button ? { text: string(button.text, 100), url: safeEmailUrl(button.url) } : null,
    image: image ? { assetId: image.assetId == null ? null : string(image.assetId, 160), alt: string(image.alt, 500), prompt: image.prompt == null ? null : string(image.prompt, 800) } : null,
    backgroundColor: row.backgroundColor == null ? null : color(row.backgroundColor), textColor: row.textColor == null ? null : color(row.textColor),
  };
  if (!result.title && !result.text && !result.items.length && !result.image && !result.button && !["header", "footer", "spacer", "divider"].includes(type)) throw new Error("В письме найден пустой блок.");
  if (result.image && !result.image.assetId && !result.image.prompt) throw new Error("Для изображения нужен файл или описание.");
  if (result.button && !result.button.text) throw new Error("У кнопки отсутствует подпись.");
  return result;
}

export function parseAiEmailDocument(value: unknown): AiEmailDocument {
  value = withEmailIconDefaults(value);
  validateEmailSchema(value, aiEmailDocumentSchema);
  const row = object(value); const meta = object(row.meta); const theme = object(row.theme);
  if (row.version !== "1.0" || "rawHtml" in row || "html" in row) throw new Error("ИИ должен вернуть структуру письма, а не HTML.");
  const blocks = list(row.blocks, 24).map(parseAiEmailBlock);
  if (!blocks.length || new Set(blocks.map(b => b.id)).size !== blocks.length) throw new Error("Блоки письма должны иметь уникальные идентификаторы.");
  const subject = string(row.subject, 150); if (!subject) throw new Error("У письма отсутствует тема.");
  return {
    version: "1.0", subject, preheader: string(row.preheader, 250),
    meta: { goal: choice(meta.goal, goals), language: string(meta.language, 20), tone: choice(meta.tone, tones), length: choice(meta.length, lengths) },
    theme: { emailWidth: number(theme.emailWidth, 600, 680), backgroundColor: color(theme.backgroundColor), contentBackgroundColor: color(theme.contentBackgroundColor), textColor: color(theme.textColor), mutedTextColor: color(theme.mutedTextColor), primaryColor: color(theme.primaryColor), accentColor: color(theme.accentColor), borderColor: color(theme.borderColor), borderRadius: number(theme.borderRadius, 0, 24), fontFamily: choice(theme.fontFamily, fonts) }, blocks,
  };
}

export function parseEmailReview(value: unknown): AiEmailReview {
  const row = object(value);
  return { score: row.score === null ? null : number(row.score, 0, 100), issues: list(row.issues, 100).map(value => { const item = object(value); return { severity: choice(item.severity, ["low", "medium", "high"] as const), blockId: string(item.blockId, 160, true) || undefined, message: string(item.message, 800), evidence: string(item.evidence, 800, true) || undefined, suggestion: string(item.suggestion, 800, true) || undefined, source: item.source ? choice(item.source, ["rule", "editor"] as const) : undefined }; }), suggestions: list(row.suggestions, 8).map(x => string(x, 800)), ...(row.unavailable ? { unavailable: true } : {}), ...(row.rubricVersion === "rules-v1" ? { rubricVersion: "rules-v1" as const, fingerprint: string(row.fingerprint, 100), checkedAt: string(row.checkedAt, 100), checks: list(row.checks, 20).map(value => { const c = object(value); return { id: string(c.id, 80), title: string(c.title, 150), status: choice(c.status, ["pass", "fail", "not_checked"] as const), points: number(c.points, 0, 100), maximum: number(c.maximum, 0, 100), detail: string(c.detail, 800) }; }) } : {}) };
}

const text = (maxLength = 5000) => ({ type: "string", maxLength });
const enumeration = (values: readonly string[]) => ({ type: "string", enum: values });
const shape = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const colors = Object.fromEntries(["backgroundColor", "contentBackgroundColor", "textColor", "mutedTextColor", "primaryColor", "accentColor", "borderColor"].map(name => [name, { type: "string", pattern: "^#[a-fA-F0-9]{6}$" }]));
export const aiEmailBlockSchema = shape({ id: text(120), type: enumeration(Object.keys(emailBlockVariants)), variant: enumeration(Object.values(emailBlockVariants).flat()), title: text(500), text: text(6000), badge: text(150), items: { type: "array", maxItems: 12, items: shape({ title: text(300), text: text(1500), value: text(100), label: text(300), iconId: nullable(enumeration(emailIconIds)) }) }, button: nullable(shape({ text: text(100), url: text(2000) })), image: nullable(shape({ assetId: nullable(text(160)), alt: text(500), prompt: nullable(text(800)) })), backgroundColor: nullable(colors.backgroundColor as Record<string, unknown>), textColor: nullable(colors.textColor as Record<string, unknown>) });
export const aiEmailDocumentSchema = shape({ version: { type: "string", const: "1.0" }, subject: text(150), preheader: text(250), meta: shape({ goal: enumeration(goals), language: text(20), tone: enumeration(tones), length: enumeration(lengths) }), theme: shape({ emailWidth: { type: "number", minimum: 600, maximum: 680 }, ...colors, borderRadius: { type: "number", minimum: 0, maximum: 24 }, fontFamily: enumeration(fonts) }), blocks: { type: "array", minItems: 1, maxItems: 24, items: aiEmailBlockSchema } });
export const aiEmailReviewSchema = shape({ findings: { type: "array", maxItems: 6, items: shape({ category: enumeration(["clarity", "repetition", "brief", "cta"]), blockId: nullable(text(160)), evidence: text(400), message: text(600), suggestion: text(600) }) } });
export const subjectVariantsSchema = shape({ variants: { type: "array", minItems: 3, maxItems: 3, items: shape({ subject: text(150), preheader: text(250) }) } });

/** The provider's strict output is still untrusted; validate the same schema locally. */
export function validateEmailSchema(value: unknown, schema: Record<string, unknown>, path = "email"): void {
  const fail = () => { throw new Error(`Ответ ИИ не соответствует схеме в ${path}.`); };
  if (Array.isArray(schema.anyOf)) {
    for (const alternative of schema.anyOf) { try { validateEmailSchema(value, object(alternative), path); return; } catch { /* Try the next permitted type. */ } }
    return fail();
  }
  if ("const" in schema && value !== schema.const) fail();
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) throw new Error(`Поле ${path}: допустимы ${schema.enum.join(", ")}.`);
  if (schema.type === "null") { if (value !== null) fail(); return; }
  if (schema.type === "string") {
    if (typeof value !== "string") return fail();
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) fail();
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) fail();
  } else if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return fail();
    if (typeof schema.minimum === "number" && value < schema.minimum || typeof schema.maximum === "number" && value > schema.maximum) fail();
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return fail();
    if (typeof schema.minItems === "number" && value.length < schema.minItems || typeof schema.maxItems === "number" && value.length > schema.maxItems) fail();
    for (const [index, entry] of value.entries()) validateEmailSchema(entry, object(schema.items), `${path}[${index}]`);
  } else if (schema.type === "object") {
    const row = object(value); const properties = object(schema.properties);
    if (Array.isArray(schema.required)) { const missing = schema.required.filter(key => typeof key === "string" && !Object.hasOwn(row, key)); if (missing.length) throw new Error(`В ${path} отсутствуют обязательные поля: ${missing.join(", ")}.`); }
    if (schema.additionalProperties === false && Object.keys(row).some(key => !(key in properties))) fail();
    for (const [key, item] of Object.entries(row)) if (key in properties) validateEmailSchema(item, object(properties[key]), `${path}.${key}`);
  }
}

/** Older generated items have no icon field; null preserves their appearance. */
export function withEmailIconDefaults(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const row = value as Record<string, unknown>;
  return { ...row, ...(Array.isArray(row.blocks) ? { blocks: row.blocks.map(withEmailIconDefaults) } : {}), ...(Array.isArray(row.items) ? { items: row.items.map(item => item && typeof item === "object" && !Array.isArray(item) ? { iconId: null, ...item } : item) } : {}) };
}
