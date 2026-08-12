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
    const href = type === "button" || type === "product"
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
  const family = block.fontFamily ?? "Arial";
  const weight = block.fontWeight ?? 400;
  const lineHeight = (block.lineHeight ?? 155) / 100;
  const tracking = block.letterSpacing ?? 0;
  const wrapper = `padding:${block.paddingTop}px ${block.paddingRight ?? 40}px ${block.paddingBottom}px ${block.paddingLeft ?? 40}px;${background}color:${block.textColor};text-align:${block.alignment};`;
  let content = "";
  if (block.type === "heading") {
    content = `<h1 style="margin:0;font-family:${family},sans-serif;font-size:${block.fontSize}px;font-weight:${weight};line-height:${lineHeight};letter-spacing:${tracking}px;color:${block.textColor};">${lineBreaks(block.content)}</h1>`;
  } else if (block.type === "text" || block.type === "footer" || block.type === "logo" || block.type === "signature") {
    const weight = block.type === "logo" ? "font-weight:700;letter-spacing:.12em;" : "";
    if (block.type === "logo" && block.href) {
      content = `<img src="${escapeHtml(block.href)}" alt="${escapeHtml(block.content)}" style="display:inline-block;max-width:220px;max-height:88px;width:auto;height:auto;border:0;">`;
    } else {
      content = `<div style="margin:0;font-family:${family},sans-serif;font-size:${block.fontSize}px;font-weight:${block.fontWeight ?? 400};line-height:${lineHeight};letter-spacing:${tracking}px;color:${block.textColor};${weight}">${lineBreaks(block.content)}</div>`;
    }
  } else if (block.type === "button") {
    const buttonBackground = block.buttonStyle === "outline" ? "transparent" : block.buttonStyle === "soft" ? `${accent}18` : accent;
    const buttonColor = block.buttonStyle === "solid" || !block.buttonStyle ? block.textColor : accent;
    content = `<a href="${escapeHtml(block.href ?? "")}" style="display:inline-block;padding:12px 22px;border:${block.buttonStyle === "outline" ? `2px solid ${accent}` : "0"};border-radius:${block.borderRadius}px;background:${buttonBackground};color:${buttonColor};font-family:${family},sans-serif;font-size:${block.fontSize}px;font-weight:${weight || 700};text-decoration:none;">${lineBreaks(block.label || block.content)}</a>`;
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
  } else if (block.type === "hero") {
    const [title = "", subtitle = ""] = block.content.split("|");
    content = `<div style="padding:28px;border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#f3f2ff" : block.backgroundColor};"><div style="font-family:Arial,sans-serif;font-size:${block.fontSize}px;font-weight:700;line-height:1.12;color:${block.textColor};">${lineBreaks(title)}</div><div style="margin-top:12px;font-family:Arial,sans-serif;font-size:16px;line-height:1.55;color:${block.textColor};opacity:.78;">${lineBreaks(subtitle)}</div></div>`;
  } else if (block.type === "quote") {
    const [quote = "", author = ""] = block.content.split("|");
    content = `<blockquote style="margin:0;padding:20px;border-left:4px solid ${accent};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#f8f8fb" : block.backgroundColor};font-family:Arial,sans-serif;color:${block.textColor};"><div style="font-size:${block.fontSize}px;line-height:1.55;">“${lineBreaks(quote)}”</div><div style="margin-top:10px;font-size:13px;font-weight:700;">${lineBreaks(author)}</div></blockquote>`;
  } else if (block.type === "checklist") {
    content = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${block.content.split("|").filter(Boolean).map((item) => `<tr><td width="28" valign="top" style="padding:5px 0;color:${accent};font-weight:700;">✓</td><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:${block.fontSize}px;line-height:1.5;color:${block.textColor};">${lineBreaks(item.trim())}</td></tr>`).join("")}</table>`;
  } else if (block.type === "stats") {
    const items = block.content.split("|");
    content = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${[0, 2].map((index) => `<td width="50%" style="padding:16px;text-align:center;border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#f7f8fc" : block.backgroundColor};font-family:Arial,sans-serif;"><div style="font-size:28px;font-weight:700;color:${accent};">${lineBreaks(items[index] ?? "")}</div><div style="margin-top:5px;font-size:${block.fontSize}px;color:${block.textColor};">${lineBreaks(items[index + 1] ?? "")}</div></td>${index === 0 ? '<td width="12"></td>' : ''}`).join("")}</tr></table>`;
  } else if (block.type === "product") {
    const [name = "", description = "", price = ""] = block.content.split("|");
    content = `<div style="padding:22px;border:1px solid #e5e7eb;border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#ffffff" : block.backgroundColor};font-family:Arial,sans-serif;color:${block.textColor};"><div style="font-size:20px;font-weight:700;">${lineBreaks(name)}</div><div style="margin-top:8px;font-size:${block.fontSize}px;line-height:1.55;">${lineBreaks(description)}</div><div style="margin-top:14px;font-size:18px;font-weight:700;">${lineBreaks(price)}</div><a href="${escapeHtml(block.href ?? "")}" style="display:inline-block;margin-top:16px;padding:10px 18px;border-radius:8px;background:${accent};color:#fff;text-decoration:none;font-size:13px;font-weight:700;">${lineBreaks(block.label || "Узнать подробнее")}</a></div>`;
  } else if (block.type === "pattern") {
    content = `<div aria-hidden="true" style="padding:10px;border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? `${accent}12` : block.backgroundColor};font-family:${family},sans-serif;font-size:${block.fontSize}px;line-height:${lineHeight};letter-spacing:${tracking}px;color:${block.textColor};text-align:center;">${lineBreaks(block.content)}</div>`;
  } else if (block.type === "banner") {
    const [title = "", subtitle = ""] = block.content.split("|");
    content = `<div style="padding:24px;border:${block.borderWidth ?? 0}px solid ${block.borderColor ?? accent};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? accent : block.backgroundColor};font-family:${family},sans-serif;color:${block.textColor};"><div style="font-size:${block.fontSize + 8}px;font-weight:700;line-height:1.2;">${lineBreaks(title)}</div><div style="margin-top:8px;font-size:${block.fontSize}px;line-height:${lineHeight};opacity:.8;">${lineBreaks(subtitle)}</div></div>`;
  } else if (block.type === "timeline") {
    const items = block.content.split("|");
    content = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${Array.from({length:Math.ceil(items.length/2)},(_,i)=>`<tr><td width="34" valign="top" style="padding:8px 0;color:${accent};font-weight:700;">${i+1}</td><td style="padding:8px 0;font-family:${family},sans-serif;color:${block.textColor};"><strong>${lineBreaks(items[i*2]??"")}</strong><div style="margin-top:3px;opacity:.7;">${lineBreaks(items[i*2+1]??"")}</div></td></tr>`).join("")}</table>`;
  } else if (block.type === "faq") {
    const items = block.content.split("|");
    content = `<div style="font-family:${family},sans-serif;color:${block.textColor};">${Array.from({length:Math.ceil(items.length/2)},(_,i)=>`<div style="padding:14px 0;border-bottom:1px solid ${block.borderColor ?? "#e5e7eb"};"><strong>${lineBreaks(items[i*2]??"")}</strong><div style="margin-top:6px;line-height:${lineHeight};opacity:.75;">${lineBreaks(items[i*2+1]??"")}</div></div>`).join("")}</div>`;
  } else if (block.type === "coupon") {
    const [eyebrow = "", code = "", note = ""] = block.content.split("|");
    content = `<div style="padding:22px;border:2px dashed ${accent};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? `${accent}12` : block.backgroundColor};font-family:${family},sans-serif;text-align:center;color:${block.textColor};"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;">${lineBreaks(eyebrow)}</div><div style="margin:10px 0;font-size:${block.fontSize + 8}px;font-weight:700;letter-spacing:.08em;color:${accent};">${lineBreaks(code)}</div><div style="font-size:12px;opacity:.7;">${lineBreaks(note)}</div></div>`;
  } else if (block.type === "video") {
    const [title = "", duration = ""] = block.content.split("|");
    content = `<a href="${escapeHtml(block.href ?? "")}" style="display:block;padding:46px 24px;border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#17121c" : block.backgroundColor};font-family:${family},sans-serif;text-align:center;color:${block.textColor};text-decoration:none;"><span style="display:inline-block;font-size:28px;">▶</span><div style="margin-top:12px;font-size:${block.fontSize + 4}px;font-weight:700;">${lineBreaks(title)}</div><div style="margin-top:5px;font-size:12px;opacity:.65;">${lineBreaks(duration)}</div></a>`;
  }
  return `<tr><td style="${wrapper}"><div style="width:${block.widthPercent ?? 100}%;margin:${block.alignment === "center" ? "0 auto" : block.alignment === "right" ? "0 0 0 auto" : "0 auto 0 0"};border:${block.borderWidth ?? 0}px solid ${block.borderColor ?? "#e5e7eb"};border-radius:${block.borderRadius}px;box-sizing:border-box;">${content}</div></td></tr>`;
}

