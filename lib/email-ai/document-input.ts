import { emailIconIds } from "@/lib/email-icons";
// Shared validation and normalization for persistence and editor identities.
import { checkEmailHtml } from "@/lib/email-import/formats";
import type { EmailBuilderBlockInput, EmailBuilderDocumentInput } from "@/types/api";
import type { EmailFrameStyle } from "@/components/email-builder/frame-presets";
import { ApiRequestError } from "@/lib/server/api-utils";
import { emailBlockVariants, isEmailVariant } from "./variants";
import { parseAiEmailBrief, parseEmailReview } from "./schema";
import { safeEmailUrl } from "./urls";

const BLOCK_TYPES = new Set<EmailBuilderBlockInput["type"]>([
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
const COLOR = /^#[0-9a-f]{6}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiRequestError("Документ email-редактора повреждён.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.length > max) {
    throw new ApiRequestError(`Некорректное поле «${field}» в email-макете.`);
  }
  return value;
}

function number(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ApiRequestError(`Некорректное поле «${field}» в email-макете.`);
  }
  return Math.round(value);
}

function color(value: unknown, field: string, transparent = false) {
  if (transparent && value === "transparent") return "transparent";
  if (typeof value !== "string" || !COLOR.test(value)) {
    throw new ApiRequestError(`Цвет «${field}» в email-макете должен быть в формате #RRGGBB.`);
  }
  return value.toLowerCase();
}

function safeHttpsUrl(value: unknown, field: string, required: boolean) {
  if ((value === undefined || value === "") && !required) return undefined;
  const raw = text(value, field, 2_000);
  try {
    const url = new URL(raw);
    const localDevelopmentUrl =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    if (url.protocol !== "https:" && !localDevelopmentUrl) throw new Error("https required");
    return url.toString();
  } catch {
    throw new ApiRequestError(`Поле «${field}» должно содержать HTTPS-ссылку.`);
  }
}

function actionUrl(value: unknown, field: string, required = false) {
  if ((value === undefined || value === "") && !required) return undefined;
  try { return safeEmailUrl(value); }
  catch { throw new ApiRequestError(`Поле «${field}» должно содержать безопасную ссылку.`); }
}

