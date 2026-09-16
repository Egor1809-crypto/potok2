import type { PresentationSlide } from "@/types/api";
export type SlideDirection = { summary: string; findings: string[]; patches: { target: string; field: string; value: string }[] };
export function applySlideDirection(slide: PresentationSlide, direction: SlideDirection): PresentationSlide {
  const result = structuredClone(slide);
  if (!Array.isArray(direction.patches) || direction.patches.length > 40) throw new Error("Слишком много правок для одного слайда.");
  const touched = new Set<string>();
  for (const patch of direction.patches) {
    if (!patch || typeof patch.target !== "string" || typeof patch.field !== "string" || typeof patch.value !== "string" || patch.value.length > 12000) throw new Error("Некорректная правка слайда.");
    const key = `${patch.target}:${patch.field}`;
    if (touched.has(key)) throw new Error("Правки одного поля повторяются."); touched.add(key);
    if (patch.target === "slide") {
      if (["backgroundColor", "textColor", "accentColor"].includes(patch.field)) { if (!/^#[\da-f]{6}$/i.test(patch.value)) throw new Error("Некорректный цвет."); Object.assign(result, { [patch.field]: patch.value }); }
      else if (!result.canvas && ["title", "body", "eyebrow"].includes(patch.field)) Object.assign(result, { [patch.field]: patch.value });
      else if (!result.canvas && patch.field === "bullets") { const bullets = JSON.parse(patch.value); if (!Array.isArray(bullets) || bullets.length > 8 || bullets.some(v => typeof v !== "string" || v.length > 240)) throw new Error("Некорректный список."); result.bullets = bullets; }
      else throw new Error("Недопустимая правка слайда.");
    } else {
      const element = result.canvas?.elements.find(e => e.id === patch.target);
      if (element?.locked) throw new Error("Элемент заблокирован. Сначала снимите блокировку.");
      if (!element) throw new Error("Элемент для правки не найден.");
      if (patch.field === "text" && element.kind === "text") element.text = patch.value;
      else if (["x", "y", "width", "height"].includes(patch.field) || (patch.field === "fontSize" && element.kind === "text")) { const n = Number(patch.value); if (!patch.value.trim() || !Number.isFinite(n) || n < (["x", "y"].includes(patch.field) ? -10000 : 1) || n > 10000) throw new Error("Некорректный размер элемента."); Object.assign(element, { [patch.field]: n }); }
      else if (((patch.field === "color" && element.kind === "text") || (patch.field === "fill" && element.kind !== "image")) && /^#[\da-f]{6}$/i.test(patch.value)) Object.assign(element, { [patch.field]: patch.value });
      else throw new Error("Недопустимая правка элемента.");
    }
  }
  if (result.canvas && slide.canvas) {
    const boundsOverflow = (element: typeof result.canvas.elements[number]) => {
      const angle = (element.rotation || 0) * Math.PI / 180;
      const width = Math.abs(element.width * Math.cos(angle)) + Math.abs(element.height * Math.sin(angle));
      const height = Math.abs(element.width * Math.sin(angle)) + Math.abs(element.height * Math.cos(angle));
      const x = element.x + (element.width - width) / 2;
      const y = element.y + (element.height - height) / 2;
      return Math.max(0, -x, -y, x + width - result.canvas!.width, y + height - result.canvas!.height);
    };
    for (let i = 0; i < result.canvas.elements.length; i++) {
      const before = slide.canvas.elements[i], after = result.canvas.elements[i];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      if (boundsOverflow(after) > boundsOverflow(before) + 1) throw new Error("Правка выводит элемент за границы слайда.");
      if (after.kind === "image" && Math.abs((after.width / after.height) / (before.width / before.height) - 1) > .01)
        throw new Error("Правка искажает пропорции изображения.");
      if (after.kind === "text" && after.fontSize && after.fontSize > after.height && (before.fontSize || 0) <= before.height)
        throw new Error("Новый размер шрифта не помещается в текстовый блок.");
    }
  }
  return result;
}

/** Some compatible providers return grouped fields despite a strict schema. Expand only a known, lossless shorthand. */
export function normalizeDirectionPatches(value: unknown): SlideDirection["patches"] {
  if (!Array.isArray(value) || value.length > 40) throw new Error("Некорректные правки.");
  const numeric = new Set(["x", "y", "width", "height", "fontSize"]);
  const allowed = new Set([...numeric, "text", "color", "fill", "backgroundColor", "textColor", "accentColor", "title", "body", "eyebrow", "bullets"]);
  const patches: SlideDirection["patches"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.target !== "string") throw new Error("Некорректная цель правки.");
    const pairs = "field" in item
      ? (Object.keys(item).some(key => !["target", "field", "value"].includes(key)) ? [] : [[item.field, item.value]])
      : Object.entries(item).filter(([key]) => key !== "target");
    if (!pairs.length) throw new Error("Пустая правка.");
    for (const [field, raw] of pairs) {
      if (typeof field !== "string" || !allowed.has(field)) throw new Error("Недопустимое поле правки.");
      const value = numeric.has(field) && typeof raw === "number" && Number.isFinite(raw) ? String(raw) : raw;
      if (typeof value !== "string") throw new Error("Некорректное значение правки.");
      patches.push({ target: item.target, field, value });
    }
  }
  if (patches.length > 40) throw new Error("Слишком много правок.");
  return patches;
}
