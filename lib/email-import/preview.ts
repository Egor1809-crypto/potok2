import type { ImportResource } from "./import-letter";

/** Opaque sandbox frames cannot reliably resolve a blob URL owned by the editor. */
export async function inlinePreviewResources(html: string, resources: ImportResource[]): Promise<string> {
  let preview = html;
  for (const resource of resources) {
    if (!preview.includes(resource.url)) continue;
    const bytes = new Uint8Array(await resource.blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
    preview = preview.replaceAll(resource.url, `data:${resource.blob.type || "image/png"};base64,${btoa(binary)}`);
  }
  return preview;
}

/** Fetch our assets as the signed-in page, then embed them in the opaque frame.
 * This also handles imported letters saved on the other production domain. */
export async function inlineStoredPreviewImages(html: string, signal: AbortSignal): Promise<string> {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const sources = [...new Set(Array.from(parsed.querySelectorAll("img[src]")).map(image => image.getAttribute("src")!))];
  const resources: ImportResource[] = [];
  for (const source of sources) {
    const url = new URL(source, location.href);
    if (!/^\/api\/assets\/[\w-]+$/.test(url.pathname)) continue;
    const response = await fetch(url.pathname, { signal });
    if (!response.ok) throw new Error("Не удалось загрузить изображение письма. Повторите открытие предпросмотра.");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Вместо изображения получен неподдерживаемый файл.");
    resources.push({ url: source, name: "preview", blob });
  }
  return inlinePreviewResources(html, resources);
}
