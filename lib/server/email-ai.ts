import { env } from "cloudflare:workers";

import type {
  EmailAiAction,
  EmailAiRequest,
  EmailAiResponse,
  EmailAiSuggestion,
  EmailBuilderBlockInput,
} from "@/types/api";

import {
  ApiRequestError,
  asObject,
  cleanText,
  optionalText,
} from "./api-utils";
import { ensureDatabase } from "./database-init";
import {
  decorativePatternFor,
  distributeEditorialBody,
  fallbackEmailImagePrompt,
  normalizeDisplayHeading,
  resolveEmailVisualPalette,
  semanticOverlap,
  type EmailVisualPalette,
} from "./email-art-direction";
import { parseEmailBuilderDocument } from "./email-document";
import {
  storeGeneratedEmailAsset,
  storeGeneratedEmailAssetBytes,
} from "./email-asset-store";

const ACTIONS = new Set<EmailAiAction>([
  "brief",
  "design",
  "compose",
  "rewrite",
  "shorten",
  "subject",
  "cta",
]);
const TONES = new Set(["business", "friendly", "expert", "concise"]);
const EMAIL_TYPES = new Set([
  "informational",
  "welcome",
  "invitation",
  "promotion",
  "event",
  "news",
  "notification",
  "product_update",
  "congratulation",
  "transactional",
] as const);
type EmailType =
  | "informational"
  | "welcome"
  | "invitation"
  | "promotion"
  | "event"
  | "news"
  | "notification"
  | "product_update"
  | "congratulation"
  | "transactional";

function classifyEmailType(value: string): EmailType {
  const text = value.toLocaleLowerCase("ru-RU");
  if (/добро пожаловать|приветствен|онбординг|регистрац.*успеш/.test(text))
    return "welcome";
  if (/приглаш|зарегистрир|вебинар|конференц|встреч/.test(text))
    return /мероприят|вебинар|конференц/.test(text) ? "event" : "invitation";
  if (/скидк|акци|промокод|распродаж|спецпредлож/.test(text))
    return "promotion";
  if (
    /запуск|релиз|нов(?:ая|ого) функц|обновлен.*продукт|product update/.test(
      text,
    )
  )
    return "product_update";
  if (/чек|заказ|оплат|подтвержден|парол|код|доставк/.test(text))
    return "transactional";
  if (/уведом|изменен.*услов|безопасност|важн.*информац/.test(text))
    return "notification";
  if (/поздрав|праздник|юбилей|день рожд/.test(text)) return "congratulation";
  if (/новост|дайджест|итоги недели|обзор/.test(text)) return "news";
  return "informational";
}

function requestedVisualStyle(
  goal: string,
  raw: unknown,
): NonNullable<EmailAiRequest["visualStyle"]> {
  const text = goal.toLocaleLowerCase("ru-RU");
  if (
    /премиаль|премиум|люкс|luxury|дорог|элит|золот|black\s*(?:and|&)\s*gold|ч[её]рн[^\n]{0,40}золот/.test(
      text,
    )
  )
    return "premium";
  if (/ярк|дерзк|bold|неон|контрастн/.test(text)) return "bold";
  if (
    /editorial|редакцион|журнал|газет|постер|брутал|эксперимент|breaking news/.test(
      text,
    )
  )
    return "editorial";
  if (/минимал|minimal|чистый|сдержанн/.test(text)) return "minimal";
  if (
    (["minimal", "editorial", "bold", "premium"] as const).includes(
      raw as never,
    )
  )
    return raw as NonNullable<EmailAiRequest["visualStyle"]>;
  return "minimal";
}

function runtime() {
  return env as unknown as {
    NAVYAI_API_KEY?: string;
    NAVYAI_BASE_URL?: string;
    NAVYAI_EMAIL_MODEL?: string;
    NAVYAI_IMAGE_MODEL?: string;
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
      endpoint: `${runtime().NAVYAI_BASE_URL?.trim().replace(/\/$/, "") || "https://api.navy/v1"}/chat/completions`,
      model: runtime().NAVYAI_EMAIL_MODEL?.trim() || "gpt-5.2",
      fallbackModel: "gemini-2.5-flash-lite",
      imageEndpoint: `${runtime().NAVYAI_BASE_URL?.trim().replace(/\/$/, "") || "https://api.navy/v1"}/images/generations`,
      imageModel: runtime().NAVYAI_IMAGE_MODEL?.trim() || "gpt-image-1.5",
    };
  }
  const openAiKey = runtime().OPENAI_API_KEY?.trim();
  return openAiKey
    ? {
        key: openAiKey,
        provider: "openai" as const,
        endpoint: "https://api.openai.com/v1/responses",
        model: runtime().OPENAI_EMAIL_MODEL?.trim() || "gpt-5.2",
        fallbackModel: undefined,
        imageEndpoint: "https://api.openai.com/v1/images/generations",
        imageModel: "gpt-image-1",
      }
    : null;
}

export async function emailAiStatus(
  request: Request,
): Promise<EmailAiResponse> {
  await ensureDatabase(request);
  const provider = aiProvider();
  return {
    configured: Boolean(provider),
    ...(provider ? { provider: provider.provider } : {}),
  };
}

function parseRequest(value: unknown): EmailAiRequest {
  const object = asObject(value);
  const action = cleanText(object.action, "Действие", 30) as EmailAiAction;
  if (!ACTIONS.has(action))
    throw new ApiRequestError("Выберите действие ИИ-помощника.");
  const tone = optionalText(object.tone, "Тон", 20) ?? "business";
  if (!TONES.has(tone))
    throw new ApiRequestError("Выберите допустимый тон письма.");
  const goal = cleanText(object.goal, "Задача письма", 2_000);
  if (goal.length < 8)
    throw new ApiRequestError(
      "Опишите задачу письма хотя бы в нескольких словах.",
    );
  const availableAssets = Array.isArray(object.availableAssets)
    ? object.availableAssets.slice(0, 30).flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return [];
        const asset = value as Record<string, unknown>;
        const id = optionalText(asset.id, "Идентификатор изображения", 160);
        const filename = optionalText(asset.filename, "Имя изображения", 300);
        const kind: "logo" | "photo" | undefined =
          asset.kind === "logo" || asset.kind === "photo"
            ? asset.kind
            : undefined;
        const url = optionalText(asset.url, "Ссылка изображения", 2_000);
        return id && filename && kind && url
          ? [{ id, filename, kind, url }]
          : [];
      })
    : undefined;
  const briefAnswers = Array.isArray(object.briefAnswers)
    ? object.briefAnswers.slice(0, 8).flatMap((value, index) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return [];
        const row = value as Record<string, unknown>;
        const question = optionalText(
          row.question,
          `Вопрос уточнения ${index + 1}`,
          300,
        );
        const answer = optionalText(
          row.answer,
          `Ответ уточнения ${index + 1}`,
          1_000,
        );
        return question && answer ? [{ question, answer }] : [];
      })
    : undefined;
  const websiteUrl = optionalText(object.websiteUrl, "Ссылка кнопки", 2_000);
  if (websiteUrl) {
    try {
      if (new URL(websiteUrl).protocol !== "https:")
        throw new Error("https required");
    } catch {
      throw new ApiRequestError("Ссылка кнопки должна начинаться с https://");
    }
  }
  const socialLinks = Array.isArray(object.socialLinks)
    ? object.socialLinks.slice(0, 8).flatMap((value, index) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return [];
        const row = value as Record<string, unknown>;
        const label = optionalText(
          row.label,
          `Название социальной сети ${index + 1}`,
          80,
        );
        const url = optionalText(
          row.url,
          `Ссылка социальной сети ${index + 1}`,
          2_000,
        );
        if (!label || !url) return [];
        try {
          if (new URL(url).protocol !== "https:")
            throw new Error("https required");
        } catch {
          throw new ApiRequestError(
            `Ссылка «${label}» должна начинаться с https://`,
          );
        }
        return [{ label, url }];
      })
    : undefined;
  const designBrief = optionalText(
    object.designBrief,
    "Пожелания к дизайну",
    1_500,
  );
  return {
    action,
    tone: tone as EmailAiRequest["tone"],
    goal,
    audience: optionalText(object.audience, "Аудитория", 800),
    currentSubject: optionalText(object.currentSubject, "Текущая тема", 300),
    currentPreviewText: optionalText(
      object.currentPreviewText,
      "Текущий прехедер",
      500,
    ),
    currentText: optionalText(object.currentText, "Текущий текст", 8_000),
    websiteUrl,
    ctaLabel: optionalText(object.ctaLabel, "Текст кнопки", 100),
    designBrief,
    socialLinks,
    primaryColor: optionalText(object.primaryColor, "Основной цвет", 20),
    secondaryColor: optionalText(
      object.secondaryColor,
      "Дополнительный цвет",
      20,
    ),
    brandName: optionalText(object.brandName, "Название бренда", 120),
    includeLogo: object.includeLogo !== false,
    visualStyle: requestedVisualStyle(
      `${goal}\n${designBrief ?? ""}`,
      object.visualStyle,
    ),
    visualContent:
      action === "design"
        ? "image-and-pattern"
        : object.visualContent === "image" ||
            object.visualContent === "pattern" ||
            object.visualContent === "none"
          ? object.visualContent
          : "image-and-pattern",
    imageSource:
      action === "design"
        ? availableAssets?.some((asset) => asset.kind === "photo")
          ? "none"
          : "generate"
        : object.imageSource === "none" || object.imageSource === "generate"
          ? object.imageSource
          : "internet",
    availableAssets,
    briefAnswers,
  };
}

