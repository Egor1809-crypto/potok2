import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { safeEmailUrl } from "@/lib/email-ai/urls";

type Element = DefaultTreeAdapterTypes.Element;
type Node = DefaultTreeAdapterTypes.Node;
export type LetterElement = {
  index: number; tag: string; kind: "image" | "link" | "text";
  label: string; node: Element; attributes: Record<string, string>;
  texts: { start: number; end: number; value: string }[];
};
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const inline = new Set(["span", "strong", "b", "em", "i", "u", "s", "small", "font", "br", "sup", "sub"]);
const textTags = new Set(["p", "div", "td", "th", "li", "h1", "h2", "h3", "h4", "h5", "h6", ...inline]);
const children = (node: Node): Node[] => "childNodes" in node ? node.childNodes : [];
const isElement = (node: Node): node is Element => "tagName" in node;
function textParts(node: Node): LetterElement["texts"] {
  if (node.nodeName === "#text" && "value" in node && node.sourceCodeLocation) return [{ start: node.sourceCodeLocation.startOffset, end: node.sourceCodeLocation.endOffset, value: node.value }];
  return children(node).flatMap(textParts);
}
function onlyInline(node: Node): boolean { return children(node).every(child => !isElement(child) || child.tagName === "img" || inline.has(child.tagName) && onlyInline(child)); }

/** Source locations let us change one attribute/text run without serializing the
 * document. In particular, Outlook conditional comments and media rules survive. */
export function letterElements(html: string): LetterElement[] {
  const result: LetterElement[] = [];
  function visit(node: Node, textSelected = false) {
    if (isElement(node) && ["head", "script", "style", "template", "noscript"].includes(node.tagName)) return;
    let selected = false;
    if (isElement(node) && node.sourceCodeLocation?.startTag) {
      const texts = textParts(node).filter(part => part.value.trim());
      const kind = node.tagName === "img" ? "image" : node.tagName === "a" ? "link" : !textSelected && textTags.has(node.tagName) && onlyInline(node) && texts.length ? "text" : null;
      if (kind) {
        const attributes = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
        result.push({ index: 0, node, tag: node.tagName, kind, attributes, texts,
          label: kind === "image" ? attributes.alt || "Изображение" : texts.map(text => text.value).join(" ").trim().slice(0, 100) || "Кнопка / ссылка" });
        selected = kind !== "image";
      }
    }
    children(node).forEach(child => visit(child, textSelected || selected));
  }
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return result.sort((a, b) => a.node.sourceCodeLocation!.startOffset - b.node.sourceCodeLocation!.startOffset).map((element, index) => ({ ...element, index }));
}

