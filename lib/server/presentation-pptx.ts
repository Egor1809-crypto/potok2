import type {
  PresentationProjectRecord,
  PresentationSlide,
} from "@/types/api";

const SLIDE_WIDTH = 12_192_000;
const SLIDE_HEIGHT = 6_858_000;
const EMU = 914_400;

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function hex(value: string) {
  return value.replace("#", "").toUpperCase();
}

function dark(value: string) {
  const color = hex(value);
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 145;
}

function rect(id: number, name: string, x: number, y: number, w: number, h: number, fill: string, radius = false) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${radius ? "roundRect" : "rect"}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${hex(fill)}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

function presentationPatternShapes(project: PresentationProjectRecord, startId: number) {
  let id = startId;
  const shapes: string[] = [];
  const soft = dark(project.backgroundColor)
    ? project.themeId === "noir" ? "#263746" : "#292330"
    : project.themeId === "ocean" ? "#D9F1EE" : project.themeId === "sunrise" ? "#FFE1C7" : "#EDE3FA";
  if (project.themeId === "atelier") {
    shapes.push(rect(id++, "Узор · редакционная полоса", 11.88 * EMU, 0, 0.34 * EMU, 6.45 * EMU, soft));
    shapes.push(rect(id++, "Узор · нижний угол", 0, 6.62 * EMU, 3.1 * EMU, 0.12 * EMU, project.accentColor));
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 4; column += 1) {
      shapes.push(rect(id++, `Узор · точка ${row + 1}.${column + 1}`, (10.95 + column * 0.22) * EMU, (0.35 + row * 0.22) * EMU, 0.055 * EMU, 0.055 * EMU, project.accentColor, true));
    }
  } else if (project.themeId === "noir") {
    shapes.push(rect(id++, "Узор · верхняя рейка", 8.65 * EMU, 0.3 * EMU, 3.75 * EMU, 0.07 * EMU, project.accentColor));
    shapes.push(rect(id++, "Узор · правая рейка", 12.35 * EMU, 0.3 * EMU, 0.07 * EMU, 2.0 * EMU, project.accentColor));
    shapes.push(rect(id++, "Узор · нижняя панель", 9.25 * EMU, 6.58 * EMU, 3.0 * EMU, 0.22 * EMU, soft));
  } else if (project.themeId === "ocean") {
    shapes.push(rect(id++, "Узор · волна 1", 10.95 * EMU, 0.35 * EMU, 1.45 * EMU, 0.14 * EMU, project.accentColor, true));
    shapes.push(rect(id++, "Узор · волна 2", 11.25 * EMU, 0.62 * EMU, 1.15 * EMU, 0.14 * EMU, soft, true));
    shapes.push(rect(id++, "Узор · волна 3", 11.58 * EMU, 0.89 * EMU, 0.82 * EMU, 0.14 * EMU, project.accentColor, true));
    shapes.push(rect(id++, "Узор · береговая линия", 0, 6.72 * EMU, 12.25 * EMU, 0.07 * EMU, soft));
  } else if (project.themeId === "sunrise") {
    shapes.push(rect(id++, "Узор · солнечная плашка", 10.8 * EMU, 0, 1.42 * EMU, 1.15 * EMU, soft, true));
    shapes.push(rect(id++, "Узор · луч 1", 10.12 * EMU, 0.23 * EMU, 0.55 * EMU, 0.08 * EMU, project.accentColor));
    shapes.push(rect(id++, "Узор · луч 2", 10.28 * EMU, 0.52 * EMU, 0.42 * EMU, 0.08 * EMU, project.accentColor));
    shapes.push(rect(id++, "Узор · нижняя лента", 0, 6.54 * EMU, 5.1 * EMU, 0.25 * EMU, soft));
  } else {
    shapes.push(rect(id++, "Узор · фиолетовый модуль", 10.72 * EMU, 0, 1.5 * EMU, 1.28 * EMU, soft, true));
    shapes.push(rect(id++, "Узор · диагональ 1", 11.0 * EMU, 1.45 * EMU, 1.25 * EMU, 0.09 * EMU, project.accentColor));
    shapes.push(rect(id++, "Узор · диагональ 2", 11.35 * EMU, 1.73 * EMU, 0.9 * EMU, 0.09 * EMU, soft));
    shapes.push(rect(id++, "Узор · нижний ритм", 8.45 * EMU, 6.56 * EMU, 3.8 * EMU, 0.22 * EMU, soft));
  }
  return { shapes, nextId: id };
}

