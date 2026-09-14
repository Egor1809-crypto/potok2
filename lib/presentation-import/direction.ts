import type { PresentationSlide } from "@/types/api";
export type SlideDirection = { summary: string; findings: string[]; patches: { target: string; field: string; value: string }[] };
export function applySlideDirection(slide: PresentationSlide, direction: SlideDirection): PresentationSlide {
  const result = structuredClone(slide);
  if (!Array.isArray(direction.patches) || direction.patches.length > 40) throw new Error("Слишком много правок для одного слайда.");
  const touched = new Set<string>();
  for (const patch of direction.patches) {
    if (!patch || typeof patch.value !== "string" || patch.value.length > 12000) throw new Error("Некорректная правка слайда.");
    const key = `${patch.target}:${patch.field}`;
    if (touched.has(key)) throw new Error("Правки одного поля повторяются."); touched.add(key);
    if (patch.target === "slide") {
      if (["backgroundColor", "textColor", "accentColor"].includes(patch.field)) { if (!/^#[\da-f]{6}$/i.test(patch.value)) throw new Error("Некорректный цвет."); Object.assign(result, { [patch.field]: patch.value }); }
      else if (!result.canvas && ["title", "body", "eyebrow"].includes(patch.field)) Object.assign(result, { [patch.field]: patch.value });
      else if (!result.canvas && patch.field === "bullets") { const bullets = JSON.parse(patch.value); if (!Array.isArray(bullets) || bullets.length > 8 || bullets.some(v => typeof v !== "string" || v.length > 240)) throw new Error("Некорректный список."); result.bullets = bullets; }
      else throw new Error("Недопустимая правка слайда.");
    } else {
      const element = result.canvas?.elements.find(e => e.id === patch.target);
      if (!element) throw new Error("Элемент для правки не найден.");
      if (patch.field === "text" && element.kind === "text") element.text = patch.value;
      else if (["x", "y", "width", "height", "fontSize"].includes(patch.field)) { const n = Number(patch.value); if (!patch.value.trim() || !Number.isFinite(n) || n < (["x", "y"].includes(patch.field) ? -10000 : 1) || n > 10000) throw new Error("Некорректный размер элемента."); Object.assign(element, { [patch.field]: n }); }
      else if (["color", "fill"].includes(patch.field) && /^#[\da-f]{6}$/i.test(patch.value)) Object.assign(element, { [patch.field]: patch.value });
      else throw new Error("Недопустимая правка элемента.");
    }
  }
  return result;
}
