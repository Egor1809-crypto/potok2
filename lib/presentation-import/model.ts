import type { PresentationCanvas, PresentationElement } from "@/types/api";

export function parsePresentationCanvas(value: unknown): PresentationCanvas {
  const fail = (): never => { throw new Error("Некорректные элементы импортированного слайда."); };
  const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : fail();
  const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fail();
  const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max ? v : fail();
  const c = obj(value);
  if (c.source !== "pptx" && c.source !== "pdf") fail();
  if (!Array.isArray(c.elements) || c.elements.length > 200) fail();
  const ids = new Set<string>();
  const elements = (c.elements as unknown[]).map(v => {
    const e = obj(v), id = str(e.id, 160);
    if (!id || ids.has(id) || !["text", "image", "shape"].includes(String(e.kind))) fail();
    ids.add(id);
    const result: PresentationElement = { id, kind: e.kind as PresentationElement["kind"], x: num(e.x, -10000, 10000), y: num(e.y, -10000, 10000), width: num(e.width, .01, 20000), height: num(e.height, .01, 20000) };
    if (e.rotation !== undefined) result.rotation = num(e.rotation, -360, 360);
    if (e.text !== undefined) result.text = str(e.text, 12000);
    if (e.fontSize !== undefined) result.fontSize = num(e.fontSize, 1, 1000);
    if (e.fontFamily !== undefined) result.fontFamily = str(e.fontFamily, 100).replace(/["'<>;{}]/g, "");
    for (const key of ["bold", "italic"] as const) if (e[key] !== undefined) { if (typeof e[key] !== "boolean") fail(); result[key] = e[key] as boolean; }
    for (const key of ["color", "fill"] as const) if (e[key] !== undefined) { const color = str(e[key], 11); if (!/^#[\da-f]{6}$/i.test(color) && color !== "transparent") fail(); result[key] = color; }
    if (e.align !== undefined) { if (!["left", "center", "right"].includes(String(e.align))) fail(); result.align = e.align as PresentationElement["align"]; }
    if (e.shape !== undefined) { if (!["rect", "roundRect", "ellipse"].includes(String(e.shape))) fail(); result.shape = e.shape as PresentationElement["shape"]; }
    if (e.fit !== undefined) { if (!["contain", "cover"].includes(String(e.fit))) fail(); result.fit = e.fit as PresentationElement["fit"]; }
    if (e.imageUrl !== undefined) {
      const url = str(e.imageUrl, 500);
      // Persist only local workspace assets. Blob URLs exist only in import preview.
      if (!/^\/api\/assets\/[\w-]+$/.test(url)) fail();
      result.imageUrl = url;
    }
    if (result.kind === "image" && !result.imageUrl) fail();
    if (e.href) { const url = str(e.href, 2000); if (!/^https:\/\//i.test(url)) fail(); try { new URL(url); } catch { fail(); } result.href = url; }
    if (e.crop !== undefined) {
      const crop = obj(e.crop);
      result.crop = { left: num(crop.left, 0, .99), top: num(crop.top, 0, .99), right: num(crop.right, 0, .99), bottom: num(crop.bottom, 0, .99) };
      if (result.crop.left + result.crop.right >= .99 || result.crop.top + result.crop.bottom >= .99) fail();
    }
    return result;
  });
  return { width: num(c.width, 100, 10000), height: num(c.height, 100, 10000), source: c.source as "pptx" | "pdf", elements };
}