async function safetyIdentifier(request: Request) {
  const source =
    request.headers.get("oai-authenticated-user-id") ??
    "mailflow-local-participant";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function outputText(response: unknown): string {
  const object = asObject(response);
  if (typeof object.output_text === "string" && object.output_text.trim()) {
    return object.output_text;
  }
  if (Array.isArray(object.choices)) {
    for (const choiceValue of object.choices) {
      if (!choiceValue || typeof choiceValue !== "object") continue;
      const choice = choiceValue as { message?: unknown };
      if (!choice.message || typeof choice.message !== "object") continue;
      const message = choice.message as { content?: unknown };
      if (typeof message.content === "string" && message.content.trim())
        return message.content;
    }
  }
  if (!Array.isArray(object.output))
    throw new ApiRequestError("ИИ не вернул результат. Повторите запрос.", 502);
  for (const itemValue of object.output) {
    if (!itemValue || typeof itemValue !== "object") continue;
    const item = itemValue as { type?: unknown; content?: unknown };
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const contentValue of item.content) {
      if (!contentValue || typeof contentValue !== "object") continue;
      const content = contentValue as { type?: unknown; text?: unknown };
      if (content.type === "output_text" && typeof content.text === "string")
        return content.text;
    }
  }
  throw new ApiRequestError(
    "ИИ не вернул текстовый результат. Повторите запрос.",
    502,
  );
}

function fallbackBriefQuestions(goal: string): EmailAiSuggestion {
  const normalized = goal.toLocaleLowerCase("ru-RU");
  const candidates = [
    !/(для кого|аудитор|юрист|руководител|клиент|партн[её]р)/.test(normalized)
      ? {
          id: "audience",
          question:
            "Кто должен получить письмо и что для них сейчас важнее всего?",
          placeholder:
            "Например: управляющие партнёры юридических фирм, которым важно сократить рутину",
          required: true,
        }
      : null,
    !/(цель|регистрац|купить|заказ|ответ|встреч|скачать|перейти)/.test(
      normalized,
    )
      ? {
          id: "action",
          question: "Какое одно действие должен совершить читатель?",
          placeholder: "Зарегистрироваться, ответить, записаться на встречу…",
          required: true,
        }
      : null,
    !/(до \d|срок|дат|сентябр|октябр|ноябр|декабр|январ|феврал|март|апрел|ма[йя]|июн|июл|август)/.test(
      normalized,
    )
      ? {
          id: "timing",
          question: "Есть ли дата, срок или ограничение по времени?",
          placeholder: "Например: регистрация до 20 сентября или срока нет",
          required: false,
        }
      : null,
    {
      id: "offer",
      question: "Какую главную ценность или предложение нужно донести?",
      placeholder:
        "Конкретная польза для получателя — без рекламных общих слов",
      required: true,
    },
    {
      id: "proof",
      question:
        "Какие факты, программа или доказательства должны вызвать доверие?",
      placeholder:
        "Спикеры, программа, кейс, цифра, гарантия — только реальные данные",
      required: false,
    },
    {
      id: "restrictions",
      question: "Что обязательно упомянуть и чего нельзя обещать?",
      placeholder:
        "Юридические ограничения, формулировки, контакты или важные условия",
      required: false,
    },
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 6);
  return {
    subject: "",
    previewText: "",
    body: "",
    cta: "",
    questions: candidates,
  };
}

export function parseAiJson(value: string): Record<string, unknown> {
  const normalized = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  const candidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? normalized.slice(firstBrace, lastBrace + 1)
      : normalized;
  try {
    const parsed: unknown = JSON.parse(candidate);
    return asObject(parsed);
  } catch {
    throw new ApiRequestError(
      "ИИ вернул текст вместо структуры письма. Нажмите «Повторить» — ваш макет не изменён.",
      502,
    );
  }
}

function blockDefaults(type: EmailBuilderBlockInput["type"]) {
  const visual = ["hero", "quote", "stats", "product"].includes(type);
  return {
    alignment:
      type === "button" || type === "logo"
        ? ("center" as const)
        : ("left" as const),
    paddingTop: type === "hero" ? 34 : 18,
    paddingBottom: type === "hero" ? 34 : 18,
    backgroundColor: visual ? "#f3edff" : "transparent",
    textColor: type === "button" ? "#ffffff" : "#24182d",
    fontSize:
      type === "heading" || type === "hero" ? 36 : type === "footer" ? 11 : 15,
    borderRadius: visual
      ? 16
      : type === "image"
        ? 14
        : type === "button"
          ? 10
          : 0,
  };
}

function isDarkColor(value: string): boolean {
  const hex = value.replace("#", "");
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 142;
}

function visibleBlockContent(
  type: EmailBuilderBlockInput["type"],
  value: string,
): string {
  const technicalInstruction =
    /(?:декоративн(?:ый|ая)|паттерн|фон-рамка|accent\s*#|акцент\s*#|насыщенност|отступы увелич|ощущение [«"]?бумаг|цветов(?:ая|ые) плашк|типографик|cta-кнопк|текст белый|стиль письма)/i;
  if (type === "pattern") return "✦  ·  ✦  ·  ✦";
  if (!technicalInstruction.test(value)) return value;
  if (type === "banner") return "Важное сообщение";
  if (type === "heading" || type === "hero") return "Главная идея";
  return "";
}

function modelText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const object = value as Record<string, unknown>;
  for (const key of ["text", "label", "value", "content", "title"]) {
    if (typeof object[key] === "string" && object[key].trim())
      return object[key].trim();
  }
  return undefined;
}