type TextOptions = {
  color: string;
  fontSize: number;
  fontFace?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "l" | "ctr" | "r";
  valign?: "t" | "ctr" | "b";
  margin?: number;
  bullet?: boolean;
};

function textParagraph(value: string, options: TextOptions) {
  const bullet = options.bullet ? '<a:buChar char="•"/>' : "";
  const indent = options.bullet ? ` marL="${Math.round(0.28 * EMU)}" indent="-${Math.round(0.16 * EMU)}"` : "";
  return `<a:p><a:pPr algn="${options.align ?? "l"}"${indent}>${bullet}</a:pPr><a:r><a:rPr lang="ru-RU" sz="${Math.round(options.fontSize * 100)}"${options.bold ? ' b="1"' : ""}${options.italic ? ' i="1"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${hex(options.color)}"/></a:solidFill><a:latin typeface="${xml(options.fontFace ?? "Arial")}"/><a:cs typeface="${xml(options.fontFace ?? "Arial")}"/></a:rPr><a:t>${xml(value || " ")}</a:t></a:r><a:endParaRPr lang="ru-RU" sz="${Math.round(options.fontSize * 100)}"/></a:p>`;
}

function textBox(
  id: number,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  paragraphs: Array<{ text: string; options: TextOptions }>,
  options?: { fill?: string; radius?: boolean },
) {
  const margin = paragraphs[0]?.options.margin ?? 0;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${options?.radius ? "roundRect" : "rect"}"><a:avLst/></a:prstGeom>${options?.fill ? `<a:solidFill><a:srgbClr val="${hex(options.fill)}"/></a:solidFill>` : "<a:noFill/>"}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="${margin}" rIns="${margin}" tIns="${margin}" bIns="${margin}" anchor="${paragraphs[0]?.options.valign ?? "t"}"/><a:lstStyle/>${paragraphs.map((item) => textParagraph(item.text, item.options)).join("")}</p:txBody></p:sp>`;
}

type ImageEntry = {
  bytes: Uint8Array;
  extension: "png" | "jpg" | "gif";
  contentType: "image/png" | "image/jpeg" | "image/gif";
  width?: number;
  height?: number;
};

function imageDimensions(bytes: Uint8Array, contentType: ImageEntry["contentType"]) {
  if (contentType === "image/png" && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (contentType === "image/gif" && bytes.length >= 10) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (contentType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: (bytes[offset + 5] << 8) + bytes[offset + 6], width: (bytes[offset + 7] << 8) + bytes[offset + 8] };
      }
      if (!length) break;
      offset += length + 2;
    }
  }
  return {};
}

function cropForCover(image: ImageEntry, frameWidth: number, frameHeight: number) {
  if (!image.width || !image.height) return "";
  const imageRatio = image.width / image.height;
  const frameRatio = frameWidth / frameHeight;
  if (imageRatio > frameRatio) {
    const visible = frameRatio / imageRatio;
    const crop = Math.round((1 - visible) * 50_000);
    return `<a:srcRect l="${crop}" r="${crop}"/>`;
  }
  const visible = imageRatio / frameRatio;
  const crop = Math.round((1 - visible) * 50_000);
  return `<a:srcRect t="${crop}" b="${crop}"/>`;
}

function picture(id: number, name: string, relationshipId: string, image: ImageEntry, x: number, y: number, w: number, h: number) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relationshipId}"/>${cropForCover(image, w, h)}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></p:spPr></p:pic>`;
}

