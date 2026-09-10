import { createBlankDocument, createBlock, type BuilderDocument } from "@/components/email-builder/builder-types";
import { checkEmailHtml, completeHtml, decodeDocument, escapeMarkup, textLetter } from "./formats";

export type ImportResource = { url: string; blob: Blob; name: string; uploadedUrl?: string };
export type ImportedLetter = { name: string; document: BuilderDocument; resources: ImportResource[]; notes: string[] };
export function disposeImportedLetter(letter: ImportedLetter) { letter.resources.forEach(resource => URL.revokeObjectURL(resource.url)); }
const imageTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
export async function importLetter(files: File[], progress: (message: string) => void): Promise<ImportedLetter> {
  if (!files.length) throw new Error("Выберите файл письма.");
  if (files.some(file => file.size === 0)) throw new Error("Один из выбранных файлов пуст. Выберите исходный документ с содержимым.");
  if (files.some(file => file.size > 20 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 40 * 1024 * 1024) throw new Error("Один файл может быть до 20 МБ, письмо со всеми ресурсами — до 40 МБ.");
  const primary = files.filter(file => /^(html?|pdf|docx|txt|json)$/.test(extension(file.name)));
  if (primary.length > 1) throw new Error("Выберите одно письмо. Вместе с HTML можно выбрать его изображения и CSS.");
  const file = primary[0] ?? files[0], ext = extension(file.name);
  const resources: ImportResource[] = [], notes: string[] = [];
  const addResource = (blob: Blob, name: string) => {
    if (blob.size > 4 * 1024 * 1024) throw new Error(`Изображение «${name}» больше 4 МБ.`);
    const url = URL.createObjectURL(blob); resources.push({ url, blob, name }); return url;
  };
  try {
    if (ext === "json") {
      const parsed = JSON.parse(decodeDocument(new Uint8Array(await file.arrayBuffer())));
      const document = parsed?.template?.builderDocument ?? parsed?.builderDocument ?? parsed;
      if (!document || !Array.isArray(document.blocks)) throw new Error("В JSON нет макета Поток. Выберите резервный файл .mailflow.json.");
      if (document.rawHtml) checkEmailHtml(document.rawHtml);
      return { name: parsed?.template?.name || file.name.replace(/\.mailflow\.json$|\.json$/i, ""), document, resources, notes: ["Редактируемый макет Поток будет восстановлен из резервного файла."] };
    }
    let html = "";
    if (ext === "html" || ext === "htm") {
      html = decodeDocument(new Uint8Array(await file.arrayBuffer())); checkEmailHtml(html);
      const asset = (path: string) => {
        const name = decodeURIComponent(path.replace(/[?#].*$/, "").replaceAll("\\", "/")).split("/").pop();
        const matches = files.filter(candidate => candidate !== file && candidate.name === name);
        if (matches.length !== 1) throw new Error(`Не найден ресурс «${path}». Выберите HTML и его изображения/CSS вместе, либо экспортируйте HTML со встроенными изображениями.`);
        return matches[0];
      };
      const styleLinks = [...html.matchAll(/<link\b[^>]*>/gi)];
      for (const [tag] of styleLinks) {
        const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
        if (/rel\s*=\s*["']stylesheet["']/i.test(tag) && href && !/^(https?:|\/\/|data:)/i.test(href)) {
          const css = decodeDocument(new Uint8Array(await asset(href).arrayBuffer()));
          if (/<\/style/i.test(css)) throw new Error("CSS содержит некорректное закрытие стиля.");
          html = html.replace(tag, `<style>${css}</style>`);
        }
      }
      const refs = [...html.matchAll(/\b(?:src|background|poster)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^\s)'"<>]+)["']?\s*\)/gi)];
      const urls = new Map<string, string>();
      for (const ref of refs) {
        const source = ref[1] ?? ref[2];
        if (!source || /^(https?:|\/\/|#|data:font\/|data:application\/(?:font|x-font))/i.test(source) || urls.has(source)) continue;
        let blob: Blob, name: string;
        if (/^data:image\/(png|jpeg|gif|webp);base64,/i.test(source)) {
          const type = source.slice(5, source.indexOf(";"));
          const binary = atob(source.slice(source.indexOf(",") + 1));
          blob = new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type }); name = `inline-${resources.length}.${type.split("/")[1]}`;
        } else {
          const selected = asset(source), type = imageTypes[extension(selected.name)];
          if (!type) throw new Error(`Ресурс «${source}» не является поддерживаемым изображением. Встройте шрифты в HTML или экспортируйте письмо как PDF.`);
          blob = new Blob([await selected.arrayBuffer()], { type }); name = selected.name;
        }
        urls.set(source, addResource(blob, name));
      }
      html = html.replace(/(\b(?:src|background|poster)\s*=\s*)(["'])([^"']+)\2/gi, (all, prefix, quote, url) => urls.has(url) ? `${prefix}${quote}${urls.get(url)}${quote}` : all)
        .replace(/url\(\s*(["']?)([^\s)'"<>]+)\1\s*\)/gi, (all, quote, url) => urls.has(url) ? `url(${quote}${urls.get(url)}${quote})` : all);
      const remaining = html.match(/\bsrc\s*=\s*(?!["'])([^\s>]+)/i);
      if (remaining && !/^https?:|^\/\//i.test(remaining[1])) throw new Error("Относительные адреса изображений в HTML должны быть в кавычках. Экспортируйте письмо со встроенными изображениями.");
      for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
        if (match[1].split(",").some(item => !/^\s*(https?:|\/\/)/i.test(item))) throw new Error("В srcset есть локальные изображения. Экспортируйте HTML с абсолютными ссылками или одним встроенным изображением для каждого блока.");
      }
      for (const match of html.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gi)) {
        if (!/^(https?:|\/\/)/i.test(match[1])) throw new Error("В CSS есть относительный @import. Объедините стили в один HTML-файл перед импортом.");
      }
      notes.push("Исходные таблицы, стили, ссылки и текст сохранены. Локальные изображения будут загружены в Поток; HTML не превращается в блоки конструктора.");
    } else if (ext === "txt") {
      html = textLetter(decodeDocument(new Uint8Array(await file.arrayBuffer())));
      notes.push("Текст, пробелы и переносы сохранены. Для TXT используется простой шрифт без декоративного оформления.");
    } else if (imageTypes[ext]) {
      if (files.length > 1) throw new Error("Выберите одно изображение письма.");
      const blob = new Blob([await file.arrayBuffer()], { type: imageTypes[ext] });
      const url = addResource(blob, file.name);
      const image = new Image(); image.src = url; await image.decode();
      html = `<body style="margin:0"><img src="${url}" width="${image.naturalWidth}" alt="${escapeMarkup(file.name)}" style="display:block;max-width:100%;height:auto;border:0"></body>`;
      notes.push("Изображение загружается без перекодирования. Текст внутри изображения не редактируется, отдельные кнопки не становятся ссылками.");
    } else if (ext === "pdf" || ext === "docx") {
      const { pdfPages, wordPages } = await import("./pages");
      const pages = await (ext === "pdf" ? pdfPages : wordPages)(file, progress);
      html = `<body style="margin:0;padding:0">${pages.map((page, index) => {
        const url = addResource(page.blob, `${file.name}-page-${index + 1}.png`);
        return `<img src="${url}" width="${Math.min(760, Math.round(page.width / 2))}" alt="${escapeMarkup(page.text.slice(0, 4000) || `Страница ${index + 1}`)}" style="display:block;max-width:100%;height:auto;border:0;margin:0">`;
      }).join("")}</body>`;
      notes.push(`${ext === "pdf" ? "PDF" : "Word"}: ${pages.length} стр. сохранены изображениями. Текст не редактируется, ссылки исходного документа не становятся кнопками письма.`);
      if (ext === "docx") notes.push("Сравните предпросмотр с Word: нестандартные шрифты и сложная вёрстка могут отличаться. Для более точного переноса экспортируйте Word в PDF со встроенными шрифтами.");
    } else throw new Error("Поддерживаются HTML, PDF, Word DOCX, PNG/JPEG/GIF/WebP, TXT и JSON Поток. Старый Word DOC сохраните как DOCX или PDF.");
    html = completeHtml(html);
    if (html.length > 500000) throw new Error("HTML письма превышает 500 КБ. Уменьшите документ или число страниц.");
    const document = { ...createBlankDocument(), subject: file.name.replace(/\.[^.]+$/, ""), rawHtml: html, blocks: [createBlock("text")] };
    document.blocks[0].content = "";
    return { name: document.subject.slice(0, 100), document, resources, notes };
  } catch (error) { resources.forEach(resource => URL.revokeObjectURL(resource.url)); throw error; }
}
export async function uploadImportedResources(letter: ImportedLetter, progress: (message: string) => void) {
  let html = letter.document.rawHtml;
  for (const [index, resource] of letter.resources.entries()) {
    progress(`Сохраняем изображение ${index + 1} из ${letter.resources.length}`);
    if (resource.uploadedUrl) { html = html?.replaceAll(resource.url, resource.uploadedUrl); continue; }
    const form = new FormData(); form.set("kind", "photo"); form.set("file", resource.blob, resource.name);
    const response = await fetch("/api/assets", { method: "POST", body: form });
    const body = await response.json() as { error?: string; asset?: { url: string } };
    if (!response.ok || !body.asset?.url) throw new Error(body.error || "Не удалось сохранить изображение.");
    resource.uploadedUrl = body.asset.url;
    html = html?.replaceAll(resource.url, body.asset.url);
  }
  return { ...letter.document, templateId: "", ...(html ? { rawHtml: html } : {}) };
}