function normalizeCompoundContent(
  type: EmailBuilderBlockInput["type"],
  value: string,
): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("|")) return trimmed;
  const parts = trimmed
    .split(/\n{2,}|(?<=[.!?])\s+(?=[А-ЯA-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (type === "columns") {
    if (parts.length > 1)
      return `${parts.slice(0, Math.ceil(parts.length / 2)).join(" ")}|${parts.slice(Math.ceil(parts.length / 2)).join(" ")}`;
    const words = trimmed.split(/\s+/);
    const midpoint = Math.max(1, Math.ceil(words.length / 2));
    return `${words.slice(0, midpoint).join(" ")}|${words.slice(midpoint).join(" ")}`;
  }
  if (["hero", "banner", "quote", "video"].includes(type) && parts.length > 1)
    return `${parts[0]}|${parts.slice(1).join(" ")}`;
  return trimmed;
}

function creativeBlockStyle(
  type: EmailBuilderBlockInput["type"],
  index: number,
  palette: EmailVisualPalette,
) {
  const defaults = blockDefaults(type);
  const display = [
    "hero",
    "banner",
    "quote",
    "columns",
    "stats",
    "product",
    "coupon",
    "pattern",
    "notice",
    "comparison",
    "document",
    "compliance",
  ].includes(type);
  const centered = [
    "logo",
    "hero",
    "button",
    "stats",
    "coupon",
    "pattern",
  ].includes(type);
  return {
    ...defaults,
    alignment: centered
      ? ("center" as const)
      : index % 4 === 2 && type === "heading"
        ? ("right" as const)
        : ("left" as const),
    paddingTop:
      type === "hero" ? 48 : type === "pattern" ? 12 : display ? 26 : 18,
    paddingBottom:
      type === "hero" ? 48 : type === "pattern" ? 12 : display ? 26 : 18,
    paddingLeft: display ? 34 : 46,
    paddingRight: display ? 34 : 46,
    backgroundColor:
      type === "hero" || type === "banner"
        ? palette.accent
        : type === "pattern" ||
            type === "quote" ||
            type === "stats" ||
            type === "coupon"
          ? palette.soft
          : "transparent",
    textColor:
      type === "hero" || type === "banner" || type === "button"
        ? type === "button"
          ? palette.buttonText
          : isDarkColor(palette.accent)
            ? "#FFFFFF"
            : palette.text
        : ["pattern", "quote", "stats", "coupon"].includes(type)
          ? isDarkColor(palette.soft)
            ? "#FFFFFF"
            : palette.text
          : type === "text" || type === "footer"
            ? palette.muted
            : palette.text,
    fontSize:
      type === "hero"
        ? 42
        : type === "heading"
          ? 34
          : type === "banner"
            ? 19
            : type === "footer"
              ? 11
              : 15,
    borderRadius:
      type === "hero"
        ? 22
        : display || type === "image" || type === "button"
          ? 14
          : 0,
    fontFamily:
      type === "quote" || type === "heading"
        ? ("Georgia" as const)
        : ("Arial" as const),
    fontWeight:
      type === "heading" || type === "hero" || type === "banner"
        ? (700 as const)
        : type === "button"
          ? (600 as const)
          : (400 as const),
    lineHeight: type === "heading" || type === "hero" ? 112 : 155,
    letterSpacing: type === "pattern" ? 8 : type === "logo" ? 2 : 0,
    borderWidth:
      type === "quote" || type === "columns" || type === "coupon" ? 1 : 0,
    borderColor: palette.border,
    widthPercent:
      type === "quote" || type === "columns" || type === "stats"
        ? 92
        : type === "button"
          ? 58
          : 100,
    buttonStyle: "solid" as const,
  };
}

function saasEmailBlockStyle(
  type: EmailBuilderBlockInput["type"],
  palette: EmailVisualPalette,
) {
  const defaults = blockDefaults(type);
  const isCard = [
    "hero",
    "columns",
    "checklist",
    "stats",
    "product",
    "notice",
    "document",
    "compliance",
  ].includes(type);
  const centered = ["logo", "button", "social"].includes(type);
  const heading = type === "heading" || type === "hero";
  return {
    ...defaults,
    alignment: centered ? ("center" as const) : ("left" as const),
    paddingTop:
      type === "logo"
        ? 22
        : type === "pattern"
          ? 10
        : type === "hero"
          ? 12
          : type === "footer"
            ? 12
            : type === "divider"
              ? 12
              : 9,
    paddingBottom:
      type === "logo"
        ? 10
        : type === "pattern"
          ? 10
        : type === "hero"
          ? 18
          : type === "footer"
            ? 24
            : type === "divider"
              ? 12
              : 9,
    paddingLeft: type === "logo" || type === "footer" ? 32 : 36,
    paddingRight: type === "logo" || type === "footer" ? 32 : 36,
    backgroundColor:
      type === "pattern"
        ? palette.patternBackground ?? palette.soft
        : type === "hero"
        ? palette.soft
        : isCard
          ? palette.body
          : "transparent",
    textColor:
      type === "button"
        ? palette.buttonText
      : type === "footer"
          ? palette.muted
          : isDarkColor(palette.body)
            ? palette.text
            : type === "text"
              ? palette.muted
              : type === "pattern"
                ? palette.secondaryAccent ?? palette.accent
                : palette.text,
    fontSize:
      type === "hero"
        ? 30
        : type === "heading"
          ? 24
          : type === "pattern"
            ? 13
          : type === "footer" || type === "social"
            ? 12
            : type === "button"
              ? 15
              : 16,
    borderRadius:
      type === "hero"
        ? 8
        : type === "button"
          ? 8
          : type === "pattern"
            ? 0
          : isCard || type === "image"
            ? 8
            : 0,
    fontFamily: "Arial" as const,
    fontWeight: heading
      ? (700 as const)
      : type === "button"
        ? (600 as const)
        : (400 as const),
    lineHeight: heading ? 128 : type === "footer" ? 155 : 160,
    letterSpacing: type === "pattern" ? 4 : 0,
    borderWidth: [
      "columns",
      "product",
      "notice",
      "document",
      "compliance",
    ].includes(type)
      ? 1
      : 0,
    borderColor: palette.border,
    widthPercent: type === "button" ? 54 : 100,
    buttonStyle: "solid" as const,
    ...(type === "button"
      ? { backgroundColor: "transparent", textColor: "#FFFFFF" }
      : {}),
    ...(type === "divider" ? { textColor: palette.border } : {}),
    ...(type === "hero" ? { borderColor: palette.border } : {}),
  };
}

function premiumEmailBlockStyle(
  type: EmailBuilderBlockInput["type"],
  palette: EmailVisualPalette,
) {
  const cardTypes = new Set<EmailBuilderBlockInput["type"]>([
    "hero",
    "columns",
    "checklist",
    "stats",
    "product",
    "notice",
    "document",
    "compliance",
  ]);
  const base = saasEmailBlockStyle(type, palette);
  const isCard = cardTypes.has(type);
  return {
    ...base,
    backgroundColor:
      type === "hero" ? "#181612" : isCard ? "#1B1915" : "transparent",
    textColor:
      type === "button"
        ? "#11110F"
        : type === "footer"
          ? "#A79E90"
          : type === "divider"
            ? "#574A31"
            : type === "text"
              ? "#D8D1C4"
              : "#F8F2E7",
    borderColor: isCard ? palette.accent : palette.border,
    borderWidth: isCard ? 1 : 0,
    borderRadius:
      type === "hero" ? 20 : type === "button" ? 8 : isCard ? 14 : 0,
    ...(type === "button"
      ? { backgroundColor: "transparent", buttonStyle: "solid" as const }
      : {}),
  };
}

function parseSuggestion(
  value: string,
  input: EmailAiRequest,
): EmailAiSuggestion {
  const parsed = parseAiJson(value);
  const nested = [parsed.suggestion, parsed.email, parsed.result].find(
    (candidate) =>
      candidate && typeof candidate === "object" && !Array.isArray(candidate),
  );
  const object = nested ? asObject(nested) : parsed;
  if (input.action === "brief") {
    const questions = Array.isArray(object.questions)
      ? object.questions.slice(0, 6).flatMap((value, index) => {
          const row = asObject(value);
          const question = optionalText(
            row.question,
            `Вопрос ${index + 1}`,
            300,
          );
          if (!question) return [];
          const id =
            optionalText(row.id, `Ключ вопроса ${index + 1}`, 60) ??
            `question-${index + 1}`;
          const materiallyRequired = /audience|offer|action|cta|goal/i.test(id);
          return [
            {
              id,
              question,
              placeholder:
                optionalText(row.placeholder, `Подсказка ${index + 1}`, 300) ??
                "Введите ответ",
              required: row.required === true || materiallyRequired,
            },
          ];
        })
      : [];
    return { subject: "", previewText: "", body: "", cta: "", questions };
  }
  const subject =
    modelText(object.subject) ??
    modelText(object.title) ??
    input.goal.split(/[.!?\n]/)[0]?.slice(0, 140) ??
    "Новое письмо";
  const body =
    modelText(object.body) ??
    modelText(object.text) ??
    [input.goal, ...(input.briefAnswers ?? []).map((item) => item.answer)]
      .filter(Boolean)
      .join("\n\n");
  const rawEmailType =
    typeof object.emailType === "string" ? object.emailType : "";
  const emailType = EMAIL_TYPES.has(rawEmailType as EmailType)
    ? (rawEmailType as EmailType)
    : classifyEmailType(input.goal);
  const suggestion: EmailAiSuggestion = {
    emailType,
    subject: normalizeDisplayHeading(cleanText(subject, "Тема", 300)),
    previewText: normalizeDisplayHeading(
      cleanText(
        modelText(object.previewText) ?? modelText(object.preheader) ?? subject,
        "Прехедер",
        500,
      ),
    ),
    body: cleanText(body, "Текст", 8_000),
    cta: normalizeDisplayHeading(
      cleanText(
        input.ctaLabel ??
          modelText(object.cta) ??
          modelText(object.callToAction) ??
          "Узнать подробнее",
        "Призыв к действию",
        160,
      ),
    ),
    artDirection:
      typeof object.artDirection === "string"
        ? optionalText(object.artDirection, "Арт-направление", 600)
        : undefined,
    contentStrategy:
      typeof object.contentStrategy === "string"
        ? optionalText(object.contentStrategy, "Стратегия текста", 600)
        : undefined,
  };
  if (input.action !== "design") return suggestion;
  const cleanSaas =
    input.visualStyle !== "editorial" && input.visualStyle !== "bold";
  const premium = input.visualStyle === "premium";
  const wantsPattern =
    input.visualContent === "pattern" ||
    input.visualContent === "image-and-pattern";
  const wantsImage =
    input.visualContent === "image" ||
    input.visualContent === "image-and-pattern";
  const design =
    object.design &&
    typeof object.design === "object" &&
    !Array.isArray(object.design)
      ? asObject(object.design)
      : {};
  const fallbackBlocks: Record<string, unknown>[] = [
    ...(input.includeLogo || input.brandName
      ? [
          {
            type: "logo",
            content: input.brandName || "Компания",
            label: null,
            assetId: null,
            imagePrompt: null,
          },
        ]
      : []),
    {
      type: "hero",
      content: `${suggestion.subject}|${suggestion.previewText}`,
      label: null,
      assetId: null,
      imagePrompt: null,
    },
    {
      type: "text",
      content: suggestion.body,
      label: null,
      assetId: null,
      imagePrompt: null,
    },
    ...(input.websiteUrl
      ? [
          {
            type: "button",
            content: suggestion.cta,
            label: suggestion.cta,
            assetId: null,
            imagePrompt: null,
          },
        ]
      : []),
    ...(input.socialLinks?.length
      ? [
          {
            type: "social",
            content: input.socialLinks
              .flatMap((item) => [item.label, item.url])
              .join("|"),
            label: null,
            assetId: null,
            imagePrompt: null,
          },
        ]
      : []),
    {
      type: "divider",
      content: "",
      label: null,
      assetId: null,
      imagePrompt: null,
    },
    {
      type: "footer",
      content: `${input.brandName || "Поток"} · Настроить подписку · Отписаться`,
      label: null,
      assetId: null,
      imagePrompt: null,
    },
  ];
  const designBlocks =
    Array.isArray(design.blocks) && design.blocks.length
      ? design.blocks
      : fallbackBlocks;
  const assetById = new Map(
    (input.availableAssets ?? []).map((asset) => [asset.id, asset]),
  );
  const palette = resolveEmailVisualPalette({
    goal: input.goal,
    designBrief: input.designBrief,
    visualStyle: input.visualStyle ?? "minimal",
    primaryColor: input.primaryColor,
    modelAccent: design.accentColor,
    modelBody: design.bodyBackground,
    modelWorkspace: design.workspaceBackground ?? input.secondaryColor,
  });
  const accentColor = palette.accent;
  const effectiveBodyBackground = palette.body;
  const workspaceBackground = palette.workspace;
  const styleBlock = (type: EmailBuilderBlockInput["type"]) =>
    premium
      ? premiumEmailBlockStyle(type, palette)
      : saasEmailBlockStyle(type, palette);
  const allowedTypes = new Set<EmailBuilderBlockInput["type"]>([
    "logo",
    "heading",
    "text",
    "image",
    "button",
    "columns",
    "divider",
    "spacer",
    "social",
    "footer",
    "hero",
    "quote",
    "checklist",
    "stats",
    "product",
    "signature",
    "pattern",
    "banner",
    "timeline",
    "faq",
    "coupon",
    "video",
    "notice",
    "comparison",
    "document",
    "compliance",
  ]);
  const plannedImagePrompts: NonNullable<
    EmailAiSuggestion["imagePrompts"]
  > = [];
  const blocks = designBlocks.slice(0, 20).flatMap((value, index) => {
    const raw = asObject(value);
    const rawType = optionalText(raw.type, `Тип блока ${index + 1}`, 30);
    const typeAliases: Record<string, EmailBuilderBlockInput["type"]> = {
      paragraph: "text",
      list: "checklist",
      cta: "button",
      call_to_action: "button",
      title: "heading",
    };
    const type = (rawType ? (typeAliases[rawType] ?? rawType) : undefined) as
      EmailBuilderBlockInput["type"] | undefined;
    const cleanSaasTypes = new Set<EmailBuilderBlockInput["type"]>([
      "logo",
      "hero",
      "heading",
      "text",
      "image",
      "button",
      "columns",
      "divider",
      "spacer",
      "social",
      "footer",
      "checklist",
      "stats",
      "product",
      "notice",
      "document",
      "compliance",
      ...(wantsPattern ||
      /узор|паттерн|контур|геометр|декор/i.test(
        input.designBrief ?? input.goal,
      )
        ? ["pattern" as const]
        : []),
    ]);
    if (
      !type ||
      !allowedTypes.has(type) ||
      (cleanSaas && !cleanSaasTypes.has(type)) ||
      (type === "pattern" && !wantsPattern)
    )
      return [];
    const assetId =
      raw.assetId === null
        ? undefined
        : optionalText(raw.assetId, `Изображение блока ${index + 1}`, 160);
    const asset = assetId ? assetById.get(assetId) : undefined;
    const imagePrompt =
      raw.imagePrompt === null
        ? undefined
        : optionalText(
            raw.imagePrompt,
            `Описание изображения блока ${index + 1}`,
            800,
          );
    if (
      (type === "image" || type === "logo") &&
      !asset &&
      !imagePrompt &&
      !(type === "logo" && input.brandName)
    )
      return [];
    if (type === "button" && !input.websiteUrl) return [];
    const rawContent = normalizeCompoundContent(
      type,
      visibleBlockContent(
        type,
        optionalText(raw.content, `Контент блока ${index + 1}`, 20_000) ?? "",
      ),
    );
    const content = ["hero", "heading", "banner"].includes(type)
      ? normalizeDisplayHeading(rawContent)
      : rawContent;
    if (!content && !asset && type !== "divider" && type !== "spacer")
      return [];
    const label =
      raw.label === null
        ? undefined
        : optionalText(raw.label, `Подпись блока ${index + 1}`, 2_000);
    const blockId = `ai-${type}-${crypto.randomUUID()}`;
    if (imagePrompt && (type === "image" || type === "logo")) {
      plannedImagePrompts.push({
        blockId,
        prompt: imagePrompt,
        alt: content || suggestion.subject,
        kind: type === "logo" ? "logo" : "photo",
      });
    }
    return [
      {
        id: blockId,
        type,
        content: content || (asset?.filename ?? ""),
        ...(label ? { label } : {}),
        ...(asset
          ? { href: asset.url }
          : type === "image" || (type === "logo" && imagePrompt)
            ? { href: "https://placehold.co/1200x675/png" }
            : type === "button" && input.websiteUrl
              ? { href: input.websiteUrl }
              : {}),
        ...(cleanSaas
          ? styleBlock(type)
          : creativeBlockStyle(type, index, palette)),
        ...(["hero", "heading", "banner"].includes(type) && content.length > 90
          ? {
              fontSize:
                type === "banner"
                  ? 17
                  : cleanSaas
                    ? type === "hero"
                      ? 28
                      : 22
                    : 28,
              lineHeight: cleanSaas ? 128 : 120,
            }
          : {}),
      },
    ];
  });
  const usedAssetUrls = new Set(
    blocks.map((block) => block.href).filter(Boolean),
  );
  for (const asset of input.availableAssets ?? []) {
    if (
      usedAssetUrls.has(asset.url) ||
      (asset.kind === "logo" && !input.includeLogo) ||
      (asset.kind === "photo" && !wantsImage)
    )
      continue;
    const type = asset.kind === "logo" ? ("logo" as const) : ("image" as const);
    const assetBlock = {
      id: `ai-${type}-${crypto.randomUUID()}`,
      type,
      content:
        asset.kind === "logo"
          ? asset.filename
          : `Фотография: ${asset.filename}`,
      href: asset.url,
      ...(cleanSaas
        ? styleBlock(type)
        : creativeBlockStyle(type, blocks.length, palette)),
      widthPercent: asset.kind === "logo" ? 44 : 100,
      borderRadius: asset.kind === "logo" ? 0 : 16,
    };
    if (type === "logo") {
      blocks.unshift(assetBlock);
    } else {
      const heroIndex = blocks.findIndex(
        (block) => block.type === "hero" || block.type === "heading",
      );
      blocks.splice(heroIndex >= 0 ? heroIndex + 1 : 0, 0, assetBlock);
    }
    usedAssetUrls.add(asset.url);
  }
  if (cleanSaas && !blocks.some((block) => block.type === "hero")) {
    const hero = {
      id: `ai-hero-${crypto.randomUUID()}`,
      type: "hero" as const,
      content: `${suggestion.subject}|${suggestion.previewText}`,
      ...styleBlock("hero"),
    };
    const logoIndex = blocks.findIndex((block) => block.type === "logo");
    blocks.splice(logoIndex >= 0 ? logoIndex + 1 : 0, 0, hero);
  }
  if (
    !blocks.some((block) => block.type === "heading" || block.type === "hero")
  ) {
    blocks.unshift({
      id: `ai-heading-${crypto.randomUUID()}`,
      type: "heading",
      content: suggestion.subject,
      ...(cleanSaas
        ? styleBlock("heading")
        : creativeBlockStyle("heading", 0, palette)),
    });
  }
  if (
    wantsImage &&
    input.imageSource === "generate" &&
    !blocks.some((block) => block.type === "image")
  ) {
    const blockId = `ai-image-${crypto.randomUUID()}`;
    const imageBlock = {
      id: blockId,
      type: "image" as const,
      content: `Иллюстрация к письму «${suggestion.subject}»`,
      href: "https://placehold.co/1200x675/png",
      ...(cleanSaas
        ? styleBlock("image")
        : creativeBlockStyle("image", blocks.length, palette)),
      widthPercent: 100,
      borderRadius: cleanSaas ? 8 : 14,
    };
    const heroIndex = blocks.findIndex(
      (block) => block.type === "hero" || block.type === "heading",
    );
    blocks.splice(heroIndex >= 0 ? heroIndex + 1 : 0, 0, imageBlock);
    plannedImagePrompts.push({
      blockId,
      prompt: fallbackEmailImagePrompt(
        input.goal,
        suggestion.subject,
        input.visualStyle ?? "minimal",
        palette,
      ),
      alt: imageBlock.content,
      kind: "photo",
    });
  }
  if (wantsPattern) {
    const patternContent = decorativePatternFor(
      `${input.goal}\n${input.designBrief ?? ""}`,
    );
    const existingPattern = blocks.find((block) => block.type === "pattern");
    if (existingPattern) {
      existingPattern.content = patternContent;
      existingPattern.href = undefined;
      Object.assign(
        existingPattern,
        cleanSaas
          ? styleBlock("pattern")
          : creativeBlockStyle("pattern", blocks.indexOf(existingPattern), palette),
      );
    } else {
      const patternBlock = {
        id: `ai-pattern-${crypto.randomUUID()}`,
        type: "pattern" as const,
        content: patternContent,
        ...(cleanSaas
          ? styleBlock("pattern")
          : creativeBlockStyle("pattern", blocks.length, palette)),
      };
      const heroIndex = blocks.findIndex(
        (block) => block.type === "hero" || block.type === "heading",
      );
      blocks.splice(heroIndex >= 0 ? heroIndex + 1 : 0, 0, patternBlock);
    }
  }
  if (!blocks.some((block) => block.type === "text")) {
    blocks.push({
      id: `ai-text-${crypto.randomUUID()}`,
      type: "text",
      content: suggestion.body,
      ...(cleanSaas
        ? styleBlock("text")
        : creativeBlockStyle("text", blocks.length, palette)),
    });
  }
  const primaryHeroIndex = blocks.findIndex((block) => block.type === "hero");
  const firstNarrativeTextIndex = blocks.findIndex(
    (block) => block.type === "text",
  );
  if (primaryHeroIndex >= 0) {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index];
      if (block.type !== "heading") continue;
      const copiedBrief = semanticOverlap(block.content, input.goal) >= 0.55;
      const duplicatedSubject =
        semanticOverlap(block.content, suggestion.subject) >= 0.55;
      const redundantLead =
        index > primaryHeroIndex &&
        firstNarrativeTextIndex >= 0 &&
        index < firstNarrativeTextIndex;
      if (copiedBrief || duplicatedSubject || redundantLead)
        blocks.splice(index, 1);
    }
  }
  if (cleanSaas) {
    let buttonSeen = false;
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      if (blocks[index].type !== "button") continue;
      if (!buttonSeen) buttonSeen = true;
      else blocks.splice(index, 1);
    }
    if (input.websiteUrl && !buttonSeen) {
      const textIndex = blocks.findIndex((block) => block.type === "text");
      blocks.splice(textIndex >= 0 ? textIndex + 1 : blocks.length, 0, {
        id: `ai-button-${crypto.randomUUID()}`,
        type: "button",
        content: suggestion.cta,
        label: suggestion.cta,
        href: input.websiteUrl,
        ...styleBlock("button"),
      });
    }
    if (input.websiteUrl) {
      const button = blocks.find((block) => block.type === "button");
      if (button) {
        button.content = input.ctaLabel || suggestion.cta;
        button.label = input.ctaLabel || suggestion.cta;
        button.href = input.websiteUrl;
      }
    }
    if (input.socialLinks?.length) {
      for (let index = blocks.length - 1; index >= 0; index -= 1)
        if (blocks[index].type === "social") blocks.splice(index, 1);
      const buttonIndex = blocks.findIndex((block) => block.type === "button");
      const boundaryIndex = blocks.findIndex(
        (block) => block.type === "divider" || block.type === "footer",
      );
      blocks.splice(
        buttonIndex >= 0
          ? buttonIndex + 1
          : boundaryIndex >= 0
            ? boundaryIndex
            : blocks.length,
        0,
        {
          id: `ai-social-${crypto.randomUUID()}`,
          type: "social",
          content: input.socialLinks
            .flatMap((item) => [item.label, item.url])
            .join("|"),
          ...styleBlock("social"),
        },
      );
    }
    if (!blocks.some((block) => block.type === "divider")) {
      const footerIndex = blocks.findIndex((block) => block.type === "footer");
      blocks.splice(footerIndex >= 0 ? footerIndex : blocks.length, 0, {
        id: `ai-divider-${crypto.randomUUID()}`,
        type: "divider",
        content: "",
        ...styleBlock("divider"),
      });
    }
    if (!blocks.some((block) => block.type === "footer")) {
      blocks.push({
        id: `ai-footer-${crypto.randomUUID()}`,
        type: "footer",
        content: `${input.brandName || "Компания"} · Вы получили письмо, потому что подписаны на обновления · Отписаться`,
        ...styleBlock("footer"),
      });
    }
  }
  const expressiveTypes = new Set([
    "hero",
    "banner",
    "pattern",
    "quote",
    "columns",
    "stats",
    "coupon",
    "product",
    "notice",
    "comparison",
    "document",
    "compliance",
  ]);
  if (
    cleanSaas
      ? blocks.length < 4 ||
        !blocks.some((block) => block.type === "hero") ||
        !blocks.some((block) => block.type === "text") ||
        !blocks.some((block) => block.type === "footer")
      : blocks.length < 5 ||
        blocks.filter((block) => expressiveTypes.has(block.type)).length < 2
  ) {
    throw new ApiRequestError(
      "ИИ подготовил слишком простой макет. Нажмите «Создать дизайнерскую редакцию» ещё раз — исходное письмо не изменено.",
      502,
    );
  }
  const parsedDocument = parseEmailBuilderDocument({
    templateId: "",
    subject: suggestion.subject,
    previewText: suggestion.previewText,
    accentColor,
    bodyBackground: effectiveBodyBackground,
    workspaceBackground,
    contentWidth: cleanSaas ? 620 : 640,
    frameStyle: cleanSaas ? "hairline" : "none",
    frameColor: premium ? accentColor : palette.border,
    frameRadius: cleanSaas ? 8 : 0,
    blocks,
  });
  if (!parsedDocument)
    throw new ApiRequestError(
      "ИИ не собрал макет письма. Повторите запрос.",
      502,
    );
  suggestion.document = parsedDocument;
  suggestion.artDirection ??=
    `${palette.name}: ${input.visualStyle ?? "minimal"}, акцент ${palette.accent}${palette.secondaryAccent ? ` и ${palette.secondaryAccent}` : ""}, тематическое изображение и один спокойный узор. Типографика, интервалы и декоративные роли собраны в единую email-safe систему.`;
  suggestion.contentStrategy ??=
    "Один главный тезис, короткое объяснение ценности, только подтверждённые факты и одно целевое действие без повторов исходного брифа.";
  suggestion.imagePrompts = plannedImagePrompts.filter(
    (planned) =>
      (planned.kind === "logo" || input.imageSource !== "none") &&
      parsedDocument.blocks.some((block) => block.id === planned.blockId),
  );
  return suggestion;
}

