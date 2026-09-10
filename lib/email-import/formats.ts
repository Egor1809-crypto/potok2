export const importAccept = ".html,.htm,.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp,.txt,.json,.css";
export const escapeMarkup = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function decodeDocument(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  const head = new TextDecoder("ascii").decode(bytes.slice(0, 2048));
  const encoding = head.match(/charset\s*=\s*["']?\s*([\w-]+)/i)?.[1];
  if (encoding) { try { return new TextDecoder(encoding).decode(bytes); } catch { /* Try UTF-8 below. */ } }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1251").decode(bytes); }
}
export function completeHtml(html: string) {
  // Preserve complete documents byte for byte after decoding, including MSO
  // conditional comments, media queries and table attributes.
  if (/^(?:\s|<!--[\s\S]*?-->)*(?:<!doctype\s+html|<html[\s>])/i.test(html)) return html;
  if (/<body[\s>]/i.test(html)) return `<!doctype html><html>${/<head[\s>]/i.test(html) ? "" : '<head><meta charset="utf-8"></head>'}${html}</html>`;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
}
export function textLetter(text: string) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><pre style="margin:0;white-space:pre-wrap;overflow-wrap:break-word;font:16px/1.5 Arial,sans-serif">${escapeMarkup(text)}</pre></body></html>`;
}
export function checkEmailHtml(html: string) {
  const unsupported = () => { throw new Error("В HTML есть сценарии, формы или встроенные объекты. Экспортируйте статичную HTML-версию письма: почтовые программы не поддерживают эти элементы."); };
  for (const [tag] of html.matchAll(/<(?:[^"'<>]|"[^"]*"|'[^']*')+>/g)) {
    const name = tag.match(/^<\s*([a-z][\w:-]*)/i)?.[1]?.toLowerCase();
    if (!name) continue;
    if (["script", "iframe", "object", "embed", "form", "base"].includes(name)) unsupported();
    for (const attr of tag.matchAll(/(?:\s+|\/)([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      const key = attr[1].toLowerCase();
      const value = (attr[2] ?? attr[3] ?? attr[4]).replace(/&#(x[\da-f]+|\d+);?/gi, (_, code: string) => String.fromCodePoint(Math.min(0x10ffff, parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10)))).split("").filter(char => char.charCodeAt(0) > 32).join("");
      if (/^on[a-z]+$/.test(key) || (["href", "src", "action", "xlink:href"].includes(key) && /^(javascript|vbscript):/i.test(value)) || (key === "http-equiv" && value.toLowerCase() === "refresh")) unsupported();
    }
  }
}
