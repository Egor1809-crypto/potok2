import { unzipSync, strFromU8 } from "fflate";
import type { PresentationElement, PresentationSlide } from "@/types/api";

export type ImportedDeck = { name: string; slides: PresentationSlide[]; warnings: string[]; resources: Map<string, Blob>; dispose: () => void };
const children = (n: Element | Document, name: string) => Array.from(n.children).filter(e => e.localName === name);
const one = (n: Element | Document | undefined, name: string): Element | undefined => n ? children(n, name)[0] : undefined;
const all = (n: Element | Document | undefined, name: string): Element[] => n ? Array.from(n.getElementsByTagNameNS("*", name)) : [];
const first = (n: Element | Document | undefined, name: string) => all(n, name)[0];
const val = (e: Element | undefined, attr = "val", fallback = "") => e?.getAttribute(attr) ?? fallback;
const number = (e: Element | undefined, attr: string, fallback = 0) => Number(val(e, attr, String(fallback))) || fallback;
const uid = () => crypto.randomUUID();
const slideBase = (title: string): PresentationSlide => ({ id: uid(), layout: "statement", eyebrow: "", title: title.slice(0, 300), body: "", bullets: [], speakerNotes: "", backgroundColor: "#ffffff" });
function resolvePart(base: string, target: string) {
  const parts = (target.startsWith("/") ? target.slice(1) : base.slice(0, base.lastIndexOf("/") + 1) + target).split("/");
  const result: string[] = [];
  for (const part of parts) { if (part === "..") { if (!result.length) throw new Error("Некорректный путь внутри PowerPoint."); result.pop(); } else if (part && part !== ".") result.push(part); }
  return result.join("/");
}
export async function importPresentation(file: File, progress: (message: string) => void): Promise<ImportedDeck> {
  if (file.size > 30 * 1024 * 1024 || !file.size) throw new Error("Выберите файл размером до 30 МБ.");
  const resources = new Map<string, Blob>();
  const dispose = () => { resources.forEach((_, url) => URL.revokeObjectURL(url)); resources.clear(); };
  let resourceBytes = 0;
  const resource = (blob: Blob) => { resourceBytes += blob.size; if (resourceBytes > 32 * 1024 * 1024) throw new Error("Изображения презентации занимают больше 32 МБ. Сожмите их или разделите файл."); const url = URL.createObjectURL(blob); resources.set(url, blob); return url; };
  try {
    const name = file.name.replace(/\.(pptx|pdf)$/i, "").slice(0, 120) || "Импортированная презентация";
    if (/\.pdf$/i.test(file.name)) {
      const { pdfPages } = await import("@/lib/email-import/pages");
      const pages = await pdfPages(file, progress);
      return { name, warnings: ["Страницы PDF сохраняют исходный вид. Текст внутри страницы — часть изображения; поверх можно добавить текст и ссылки."], resources, dispose,
        slides: pages.map((page, i) => ({ ...slideBase(`Страница ${i + 1}`), speakerNotes: page.text.slice(0, 3000), canvas: { source: "pdf", width: page.width, height: page.height, elements: [{ id: uid(), kind: "image", x: 0, y: 0, width: page.width, height: page.height, imageUrl: resource(page.blob), fit: "contain" }] } })) };
    }
    if (!/\.pptx$/i.test(file.name)) throw new Error("Поддерживаются PowerPoint (.pptx) и PDF. Старый PPT сохраните как PPTX.");
    let total = 0, entries = 0;
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: e => {
      total += e.originalSize;
      if (++entries > 12000 || total > 120 * 1024 * 1024 || e.originalSize > 30 * 1024 * 1024) throw new Error("PowerPoint слишком большой после распаковки. Разделите его на несколько файлов.");
      return /\.(xml|rels|png|jpe?g|gif|webp)$/i.test(e.name);
    } });
    const xml = (path: string) => {
      if (!archive[path]) return undefined;
      const source = strFromU8(archive[path]);
      if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("Файл содержит неподдерживаемые XML-сущности.");
      const doc = new DOMParser().parseFromString(source, "application/xml");
      if (first(doc, "parsererror")) throw new Error("Повреждён XML внутри PowerPoint.");
      return doc;
    };
    const rels = (path: string) => all(xml(path.replace(/([^/]+)$/, "_rels/$1.rels")), "Relationship");
    const related = (path: string, type: string) => { const r = rels(path).find(e => val(e, "Type").endsWith(`/${type}`) && val(e, "TargetMode") !== "External"); return r ? resolvePart(path, val(r, "Target")) : ""; };
    const presentation = xml("ppt/presentation.xml");
    if (!presentation) throw new Error("В файле не найдена презентация PowerPoint.");
    const size = first(presentation, "sldSz"), width = number(size, "cx", 9144000) / 9525, height = number(size, "cy", 5143500) / 9525;
    if (width < 100 || height < 100 || width > 10000 || height > 10000) throw new Error("Неподдерживаемый размер слайда.");
    const ordered = all(presentation, "sldId");
    if (!ordered.length || ordered.length > 40) throw new Error("Можно импортировать от 1 до 40 слайдов PowerPoint.");
    const warnings = new Set<string>();
    const slides: PresentationSlide[] = [];
    const mediaCache = new Map<string, string>();
    const presentationRels = rels("ppt/presentation.xml");
    for (let index = 0; index < ordered.length; index++) {
      progress(`Читаем PowerPoint: слайд ${index + 1} из ${ordered.length}`);
      const rid = ordered[index].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      const relation = presentationRels.find(e => val(e, "Id") === rid);
      if (!relation || val(relation, "TargetMode") === "External") throw new Error("Не удалось прочитать порядок слайдов.");
      const path = resolvePart("ppt/presentation.xml", val(relation, "Target")), doc = xml(path);
      if (!doc) throw new Error(`Не удалось прочитать слайд ${index + 1}.`);
      const layoutPath = related(path, "slideLayout"), layout = xml(layoutPath), masterPath = related(layoutPath, "slideMaster"), master = xml(masterPath);
      const theme = xml(related(masterPath, "theme") || "ppt/theme/theme1.xml");
      const themeColors: Record<string, string> = { tx1: "#111111", tx2: "#333333", bg1: "#ffffff", bg2: "#eeeeee" };
      for (const e of Array.from(first(theme, "clrScheme")?.children ?? [])) { const c = val(first(e, "srgbClr")) || val(first(e, "sysClr"), "lastClr"); if (/^[\da-f]{6}$/i.test(c)) themeColors[e.localName] = `#${c}`; }
      themeColors.tx1 = themeColors.dk1 ?? themeColors.tx1; themeColors.bg1 = themeColors.lt1 ?? themeColors.bg1;
      const color = (node: Element | undefined, fallback: string) => { const literal = val(first(node, "srgbClr")); return /^[\da-f]{6}$/i.test(literal) ? `#${literal}` : themeColors[val(first(node, "schemeClr"))] ?? fallback; };
      const slide = slideBase(`Слайд ${index + 1}`), elements: PresentationElement[] = [];
      slide.backgroundColor = color(first(doc, "bgPr") ?? first(layout, "bgPr") ?? first(master, "bgPr"), "#ffffff");
      const fallbackShape = (node: Element) => {
        const ph = first(node, "ph"); if (!ph) return undefined;
        return [...all(layout, "sp"), ...all(master, "sp")].find(e => { const p = first(e, "ph"); return p && (val(p, "idx", "0") === val(ph, "idx", "0") || val(p, "type") === val(ph, "type", "body")); });
      };
      const walk = (tree: Element | undefined, part: string, transform = { sx: 1, sy: 1, x: 0, y: 0 }, decorations = false) => {
        for (const node of Array.from(tree?.children ?? [])) {
          if (elements.length >= 200) throw new Error(`На слайде ${index + 1} больше 200 элементов. Сохраните сложный слайд как PDF.`);
          if (node.localName === "grpSp") {
            const tr = first(one(node, "grpSpPr"), "xfrm"), off = one(tr!, "off"), ext = one(tr!, "ext"), chOff = one(tr!, "chOff"), chExt = one(tr!, "chExt");
            const sx = number(ext, "cx", 1) / number(chExt, "cx", 1), sy = number(ext, "cy", 1) / number(chExt, "cy", 1);
            walk(node, part, { sx: transform.sx * sx, sy: transform.sy * sy, x: transform.x + transform.sx * (number(off, "x") - number(chOff, "x") * sx), y: transform.y + transform.sy * (number(off, "y") - number(chOff, "y") * sy) }, decorations); continue;
          }
          if (!["sp", "pic"].includes(node.localName)) {
            if (["graphicFrame", "contentPart", "cxnSp"].includes(node.localName)) warnings.add(`Слайд ${index + 1}: диаграмма, таблица, соединитель или SmartArt не перенесены. Для точного вида импортируйте PDF.`);
            continue;
          }
          if (decorations && first(node, "ph")) continue;
          const fallback = fallbackShape(node), props = one(node, "spPr"), tr = first(props, "xfrm") ?? first(fallback, "xfrm"), off = one(tr!, "off"), ext = one(tr!, "ext");
          if (!tr) { warnings.add(`Слайд ${index + 1}: пропущен объект без положения.`); continue; }
          const e: PresentationElement = { id: uid(), kind: node.localName === "pic" ? "image" : "shape", x: (transform.x + number(off, "x") * transform.sx) / 9525, y: (transform.y + number(off, "y") * transform.sy) / 9525, width: Math.max(.1, number(ext, "cx") * transform.sx / 9525), height: Math.max(.1, number(ext, "cy") * transform.sy / 9525), rotation: number(tr, "rot") / 60000 };
          const relationships = rels(part);
          const link = first(node, "hlinkClick"), linkId = link?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
          const href = val(relationships.find(r => val(r, "Id") === linkId), "Target");
          if (/^https:\/\//i.test(href)) e.href = href;
          if (e.kind === "image") {
            const blip = first(node, "blip"), imageId = blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
            const rel = relationships.find(r => val(r, "Id") === imageId);
            const imagePath = rel && val(rel, "TargetMode") !== "External" ? resolvePart(part, val(rel, "Target")) : "";
            const bytes = archive[imagePath], extension = imagePath.split(".").pop()?.toLowerCase();
            if (!bytes || !["png", "jpg", "jpeg", "gif", "webp"].includes(extension!)) { warnings.add(`Слайд ${index + 1}: внешнее или векторное изображение не перенесено. Встройте PNG/JPG или используйте PDF.`); continue; }
            if (bytes.length > 4 * 1024 * 1024) throw new Error(`На слайде ${index + 1} изображение больше 4 МБ. Сожмите изображения в PowerPoint.`);
            let url = mediaCache.get(imagePath); if (!url) { url = resource(new Blob([bytes as BlobPart], { type: `image/${extension === "jpg" ? "jpeg" : extension}` })); mediaCache.set(imagePath, url); }
            e.imageUrl = url; e.fit = "contain";
            const crop = first(node, "srcRect");
            if (crop) { const c = { left: number(crop, "l") / 100000, top: number(crop, "t") / 100000, right: number(crop, "r") / 100000, bottom: number(crop, "b") / 100000 }; if (Object.values(c).every(n => n >= 0) && c.left + c.right < .99 && c.top + c.bottom < .99) e.crop = c; }
          } else {
            const body = one(node, "txBody"), paragraphs = body ? children(body, "p") : [];
            e.text = paragraphs.map(p => all(p, "t").map(t => t.textContent || "").join("")).join("\n");
            e.kind = e.text ? "text" : "shape";
            if ((e.text?.length ?? 0) > 12000) throw new Error(`Слайд ${index + 1}: слишком большой текстовый блок.`);
            const runs = all(body, "rPr"), rp = runs[0] ?? first(body, "defRPr") ?? first(fallback, "defRPr");
            e.fontSize = number(rp, "sz", 1800) / 100 * 96 / 72; e.bold = val(rp, "b") === "1"; e.italic = val(rp, "i") === "1";
            const font = val(first(rp, "latin"), "typeface", "Arial"); e.fontFamily = font.startsWith("+") ? val(first(first(theme, "minorFont"), "latin"), "typeface", "Arial") : font;
            e.color = color(rp, "#111111");
            const alignment = val(first(body, "pPr"), "algn"); e.align = alignment === "ctr" ? "center" : alignment === "r" ? "right" : "left";
            e.fill = one(props!, "solidFill") ? color(one(props!, "solidFill"), "transparent") : "transparent";
            const shape = val(first(props, "prstGeom"), "prst", "rect"); e.shape = shape === "ellipse" ? "ellipse" : shape === "roundRect" ? "roundRect" : "rect";
            if (!["rect", "roundRect", "ellipse"].includes(shape) || first(props, "gradFill") || first(props, "custGeom")) warnings.add(`Слайд ${index + 1}: сложная фигура или градиент упрощены.`);
            if (runs.some(r => val(r, "sz") !== val(rp, "sz") || val(r, "b") !== val(rp, "b"))) warnings.add(`Слайд ${index + 1}: форматирование внутри текстового блока приведено к первому фрагменту.`);
          }
          elements.push(e);
        }
      };
      if (val(doc.documentElement, "showMasterSp", "1") !== "0") { walk(first(master, "spTree"), masterPath, undefined, true); walk(first(layout, "spTree"), layoutPath, undefined, true); }
      walk(first(doc, "spTree"), path);
      if (!elements.length) warnings.add(`Слайд ${index + 1}: нет поддерживаемых элементов. Проверьте предпросмотр.`);
      slide.title = (elements.find(e => e.kind === "text")?.text || slide.title).slice(0, 300);
      const notes = xml(related(path, "notesSlide")); slide.speakerNotes = all(notes, "t").map(e => e.textContent || "").join("\n").slice(0, 3000);
      slide.canvas = { width, height, source: "pptx", elements }; slides.push(slide);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    warnings.add("Проверьте шрифты, переносы и порядок объектов. Анимации и переходы не импортируются.");
    return { name, slides, warnings: [...warnings], resources, dispose };
  } catch (error) { dispose(); throw error; }
}

