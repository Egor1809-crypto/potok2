import { env } from "cloudflare:workers";

import type { EmailAiAction, EmailAiRequest, EmailAiResponse, EmailAiSuggestion, EmailBuilderBlockInput } from "@/types/api";

import { ApiRequestError, asObject, cleanText, optionalText } from "./api-utils";
import { ensureDatabase } from "./database-init";
import { parseEmailBuilderDocument } from "./email-document";

const ACTIONS = new Set<EmailAiAction>(["design", "compose", "rewrite", "shorten", "subject", "cta"]);
const TONES = new Set(["business", "friendly", "expert", "concise"]);

function runtime() {
  return env as unknown as { OPENAI_API_KEY?: string; OPENAI_EMAIL_MODEL?: string };
}

export async function emailAiStatus(request: Request): Promise<EmailAiResponse> {
  await ensureDatabase(request);
  return { configured: Boolean(runtime().OPENAI_API_KEY?.trim()) };
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
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new ApiRequestError("ИИ вернул некорректный формат. Повторите запрос.", 502); }
  const object = asObject(parsed);
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
    "logo", "heading", "text", "image", "button", "columns", "divider", "spacer", "social", "footer", "hero", "quote", "checklist", "stats", "product", "signature", "pattern",
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
    }];
  });
  if (!blocks.some((block) => block.type === "heading" || block.type === "hero")) {
    blocks.unshift({ id: `ai-heading-${crypto.randomUUID()}`, type: "heading", content: suggestion.subject, ...blockDefaults("heading") });
  }
  if (!blocks.some((block) => block.type === "text")) {
    blocks.push({ id: `ai-text-${crypto.randomUUID()}`, type: "text", content: suggestion.body, ...blockDefaults("text") });
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
  const apiKey = runtime().OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiRequestError("ИИ-помощник ещё не подключён: добавьте секрет OPENAI_API_KEY в настройках публикации.", 503);
  }
  const input = parseRequest(value);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: runtime().OPENAI_EMAIL_MODEL?.trim() || "gpt-5.6-luna",
      store: false,
      safety_identifier: await safetyIdentifier(request),
      reasoning: { effort: "low" },
      max_output_tokens: input.action === "design" ? 4_000 : 1_200,
      instructions: "Ты арт-директор и редактор деловых email-писем на русском языке. Пиши конкретно, без выдуманных фактов, обещаний и цифр. Сохраняй только переменные {{first_name}}, {{last_name}}, {{company}}, {{position}}, {{city}}. Для design собери цельное красивое письмо из 5-10 разноплановых блоков. Используй image только с assetId из availableAssets, logo может быть текстовым или с assetId. Не выдумывай ссылки и изображения. Если websiteUrl отсутствует, не добавляй button. Цвета строго #RRGGBB. Ответ строго по JSON-схеме.",
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
              subject: { type: "string" },
              previewText: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
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
                        type: { type: "string", enum: ["logo", "heading", "text", "image", "button", "columns", "divider", "spacer", "social", "footer", "hero", "quote", "checklist", "stats", "product", "signature", "pattern"] },
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
  return { configured: true, suggestion: parseSuggestion(outputText(responseBody), input) };
}
