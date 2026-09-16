import type { PresentationSlide } from "@/types/api";

export type FindingRegion = { x: number; y: number; width: number; height: number };
export type SlideFinding = {
  priority: "required" | "suggestion";
  title: string;
  problem: string;
  suggestion: string;
  elementIds: string[];
  region: FindingRegion | null;
};
const normalized = (text: string) => text.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
function quoteTargets(text: string, slide: PresentationSlide) {
  const quotes = [...text.matchAll(/[«“"]([^»”"]{5,300})[»”"]/g)].map(m => normalized(m[1]));
  return (slide.canvas?.elements ?? []).filter(e => e.kind === "text" && quotes.some(q => normalized(e.text || "").includes(q))).map(e => e.id);
}
function region(value: unknown): FindingRegion | null {
  if (!value || typeof value !== "object") return null;
  const r = value as FindingRegion;
  if ([r.x,r.y,r.width,r.height].some(n => typeof n !== "number" || !Number.isFinite(n)) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > 100.01 || r.y + r.height > 100.01) return null;
  return {x:r.x,y:r.y,width:r.width,height:r.height};
}
/** Preserve older reports; locate only known IDs or exact quoted text, never guessed objects. */
export function parseSlideFindings(value: unknown, slide: PresentationSlide): SlideFinding[] {
  if (!Array.isArray(value) || value.length > 8) throw new Error("Некорректные замечания.");
  return value.map(raw => {
    if (typeof raw === "string") {
      if (!raw.trim() || raw.length > 2000) throw new Error("Некорректное замечание.");
      const text = raw.replace(/^(?:Обязательно|Обязательное исправление|Предложение|Необязательное предложение)\s*:\s*/i, "");
      const parts = text.split(/\s+[—–]\s+/);
      return {priority:/^обязател/i.test(raw) ? "required" : "suggestion",title:parts.length >= 3 ? parts[0] : "Замечание к слайду",problem:parts.length >= 3 ? parts[1] : text,suggestion:parts.length >= 3 ? parts.slice(2).join(" — ") : "",elementIds:quoteTargets(text,slide),region:null};
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Некорректное замечание.");
    const f = raw as Record<string,unknown>;
    // Lossless compatibility with providers that use location/problem/fix despite the schema.
    const title = f.title ?? f.location;
    const suggestion = f.suggestion ?? f.fix;
    if ([title,f.problem,suggestion].some(s => typeof s !== "string" || !s.trim() || s.length > 1200) || typeof f.priority !== "string") throw new Error("Неполное замечание.");
    const priority = /^(required|обязатель)/i.test(f.priority) ? "required" : "suggestion";
    const knownIds = new Set(slide.canvas?.elements.map(e => e.id) ?? []);
    const ids = Array.isArray(f.elementIds) ? f.elementIds.filter((id): id is string => typeof id === "string" && knownIds.has(id)) : [];
    return {priority,title:String(title),problem:String(f.problem),suggestion:String(suggestion),elementIds:[...new Set(ids.length ? ids : quoteTargets(`${title} ${f.problem}`,slide))],region:region(f.region)};
  });
}
export function findingText(f: SlideFinding) {
  return `${f.priority === "required" ? "Обязательно" : "Предложение"}: ${f.title} — ${f.problem}${f.suggestion ? ` — ${f.suggestion}` : ""}`;
}
export function findingRegions(f: SlideFinding, slide: PresentationSlide): FindingRegion[] {
  const c = slide.canvas;
  const regions = c ? c.elements.filter(e => f.elementIds.includes(e.id)).map(e => {
    const angle = (e.rotation || 0) * Math.PI / 180;
    const w = Math.abs(e.width*Math.cos(angle))+Math.abs(e.height*Math.sin(angle));
    const h = Math.abs(e.width*Math.sin(angle))+Math.abs(e.height*Math.cos(angle));
    const x = Math.max(0,e.x+(e.width-w)/2),y = Math.max(0,e.y+(e.height-h)/2);
    return {x:100*x/c.width,y:100*y/c.height,width:100*Math.max(0,Math.min(c.width,e.x+(e.width+w)/2)-x)/c.width,height:100*Math.max(0,Math.min(c.height,e.y+(e.height+h)/2)-y)/c.height};
  }).filter(r => r.width > 0 && r.height > 0) : [];
  return regions.length ? regions : f.region ? [f.region] : [];
}