export function compileEmailDocument(document: EmailBuilderDocumentInput) {
  const blocks = document.blocks.map((block) => blockHtml(block, document.accentColor)).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${document.workspaceBackground};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(document.previewText)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${document.workspaceBackground};"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="${document.contentWidth}" cellspacing="0" cellpadding="0" style="width:100%;max-width:${document.contentWidth}px;background:${document.bodyBackground};">${blocks}</table></td></tr></table></body></html>`;
  if (html.length > 500_000) {
    throw new ApiRequestError("Скомпилированный HTML письма превышает 500 КБ.");
  }
  return html;
}

export function emailDocumentPlainText(
  document: EmailBuilderDocumentInput,
): string {
  const sections = document.blocks.flatMap((block) => {
    if (block.type === "divider" || block.type === "spacer" || block.type === "pattern") return [];
    if (block.type === "button") return [block.label || block.content];
    if (block.type === "columns") {
      return block.content.split("|").map((value) => value.trim());
    }
    if (["hero", "quote", "checklist", "stats", "product", "signature", "banner", "timeline", "faq", "coupon", "video"].includes(block.type)) {
      const parts = block.content.split("|").map((value) => value.trim()).filter(Boolean);
      if (block.type === "product" && block.label) parts.push(block.label);
      return parts;
    }
    return [block.content];
  });
  const text = sections.map((value) => value.trim()).filter(Boolean).join("\n\n");
  if (!text) {
    throw new ApiRequestError(
      "Email-макет должен содержать хотя бы один заполненный текстовый блок.",
    );
  }
  if (text.length > 200_000) {
    throw new ApiRequestError("Текст email-макета превышает 200 000 символов.");
  }
  return text;
}

export function plainTextEmailHtml(text: string, previewText = "") {
  return `<!doctype html><html><body><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div><div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#1f2937;">${lineBreaks(text)}</div></body></html>`;
}
