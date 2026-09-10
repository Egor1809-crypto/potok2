import { unzipSync, strFromU8 } from "fflate";
export type PageImage = { blob: Blob; width: number; height: number; text: string };
const MAX_PAGES = 20;
async function png(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob || blob.size > 4 * 1024 * 1024) throw new Error("Страница превышает 4 МБ. Уменьшите разрешение исходного документа.");
  return blob;
}
export async function pdfPages(file: File, progress: (message: string) => void): Promise<PageImage[]> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/" });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new Error("В письме может быть до 20 страниц. Разделите PDF на несколько файлов.");
    const pages: PageImage[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      progress(`Читаем PDF: страница ${i} из ${pdf.numPages}`);
      const page = await pdf.getPage(i), original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1440 / original.width) });
      if (viewport.height > 16000) throw new Error("Страница PDF слишком длинная. Разделите её на несколько страниц.");
      const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str : "").join(" ");
      pages.push({ blob: await png(canvas), width: canvas.width, height: canvas.height, text });
      canvas.width = canvas.height = 0; page.cleanup();
    }
    return pages;
  } finally { await task.destroy(); }
}
export async function wordPages(file: File, progress: (message: string) => void): Promise<PageImage[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let total = 0;
  const xml = unzipSync(bytes, { filter: entry => {
    total += entry.originalSize;
    if (entry.originalSize > 30 * 1024 * 1024 || total > 80 * 1024 * 1024) throw new Error("Документ Word слишком большой после распаковки.");
    return /\.xml$|\.rels$/.test(entry.name);
  } });
  if (!xml["word/document.xml"]) throw new Error("Выберите документ Word в формате DOCX. Старый DOC сохраните как DOCX или PDF.");
  const main = strFromU8(xml["word/document.xml"]);
  if (/<w:altChunk\b|<o:OLEObject\b/.test(main)) throw new Error("В Word есть встроенные документы. Сохраните файл как PDF, чтобы сохранить их вид.");
  for (const [name, value] of Object.entries(xml)) if (name.endsWith(".rels")) {
    const content = strFromU8(value);
    if (/<Relationship\b(?=[^>]*TargetMode=["']External["'])(?=[^>]*Type=["'][^"']*\/(?:image|font|aFChunk)["'])[^>]*>/i.test(content)) throw new Error("Word использует связанные изображения или шрифты. Встройте их в документ или экспортируйте PDF.");
  }
  const [{ renderAsync }, { default: html2canvas }] = await Promise.all([import("docx-preview"), import("html2canvas")]);
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin"); frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-20000px;top:0;width:1600px;height:1000px;border:0;pointer-events:none";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open(); doc.write('<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; font-src data: blob:; frame-src \'self\' blob: about:; style-src \'unsafe-inline\'"></head><body style="margin:0"></body></html>'); doc.close();
    const styleHost = doc.createElement("div"); doc.head.appendChild(styleHost);
    await renderAsync(bytes.buffer, doc.body, styleHost, { className: "import-docx", inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false, ignoreFonts: false, renderAltChunks: false, useBase64URL: true });
    await doc.fonts.ready;
    await Promise.all([...doc.images].map(image => image.decode()));
    const sections = [...doc.querySelectorAll<HTMLElement>("section.import-docx")];
    if (!sections.length || sections.length > MAX_PAGES) throw new Error("Импорт поддерживает от 1 до 20 страниц Word. Для большого документа используйте PDF из нужных страниц.");
    const pages: PageImage[] = [];
    for (const [index, section] of sections.entries()) {
      progress(`Читаем Word: страница ${index + 1} из ${sections.length}`);
      const width = Math.ceil(section.getBoundingClientRect().width), height = Math.max(section.scrollHeight, Math.ceil(section.getBoundingClientRect().height));
      if (!width || height > 12000) throw new Error("Не удалось определить границы страницы Word. Экспортируйте документ как PDF.");
      const canvas = await html2canvas(section, { scale: Math.min(2, 1440 / width), width, height, backgroundColor: "#ffffff", logging: false, useCORS: false });
      pages.push({ blob: await png(canvas), width: canvas.width, height: canvas.height, text: section.textContent ?? "" });
      canvas.width = canvas.height = 0;
    }
    return pages;
  } finally { frame.remove(); }
}
