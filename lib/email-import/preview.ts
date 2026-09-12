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
