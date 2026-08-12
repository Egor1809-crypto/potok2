import { env } from "cloudflare:workers";

import type { EmailAiAction, EmailAiRequest, EmailAiResponse, EmailAiSuggestion, EmailBuilderBlockInput } from "@/types/api";

import { ApiRequestError, asObject, cleanText, optionalText } from "./api-utils";
import { ensureDatabase } from "./database-init";
import { parseEmailBuilderDocument } from "./email-document";

const ACTIONS = new Set<EmailAiAction>(["design", "compose", "rewrite", "shorten", "subject", "cta"]);
const TONES = new Set(["business", "friendly", "expert", "concise"]);

function runtime() {
  return env as unknown as {
    NAVYAI_API_KEY?: string;
    NAVYAI_BASE_URL?: string;
    NAVYAI_EMAIL_MODEL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_EMAIL_MODEL?: string;
  };
}

function aiProvider() {
  const navyKey = runtime().NAVYAI_API_KEY?.trim();
  if (navyKey) {
    return {
      key: navyKey,
      provider: "navyai" as const,
      endpoint: `${runtime().NAVYAI_BASE_URL?.trim().replace(/\/$/, "") || "https://api.navy/v1"}/responses`,
      model: runtime().NAVYAI_EMAIL_MODEL?.trim() || "gpt-5.2",
    };
  }
  const openAiKey = runtime().OPENAI_API_KEY?.trim();
  return openAiKey ? {
    key: openAiKey,
    provider: "openai" as const,
    endpoint: "https://api.openai.com/v1/responses",
    model: runtime().OPENAI_EMAIL_MODEL?.trim() || "gpt-5.2",
  } : null;
}

export async function emailAiStatus(request: Request): Promise<EmailAiResponse> {
  await ensureDatabase(request);
  const provider = aiProvider();
  return { configured: Boolean(provider), ...(provider ? { provider: provider.provider } : {}) };
}

function parseRequest(value: unknown): EmailAiRequest {
  const object = asObject(value);
  const action = cleanText(object.action, "Действие", 30) as EmailAiAction;
  if (!ACTIONS.has(action)) throw new ApiRequestError("Выберите действие ИИ-помощника.");
  const tone = optionalText(object.tone, "Тон", 20) ?? "business";
  if (!TONES.has(tone)) throw new ApiRequestError("Выберите допустимый тон письма.");
  const goal = cleanText(object.goal, "Задача письма", 2_000);
  if (goal.length < 8) throw new ApiRequestError("Опишите задачу письма хотя бы в нескольких словах.");
  const availableAssets = Array.isArray(object.availableAssets)
    ? object.availableAssets.slice(0, 30).flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const asset = value as Record<string, unknown>;
        const id = optionalText(asset.id, "Идентификатор изображения", 160);
        const filename = optionalText(asset.filename, "Имя изображения", 300);
        const kind: "logo" | "photo" | undefined = asset.kind === "logo" || asset.kind === "photo" ? asset.kind : undefined;
        const url = optionalText(asset.url, "Ссылка изображения", 2_000);
        return id && filename && kind && url ? [{ id, filename, kind, url }] : [];
      })
    : undefined;
  const websiteUrl = optionalText(object.websiteUrl, "Ссылка кнопки", 2_000);
  if (websiteUrl) {
    try {
      if (new URL(websiteUrl).protocol !== "https:") throw new Error("https required");
    } catch {
      throw new ApiRequestError("Ссылка кнопки должна начинаться с https://");
    }
  }
  return {
    action,
    tone: tone as EmailAiRequest["tone"],
    goal,
    audience: optionalText(object.audience, "Аудитория", 800),
    currentSubject: optionalText(object.currentSubject, "Текущая тема", 300),
    currentPreviewText: optionalText(object.currentPreviewText, "Текущий прехедер", 500),
    currentText: optionalText(object.currentText, "Текущий текст", 8_000),
    websiteUrl,
    availableAssets,
  };
}

