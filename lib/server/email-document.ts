import type {
  EmailBuilderBlockInput,
  EmailBuilderDocumentInput,
} from "@/types/api";
import { ApiRequestError } from "./api-utils";

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
    if (url.protocol !== "https:") throw new Error("https required");
    return url.toString();
  } catch {
    throw new ApiRequestError(`Поле «${field}» должно содержать HTTPS-ссылку.`);
  }
}

export function parseEmailBuilderDocument(
  value: unknown,
): EmailBuilderDocumentInput | null {
  if (value === null || value === undefined) return null;
  const source = record(value);
  if (!Array.isArray(source.blocks) || source.blocks.length < 1 || source.blocks.length > 80) {
    throw new ApiRequestError("Email-макет должен содержать от 1 до 80 блоков.");
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
    const href = type === "button"
      ? safeHttpsUrl(block.href, `Ссылка кнопки ${index + 1}`, true)
      : type === "image"
        ? safeHttpsUrl(block.href, `Ссылка изображения ${index + 1}`, true)
        : safeHttpsUrl(block.href, `Ссылка блока ${index + 1}`, false);
    return {
      id: text(block.id, `ID блока ${index + 1}`, 160),
      type,
      content: text(block.content, `Контент блока ${index + 1}`, 20_000),
      ...(block.label === undefined ? {} : { label: text(block.label, `Подпись блока ${index + 1}`, 2_000) }),
      ...(href ? { href } : {}),
      alignment,
      paddingTop: number(block.paddingTop, `Верхний отступ блока ${index + 1}`, 0, 80),
      paddingBottom: number(block.paddingBottom, `Нижний отступ блока ${index + 1}`, 0, 80),
      backgroundColor: color(block.backgroundColor, `Фон блока ${index + 1}`, true),
      textColor: color(block.textColor, `Текст блока ${index + 1}`),
      fontSize: number(block.fontSize, `Размер текста блока ${index + 1}`, 8, 64),
      borderRadius: number(block.borderRadius, `Скругление блока ${index + 1}`, 0, 32),
    };
  });
  return {
    templateId: text(source.templateId, "ID шаблона", 160),
    subject: text(source.subject, "Тема", 300),
    previewText: text(source.previewText, "Прехедер", 500),
    accentColor: color(source.accentColor, "Акцент"),
    bodyBackground: color(source.bodyBackground, "Фон письма"),
    workspaceBackground: color(source.workspaceBackground, "Фон рабочей области"),
    contentWidth: number(source.contentWidth, "Ширина письма", 320, 760),
    blocks,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lineBreaks(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function blockHtml(block: EmailBuilderBlockInput, accent: string) {
  const background = block.backgroundColor === "transparent"
    ? ""
    : `background-color:${block.backgroundColor};`;
  const wrapper = `padding:${block.paddingTop}px 40px ${block.paddingBottom}px;${background}color:${block.textColor};text-align:${block.alignment};`;
  let content = "";
  if (block.type === "heading") {
    content = `<h1 style="margin:0;font-family:Arial,sans-serif;font-size:${block.fontSize}px;line-height:1.15;color:${block.textColor};">${lineBreaks(block.content)}</h1>`;
  } else if (block.type === "text" || block.type === "footer" || block.type === "logo") {
    const weight = block.type === "logo" ? "font-weight:700;letter-spacing:.12em;" : "";
    content = `<div style="margin:0;font-family:Arial,sans-serif;font-size:${block.fontSize}px;line-height:1.65;color:${block.textColor};${weight}">${lineBreaks(block.content)}</div>`;
  } else if (block.type === "button") {
    content = `<a href="${escapeHtml(block.href ?? "")}" style="display:inline-block;padding:12px 22px;border-radius:${block.borderRadius}px;background:${accent};color:${block.textColor};font-family:Arial,sans-serif;font-size:${block.fontSize}px;font-weight:700;text-decoration:none;">${lineBreaks(block.label || block.content)}</a>`;
  } else if (block.type === "image") {
    content = `<img src="${escapeHtml(block.href ?? "")}" alt="${escapeHtml(block.content)}" width="100%" style="display:block;width:100%;height:auto;border:0;border-radius:${block.borderRadius}px;">`;
  } else if (block.type === "columns") {
    const columns = block.content.split("|");
    content = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="50%" valign="top" style="padding:12px;border:1px solid #e5e7eb;border-radius:${block.borderRadius}px;font-family:Arial,sans-serif;font-size:${block.fontSize}px;line-height:1.5;color:${block.textColor};">${lineBreaks(columns[0] ?? "")}</td><td width="12"></td><td width="50%" valign="top" style="padding:12px;border:1px solid #e5e7eb;border-radius:${block.borderRadius}px;font-family:Arial,sans-serif;font-size:${block.fontSize}px;line-height:1.5;color:${block.textColor};">${lineBreaks(columns[1] ?? "")}</td></tr></table>`;
  } else if (block.type === "divider") {
    content = `<div style="border-top:1px solid ${block.textColor};font-size:0;line-height:0;">&nbsp;</div>`;
  } else if (block.type === "spacer") {
    content = "&nbsp;";
  } else if (block.type === "social") {
    content = `<div style="font-family:Arial,sans-serif;font-size:${block.fontSize}px;line-height:1.6;color:${block.textColor};">${block.content.split("|").map((item) => escapeHtml(item.trim())).filter(Boolean).join(" &nbsp;·&nbsp; ")}</div>`;
  }
  return `<tr><td style="${wrapper}">${content}</td></tr>`;
}

export function compileEmailDocument(document: EmailBuilderDocumentInput) {
  const blocks = document.blocks.map((block) => blockHtml(block, document.accentColor)).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${document.workspaceBackground};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(document.previewText)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${document.workspaceBackground};"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="${document.contentWidth}" cellspacing="0" cellpadding="0" style="width:100%;max-width:${document.contentWidth}px;background:${document.bodyBackground};">${blocks}</table></td></tr></table></body></html>`;
  if (html.length > 500_000) {
    throw new ApiRequestError("Скомпилированный HTML письма превышает 500 КБ.");
  }
  return html;
}

export function plainTextEmailHtml(text: string) {
  return `<!doctype html><html><body><div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#1f2937;">${lineBreaks(text)}</div></body></html>`;
}
