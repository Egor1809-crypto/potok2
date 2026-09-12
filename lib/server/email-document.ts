import type { EmailBuilderBlockInput, EmailBuilderDocumentInput } from "@/types/api";
import { emailFrameInlineCss } from "@/components/email-builder/frame-presets";
import { ApiRequestError } from "./api-utils";
import { renderEmailVariant } from "@/lib/email-ai/render-variants";
export { parseEmailBuilderDocument } from "@/lib/email-ai/document-input";

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

function emailFontStack(family: EmailBuilderBlockInput["fontFamily"]) {
  if (family === "Georgia") return "Georgia,'Times New Roman',serif";
  if (family === "Verdana") return "Verdana,Geneva,sans-serif";
  if (family === "Trebuchet MS")
    return "'Trebuchet MS',Arial,sans-serif";
  return "Arial,Helvetica,sans-serif";
}

function companionBodyFont(family: EmailBuilderBlockInput["fontFamily"]) {
  return family === "Georgia"
    ? "'Trebuchet MS',Arial,sans-serif"
    : emailFontStack(family);
}

function paragraphHtml(
  value: string,
  family: string,
  size: number,
  weight: number,
  lineHeight: number,
  tracking: number,
  color: string,
) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  return paragraphs
    .map(
      (paragraph, index) =>
        `<p style="margin:0${index === paragraphs.length - 1 ? "" : " 0 16px"};font-family:${family};font-size:${size}px;font-weight:${weight};line-height:${lineHeight};letter-spacing:${tracking}px;color:${color};">${lineBreaks(paragraph)}</p>`,
    )
    .join("");
}

