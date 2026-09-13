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
  if (name === "src" && value && !/^\/email-icons\/[a-z-]+\.png$/.test(value) && !/^\/api\/assets\/[\w-]+$/.test(value)) safeEmailUrl(value, true, process.env.NODE_ENV === "development");
  return attribute(html, element.node, name, value);
}
export function editLetterStyle(html: string, index: number, changes: Record<string, string>) {
  const element = letterElements(html)[index];
  if (!element) throw new Error("Выберите элемент письма.");
  let style = element.attributes.style || "";
  for (const [property, value] of Object.entries(changes)) {
    if (!/^[a-z-]+$/.test(property) || /[<>"{};]/.test(value)) throw new Error("Некорректное оформление.");
    style = style.replace(new RegExp(`(^|;)\\s*${property}\\s*:[^;]*(?=;|$)`, "gi"), "$1");
    style += `${style.trim().endsWith(";") || !style.trim() ? "" : ";"}${property}:${value};`;
  }
  return editLetterAttribute(html, index, "style", style);
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
