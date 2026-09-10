import type { PresentationSlide, PresentationSlideLayout, PresentationThemeId } from "@/types/api";
import { estimatedTextLines, readableColor } from "./design-readability";

/** These budgets describe the actual 16:9 renderer, including the space an image uses. */
export const presentationLayoutContracts: Record<PresentationSlideLayout, { title: number; body: number; items: number; item: number; image: boolean; role: string }> = {
  title: { title: 64, body: 150, items: 0, item: 0, image: true, role: "Один короткий заголовок и пояснение, свободное поле" },
  statement: { title: 80, body: 180, items: 0, item: 0, image: true, role: "Крупный тезис; без списка" },
  split: { title: 60, body: 160, items: 4, item: 70, image: true, role: "Слева текст, справа изображение ИЛИ аргументы; при imagePrompt bullets=[]" },
  bullets: { title: 76, body: 100, items: 4, item: 95, image: false, role: "Короткий заголовок и плоский список" },
  quote: { title: 110, body: 90, items: 0, item: 0, image: true, role: "Точная предоставленная цитата и её автор" },
  stats: { title: 68, body: 120, items: 3, item: 50, image: false, role: "bullets: число|подпись; только предоставленные показатели" },
  timeline: { title: 68, body: 120, items: 3, item: 65, image: false, role: "Этапы во времени, один bullet на этап" },
  process: { title: 68, body: 120, items: 3, item: 65, image: false, role: "Последовательность действий, один bullet на шаг" },
  comparison: { title: 68, body: 0, items: 6, item: 80, image: false, role: "Две колонки Сейчас / Целевое состояние; bullets по парам слева, справа" },
  agenda: { title: 52, body: 100, items: 5, item: 70, image: false, role: "Разделы выступления в строках" },
  gallery: { title: 48, body: 130, items: 0, item: 0, image: true, role: "Доминирующее изображение, короткая подпись сбоку; imagePrompt обязателен" },
  chart: { title: 68, body: 110, items: 4, item: 45, image: false, role: "bullets: число|название; сопоставимые неотрицательные величины в одной единице" },
  table: { title: 52, body: 100, items: 5, item: 85, image: false, role: "Короткая нумерованная матрица критериев" },
  callout: { title: 76, body: 180, items: 0, item: 0, image: false, role: "Один важный вывод или ограничение" },
  closing: { title: 64, body: 130, items: 0, item: 0, image: false, role: "Итог и конкретный следующий шаг" },
};

export function presentationVisualIssues(slides: PresentationSlide[]) {
  const issues: string[] = [];
  for (const [index, slide] of slides.entries()) {
    const c = presentationLayoutContracts[slide.layout];
    const prefix = `Слайд ${index + 1} (${slide.layout})`;
    if (slide.title.length > c.title || slide.body.length > c.body || slide.bullets.length > c.items || slide.bullets.some((item) => item.length > c.item)) {
      issues.push(`${prefix}: текст не помещается. Лимиты: title ${c.title}, body ${c.body}, bullets ${c.items} по ${c.item}. Перенеси подробности в speakerNotes, не обрывай слова.`);
    }
    if (slide.imagePrompt && !c.image) issues.push(`${prefix}: макет не имеет места для изображения. Убери imagePrompt или смени layout.`);
    if (slide.layout === "split" && slide.imagePrompt && slide.bullets.length) issues.push(`${prefix}: изображение занимает место списка. Выбери одно.`);
    if (slide.layout === "gallery" && !slide.imagePrompt && !slide.imageUrl) issues.push(`${prefix}: галерея без изображения пуста. Выбери другой layout.`);
    if (["stats", "chart"].includes(slide.layout) && (!slide.bullets.length || slide.bullets.some((item) => !/^\s*[−-]?\d[^|]*\|.+/u.test(item)))) issues.push(`${prefix}: нужны числовые данные в формате число|подпись, а не произвольные фразы.`);
  }
  return issues;
}

export function presentationFontFamily(theme: PresentationThemeId) {
  return ["editorial", "premium", "museum", "paper", "linen"].includes(theme) ? "Georgia" : "Arial";
}

export function presentationStepText(value: string, index: number) {
  return value.replace(new RegExp(`^\\s*0?${index + 1}[.)]\\s+`, "u"), "");
}

export function presentationChartData(items: string[]) {
  const values = items.slice(0, 4).map((item) => {
    const [raw = "", label = ""] = item.split("|").map((part) => part.trim());
    const value = Number.parseFloat(raw.replace(/\s/g, "").replace(",", "."));
    return { raw, label, value: Number.isFinite(value) ? Math.max(0, value) : 0 };
  });
  const maximum = Math.max(1, ...values.map((item) => item.value));
  return values.map((item) => ({ ...item, fraction: item.value / maximum }));
}

export function requestedPresentationColors(brief = "") {
  const names: Array<[RegExp, string]> = [
    [/син(?:ий|им|его)|blue/iu, "#245BD8"], [/голуб/iu, "#187BA8"],
    [/оранж/iu, "#D94F16"], [/зел[её]н/iu, "#19704A"], [/красн/iu, "#C62E36"],
    [/золот/iu, "#B58A32"], [/розов/iu, "#C64178"], [/фиолет/iu, "#713FC1"],
  ];
  const accentPhrase = brief.match(/(?:[\p{L}]+\s+){0,2}акцент[\p{L}]*[^.,\n]{0,16}/iu)?.[0] ?? "";
  const accent = accentPhrase.match(/#[\da-f]{6}/i)?.[0] ?? names.find(([pattern]) => pattern.test(accentPhrase))?.[1];
  const background = /бел(?:ый|ое|ая)\s+(?:фон|поле|основ)/iu.test(brief) ? "#FFFFFF" : /ч[её]рн(?:ый|ое|ая)\s+(?:фон|поле|основ)/iu.test(brief) ? "#111317" : undefined;
  return { ...(accent ? { accentColor: accent } : {}), ...(background ? { backgroundColor: background, textColor: background === "#FFFFFF" ? "#17191C" : "#F5F6F8" } : {}) };
}

export function presentationReadableColors(background: string, text: string, accent: string) {
  return { text: readableColor(text, background), accent: readableColor(accent, background, 3), inverse: readableColor("#FFFFFF", accent) };
}

export function fittedPresentationFont(text: string, widthPoints: number, heightPoints: number, preferred: number, minimum: number) {
  for (let size = preferred; size > minimum; size--) {
    if (estimatedTextLines(text, widthPoints, size) * size * 1.18 <= heightPoints) return size;
  }
  return minimum;
}
