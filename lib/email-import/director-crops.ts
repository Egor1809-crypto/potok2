import type { ImportCrop } from "./director";
import type { ImportResource } from "./import-letter";
import { letterElements, editLetterAttribute } from "./visual-editor";

export async function prepareDirectorCrops(html: string, crops: ImportCrop[], signal: AbortSignal) {
  const resources: ImportResource[] = [];
  try {
    for (const crop of crops) {
      signal.throwIfAborted();
      const url = new URL(crop.source, location.href);
      const source = /^\/api\/assets\/[\w-]+$/.test(url.pathname) ? url.pathname : crop.source;
      const response = await fetch(source, { signal });
      if (!response.ok) throw new Error("Не удалось загрузить исходную иллюстрацию. Повторите попытку.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.size > 20_000_000) throw new Error("Невозможно подготовить фрагмент изображения.");
      const bitmap = await createImageBitmap(blob);
      try {
        const sx = Math.floor(crop.x * bitmap.width), sy = Math.floor(crop.y * bitmap.height);
        const sw = Math.min(bitmap.width - sx, Math.round(crop.width * bitmap.width)), sh = Math.min(bitmap.height - sy, Math.round(crop.height * bitmap.height));
        if (sw < 2 || sh < 2) throw new Error("ИИ выбрал слишком маленький фрагмент изображения. Уточните команду.");
        const scale = Math.min(1, 1600 / sw, 2400 / sh), canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Не удалось подготовить иллюстрацию.");
        context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const fragment = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Не удалось сохранить фрагмент.")), "image/png"));
        signal.throwIfAborted();
        const resource = { url: URL.createObjectURL(fragment), blob: fragment, name: `art-director-${crop.id}.png` };
        resources.push(resource); html = html.split(`{{crop:${crop.id}}}`).join(resource.url);
        // Keep the source so a person can correct the crop after saving/reopening.
        for (const element of letterElements(html).filter(element => element.attributes.src === resource.url).reverse()) {
          html = editLetterAttribute(html, element.index, "data-potok-original-src", crop.source);
          html = editLetterAttribute(html, element.index, "data-potok-crop", JSON.stringify({ x: crop.x * 100, y: crop.y * 100, width: crop.width * 100, height: crop.height * 100 }));
        }
      } finally { bitmap.close(); }
    }
    return { html, resources };
  } catch (error) { for (const resource of resources) URL.revokeObjectURL(resource.url); throw error; }
}

export async function publishDirectorCrops(html: string, resources: ImportResource[], signal: AbortSignal) {
  for (const resource of resources) {
    signal.throwIfAborted();
    if (!resource.uploadedUrl) {
      const form = new FormData(); form.set("kind", "photo"); form.set("file", resource.blob, resource.name);
      const response = await fetch("/api/assets", { method: "POST", body: form, signal });
      const result = await response.json() as { asset?: { url: string }; error?: string };
      if (!response.ok || !result.asset?.url) throw new Error(result.error || "Не удалось сохранить иллюстрацию.");
      resource.uploadedUrl = result.asset.url;
    }
    html = html.split(resource.url).join(resource.uploadedUrl);
  }
  return html;
}