export function parseEmailBuilderDocument(
  value: unknown,
): EmailBuilderDocumentInput | null {
  if (value === null || value === undefined) return null;
  const source = record(value);
  if (!Array.isArray(source.blocks) || source.blocks.length < 1 || source.blocks.length > 80) {
    throw new ApiRequestError("Перед сохранением добавьте в email-макет хотя бы один блок.");
  }
  const blocks = source.blocks.map((rawBlock, index): EmailBuilderBlockInput => {
    const block = record(rawBlock);
    const type = text(block.type, `Тип блока ${index + 1}`, 30) as EmailBuilderBlockInput["type"];
    if (!BLOCK_TYPES.has(type)) {
      throw new ApiRequestError(`Неизвестный тип блока email-макета: ${type}.`);
    }
    const alignment = block.alignment ?? "left";
    if (alignment !== "left" && alignment !== "center" && alignment !== "right") {
      throw new ApiRequestError(`Некорректное выравнивание блока ${index + 1}.`);
    }
    const href = type === "button" || type === "product"
      ? actionUrl(block.href, `Ссылка кнопки ${index + 1}`, true)
      : type === "image"
        ? safeHttpsUrl(block.href, `Ссылка изображения ${index + 1}`, true)
        : type === "hero" ? actionUrl(block.href, `Ссылка блока ${index + 1}`) : safeHttpsUrl(block.href, `Ссылка блока ${index + 1}`, false);
    const linkHref = type === "image" || type === "logo"
      ? actionUrl(block.linkHref, `Ссылка при нажатии ${index + 1}`)
      : undefined;
    if (block.aiRole !== undefined && (typeof block.aiRole !== "string" || !Object.hasOwn(emailBlockVariants, block.aiRole))) throw new ApiRequestError("Неизвестная роль блока.");
    if (block.variant !== undefined && (!isEmailVariant(block.variant) || !block.aiRole || !emailBlockVariants[block.aiRole as keyof typeof emailBlockVariants].includes(block.variant))) throw new ApiRequestError("Вариант не соответствует типу блока.");
    return {
      id: text(block.id, `ID блока ${index + 1}`, 160),
      type,
      ...(typeof block.aiRole === "string" && block.aiRole in emailBlockVariants ? { aiRole: block.aiRole as NonNullable<EmailBuilderBlockInput["aiRole"]> } : {}),
      ...(block.badge ? { badge: text(block.badge, "Надпись над блоком", 150) } : {}),
      ...(isEmailVariant(block.variant) ? { variant: block.variant } : {}),
      ...(block.imageHref ? { imageHref: safeHttpsUrl(block.imageHref, "Изображение первого экрана", true), imageAlt: text(block.imageAlt ?? "", "Описание изображения", 1000) } : {}),
      ...(Array.isArray(block.itemIcons) ? { itemIcons: block.itemIcons.slice(0, 12).map(id => typeof id === "string" && emailIconIds.includes(id) ? id : "") } : {}),
      content: text(block.content, `Контент блока ${index + 1}`, 20_000),
      ...(block.label === undefined ? {} : { label: text(block.label, `Подпись блока ${index + 1}`, 2_000) }),
      ...(href ? { href } : {}),
      ...(linkHref ? { linkHref } : {}),
      alignment,
      paddingTop: number(block.paddingTop, `Верхний отступ блока ${index + 1}`, 0, 80),
      paddingBottom: number(block.paddingBottom, `Нижний отступ блока ${index + 1}`, 0, 80),
      backgroundColor: color(block.backgroundColor, `Фон блока ${index + 1}`, true),
      textColor: color(block.textColor, `Текст блока ${index + 1}`),
      ...(block.accentColor === undefined ? {} : { accentColor: color(block.accentColor, `Акцент блока ${index + 1}`) }),
      fontSize: number(block.fontSize, `Размер текста блока ${index + 1}`, 8, 64),
      borderRadius: number(block.borderRadius, `Скругление блока ${index + 1}`, 0, 48),
      fontFamily: (["Arial", "Georgia", "Verdana", "Trebuchet MS"] as const).includes(block.fontFamily as never) ? block.fontFamily as EmailBuilderBlockInput["fontFamily"] : "Arial",
      fontWeight: ([400, 500, 600, 700] as const).includes(block.fontWeight as never) ? block.fontWeight as EmailBuilderBlockInput["fontWeight"] : 400,
      lineHeight: block.lineHeight === undefined ? 155 : number(block.lineHeight, `Межстрочный интервал блока ${index + 1}`, 90, 220),
      letterSpacing: block.letterSpacing === undefined ? 0 : number(block.letterSpacing, `Межбуквенный интервал блока ${index + 1}`, -2, 12),
      paddingLeft: block.paddingLeft === undefined ? 40 : number(block.paddingLeft, `Левый отступ блока ${index + 1}`, 0, 80),
      paddingRight: block.paddingRight === undefined ? 40 : number(block.paddingRight, `Правый отступ блока ${index + 1}`, 0, 80),
      borderWidth: block.borderWidth === undefined ? 0 : number(block.borderWidth, `Граница блока ${index + 1}`, 0, 8),
      borderColor: block.borderColor === undefined ? "#e5e7eb" : color(block.borderColor, `Граница блока ${index + 1}`),
      widthPercent: block.widthPercent === undefined ? 100 : number(block.widthPercent, `Ширина блока ${index + 1}`, 25, 100),
      buttonStyle: block.buttonStyle === "outline" || block.buttonStyle === "soft" ? block.buttonStyle : "solid",
    };
  });
  const frameStyles = new Set<EmailFrameStyle>(["none", "hairline", "accent", "double", "dashed", "top-bottom", "left-band", "soft", "capsule", "stamp", "offset", "inset", "top-accent", "bottom-accent", "right-band", "editorial", "ticket", "window", "railway", "archive", "corner-cut", "top-ribbon", "side-lines", "luxury", "blueprint", "poster", "postcard", "focus", "inner-rule", "editorial-corner", "spine-double", "marquee", "notebook", "gallery-mat", "terminal", "legal-docket", "festive-thread", "wave-edge", "minimalist-lift", "embossed"]);
  const frameStyle = frameStyles.has(source.frameStyle as EmailFrameStyle) ? source.frameStyle as EmailFrameStyle : "none";
  const rawHtml = source.rawHtml === undefined
    ? undefined
    : typeof source.rawHtml === "string" && source.rawHtml.length <= 500_000
      ? source.rawHtml
      : (() => { throw new ApiRequestError("HTML письма должен быть текстом размером до 500 КБ."); })();
  if (rawHtml && !/^(?:\s|<!--[\s\S]*?-->)*(?:<!doctype\s+html|<html[\s>])/i.test(rawHtml)) {
    throw new ApiRequestError("Импортированный HTML должен содержать полный документ письма.");
  }
  if (rawHtml) {
    try { checkEmailHtml(rawHtml); }
    catch (error) { throw new ApiRequestError(error instanceof Error ? error.message : "HTML письма не поддерживается."); }
  }
  return {
    templateId: text(source.templateId, "ID шаблона", 160),
    subject: text(source.subject, "Тема", 300),
    previewText: text(source.previewText, "Прехедер", 500),
    ...(rawHtml ? { rawHtml } : {}),
    accentColor: color(source.accentColor, "Акцент"),
    bodyBackground: color(source.bodyBackground, "Фон письма"),
    ...(source.backgroundImageUrl === undefined || source.backgroundImageUrl === ""
      ? {}
      : { backgroundImageUrl: safeHttpsUrl(source.backgroundImageUrl, "Фоновое изображение письма", true) }),
    workspaceBackground: color(source.workspaceBackground, "Фон рабочей области"),
    contentWidth: number(source.contentWidth, "Ширина письма", 320, 760),
    frameStyle,
    frameColor: source.frameColor === undefined ? color(source.accentColor, "Цвет окантовки") : color(source.frameColor, "Цвет окантовки"),
    frameRadius: source.frameRadius === undefined ? 0 : number(source.frameRadius, "Скругление окантовки", 0, 48),
    blocks,
    ...(source.aiMetadata ? { aiMetadata: (() => {
      const metadata = record(source.aiMetadata);
      const review = metadata.review ? record(metadata.review) : undefined;
      return { brief: parseAiEmailBrief(metadata.brief), generationId: text(metadata.generationId, "Генерация", 160), generatedAt: text(metadata.generatedAt, "Дата генерации", 100), model: text(metadata.model, "Модель", 100), ...(review ? { review: parseEmailReview(review) } : {}) };
    })() } : {}),
  };
}
