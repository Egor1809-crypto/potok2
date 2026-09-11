import type { EmailBuilderBlockInput } from "@/types/api";
import { safeEmailUrl } from "./urls";
import { readableColor } from "@/lib/design-readability";

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const lines = (text: string) => escape(text).replaceAll("\n", "<br>");
const url = (value: string | undefined, media = false) => { try { return value ? escape(safeEmailUrl(value, media, process.env.NODE_ENV === "development")) : ""; } catch { return ""; } };
const table = (content: string, extra = "") => `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;" ${extra}>${content}</table>`;

/** Shared by the editable canvas and final compiler; no generated HTML or arbitrary CSS. */
export function renderEmailVariant(block: EmailBuilderBlockInput, accent: string): string {
  const parts = block.content.split("|"); const variant = block.variant || "";
  const color = block.textColor; const family = `${block.fontFamily || "Arial"},sans-serif`;
  const style = `font-family:${family};font-size:${block.fontSize}px;line-height:${(block.lineHeight || 155) / 100};color:${color};text-align:${block.alignment || "left"};`;
  const image = (href: string | undefined, alt: string, width = 560) => url(href, true) ? `<img src="${url(href, true)}" alt="${escape(alt)}" width="${width}" style="display:block;width:100%;max-width:100%;height:auto;font-size:12px;line-height:1.4;border:0;border-radius:${block.borderRadius}px;">` : "";
  const buttonColor = block.backgroundColor.toLowerCase() === accent.toLowerCase() ? "#FFFFFF" : accent;
  const button = () => url(block.href) ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:${block.alignment === "center" ? "18px auto 0" : "18px 0 0"};"><tr><td bgcolor="${buttonColor}" style="background:${buttonColor};border-radius:${block.borderRadius}px;text-align:center;"><a class="email-cta" href="${url(block.href)}" style="display:inline-block;padding:14px 24px;font-family:${family};font-size:16px;font-weight:700;line-height:1.3;text-decoration:none;color:${readableColor("#FFFFFF", buttonColor)};">${lines(block.label || block.content)}</a></td></tr></table>` : "";
  let html = "";
  if (block.aiRole === "header") {
    html = block.href ? `<div style="max-width:180px;margin:${block.alignment === "center" ? "auto" : "0"};">${image(block.href, block.content, 180)}</div>` : `<strong>${lines(block.content)}</strong>`;
    if (url(block.linkHref)) html = `<a href="${url(block.linkHref)}" style="color:${color};text-decoration:none;">${html}</a>`;
  } else if (block.aiRole === "hero") {
    const copy = `<h1 class="email-headline" style="margin:0;font-family:${family};font-size:${block.fontSize}px;line-height:1.18;color:${color};">${lines(parts[0] || "")}</h1>${parts[1] ? `<p style="margin:18px 0 0;font-size:16px;line-height:1.6;">${lines(parts.slice(1).join("|"))}</p>` : ""}${block.label ? button() : ""}`;
    const visual = image(block.imageHref, block.imageAlt || "", 560);
    if (visual && /image-(left|right)/.test(variant)) {
      const cell = (content: string) => `<td class="email-column" width="48%" valign="middle" style="width:48%;">${content}</td>`;
      html = table(`<tr>${cell(variant.endsWith("left") ? visual : copy)}<td class="email-column-gap" width="24">&nbsp;</td>${cell(variant.endsWith("left") ? copy : visual)}</tr>`, 'class="email-columns"');
    } else html = `${visual ? `<div style="margin-bottom:24px;">${visual}</div>` : ""}${copy}`;
  } else if (block.aiRole === "image") html = image(block.href, block.content);
  else if (block.aiRole === "pattern") html = url(block.href, true) ? `<img src="${url(block.href, true)}" alt="" role="presentation" width="560" style="display:block;width:100%;max-width:100%;height:auto;border:0;background:transparent;">` : "";
  else if (["benefits", "cards", "speakers", "products"].includes(block.aiRole || "")) {
    const count = /3-column|three/.test(variant) ? 3 : /list/.test(variant) ? 1 : 2;
    const rows: string[] = [];
    for (let index = 0; index < parts.length; index += count) {
      rows.push(`<tr>${parts.slice(index, index + count).map(item => `<td class="email-column" width="${Math.floor(100 / count)}%" valign="top" style="padding:14px;${count > 1 ? `border:1px solid ${block.borderColor || "#E5E7EB"};` : "border-bottom:1px solid #E5E7EB;"}border-radius:${block.borderRadius}px;font-size:16px;line-height:1.55;">${lines(item)}</td>`).join('<td class="email-column-gap" width="12">&nbsp;</td>')}</tr>`);
    }
    html = table(rows.join(""), 'class="email-columns"');
  } else if (block.aiRole === "stats") {
    html = table(`<tr>${parts.flatMap((value, index) => index % 2 ? [] : [`<td class="email-column" valign="top" style="padding:16px;text-align:center;"><strong style="font-size:30px;color:${readableColor(accent, block.backgroundColor)};">${lines(value)}</strong><div style="margin-top:8px;font-size:15px;">${lines(parts[index + 1] || "")}</div></td>`]).join("")}</tr>`, 'class="email-columns"');
  } else if (block.aiRole === "quote" || block.aiRole === "review") html = `<blockquote style="margin:0;padding:16px 20px;border-left:3px solid ${accent};"><p style="margin:0;">${lines(parts[0] || "")}</p>${parts[1] ? `<p style="margin:14px 0 0;font-size:13px;">${lines(parts[1])}</p>` : ""}</blockquote>`;
  else if (block.aiRole === "cta") html = block.type === "button" ? button() : lines(block.content);
  else if (block.aiRole === "urgency") html = `<strong style="font-size:12px;">${lines(parts[0] || "Важно")}</strong><p style="font-size:20px;font-weight:700;">${lines(parts[1] || "")}</p>${lines(parts[2] || "")}`;
  else if (block.aiRole === "footer") html = `${lines(block.content)}<p style="margin:14px 0 0;"><a href="{{UnsubscribeUrl}}" style="color:${color};text-decoration:underline;">Отписаться от рассылки</a></p>`;
  else if (block.aiRole === "divider") html = `<div style="border-top:1px solid ${color};font-size:0;line-height:0;">&nbsp;</div>`;
  else if (block.aiRole === "spacer") html = "&nbsp;";
  else html = block.content.split(/\n\n+/).map(p => `<p style="margin:0 0 12px;font-weight:${block.fontWeight || 400};">${lines(p)}</p>`).join("");
  const badge = block.badge && block.aiRole !== "urgency" ? `<p style="margin:0 0 12px;font-size:12px;line-height:1.4;letter-spacing:1px;font-weight:700;">${lines(block.badge)}</p>` : "";
  return `<div style="${style}">${badge}${html}</div>`;
}
