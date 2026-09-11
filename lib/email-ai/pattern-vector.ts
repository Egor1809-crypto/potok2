import { encodeRgbaPng } from "./pattern-png";
import { readableColor } from "@/lib/design-readability";

type Point = { x: number; y: number };
export type EmailPatternDrawing = { strokes: Array<{ type: "polyline" | "curve" | "circle"; points: Point[]; radius: number; width: number; color: string }> };
const pointSchema = { type: "object", additionalProperties: false, required: ["x", "y"], properties: { x: { type: "number", minimum: 8, maximum: 1192 }, y: { type: "number", minimum: 8, maximum: 152 } } };
export const emailPatternDrawingSchema = { type: "object", additionalProperties: false, required: ["strokes"], properties: { strokes: { type: "array", minItems: 3, maxItems: 100, items: { type: "object", additionalProperties: false, required: ["type", "points", "radius", "width", "color"], properties: { type: { type: "string", enum: ["polyline", "curve", "circle"] }, points: { type: "array", minItems: 1, maxItems: 12, items: pointSchema }, radius: { type: "number", minimum: 0, maximum: 64 }, width: { type: "number", minimum: 1.5, maximum: 4 }, color: { type: "string", pattern: "^#[a-fA-F0-9]{6}$" } } } } } };

/** Rasterize original AI-authored paths on a zero-alpha canvas. No background,
 * JPEG/chroma-key, SVG execution, native dependency or fixed motif library. */
export function renderEmailPatternDrawing(drawing: EmailPatternDrawing, background: string) {
  const width = 1200, height = 160; const rgba = new Uint8Array(width * height * 4);
  const line = (a: Point, b: Point, thickness: number, color: number[]) => {
    const r = thickness / 2, dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    for (let y = Math.max(0, Math.floor(Math.min(a.y, b.y) - r - 1)); y <= Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + r + 1)); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(a.x, b.x) - r - 1)); x <= Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + r + 1)); x++) {
        const t = length ? Math.max(0, Math.min(1, ((x + 0.5 - a.x) * dx + (y + 0.5 - a.y) * dy) / length)) : 0;
        const coverage = Math.max(0, Math.min(1, r + 0.5 - Math.hypot(x + 0.5 - a.x - t * dx, y + 0.5 - a.y - t * dy)));
        if (!coverage) continue;
        const p = (y * width + x) * 4; const oldAlpha = rgba[p + 3] / 255; const alpha = coverage + oldAlpha * (1 - coverage);
        for (let c = 0; c < 3; c++) rgba[p + c] = Math.round((color[c] * coverage + rgba[p + c] * oldAlpha * (1 - coverage)) / alpha);
        rgba[p + 3] = Math.round(alpha * 255);
      }
    }
  };
  for (const stroke of drawing.strokes) {
    let points = stroke.points;
    if (stroke.type === "circle") {
      if (points.length !== 1 || stroke.radius <= 0) throw new Error("Окружности нужны центр и радиус.");
      const center = points[0];
      if (center.x - stroke.radius < 4 || center.x + stroke.radius > 1196 || center.y - stroke.radius < 4 || center.y + stroke.radius > 156) throw new Error("Орнамент выходит за границы полосы.");
      points = Array.from({ length: 65 }, (_, i) => ({ x: center.x + Math.cos(i / 64 * Math.PI * 2) * stroke.radius, y: center.y + Math.sin(i / 64 * Math.PI * 2) * stroke.radius }));
    } else if (stroke.type === "curve") {
      if (points.length !== 4) throw new Error("Кривой нужны четыре контрольные точки.");
      const [a, b, c, d] = points;
      points = Array.from({ length: 49 }, (_, i) => { const t = i / 48, u = 1 - t; return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x, y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y }; });
    } else if (points.length < 2) throw new Error("Линии нужны минимум две точки.");
    const hex = readableColor(stroke.color, background, 1.6); const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 1; i < points.length; i++) line(points[i - 1], points[i], stroke.width, rgb);
  }
  return encodeRgbaPng(width, height, rgba);
}