function applyEditorialCopy(
  suggestion: EmailAiSuggestion,
  copy?: EmailAiSuggestion,
  input?: EmailAiRequest,
) {
  if (!copy || !suggestion.document) return suggestion;
  const subject = normalizeDisplayHeading(copy.subject);
  const previewText = normalizeDisplayHeading(copy.previewText);
  const bodyCopy = copy.body
    .split("\n")
    .map((line) => normalizeDisplayHeading(line))
    .join("\n");
  const cta = normalizeDisplayHeading(copy.cta);
  suggestion.subject = subject;
  suggestion.previewText = previewText;
  suggestion.body = bodyCopy;
  suggestion.cta = cta;
  suggestion.document.subject = subject;
  suggestion.document.previewText = previewText;
  const hero = suggestion.document.blocks.find(
    (block) => block.type === "hero" || block.type === "heading",
  );
  if (hero)
    hero.content =
      hero.type === "hero"
        ? `${subject}|${previewText}`
        : subject;

  for (const block of suggestion.document.blocks) {
    if (["hero", "heading", "banner"].includes(block.type))
      block.content = normalizeDisplayHeading(block.content);
    if (block.type === "image")
      block.content = `Иллюстрация к письму «${subject}»`;
  }

  if (hero?.type === "hero") {
    const heroIndex = suggestion.document.blocks.indexOf(hero);
    const firstTextIndex = suggestion.document.blocks.findIndex(
      (block) => block.type === "text",
    );
    suggestion.document.blocks = suggestion.document.blocks.filter(
      (block, index) => {
        if (block.type !== "heading") return true;
        const duplicatedSubject = semanticOverlap(block.content, subject) >= 0.55;
        const copiedBrief = input
          ? semanticOverlap(block.content, input.goal) >= 0.55
          : false;
        const redundantLead =
          index > heroIndex &&
          firstTextIndex >= 0 &&
          index < firstTextIndex;
        return !(duplicatedSubject || copiedBrief || redundantLead);
      },
    );
  }

  const textBlocks = suggestion.document.blocks.filter(
    (block) => block.type === "text",
  );
  const bodyParts = distributeEditorialBody(bodyCopy, textBlocks.length);
  textBlocks.forEach((block, index) => {
    if (bodyParts[index]) block.content = bodyParts[index];
  });
  if (textBlocks.length > bodyParts.length) {
    const redundantIds = new Set(
      textBlocks.slice(bodyParts.length).map((block) => block.id),
    );
    suggestion.document.blocks = suggestion.document.blocks.filter(
      (block) => !redundantIds.has(block.id),
    );
  }
  const button = suggestion.document.blocks.find(
    (block) => block.type === "button",
  );
  if (button) {
    button.content = cta;
    button.label = cta;
  }
  return suggestion;
}