function replaceAt(html: string, start: number, end: number, value: string) { return html.slice(0, start) + value + html.slice(end); }
function attribute(html: string, node: Element, name: string, value: string | null) {
  const location = node.sourceCodeLocation!;
  const existing = location.attrs?.[name];
  if (existing) return replaceAt(html, existing.startOffset, existing.endOffset, value === null ? "" : `${name}="${escape(value)}"`);
  if (value === null) return html;
  const offset = location.startTag!.endOffset - (html[location.startTag!.endOffset - 2] === "/" ? 2 : 1);
  return replaceAt(html, offset, offset, ` ${name}="${escape(value)}"`);
}
export function editLetterAttribute(html: string, index: number, name: "src" | "alt" | "href" | "width" | "height" | "style" | "align" | "srcset" | "data-potok-original-src" | "data-potok-crop", value: string | null) {
  const element = letterElements(html)[index];
  if (!element) throw new Error("Элемент изменился. Выберите его снова.");
  if (name === "href" && value) safeEmailUrl(value);
  if (name === "src" && value && !/^\/email-icons\/[a-z0-9-]+\.png$/.test(value) && !/^\/api\/assets\/[\w-]+$/.test(value)) safeEmailUrl(value, true, process.env.NODE_ENV === "development");
  return attribute(html, element.node, name, value);
}
export function editLetterStyle(html: string, index: number, changes: Record<string, string>) {
  const element = letterElements(html)[index];
  if (!element) throw new Error("Выберите элемент письма.");
  return styleAttribute(html, element.node, changes);
}
function styleAttribute(html: string, node: Element, changes: Record<string, string>) {
  let style = node.attrs.find(attr => attr.name === "style")?.value || "";
  for (const [property, value] of Object.entries(changes)) {
    if (!/^[a-z-]+$/.test(property) || /[<>"{};]/.test(value)) throw new Error("Некорректное оформление.");
    style = style.replace(new RegExp(`(^|;)\\s*${property}\\s*:[^;]*(?=;|$)`, "gi"), "$1");
    style += `${style.trim().endsWith(";") || !style.trim() ? "" : ";"}${property}:${value};`;
  }
  return attribute(html, node, "style", style);
}

/** An image with height:auto is still clipped by a fixed-height wrapper. Touch
 * only restrictive properties on its ancestors, retaining tables and columns. */
export function clearLetterImageClipping(html: string, index: number, alignLink = false) {
  const item = letterElements(html)[index];
  let node = item?.node.parentNode;
  while (node && isElement(node) && !["body", "html"].includes(node.tagName)) {
    // Stop at a shared section: fixing one picture must not reflow its siblings.
    const countImages = (current: Node): number => (isElement(current) && current.tagName === "img" ? 1 : 0) + children(current).reduce((sum, child) => sum + countImages(child), 0);
    if (textParts(node).some(text => text.value.trim()) || countImages(node) > 1) break;
    if (node.sourceCodeLocation?.startTag) {
      const style = node.attrs.find(attr => attr.name === "style")?.value || "";
      const changes: Record<string, string> = {};
      for (const property of ["height", "min-height", "max-height", "overflow", "overflow-x", "overflow-y", "position", "transform", "clip-path", "margin", "margin-left", "margin-top", "margin-right", "margin-bottom"]) {
        const value = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(style)?.[1];
        if (!value) continue;
        if (property === "height") changes[property] = "auto !important";
        else if (property === "min-height") changes[property] = "0 !important";
        else if (property === "max-height") changes[property] = "none !important";
        else if (property.startsWith("overflow") && /hidden|clip/i.test(value)) changes[property] = "visible !important";
        else if (property === "position" && /absolute|fixed/i.test(value)) changes[property] = "static !important";
        else if (["transform", "clip-path"].includes(property)) changes[property] = "none !important";
        else if (property.startsWith("margin") && /-\d/.test(value)) changes[property] = "0 !important";
      }
      if (alignLink && node.tagName === "a" && !textParts(node).some(text => text.value.trim())) { changes.display = "block"; changes.width = "100%"; }
      // Ancestors precede descendants in source, so these edits keep earlier offsets valid.
      if (Object.keys(changes).length) html = styleAttribute(html, node, changes);
    }
    node = node.parentNode;
  }
  return html;
}
export function editLetterText(html: string, index: number, part: number, value: string) {
  const text = letterElements(html)[index]?.texts[part];
  if (!text) throw new Error("Текст изменился. Выберите его снова.");
  return replaceAt(html, text.start, text.end, escape(value));
}
export function setLetterLink(html: string, index: number, href: string) {
  const element = letterElements(html)[index];
  if (!element) throw new Error("Выберите кнопку, текст или изображение.");
  if (href) safeEmailUrl(href);
  if (element.tag === "a") return attribute(html, element.node, "href", href || null);
  let ancestor = element.node.parentNode;
  while (ancestor && isElement(ancestor)) {
    if (ancestor.tagName === "a") return attribute(html, ancestor, "href", href || null);
    ancestor = ancestor.parentNode;
  }
  if (!href) return html;
  const loc = element.node.sourceCodeLocation!;
  const link = (content: string) => `<a href="${escape(href)}" style="color:inherit;text-decoration:none;display:inline-block;">${content}</a>`;
  // Wrap text inside table cells, never wrap a td/tr in an invalid anchor.
  if (element.kind !== "image") return replaceAt(html, loc.startTag!.endOffset, loc.endTag?.startOffset ?? loc.endOffset, link(html.slice(loc.startTag!.endOffset, loc.endTag?.startOffset ?? loc.endOffset)));
  return replaceAt(html, loc.startOffset, loc.endOffset, link(html.slice(loc.startOffset, loc.endOffset)));
}
export function letterLink(element: LetterElement) {
  let node: Node | null = element.node;
  while (node && isElement(node)) {
    if (node.tagName === "a") return node.attrs.find(attr => attr.name === "href")?.value || "";
    node = node.parentNode;
  }
  return "";
}
export function selectableLetterHtml(html: string) {
  for (const item of letterElements(html).reverse()) {
    html = attribute(html, item.node, "data-potok-edit", String(item.index));
    const source = item.attributes.src;
    if (source && /^https:\/\/(?:mailflow-outreach\.isakovegor820\.chatgpt\.site|potok\.slava-hunter\.ru)\/(?:api\/assets|email-icons)\//.test(source)) html = attribute(html, item.node, "src", new URL(source).pathname);
  }
  return html;
}

export function insertLetterIcon(html: string, index: number, markup: string) {
  const item = letterElements(html)[index];
  if (!item) throw new Error("Выберите место для значка.");
  const loc = item.node.sourceCodeLocation!;
  const offset = item.kind === "image" ? loc.startOffset : loc.startTag!.endOffset;
  return replaceAt(html, offset, offset, markup);
}