function blockHtml(block: EmailBuilderBlockInput, accent: string) {
  const background = block.backgroundColor === "transparent"
    ? ""
    : `background-color:${block.backgroundColor};`;
  const family = emailFontStack(block.fontFamily ?? "Arial");
  const weight = block.fontWeight ?? 400;
  const lineHeight = (block.lineHeight ?? 155) / 100;
  const tracking = block.letterSpacing ?? 0;
  const wrapper = `padding:${block.paddingTop}px ${block.paddingRight ?? 40}px ${block.paddingBottom}px ${block.paddingLeft ?? 40}px;${background}color:${block.textColor};text-align:${block.alignment};`;
  let content = "";
  if (block.aiRole && block.variant) {
    content = renderEmailVariant(block, accent);
  } else if (block.type === "heading") {
    content = `<h1 style="margin:0;font-family:${family},sans-serif;font-size:${block.fontSize}px;font-weight:${weight};line-height:${lineHeight};letter-spacing:${tracking}px;color:${block.textColor};">${lineBreaks(block.content)}</h1>`;
  } else if (block.type === "text" || block.type === "footer" || block.type === "logo" || block.type === "signature") {
    const weight = block.type === "logo" ? "font-weight:700;letter-spacing:.12em;" : "";
    if (block.type === "logo" && block.href) {
      const sizedLogo = block.widthPercent !== 100;
      const image = `<img src="${escapeHtml(block.href)}" alt="${escapeHtml(block.content)}" style="display:inline-block;${sizedLogo ? "width:100%;max-width:520px;" : "max-width:220px;width:auto;"}max-height:110px;height:auto;border:0;">`;
      content = block.linkHref ? `<a href="${escapeHtml(block.linkHref)}" style="text-decoration:none;">${image}</a>` : image;
    } else {
      content =
        block.type === "text"
          ? paragraphHtml(
              block.content,
              family,
              block.fontSize,
              block.fontWeight ?? 400,
              lineHeight,
              tracking,
              block.textColor,
            )
          : `<div style="margin:0;font-family:${family};font-size:${block.fontSize}px;font-weight:${block.fontWeight ?? 400};line-height:${lineHeight};letter-spacing:${tracking}px;color:${block.textColor};${weight}">${lineBreaks(block.content)}</div>`;
    }
  } else if (block.type === "button") {
    const buttonBackground = block.buttonStyle === "outline" ? "transparent" : block.buttonStyle === "soft" ? `${accent}18` : accent;
    const buttonColor = block.buttonStyle === "solid" || !block.buttonStyle ? block.textColor : accent;
    content = `<a class="email-cta" href="${escapeHtml(block.href ?? "")}" style="display:inline-block;padding:13px 24px;border:${block.buttonStyle === "outline" ? `2px solid ${accent}` : "0"};border-radius:${block.borderRadius}px;background:${buttonBackground};color:${buttonColor};font-family:${family},Helvetica,sans-serif;font-size:${block.fontSize}px;font-weight:${weight || 700};line-height:1.2;text-decoration:none;">${lineBreaks(block.label || block.content)}</a>`;
  } else if (block.type === "image") {
    const image = `<img src="${escapeHtml(block.href ?? "")}" alt="${escapeHtml(block.content)}" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:${block.borderRadius}px;">`;
    content = block.linkHref ? `<a href="${escapeHtml(block.linkHref)}" style="display:block;text-decoration:none;">${image}</a>` : image;
  } else if (block.type === "columns") {
    const columns = block.content.split("|");
    content = `<table class="email-columns" role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="email-column" width="50%" valign="top" style="padding:12px;border:1px solid ${block.borderColor ?? "#e5e7eb"};border-radius:${block.borderRadius}px;font-family:${family},Helvetica,sans-serif;font-size:${block.fontSize}px;line-height:${lineHeight};color:${block.textColor};">${lineBreaks(columns[0] ?? "")}</td><td class="email-column-gap" width="12"></td><td class="email-column" width="50%" valign="top" style="padding:12px;border:1px solid ${block.borderColor ?? "#e5e7eb"};border-radius:${block.borderRadius}px;font-family:${family},Helvetica,sans-serif;font-size:${block.fontSize}px;line-height:${lineHeight};color:${block.textColor};">${lineBreaks(columns[1] ?? "")}</td></tr></table>`;
  } else if (block.type === "divider") {
    content = `<div style="border-top:1px solid ${block.textColor};font-size:0;line-height:0;">&nbsp;</div>`;
  } else if (block.type === "spacer") {
    content = "&nbsp;";
  } else if (block.type === "social") {
    const items = block.content.split("|").map((item) => item.trim()).filter(Boolean);
    const links = items.length >= 2 && items.length % 2 === 0 && items.every((item, index) => index % 2 === 0 || item.startsWith("https://"));
    content = `<div style="font-family:${family},Helvetica,sans-serif;font-size:${block.fontSize}px;line-height:${lineHeight};color:${block.textColor};">${links ? items.flatMap((item, index) => index % 2 === 0 ? [`<a href="${escapeHtml(items[index + 1])}" style="color:${accent};font-weight:600;text-decoration:none;">${escapeHtml(item)}</a>`] : []).join(" &nbsp;·&nbsp; ") : items.map(escapeHtml).join(" &nbsp;·&nbsp; ")}</div>`;
  } else if (block.type === "hero") {
    const [title = "", subtitle = ""] = block.content.split("|");
    const bodyFamily = companionBodyFont(block.fontFamily ?? "Arial");
    content = `<div style="border-radius:${block.borderRadius}px;"><div style="font-family:${family};font-size:${block.fontSize}px;font-weight:${weight};line-height:${lineHeight};letter-spacing:-.2px;color:${block.textColor};">${lineBreaks(title)}</div>${subtitle ? `<div style="max-width:520px;margin-top:14px;font-family:${bodyFamily};font-size:16px;font-weight:400;line-height:1.5;color:${block.textColor};opacity:.8;">${lineBreaks(subtitle)}</div>` : ""}</div>`;
  } else if (block.type === "quote") {
    const [quote = "", author = ""] = block.content.split("|");
    content = `<blockquote style="margin:0;padding:20px;border-left:4px solid ${accent};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#f8f8fb" : block.backgroundColor};font-family:${family},Helvetica,sans-serif;color:${block.textColor};"><div style="font-size:${block.fontSize}px;line-height:${lineHeight};">“${lineBreaks(quote)}”</div><div style="margin-top:10px;font-size:13px;font-weight:700;">${lineBreaks(author)}</div></blockquote>`;
  } else if (block.type === "checklist") {
    content = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${block.content.split("|").filter(Boolean).map((item) => `<tr><td width="28" valign="top" style="padding:5px 0;color:${accent};font-weight:700;">✓</td><td style="padding:5px 0;font-family:${family},Helvetica,sans-serif;font-size:${block.fontSize}px;line-height:${lineHeight};color:${block.textColor};">${lineBreaks(item.trim())}</td></tr>`).join("")}</table>`;
  } else if (block.type === "stats") {
    const items = block.content.split("|");
    content = `<table class="email-columns" role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${[0, 2].map((index) => `<td class="email-column" width="50%" style="padding:16px;text-align:center;border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#f7f8fc" : block.backgroundColor};font-family:${family},Helvetica,sans-serif;"><div style="font-size:28px;font-weight:700;color:${block.accentColor ?? accent};">${lineBreaks(items[index] ?? "")}</div><div style="margin-top:5px;font-size:${block.fontSize}px;color:${block.textColor};">${lineBreaks(items[index + 1] ?? "")}</div></td>${index === 0 ? '<td class="email-column-gap" width="12"></td>' : ''}`).join("")}</tr></table>`;
  } else if (block.type === "product") {
    const [name = "", description = "", price = ""] = block.content.split("|");
    content = `<div style="padding:22px;border:1px solid ${block.borderColor ?? "#e5e7eb"};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#ffffff" : block.backgroundColor};font-family:${family},Helvetica,sans-serif;color:${block.textColor};"><div style="font-size:20px;font-weight:700;">${lineBreaks(name)}</div><div style="margin-top:8px;font-size:${block.fontSize}px;line-height:${lineHeight};">${lineBreaks(description)}</div><div style="margin-top:14px;font-size:18px;font-weight:700;">${lineBreaks(price)}</div><a href="${escapeHtml(block.href ?? "")}" style="display:inline-block;margin-top:16px;padding:10px 18px;border-radius:8px;background:${accent};color:#fff;text-decoration:none;font-size:13px;font-weight:700;">${lineBreaks(block.label || "Узнать подробнее")}</a></div>`;
  } else if (block.type === "pattern") {
    content = block.href
      ? `<img src="${escapeHtml(block.href)}" alt="" role="presentation" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:${block.borderRadius}px;background:transparent;">`
      : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background-color:${block.backgroundColor === "transparent" ? `${accent}12` : block.backgroundColor};border-radius:${block.borderRadius}px;"><tr><td align="center" valign="middle" style="height:64px;padding:12px 24px;font-family:${family};font-size:${block.fontSize}px;font-weight:${weight};line-height:${lineHeight};letter-spacing:${tracking}px;color:${block.textColor};text-align:center;">${lineBreaks(block.content)}</td></tr></table>`;
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
  } else if (block.type === "notice") {
    const [eyebrow = "", message = "", status = ""] = block.content.split("|");
    content = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:${block.borderWidth || 1}px solid ${block.borderColor || accent};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? `${accent}10` : block.backgroundColor};"><tr><td width="42" valign="top" style="padding:20px 0 20px 20px;font-size:22px;color:${accent};">●</td><td style="padding:20px;font-family:${family},sans-serif;color:${block.textColor};"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent};">${lineBreaks(eyebrow)}</div><div style="margin-top:7px;font-size:${block.fontSize + 3}px;font-weight:700;line-height:1.35;">${lineBreaks(message)}</div><div style="margin-top:6px;font-size:12px;line-height:1.5;opacity:.72;">${lineBreaks(status)}</div></td></tr></table>`;
  } else if (block.type === "comparison") {
    const items = block.content.split("|");
    content = `<table class="email-columns" role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${[0, 2].map((index) => `<td class="email-column" width="49%" valign="top" style="padding:18px;border:1px solid ${block.borderColor || "#e5e7eb"};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#ffffff" : block.backgroundColor};font-family:${family},sans-serif;color:${block.textColor};"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${accent};">${lineBreaks(items[index] || "")}</div><div style="margin-top:8px;font-size:${block.fontSize}px;line-height:${lineHeight};">${lineBreaks(items[index + 1] || "")}</div></td>${index === 0 ? '<td class="email-column-gap" width="2%"></td>' : ''}`).join("")}</tr></table>`;
  } else if (block.type === "document") {
    const [name = "", meta = "", status = ""] = block.content.split("|");
    content = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${block.borderColor || "#e5e7eb"};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? "#f7f7fa" : block.backgroundColor};"><tr><td width="58" valign="middle" style="padding:20px 0 20px 20px;font-size:28px;color:${accent};">▤</td><td style="padding:20px 12px;font-family:${family},sans-serif;color:${block.textColor};"><strong style="font-size:${block.fontSize + 2}px;">${lineBreaks(name)}</strong><div style="margin-top:5px;font-size:12px;opacity:.68;">${lineBreaks(meta)} · ${lineBreaks(status)}</div></td><td align="right" style="padding:20px;"><a href="${escapeHtml(block.href ?? "")}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:${accent};color:#fff;font-family:${family},sans-serif;font-size:12px;font-weight:700;text-decoration:none;">${lineBreaks(block.label || "Открыть")}</a></td></tr></table>`;
  } else if (block.type === "compliance") {
    const [status = "", description = "", hint = ""] = block.content.split("|");
    content = `<div style="padding:20px;border:1px solid ${block.borderColor || `${accent}55`};border-radius:${block.borderRadius}px;background:${block.backgroundColor === "transparent" ? `${accent}0d` : block.backgroundColor};font-family:${family},sans-serif;color:${block.textColor};"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${accent};">✓ ${lineBreaks(status)}</div><div style="margin-top:8px;font-size:${block.fontSize}px;line-height:${lineHeight};">${lineBreaks(description)}</div><div style="margin-top:8px;font-size:12px;opacity:.68;">${lineBreaks(hint)}</div><a href="${escapeHtml(block.href ?? "")}" style="display:inline-block;margin-top:14px;color:${accent};font-size:12px;font-weight:700;text-decoration:underline;">${lineBreaks(block.label || "Настроить")}</a></div>`;
  }
  return `<tr><td class="email-block" style="${wrapper}"><div style="width:${block.widthPercent ?? 100}%;margin:${block.alignment === "center" ? "0 auto" : block.alignment === "right" ? "0 0 0 auto" : "0 auto 0 0"};border:${block.borderWidth ?? 0}px solid ${block.borderColor ?? "#e5e7eb"};border-radius:${block.borderRadius}px;box-sizing:border-box;">${content}</div></td></tr>`;
}