async function createEditorialCopy(
  request: Request,
  selected: NonNullable<ReturnType<typeof aiProvider>>,
  input: EmailAiRequest,
  linkedContext: string[],
) {
  const emailType = classifyEmailType(input.goal);
  const lengthRule =
    emailType === "invitation" || emailType === "congratulation"
      ? "body — 300–850 знаков и 2–4 коротких абзаца"
      : emailType === "transactional" || emailType === "notification"
        ? "body — 350–1000 знаков и 2–5 коротких абзацев"
        : "body — 650–1500 знаков и 3–6 коротких абзацев";
  const instructions = `Ты — сильный русскоязычный редактор email-писем. Самостоятельно напиши готовое письмо по задаче пользователя. Ответы на уточнения — это сырьё и ограничения, а не текст для копирования: не перечисляй их, не склеивай дословно и не превращай ответ пользователя в заголовок. Переформулируй задачу как автор, а не как форма-анкета. Преврати исходные данные в связное убедительное повествование с естественными переходами. Структура: конкретный заход для получателя → понятная польза → детали или доказательство → одно действие. Запрещены канцелярит и пустые заходы «в современном мире», «не остаётся в стороне», «рады сообщить», «уникальная возможность», «настоящим письмом», «новый уровень», «откройте для себя», «не упустите возможность», «инновационное решение». Первый абзац сразу говорит о ситуации получателя или сути предложения. Не используй рекламные клише, метакомментарии, риторические вопросы для эффекта и инструкции дизайнеру. Чередуй длину предложений естественно, но не имитируй разговорность междометиями. Допустимы только факты пользователя и общеизвестные связующие формулировки; не выдумывай цифры, клиентов и обещания. Каждый заголовок и каждое предложение начинаются с прописной буквы; соблюдай русскую орфографию и пунктуацию. ${lengthRule}. subject до 90 знаков, previewText до 160, cta до 55. Верни только JSON с subject, previewText, body, cta.`;
  const modelInput = {
    userTask: input.goal,
    audience: input.audience,
    sourceNotes: input.briefAnswers,
    verifiedWebsiteContext: linkedContext.filter(Boolean),
    desiredLink: input.websiteUrl,
    desiredCtaLabel: input.ctaLabel,
    tone: input.tone,
  };
  const body =
    selected.provider === "navyai"
      ? {
          model: selected.model,
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: JSON.stringify(modelInput) },
          ],
          max_tokens: 2_400,
          response_format: { type: "json_object" },
        }
      : {
          model: selected.model,
          store: false,
          safety_identifier: await safetyIdentifier(request),
          reasoning: { effort: "medium" },
          max_output_tokens: 2_400,
          instructions,
          input: JSON.stringify(modelInput),
          text: {
            format: {
              type: "json_schema",
              name: "email_copy",
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
        };
  try {
    let response = await fetch(selected.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${selected.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    let responseBody: unknown = await response.json().catch(() => null);
    if (
      !response.ok &&
      selected.provider === "navyai" &&
      selected.fallbackModel &&
      selected.model !== selected.fallbackModel
    ) {
      response = await fetch(selected.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${selected.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, model: selected.fallbackModel }),
        signal: AbortSignal.timeout(45_000),
      });
      responseBody = await response.json().catch(() => null);
    }
    if (!response.ok) return undefined;
    return parseSuggestion(outputText(responseBody), {
      ...input,
      action: "compose",
    });
  } catch {
    return undefined;
  }
}

async function generateDesignImages(
  request: Request,
  provider: NonNullable<ReturnType<typeof aiProvider>>,
  suggestion: EmailAiSuggestion,
  onlyLogos = false,
) {
  if (!suggestion.document || !suggestion.imagePrompts?.length)
    return suggestion;
  const prompts = onlyLogos
    ? suggestion.imagePrompts.filter((item) => item.kind === "logo")
    : suggestion.imagePrompts;
  for (const image of prompts.slice(0, 3)) {
    const block = suggestion.document.blocks.find(
      (item) => item.id === image.blockId,
    );
    try {
      const response = await fetch(
        provider.imageEndpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: provider.imageModel,
            prompt:
              image.kind === "logo"
                ? `${image.prompt}. Чистый профессиональный логотип на однотонном светлом фоне, без макета сайта, без водяных знаков.`
                : `${image.prompt}. Законченное оригинальное изображение, без текста, логотипа, интерфейса и водяных знаков.`,
            size: "1536x1024",
            quality: "high",
            n: 1,
          }),
          signal: AbortSignal.timeout(60_000),
        },
      );
      const body = asObject(await response.json());
      const data = Array.isArray(body.data) ? body.data : [];
      const first =
        data[0] && typeof data[0] === "object"
          ? (data[0] as Record<string, unknown>)
          : null;
      if (!response.ok || !block || !first)
        throw new Error("Image generation failed");
      const filename =
        image.kind === "logo"
          ? "Логотип, созданный ИИ"
          : "Тематическая иллюстрация, созданная ИИ";
      const stored =
        typeof first.url === "string" && first.url.startsWith("https://")
          ? await storeGeneratedEmailAsset(
              request,
              first.url,
              image.kind,
              filename,
            )
          : typeof first.b64_json === "string" && first.b64_json.length > 100
            ? await storeGeneratedEmailAssetBytes(
                request,
                Uint8Array.from(atob(first.b64_json), (character) =>
                  character.charCodeAt(0),
                ),
                "image/png",
                image.kind,
                filename,
              )
            : null;
      if (!stored) throw new Error("Image provider returned no file");
      block.href = stored.url;
    } catch (error) {
      console.warn(
        "Email AI visual generation failed",
        error instanceof Error ? error.message : "unknown error",
      );
      // Never leave an expiring provider URL or placeholder in a finished email.
      if (block)
        suggestion.document.blocks = suggestion.document.blocks.filter(
          (item) => item.id !== block.id,
        );
    }
  }
  return suggestion;
}