async function safetyIdentifier(request: Request) {
  const source = request.headers.get("oai-authenticated-user-id") ?? "mailflow-local-participant";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function outputText(response: unknown): string {
  const object = asObject(response);
  if (typeof object.output_text === "string" && object.output_text.trim()) {
    return object.output_text;
  }
  if (!Array.isArray(object.output)) throw new ApiRequestError("ИИ не вернул результат. Повторите запрос.", 502);
  for (const itemValue of object.output) {
    if (!itemValue || typeof itemValue !== "object") continue;
    const item = itemValue as { type?: unknown; content?: unknown };
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const contentValue of item.content) {
      if (!contentValue || typeof contentValue !== "object") continue;
      const content = contentValue as { type?: unknown; text?: unknown };
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new ApiRequestError("ИИ не вернул текстовый результат. Повторите запрос.", 502);
}

export function parseAiJson(value: string): Record<string, unknown> {
  const normalized = value.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? normalized.slice(firstBrace, lastBrace + 1)
    : normalized;
  try {
    const parsed: unknown = JSON.parse(candidate);
    return asObject(parsed);
  } catch {
    throw new ApiRequestError("ИИ вернул текст вместо структуры письма. Нажмите «Повторить» — ваш макет не изменён.", 502);
  }
}

function blockDefaults(type: EmailBuilderBlockInput["type"]) {
  const visual = ["hero", "quote", "stats", "product"].includes(type);
  return {
    alignment: type === "button" || type === "logo" ? "center" as const : "left" as const,
    paddingTop: type === "hero" ? 34 : 18,
    paddingBottom: type === "hero" ? 34 : 18,
    backgroundColor: visual ? "#f3edff" : "transparent",
    textColor: type === "button" ? "#ffffff" : "#24182d",
    fontSize: type === "heading" || type === "hero" ? 36 : type === "footer" ? 11 : 15,
    borderRadius: visual ? 16 : type === "image" ? 14 : type === "button" ? 10 : 0,
  };
}

function parseSuggestion(value: string, input: EmailAiRequest): EmailAiSuggestion {
  const object = parseAiJson(value);
  const suggestion: EmailAiSuggestion = {
    subject: cleanText(object.subject, "Тема", 300),
    previewText: cleanText(object.previewText, "Прехедер", 500),
    body: cleanText(object.body, "Текст", 8_000),
    cta: cleanText(object.cta, "Призыв к действию", 160),
  };
  if (input.action !== "design") return suggestion;
  const design = asObject(object.design);
  if (!Array.isArray(design.blocks)) throw new ApiRequestError("ИИ не вернул структуру письма. Повторите запрос.", 502);
  const assetById = new Map((input.availableAssets ?? []).map((asset) => [asset.id, asset]));
  const allowedTypes = new Set<EmailBuilderBlockInput["type"]>([
    "logo", "heading", "text", "image", "button", "columns", "divider", "spacer", "social", "footer", "hero", "quote", "checklist", "stats", "product", "signature", "pattern", "banner", "timeline", "faq", "coupon", "video",
  ]);
  const blocks = design.blocks.slice(0, 20).flatMap((value, index) => {
    const raw = asObject(value);
    const type = optionalText(raw.type, `Тип блока ${index + 1}`, 30) as EmailBuilderBlockInput["type"] | undefined;
    if (!type || !allowedTypes.has(type)) return [];
    const assetId = optionalText(raw.assetId, `Изображение блока ${index + 1}`, 160);
    const asset = assetId ? assetById.get(assetId) : undefined;
    if (type === "image" && !asset) return [];
    if (type === "button" && !input.websiteUrl) return [];
    const content = optionalText(raw.content, `Контент блока ${index + 1}`, 20_000) ?? "";
    const label = optionalText(raw.label, `Подпись блока ${index + 1}`, 2_000);
    return [{
      id: `ai-${type}-${crypto.randomUUID()}`,
      type,
      content: content || (asset?.filename ?? ""),
      ...(label ? { label } : {}),
      ...(asset ? { href: asset.url } : type === "button" && input.websiteUrl ? { href: input.websiteUrl } : {}),
      ...blockDefaults(type),
      fontFamily: "Arial" as const,
      fontWeight: type === "heading" || type === "hero" || type === "banner" ? 700 as const : 400 as const,
      lineHeight: type === "heading" || type === "hero" ? 115 : 155,
      letterSpacing: type === "pattern" || type === "logo" ? 2 : 0,
      paddingLeft: 40,
      paddingRight: 40,
      borderWidth: 0,
      borderColor: "#e5e7eb",
      widthPercent: 100,
      buttonStyle: "solid" as const,
    }];
  });
  if (!blocks.some((block) => block.type === "heading" || block.type === "hero")) {
    blocks.unshift({ id: `ai-heading-${crypto.randomUUID()}`, type: "heading", content: suggestion.subject, ...blockDefaults("heading"), fontFamily:"Arial", fontWeight:700, lineHeight:115, letterSpacing:0, paddingLeft:40, paddingRight:40, borderWidth:0, borderColor:"#e5e7eb", widthPercent:100, buttonStyle:"solid" });
  }
  if (!blocks.some((block) => block.type === "text")) {
    blocks.push({ id: `ai-text-${crypto.randomUUID()}`, type: "text", content: suggestion.body, ...blockDefaults("text"), fontFamily:"Arial", fontWeight:400, lineHeight:155, letterSpacing:0, paddingLeft:40, paddingRight:40, borderWidth:0, borderColor:"#e5e7eb", widthPercent:100, buttonStyle:"solid" });
  }
  const parsedDocument = parseEmailBuilderDocument({
    templateId: "",
    subject: suggestion.subject,
    previewText: suggestion.previewText,
    accentColor: cleanText(design.accentColor, "Акцент", 20),
    bodyBackground: cleanText(design.bodyBackground, "Фон письма", 20),
    workspaceBackground: cleanText(design.workspaceBackground, "Внешний фон", 20),
    contentWidth: 640,
    blocks,
  });
  if (!parsedDocument) throw new ApiRequestError("ИИ не собрал макет письма. Повторите запрос.", 502);
  suggestion.document = parsedDocument;
  return suggestion;
}

export async function generateEmailSuggestion(request: Request, value: unknown): Promise<EmailAiResponse> {
  await ensureDatabase(request);
  const provider = aiProvider();
  if (!provider) {
    throw new ApiRequestError("ИИ-помощник ещё не подключён: добавьте серверный ключ NavyAI или OpenAI.", 503);
  }
  const input = parseRequest(value);
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      store: false,
      safety_identifier: await safetyIdentifier(request),
      reasoning: { effort: "low" },
      max_output_tokens: input.action === "design" ? 6_000 : 3_000,
      instructions: input.action === "design"
        ? "Ты арт-директор и редактор деловых email-писем на русском языке. Собери цельное красивое письмо из 6-12 разноплановых структурных блоков. Не создавай HTML: каждый блок передай только через поля JSON-схемы. Пиши конкретно, без выдуманных фактов, обещаний и цифр. Сохраняй только переменные {{first_name}}, {{last_name}}, {{company}}, {{position}}, {{city}}. Уместно используй hero, banner, timeline, faq, coupon, video, pattern и другие блоки. Используй image только с assetId из availableAssets. Не выдумывай ссылки и изображения. Если websiteUrl отсутствует, не добавляй button или video. Цвета строго #RRGGBB. Ответ строго по JSON-схеме."
        : "Ты редактор деловых email-писем на русском языке. Верни только четыре коротких поля JSON: subject, previewText, body, cta. Никакого HTML, Markdown, таблиц, дизайна или пояснений. body — обычный текст до 1800 символов. subject — до 140 символов, previewText — до 240, cta — до 80. Не выдумывай даты, цифры, ссылки и факты. Сохраняй только переменные {{first_name}}, {{last_name}}, {{company}}, {{position}}, {{city}}. Ответ строго по JSON-схеме.",
      input: JSON.stringify(input),
      text: {
        format: {
          type: "json_schema",
          name: "email_suggestion",
          strict: true,
          schema: input.action === "design" ? {
            type: "object",
            additionalProperties: false,
            required: ["subject", "previewText", "body", "cta", "design"],
            properties: {
              subject: { type: "string", maxLength: 140 },
              previewText: { type: "string", maxLength: 240 },
              body: { type: "string", maxLength: 1800 },
              cta: { type: "string", maxLength: 80 },
              design: {
                type: "object",
                additionalProperties: false,
                required: ["accentColor", "bodyBackground", "workspaceBackground", "blocks"],
                properties: {
                  accentColor: { type: "string" },
                  bodyBackground: { type: "string" },
                  workspaceBackground: { type: "string" },
                  blocks: {
                    type: "array",
                    minItems: 1,
                    maxItems: 20,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["type", "content", "label", "assetId"],
                      properties: {
                        type: { type: "string", enum: ["logo", "heading", "text", "image", "button", "columns", "divider", "spacer", "social", "footer", "hero", "quote", "checklist", "stats", "product", "signature", "pattern", "banner", "timeline", "faq", "coupon", "video"] },
                        content: { type: "string" },
                        label: { type: ["string", "null"] },
                        assetId: { type: ["string", "null"] },
                      },
                    },
                  },
                },
              },
            },
          } : {
            type: "object",
            additionalProperties: false,
            required: ["subject", "previewText", "body", "cta"],
            properties: {
              subject: { type: "string" },
              previewText: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
            },
          },
        },
      },
    }),
  });
  const responseBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("OpenAI email assistant error", response.status, responseBody);
    throw new ApiRequestError(response.status === 429 ? "ИИ-помощник занят. Повторите через минуту." : "ИИ-помощник не смог подготовить текст. Повторите попытку.", 502);
  }
  return { configured: true, provider: provider.provider, suggestion: parseSuggestion(outputText(responseBody), input) };
}