function slideShapes(project: PresentationProjectRecord, slide: PresentationSlide, image?: ImageEntry) {
  const accent = project.accentColor;
  const background = project.backgroundColor;
  const text = project.textColor;
  const inverse = dark(accent) ? "#FFFFFF" : "#151019";
  const muted = dark(background) ? "#C9C3CD" : "#6D6472";
  const x = 0.82 * EMU;
  const fullWidth = 11.7 * EMU;
  const imageWidth = image ? 4.35 * EMU : 0;
  const contentWidth = image ? 6.75 * EMU : fullWidth;
  let id = 2;
  const shapes: string[] = [];
  const pattern = presentationPatternShapes(project, id);
  shapes.push(...pattern.shapes);
  id = pattern.nextId;
  if (slide.layout !== "closing") {
    shapes.push(rect(id++, "Акцентная линия", x, 0.52 * EMU, 0.68 * EMU, 0.08 * EMU, accent, true));
    if (slide.eyebrow) shapes.push(textBox(id++, "Надзаголовок", x, 0.72 * EMU, contentWidth, 0.36 * EMU, [{ text: slide.eyebrow.toUpperCase(), options: { color: accent, fontSize: 12, bold: true } }]));
    if (image) shapes.push(picture(id++, "Изображение", "rId2", image, 8.1 * EMU, 1.15 * EMU, imageWidth, 5.65 * EMU));
  }

  if (slide.layout === "title") {
    shapes.push(textBox(id++, "Заголовок", x, 1.35 * EMU, contentWidth, 2.35 * EMU, [{ text: slide.title, options: { color: text, fontSize: 50, bold: true, valign: "ctr" } }]));
    if (slide.body) shapes.push(textBox(id++, "Подзаголовок", x, 4.0 * EMU, contentWidth * 0.9, 1.25 * EMU, [{ text: slide.body, options: { color: muted, fontSize: 23 } }]));
    shapes.push(textBox(id++, "Маркер", x, 6.62 * EMU, 2.2 * EMU, 0.3 * EMU, [{ text: "ПРЕЗЕНТАЦИИ «ПОТОК»", options: { color: muted, fontSize: 9, bold: true } }]));
  } else if (slide.layout === "statement") {
    shapes.push(textBox(id++, "Главная мысль", x, 1.35 * EMU, contentWidth, 3.2 * EMU, [{ text: slide.title, options: { color: text, fontSize: image ? 34 : 43, bold: true, valign: "ctr" } }]));
    if (slide.body) shapes.push(textBox(id++, "Пояснение", x, 4.9 * EMU, contentWidth, 1.1 * EMU, [{ text: slide.body, options: { color: muted, fontSize: 19 } }]));
  } else if (slide.layout === "split") {
    const leftWidth = image ? contentWidth : 5.55 * EMU;
    const rightX = image ? x : 6.75 * EMU;
    const rightWidth = image ? 0 : 5.55 * EMU;
    shapes.push(textBox(id++, "Заголовок", x, 1.25 * EMU, leftWidth, 1.75 * EMU, [{ text: slide.title, options: { color: text, fontSize: image ? 32 : 36, bold: true } }]));
    if (slide.body) shapes.push(textBox(id++, "Текст", x, 3.2 * EMU, leftWidth, 2.55 * EMU, [{ text: slide.body, options: { color: muted, fontSize: 18 } }]));
    if (!image) {
      shapes.push(rect(id++, "Плашка", rightX, 1.25 * EMU, rightWidth, 4.95 * EMU, dark(background) ? "#24262A" : "#F0E8E2", true));
      const items = slide.bullets.length ? slide.bullets : ["Добавьте ключевой аргумент", "Покажите следствие", "Зафиксируйте вывод"];
      shapes.push(textBox(id++, "Ключевые пункты", rightX + 0.38 * EMU, 1.7 * EMU, rightWidth - 0.76 * EMU, 4.1 * EMU, items.slice(0, 5).map((item) => ({ text: item, options: { color: text, fontSize: 19, bullet: true, margin: 0 } }))));
    }
  } else if (slide.layout === "quote") {
    shapes.push(textBox(id++, "Цитата", x, 1.25 * EMU, contentWidth, 3.7 * EMU, [{ text: `“${slide.title.replace(/^“|”$/g, "")}”`, options: { color: text, fontSize: image ? 32 : 41, bold: true, italic: true, fontFace: "Georgia", valign: "ctr" } }]));
    if (slide.body) shapes.push(textBox(id++, "Источник цитаты", x, 5.25 * EMU, contentWidth, 0.8 * EMU, [{ text: slide.body, options: { color: muted, fontSize: 17 } }]));
  } else if (slide.layout === "stats") {
    shapes.push(textBox(id++, "Заголовок", x, 1.05 * EMU, contentWidth, 1.1 * EMU, [{ text: slide.title, options: { color: text, fontSize: 35, bold: true } }]));
    const items = slide.bullets.length ? slide.bullets.slice(0, 3) : ["— | показатель", "— | показатель", "— | показатель"];
    const width = (contentWidth - 0.5 * EMU) / Math.max(1, items.length);
    items.forEach((item, index) => {
      const [metric = "—", label = "показатель"] = item.split("|").map((part) => part.trim());
      const itemX = x + index * (width + 0.25 * EMU);
      shapes.push(textBox(id++, `Показатель ${index + 1}`, itemX, 2.6 * EMU, width, 2.55 * EMU, [
        { text: metric, options: { color: accent, fontSize: 40, bold: true } },
        { text: label, options: { color: text, fontSize: 16 } },
      ], { fill: dark(background) ? "#24262A" : "#F0E8E2", radius: true }));
    });
    if (slide.body) shapes.push(textBox(id++, "Контекст", x, 5.55 * EMU, contentWidth, 0.65 * EMU, [{ text: slide.body, options: { color: muted, fontSize: 14 } }]));
  } else if (slide.layout === "closing") {
    shapes.push(rect(id++, "Финальная плашка", 0.55 * EMU, 0.55 * EMU, 12.23 * EMU, 6.4 * EMU, accent, true));
    if (slide.eyebrow) shapes.push(textBox(id++, "Финальный надзаголовок", 1.15 * EMU, 1.15 * EMU, 10.95 * EMU, 0.45 * EMU, [{ text: slide.eyebrow.toUpperCase(), options: { color: inverse, fontSize: 12, bold: true, align: "ctr" } }]));
    shapes.push(textBox(id++, "Финальный заголовок", 1.25 * EMU, 2.0 * EMU, 10.75 * EMU, 2.3 * EMU, [{ text: slide.title, options: { color: inverse, fontSize: 44, bold: true, align: "ctr", valign: "ctr" } }]));
    if (slide.body) shapes.push(textBox(id++, "Финальный текст", 2.2 * EMU, 4.65 * EMU, 8.85 * EMU, 1.1 * EMU, [{ text: slide.body, options: { color: inverse, fontSize: 19, align: "ctr" } }]));
  } else {
    shapes.push(textBox(id++, "Заголовок", x, 1.0 * EMU, contentWidth, 1.25 * EMU, [{ text: slide.title, options: { color: text, fontSize: 35, bold: true } }]));
    if (slide.body) shapes.push(textBox(id++, "Введение", x, 2.35 * EMU, contentWidth, 0.9 * EMU, [{ text: slide.body, options: { color: muted, fontSize: 17 } }]));
    const items = slide.bullets.length ? slide.bullets : ["Добавьте первый аргумент", "Добавьте второй аргумент", "Сформулируйте вывод"];
    shapes.push(textBox(id++, "Список", x, 3.35 * EMU, contentWidth, 2.8 * EMU, items.slice(0, 6).map((item) => ({ text: item, options: { color: text, fontSize: 20, bullet: true } }))));
  }
  return shapes.join("");
}