export function compileEmailDocument(document: EmailBuilderDocumentInput) {
  if (document.rawHtml) return document.rawHtml;
  const blocks = document.blocks.map((block) => blockHtml(block, document.accentColor)).join("");
  const frameCss = emailFrameInlineCss(document.frameStyle ?? "none", document.frameColor ?? document.accentColor, document.frameRadius ?? 0);
  const backgroundImage = document.backgroundImageUrl
    ? `background-image:url('${escapeHtml(document.backgroundImageUrl)}');background-repeat:no-repeat;background-position:center top;background-size:cover;`
    : "";
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><style>body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0;mso-table-rspace:0}@media only screen and (max-width:680px){.email-outer{padding:12px 8px!important}.email-shell{width:100%!important;max-width:100%!important}.email-block{padding-left:20px!important;padding-right:20px!important}.email-cta{display:block!important;text-align:center!important}.email-headline{font-size:28px!important}.email-columns,.email-columns tbody,.email-columns tr{display:block!important;width:100%!important}.email-column{display:block!important;width:auto!important}.email-column-gap{display:block!important;width:100%!important;height:12px!important}}</style><!--[if mso]><style>body,table,td,a{font-family:Arial,Helvetica,sans-serif!important}td{mso-line-height-rule:exactly}</style><![endif]--></head><body style="margin:0;padding:0;background:${document.workspaceBackground};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(document.previewText)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${document.workspaceBackground};"><tr><td class="email-outer" align="center" style="padding:24px 12px;"><table class="email-shell" role="presentation" width="${document.contentWidth}" cellspacing="0" cellpadding="0" background="${document.backgroundImageUrl ? escapeHtml(document.backgroundImageUrl) : ""}" style="table-layout:fixed;width:100%;max-width:${document.contentWidth}px;background-color:${document.bodyBackground};${backgroundImage}${frameCss}overflow:hidden;">${blocks}</table></td></tr></table></body></html>`;
  if (html.length > 500_000) {
    throw new ApiRequestError("Скомпилированный HTML письма превышает 500 КБ.");
  }
  return html;
}

export function emailDocumentPlainText(
  document: EmailBuilderDocumentInput,
): string {
  if (document.rawHtml) {
    const decode = (value: string) => value.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#34|#39|#160);/gi, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&#34;": '"', "&#39;": "'", "&#160;": " " })[entity.toLowerCase()] ?? entity);
    const preformatted = document.rawHtml.match(/<body[^>]*>\s*<pre\b[^>]*>([\s\S]*?)<\/pre>\s*<\/body>/i);
    if (preformatted && !/<[^>]+>/.test(preformatted[1])) return decode(preformatted[1]).slice(0, 200_000);
    const text = document.rawHtml
      .replace(/<img\b[^>]*\balt\s*=\s*(["'])([\s\S]*?)\1[^>]*>/gi, (_tag, _quote, alt: string) => ` ${alt} `)
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text && /<img\b/i.test(document.rawHtml)) return document.subject || "Письмо в изображении";
    if (!text) throw new ApiRequestError("Импортированный HTML не содержит текста.");
    return decode(text).slice(0, 200_000);
  }
  const sections = document.blocks.flatMap((block) => {
    if (block.type === "divider" || block.type === "spacer" || block.type === "pattern") return [];
    if (block.type === "button") return [block.label || block.content];
    if (block.type === "columns") {
      return block.content.split("|").map((value) => value.trim());
    }
    if (["hero", "quote", "checklist", "stats", "product", "signature", "banner", "timeline", "faq", "coupon", "video", "notice", "comparison", "document", "compliance"].includes(block.type)) {
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