export async function uploadPresentationResources(deck: ImportedDeck, uploaded: Map<string, string>, progress: (message: string) => void) {
  let index = 0;
  for (const [url, blob] of deck.resources) {
    progress(`Сохраняем изображения: ${++index} из ${deck.resources.size}`);
    if (uploaded.has(url)) continue;
    let upload = blob;
    if (blob.type === "image/webp") {
      const bitmap = await createImageBitmap(blob), canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext("2d")!.drawImage(bitmap, 0, 0); bitmap.close();
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png")); canvas.width = canvas.height = 0;
      if (!png || png.size > 4 * 1024 * 1024) throw new Error("Изображение WebP слишком большое после преобразования. Используйте PNG или JPEG.");
      upload = png;
    }
    const form = new FormData(); form.set("kind", "photo"); form.set("file", new File([upload], `${deck.name.slice(0, 90)}-${index}.${upload.type.split("/")[1] || "png"}`, { type: upload.type }));
    const response = await fetch("/api/assets", { method: "POST", body: form, signal: AbortSignal.timeout(60000) });
    const body = await response.json().catch(() => ({ error: response.status === 413 ? "Изображение слишком большое для загрузки." : "Не удалось загрузить изображение. Повторите попытку." })) as { error?: string; asset?: { id: string } };
    if (!response.ok || !body.asset?.id) throw new Error(body.error || "Не удалось сохранить изображение. Повторите импорт.");
    uploaded.set(url, `/api/assets/${body.asset.id}`);
  }
  return deck.slides.map(slide => ({ ...slide, canvas: slide.canvas ? { ...slide.canvas, elements: slide.canvas.elements.map(e => ({ ...e, ...(e.imageUrl ? { imageUrl: uploaded.get(e.imageUrl) || e.imageUrl } : {}) })) } : undefined }));
}
