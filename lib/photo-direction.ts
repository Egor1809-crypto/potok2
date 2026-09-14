export type PhotoDirection = { summary: string; findings: string[]; recommendations: string[] };

export function parsePhotoDirection(value: unknown): PhotoDirection {
  if (!value || typeof value !== "object") throw new Error("Некорректный разбор фотографии.");
  const d = value as Record<string, unknown>;
  const list = (v: unknown) => Array.isArray(v) && v.length <= 8 && v.every(item => typeof item === "string" && item.trim().length > 0 && item.length <= 2000);
  if (typeof d.summary !== "string" || !d.summary.trim() || d.summary.length > 3000 || !list(d.findings) || !list(d.recommendations)) throw new Error("Некорректный разбор фотографии.");
  return { summary: d.summary, findings: d.findings as string[], recommendations: d.recommendations as string[] };
}
