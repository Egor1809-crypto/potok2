import { env } from "cloudflare:workers";

import type { EmailAiAction, EmailAiRequest, EmailAiResponse, EmailAiSuggestion } from "@/types/api";

import { ApiRequestError, asObject, cleanText, optionalText } from "./api-utils";
import { ensureDatabase } from "./database-init";

const ACTIONS = new Set<EmailAiAction>(["compose", "rewrite", "shorten", "subject", "cta"]);
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
  return {
    action,
    tone: tone as EmailAiRequest["tone"],
    goal,
    audience: optionalText(object.audience, "Аудитория", 800),
    currentSubject: optionalText(object.currentSubject, "Текущая тема", 300),
    currentPreviewText: optionalText(object.currentPreviewText, "Текущий прехедер", 500),
    currentText: optionalText(object.currentText, "Текущий текст", 8_000),
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

function parseSuggestion(value: string): EmailAiSuggestion {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new ApiRequestError("ИИ вернул некорректный формат. Повторите запрос.", 502); }
  const object = asObject(parsed);
  return {
    subject: cleanText(object.subject, "Тема", 300),
    previewText: cleanText(object.previewText, "Прехедер", 500),
    body: cleanText(object.body, "Текст", 8_000),
    cta: cleanText(object.cta, "Призыв к действию", 160),
  };
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
      max_output_tokens: 1_200,
      instructions: "Ты редактор деловых email-писем на русском языке. Пиши конкретно, без выдуманных фактов, обещаний и цифр. Сохраняй только поддерживаемые переменные {{first_name}}, {{last_name}}, {{company}}, {{position}}, {{city}}. Не добавляй неподтверждённые сведения. Ответ строго по JSON-схеме.",
      input: JSON.stringify(input),
      text: {
        format: {
          type: "json_schema",
          name: "email_suggestion",
          strict: true,
          schema: {
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
  return { configured: true, suggestion: parseSuggestion(outputText(responseBody)) };
}