function slideXml(project: PresentationProjectRecord, slide: PresentationSlide, image?: ImageEntry) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex(project.backgroundColor)}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${slideShapes(project, slide, image)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

async function loadImage(request: Request, slide: PresentationSlide): Promise<ImageEntry | undefined> {
  if (!slide.assetId || !slide.imageUrl) return undefined;
  try {
    const requestUrl = new URL(request.url);
    const url = new URL(`/api/assets/${encodeURIComponent(slide.assetId)}`, requestUrl.origin);
    const expectedPath = `/api/assets/${encodeURIComponent(slide.assetId)}`;
    if (url.origin !== requestUrl.origin || url.pathname !== expectedPath) return undefined;
    const response = await fetch(url, { headers: { Accept: "image/png,image/jpeg,image/gif" }, redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
    if (contentType !== "image/png" && contentType !== "image/jpeg" && contentType !== "image/gif") return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.byteLength > 8 * 1024 * 1024) return undefined;
    const extension = contentType === "image/png" ? "png" : contentType === "image/gif" ? "gif" : "jpg";
    return { bytes, extension, contentType, ...imageDimensions(bytes, contentType) };
  } catch {
    return undefined;
  }
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

let crcTable: Uint32Array | undefined;
function crc32(bytes: Uint8Array) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function u16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function join(chunks: Uint8Array[]) {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

function zipStore(entries: Array<{ name: string; bytes: Uint8Array }>) {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  const stamp = dosDateTime();
  for (const entry of entries) {
    const name = utf8(entry.name);
    const crc = crc32(entry.bytes);
    const local = join([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(entry.bytes.byteLength), u32(entry.bytes.byteLength), u16(name.byteLength), u16(0), name, entry.bytes]);
    localChunks.push(local);
    centralChunks.push(join([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(entry.bytes.byteLength), u32(entry.bytes.byteLength), u16(name.byteLength), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += local.byteLength;
  }
  const central = join(centralChunks);
  const end = join([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.byteLength), u32(offset), u16(0)]);
  return join([...localChunks, central, end]);
}

function contentTypes(slides: number, images: ImageEntry[]) {
  const imageDefaults = [...new Set(images.map((image) => image.extension))].map((extension) => `<Default Extension="${extension}" ContentType="${extension === "jpg" ? "image/jpeg" : `image/${extension}`}"/>`).join("");
  const slideOverrides = Array.from({ length: slides }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageDefaults}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}</Types>`;
}

function packageEntries(project: PresentationProjectRecord, images: Array<ImageEntry | undefined>) {
  const files: Array<{ name: string; bytes: Uint8Array }> = [];
  const slideIds = project.slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  const slideRels = project.slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  const now = new Date().toISOString();
  const xmlFile = (name: string, content: string) => files.push({ name, bytes: utf8(content) });
  xmlFile("[Content_Types].xml", contentTypes(project.slides.length, images.filter((item): item is ImageEntry => Boolean(item))));
  xmlFile("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
  xmlFile("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(project.name)}</dc:title><dc:creator>Поток</dc:creator><cp:lastModifiedBy>Поток</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  xmlFile("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Поток</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>${project.slides.length}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop><Company>Поток</Company><AppVersion>1.0</AppVersion></Properties>`);
  xmlFile("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`);
  xmlFile("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRels}<Relationship Id="rId${project.slides.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId${project.slides.length + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId${project.slides.length + 4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`);
  xmlFile("ppt/presProps.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
  xmlFile("ppt/viewProps.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr snapToGrid="1" snapToObjects="1"/></p:slideViewPr><p:notesTextViewPr><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:notesTextViewPr><p:gridSpacing cx="72008" cy="72008"/></p:viewPr>');
  xmlFile("ppt/tableStyles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>');
  xmlFile("ppt/theme/theme1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Поток"><a:themeElements><a:clrScheme name="Поток"><a:dk1><a:srgbClr val="${hex(project.textColor)}"/></a:dk1><a:lt1><a:srgbClr val="${hex(project.backgroundColor)}"/></a:lt1><a:dk2><a:srgbClr val="${hex(project.textColor)}"/></a:dk2><a:lt2><a:srgbClr val="${hex(project.backgroundColor)}"/></a:lt2><a:accent1><a:srgbClr val="${hex(project.accentColor)}"/></a:accent1><a:accent2><a:srgbClr val="C7A6FF"/></a:accent2><a:accent3><a:srgbClr val="36C7B5"/></a:accent3><a:accent4><a:srgbClr val="F05A3C"/></a:accent4><a:accent5><a:srgbClr val="5D76CB"/></a:accent5><a:accent6><a:srgbClr val="C08A3E"/></a:accent6><a:hlink><a:srgbClr val="6558E8"/></a:hlink><a:folHlink><a:srgbClr val="8E5EB6"/></a:folHlink></a:clrScheme><a:fontScheme name="Поток"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Поток"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:solidFill><a:schemeClr val="lt2"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
  xmlFile("ppt/slideMasters/slideMaster1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>');
  xmlFile("ppt/slideMasters/_rels/slideMaster1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>');
  xmlFile("ppt/slideLayouts/slideLayout1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
  xmlFile("ppt/slideLayouts/_rels/slideLayout1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>');
  let imageIndex = 0;
  project.slides.forEach((slide, index) => {
    const image = images[index];
    xmlFile(`ppt/slides/slide${index + 1}.xml`, slideXml(project, slide, image));
    const imageRelationship = image ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${imageIndex + 1}.${image.extension}"/>` : "";
    xmlFile(`ppt/slides/_rels/slide${index + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${imageRelationship}</Relationships>`);
    if (image) {
      imageIndex += 1;
      files.push({ name: `ppt/media/image${imageIndex}.${image.extension}`, bytes: image.bytes });
    }
  });
  return files;
}

export async function buildPresentationPptx(request: Request, project: PresentationProjectRecord) {
  const images = await Promise.all(project.slides.map((slide) => loadImage(request, slide)));
  return zipStore(packageEntries(project, images));
}

export function safePresentationFilename(name: string) {
  const withoutControls = [...name.normalize("NFKC")]
    .filter((character) => character.codePointAt(0)! >= 32)
    .join("");
  const normalized = withoutControls.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  return `${normalized || "presentation"}.pptx`;
}