async function findInternetImages(suggestion: EmailAiSuggestion) {
  if (!suggestion.document || !suggestion.imagePrompts?.length)
    return suggestion;
  const used = new Set<string>();
  for (const image of suggestion.imagePrompts
    .filter((item) => item.kind === "photo")
    .slice(0, 2)) {
    try {
      const prompt = image.prompt.toLowerCase();
      const conciseQuery = prompt.includes("conference")
        ? "modern technology conference auditorium"
        : prompt.includes("laptop")
          ? "modern laptop office technology"
          : image.prompt
              .replace(/#[\da-f]{6}/gi, "")
              .split(/[,.]/)[0]
              ?.trim()
              .split(/\s+/)
              .slice(0, 6)
              .join(" ") || image.alt;
      const candidate =
        (await searchCommonsImage(conciseQuery, used)) ??
        (await searchCommonsImage(image.alt, used));
      const block = suggestion.document.blocks.find(
        (item) => item.id === image.blockId,
      );
      if (block && candidate) {
        block.href = candidate;
        used.add(candidate);
      }
    } catch {
      // Keep the complete design if public image search is unavailable.
    }
  }
  return suggestion;
}

async function searchCommonsImage(search: string, used: Set<string>) {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.search = new URLSearchParams({
    q: search,
    license_type: "commercial",
    aspect_ratio: "wide",
    mature: "false",
    page_size: "20",
  }).toString();
  const response = await fetch(url, {
    headers: { "User-Agent": "Поток/1.0 (info@tech-pravo.ru)" },
  });
  if (!response.ok) return undefined;
  const body = asObject(await response.json());
  const results = Array.isArray(body.results) ? body.results : [];
  return results.flatMap((value) => {
    const row = asObject(value);
    const width = typeof row.width === "number" ? row.width : 0;
    const height = typeof row.height === "number" ? row.height : 0;
    const imageUrl = typeof row.url === "string" ? row.url : "";
    if (
      !imageUrl.startsWith("https://") ||
      used.has(imageUrl) ||
      width < 900 ||
      height < 450 ||
      width / Math.max(height, 1) < 1.25
    )
      return [];
    return [imageUrl];
  })[0];
}

function emailDesignInstructions(input: EmailAiRequest) {
  const premium = input.visualStyle === "premium";
  const wantsPattern =
    input.visualContent === "pattern" ||
    input.visualContent === "image-and-pattern";
  const requestedPalette = resolveEmailVisualPalette({
    goal: input.goal,
    designBrief: input.designBrief,
    visualStyle: input.visualStyle ?? "minimal",
    primaryColor: input.primaryColor,
  });
  const layoutRule =
    input.visualStyle === "editorial"
      ? "Арт-направление — редакционная колонка: тёплая бумага или белое поле, один киноварный/чернильный акцент, заголовок Georgia, основной текст Arial, тонкие линии и почти без скруглений. Композиция должна напоминать хорошо отредактированное письмо от человека: logo → короткий heading или компактный hero → 1–2 текстовых блока → одно доказательство при наличии фактов → одна CTA → подпись или footer. Не собирай витрину из одинаковых карточек."
      : input.visualStyle === "premium"
        ? "Арт-направление — quiet luxury: почти чёрная основа, тёплое золото, кремовый текст, Georgia в заголовке, тонкие рамки и умеренные отступы. Премиальность создают пропорции и тишина. Структура: маленький logo → компактный hero → короткий текст → не более одного доказательства → одна CTA → footer."
        : input.visualStyle === "bold"
          ? "Арт-направление — выразительный выпуск: один высокий контраст, одна неожиданная композиционная пауза и сильный заголовок, но не постер. Структура остаётся короткой и email-safe: logo → hero → смысл → доказательство → одна CTA → footer. Не используй одновременно banner, pattern и coupon."
          : `Арт-направление — чистый минимализм: спокойное поле, точная тёмная типографика, все явно запрошенные цветовые акценты из брифа, прямые линии и радиусы не больше 8px. Структура: маленький logo/header (только при наличии логотипа или названия бренда) → компактный hero или heading → короткие абзацы → ровно одна CTA при наличии ссылки → divider → компактный footer. Допустимы только 1–2 функциональных блока, если они действительно нужны сценарию: columns, checklist, stats, product, notice, document или compliance. ${wantsPattern ? "Добавь один тонкий pattern-блок как визуальную паузу." : "Не используй banner, quote, coupon, timeline, faq или video по умолчанию."} Hero не должен занимать большую часть письма.`;
  const assetRule = input.includeLogo
    ? "Каждый asset kind=logo обязательно помести отдельным маленьким logo-блоком с его assetId."
    : "Не добавляй logo без реального ассета или названия бренда.";
  const imageRule = (input.availableAssets ?? []).some(
    (asset) => asset.kind === "photo",
  )
    ? "Каждую загруженную фотографию обязательно помести отдельным компактным image-блоком с её assetId."
    : input.imageSource === "generate"
      ? "Обязательно добавь ровно один компактный image-блок и предметный imagePrompt без текста на изображении. Изображение должно раскрывать тему письма, а не быть абстрактной заглушкой."
      : "Не добавляй image.";
  const paletteRule = `Обязательная палитра уже извлечена из пожеланий пользователя: ${requestedPalette.name}; основной акцент ${requestedPalette.accent}${requestedPalette.secondaryAccent ? `, второй обязательный акцент ${requestedPalette.secondaryAccent}` : ""}, мягкий фон ${requestedPalette.soft}, фон письма ${requestedPalette.body}, внешний фон ${requestedPalette.workspace}, основной текст ${requestedPalette.text}. Не заменяй явно запрошенный цвет стандартным голубым или фиолетовым. Если запрошено два цвета, не выбрасывай второй и используй оба в разных визуальных ролях. ${premium ? "Премиальность создают контраст, точная типографика, тонкая рамка и ритм — не огромные заголовки и не декоративная перегрузка." : "Минимализм означает меньше элементов, а не отсутствие арт-дирекции."}`;
  const patternRule = wantsPattern
    ? `Добавь ровно один узкий pattern-блок. Его видимый content: «${decorativePatternFor(`${input.goal}\n${input.designBrief ?? ""}`)}». Он должен работать как спокойный орнамент и использовать цвета палитры.`
    : "Не добавляй pattern.";
  return `Ты senior email designer и редактор профессиональных маркетинговых писем на русском языке. Проектируй именно HTML EMAIL для Gmail, Outlook и Apple Mail — не лендинг, не презентацию, не постер, не журнальную страницу и не новостной сайт. Не копируй узнаваемый интерфейс или стиль конкретного сервиса. authoritativeUserBrief задаёт тему и ограничения, а briefAnswers — только сырьё: нельзя копировать их списком или склеивать дословно. approvedEditorialCopy — утверждённая редакция темы, прехедера, основного текста и действия; сохрани её смысл. detectedEmailType — уже определённый сценарий письма, верни его как emailType и подбери композицию внутри одной email-дизайн-системы.

${layoutRule}

Типографика: не более двух семейств — Arial/Helvetica для текста, Georgia допустима только для editorial/premium заголовка; H1 не более 34px, H2 20–26px, текст 15–17px, footer 12–14px; letter-spacing 0 кроме маленького логотипа. ${paletteRule} Отступы 24–40px. Радиусы подчиняются выбранному арт-направлению, а не назначаются каждому блоку случайно. Всего обычно 5–9 блоков.

Пожелания пользователя к оформлению находятся в designBrief и обязательны, пока не нарушают совместимость email. Текст, ссылка кнопки и socialLinks являются точными данными: не переименовывай и не выдумывай их. Запрещены giant headlines, breaking news, декоративные номера, uppercase-плашки, красные рамки, большие пустоты, полноэкранный hero, aggressive typography, журнальная сетка, стеклянные карточки, градиент по умолчанию, одинаковые скруглённые карточки на каждом шаге, производственные комментарии, названия блоков и HEX-коды в видимом тексте. Не дублируй subject одновременно в hero и heading. Не превращай ответы briefAnswers и формулировку задачи в видимые заголовки дословно. Все заголовки начинай с прописной буквы. Длинные тексты всегда выравнивай влево. artDirection и contentStrategy опиши отдельно и конкретно. Составные блоки кодируй через вертикальную черту: hero — заголовок|пояснение, columns — две части, stats — число|подпись|число|подпись, product/document/compliance/notice — три части. Не создавай HTML: сервер сам соберёт table-based inline-CSS email. ${assetRule} ${imageRule} ${patternRule} Не выдумывай факты, даты и цифры. Сохраняй только переменные {{first_name}}, {{last_name}}, {{company}}, {{position}}, {{city}}. Если websiteUrl отсутствует, не добавляй button, document или compliance. Цвета — только #RRGGBB. Ответ строго по JSON-схеме.`;
}

export async function generateEmailSuggestion(
  request: Request,
  value: unknown,
): Promise<EmailAiResponse> {
  await ensureDatabase(request);
  const provider = aiProvider();
  if (!provider) {
    throw new ApiRequestError(
      "ИИ-помощник ещё не подключён: добавьте серверный ключ NavyAI или OpenAI.",
      503,
    );
  }
  const input = parseRequest(value);
  const detectedEmailType = classifyEmailType(input.goal);
  const urls = input.goal.match(/https:\/\/[^\s]+/g) ?? [];
  const linkedContext = await Promise.all(
    urls.slice(0, 2).map(async (url) => {
      try {
        const response = await fetch(url, {
          redirect: "follow",
          headers: { "User-Agent": "Поток/1.0" },
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("text/html")
        )
          return "";
        return (await response.text())
          .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 10_000);
      } catch {
        return "";
      }
    }),
  );
  const editorialCopy =
    input.action === "design"
      ? await createEditorialCopy(request, provider, input, linkedContext)
      : undefined;
  const modelInput = {
    authoritativeUserBrief: {
      goal: input.goal,
      briefAnswers: input.briefAnswers,
      websiteUrl: input.websiteUrl,
      ctaLabel: input.ctaLabel,
      designBrief: input.designBrief,
      visualContent: input.visualContent,
      socialLinks: input.socialLinks,
      availableAssets: input.availableAssets,
    },
    linkedPageReference: linkedContext.filter(Boolean),
    approvedEditorialCopy: editorialCopy
      ? {
          subject: editorialCopy.subject,
          previewText: editorialCopy.previewText,
          body: editorialCopy.body,
          cta: editorialCopy.cta,
        }
      : undefined,
    detectedEmailType,
    designPreferences: {
      visualStyle: input.visualStyle,
      visualContent: input.visualContent,
      imageSource: input.imageSource,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      designBrief: input.designBrief,
    },
  };
  const instructions =
    input.action === "brief"
      ? "Ты продуктовый стратег. authoritativeUserBrief — главный источник задачи. linkedPageReference служит только справочником для проверки бренда и фактов и никогда не меняет тему, аудиторию, оффер или цель пользователя. Задавай 4–6 конкретных вопросов только о недостающем смысле: аудитория, обещание/оффер, доказательство, обязательные факты, срок и главное действие. Не спрашивай цвета, палитру или визуальный стиль — пользователь пишет их в исходном описании. Не спрашивай то, что уже указано. Каждый вопрос должен заметно влиять на текст будущего письма. Верни вопросы строго по JSON-схеме."
      : input.action === "design"
        ? emailDesignInstructions(input)
        : "Ты редактор деловых email-писем на русском языке. Верни только четыре коротких поля JSON: subject, previewText, body, cta. Никакого HTML, Markdown, таблиц, дизайна или пояснений. body — обычный текст до 1800 символов. subject — до 140 символов, previewText — до 240, cta — до 80. Не выдумывай даты, цифры, ссылки и факты. Сохраняй только переменные {{first_name}}, {{last_name}}, {{company}}, {{position}}, {{city}}. Ответ строго по JSON-схеме.";
  const schema =
    input.action === "brief"
      ? {
          type: "object",
          additionalProperties: false,
          required: ["questions"],
          properties: {
            questions: {
              type: "array",
              minItems: 3,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "question", "placeholder", "required"],
                properties: {
                  id: { type: "string" },
                  question: { type: "string" },
                  placeholder: { type: "string" },
                  required: { type: "boolean" },
                },
              },
            },
          },
        }
      : input.action === "design"
        ? {
            type: "object",
            additionalProperties: false,
            required: [
              "emailType",
              "subject",
              "previewText",
              "body",
              "cta",
              "artDirection",
              "contentStrategy",
              "design",
            ],
            properties: {
              emailType: {
                type: "string",
                enum: [
                  "informational",
                  "welcome",
                  "invitation",
                  "promotion",
                  "event",
                  "news",
                  "notification",
                  "product_update",
                  "congratulation",
                  "transactional",
                ],
              },
              subject: { type: "string", maxLength: 140 },
              previewText: { type: "string", maxLength: 240 },
              body: { type: "string", maxLength: 1800 },
              cta: { type: "string", maxLength: 80 },
              artDirection: { type: "string", maxLength: 600 },
              contentStrategy: { type: "string", maxLength: 600 },
              design: {
                type: "object",
                additionalProperties: false,
                required: [
                  "accentColor",
                  "bodyBackground",
                  "workspaceBackground",
                  "blocks",
                ],
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
                      required: [
                        "type",
                        "content",
                        "label",
                        "assetId",
                        "imagePrompt",
                      ],
                      properties: {
                        type: {
                          type: "string",
                          enum: [
                            "logo",
                            "heading",
                            "text",
                            "image",
                            "button",
                            "columns",
                            "divider",
                            "spacer",
                            "social",
                            "footer",
                            "hero",
                            "quote",
                            "checklist",
                            "stats",
                            "product",
                            "signature",
                            "pattern",
                            "banner",
                            "timeline",
                            "faq",
                            "coupon",
                            "video",
                            "notice",
                            "comparison",
                            "document",
                            "compliance",
                          ],
                        },
                        content: { type: "string" },
                        label: { type: ["string", "null"] },
                        assetId: { type: ["string", "null"] },
                        imagePrompt: { type: ["string", "null"] },
                      },
                    },
                  },
                },
              },
            },
          }
        : {
            type: "object",
            additionalProperties: false,
            required: ["subject", "previewText", "body", "cta"],
            properties: {
              subject: { type: "string" },
              previewText: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
            },
          };
  const requestBody = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      provider.provider === "navyai"
        ? {
            model: provider.model,
            messages: [
              { role: "system", content: instructions },
              { role: "user", content: JSON.stringify(modelInput) },
            ],
            max_tokens: input.action === "design" ? 6_000 : 3_000,
            // NavyAI's OpenAI-compatible gateway accepts JSON mode consistently, while
            // complex nested json_schema requests can fail at the provider before the
            // model runs. We still validate the full result with our own strict parser.
            response_format: { type: "json_object" },
          }
        : {
            model: provider.model,
            store: false,
            safety_identifier: await safetyIdentifier(request),
            reasoning: { effort: "low" },
            max_output_tokens: input.action === "design" ? 6_000 : 3_000,
            instructions,
            input: JSON.stringify(modelInput),
            text: {
              format: {
                type: "json_schema",
                name: "email_suggestion",
                strict: true,
                schema,
              },
            },
          },
    ),
  } satisfies RequestInit;
  let response: Response;
  let responseBody: unknown;
  try {
    response = await fetch(provider.endpoint, requestBody);
    responseBody = await response.json().catch(() => null);
    if (
      !response.ok &&
      provider.provider === "navyai" &&
      provider.fallbackModel &&
      provider.model !== provider.fallbackModel
    ) {
      const fallbackBody = {
        ...(JSON.parse(String(requestBody.body)) as Record<string, unknown>),
        model: provider.fallbackModel,
      };
      response = await fetch(provider.endpoint, {
        ...requestBody,
        body: JSON.stringify(fallbackBody),
      });
      responseBody = await response.json().catch(() => null);
    }
  } catch {
    if (input.action === "brief") {
      return {
        configured: true,
        provider: provider.provider,
        suggestion: fallbackBriefQuestions(input.goal),
      };
    }
    throw new ApiRequestError(
      "ИИ-помощник временно недоступен. Повторите попытку.",
      502,
    );
  }
  if (!response.ok) {
    if (input.action === "brief") {
      return {
        configured: true,
        provider: provider.provider,
        suggestion: fallbackBriefQuestions(input.goal),
      };
    }
    console.error(
      "OpenAI email assistant error",
      response.status,
      responseBody,
    );
    throw new ApiRequestError(
      response.status === 429
        ? "ИИ-помощник занят. Повторите через минуту."
        : "ИИ-помощник не смог подготовить текст. Повторите попытку.",
      502,
    );
  }
  let suggestion: EmailAiSuggestion;
  try {
    suggestion = parseSuggestion(outputText(responseBody), input);
  } catch (error) {
    if (input.action === "brief") {
      suggestion = fallbackBriefQuestions(input.goal);
    } else if (input.action === "design") {
      const rawRetry = JSON.parse(String(requestBody.body)) as Record<
        string,
        unknown
      >;
      response = await fetch(provider.endpoint, {
        ...requestBody,
        body: JSON.stringify(
          provider.provider === "navyai"
            ? {
                ...rawRetry,
                model: "gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content: `${instructions}\nПРЕДЫДУЩАЯ ПОПЫТКА НАРУШИЛА JSON-СХЕМУ. Верни только один валидный JSON-объект без Markdown, вводного текста и комментариев.`,
                  },
                  { role: "user", content: JSON.stringify(modelInput) },
                ],
              }
            : {
                ...rawRetry,
                reasoning: { effort: "medium" },
                instructions: `${instructions}\nПРЕДЫДУЩАЯ ПОПЫТКА НАРУШИЛА JSON-СХЕМУ. Верни только один валидный JSON-объект без Markdown, вводного текста и комментариев.`,
              },
        ),
      });
      const retryBody: unknown = await response.json().catch(() => null);
      if (!response.ok) throw error;
      suggestion = parseSuggestion(outputText(retryBody), input);
    } else {
      throw error;
    }
  }
  const designed =
    input.action !== "design"
      ? suggestion
      : input.imageSource === "internet"
        ? await generateDesignImages(
            request,
            provider,
            await findInternetImages(suggestion),
            true,
          )
        : input.imageSource === "generate"
          ? await generateDesignImages(request, provider, suggestion)
          : input.includeLogo
            ? await generateDesignImages(request, provider, suggestion, true)
            : suggestion;
  if (input.action === "design")
    applyEditorialCopy(designed, editorialCopy, input);
  return {
    configured: true,
    provider: provider.provider,
    suggestion: designed,
  };
}
