import type { EmailBuilderDocumentInput } from "@/types/api";
import type { AiEmailBrief, AiEmailEditorialReview, AiEmailReview } from "@/types/email-ai";
import { contrastRatio, readableColor } from "@/lib/design-readability";

import { parseEmailBuilderDocument } from "./document-input";
import { parseAiEmailBrief } from "./schema";

const normalize = (text: string) => text.toLocaleLowerCase("ru").replace(/\s+/g, " ").trim();
/** A stable content identity, independent of save IDs, object key order and reviews. */
export function emailReviewFingerprint(document: EmailBuilderDocumentInput, brief: AiEmailBrief) {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key, v]) => v !== undefined && !["aiMetadata", "templateId"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
  // Match server defaults, color casing and brief normalization. Incomplete
  // drafts still need an identity while the user is filling them in.
  let normalizedDocument = document, normalizedBrief = brief;
  try { normalizedDocument = parseEmailBuilderDocument({ ...document, aiMetadata: undefined }) || document; } catch { /* In-progress draft. */ }
  try { normalizedBrief = parseAiEmailBrief(brief); } catch { /* In-progress brief. */ }
  const text = JSON.stringify(canonical({ document: normalizedDocument, brief: normalizedBrief }));
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `rules-v1-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

/** Scores only explicit, repeatable checks of the FINAL builder document.
 * Editorial opinions cannot change the score or trigger silent regeneration. */
export function reviewEmailDocument(document: EmailBuilderDocumentInput, brief: AiEmailBrief, editorial?: AiEmailEditorialReview): AiEmailReview {
  const issues: AiEmailReview["issues"] = [];
  const checks: NonNullable<AiEmailReview["checks"]> = [];
  const check = (id: string, title: string, maximum: number, failures: Array<{ blockId?: string; message: string }>, passed: string) => {
    // One fixed deduction per criterion, never per model finding or block count.
    checks.push({ id, title, maximum, points: failures.length ? 0 : maximum, status: failures.length ? "fail" : "pass", detail: failures.length ? failures.map(f => f.message).join(" ").slice(0, 800) : passed });
    issues.push(...failures.slice(0, 8).map(f => ({ ...f, source: "rule" as const, severity: id === "contrast" || id === "cta" ? "high" as const : "medium" as const })));
  };
  check("subject", "Тема письма", 10, !document.subject.trim() ? [{ message: "Добавьте тему письма." }] : document.subject.length > 90 ? [{ message: `В теме ${document.subject.length} символов. Сократите до 90: длинная тема может обрезаться в списке писем.` }] : [], `Тема заполнена: ${document.subject.length} символов, ориентир — до 90.`);
  check("preheader", "Прехедер", 10, !document.previewText.trim() ? [{ message: "Добавьте прехедер, который дополняет тему." }] : normalize(document.previewText) === normalize(document.subject) ? [{ message: "Прехедер дословно повторяет тему. Добавьте другую полезную деталь." }] : [], "Прехедер заполнен и не повторяет тему дословно.");
  const buttons = document.blocks.filter(b => b.type === "button" || b.aiRole === "hero" && b.label);
  const ctaFailures: Array<{ blockId?: string; message: string }> = [];
  for (const b of buttons) if (!b.href || !String(b.label || b.content).trim()) ctaFailures.push({ blockId: b.id, message: "У кнопки отсутствует адрес или подпись." });
  if (brief.cta.url && !buttons.some(b => b.href === brief.cta.url && (!brief.cta.text || (b.label || b.content) === brief.cta.text))) ctaFailures.push({ message: "В письме нет основной кнопки с адресом и подписью из брифа." });
  check("cta", "Основное действие", 15, ctaFailures, brief.cta.url ? "Основная кнопка соответствует брифу." : "Пустых кнопок нет. Без заданного адреса текстовый призыв допустим.");
  const contrast: Array<{ blockId: string; message: string }> = [], fonts: typeof contrast = [], spacing: typeof contrast = [];
  const contentBlocks = document.blocks.filter(b => !["image", "pattern", "spacer", "divider"].includes(b.type) && b.content.trim());
  for (const b of contentBlocks) {
    const bg = b.backgroundColor === "transparent" ? document.bodyBackground : b.backgroundColor;
    const accent = b.accentColor || document.accentColor;
    // Same foreground/background choices as renderEmailVariant; headings with body
    // text still need the body threshold, not just the large heading threshold.
    const buttonBg = b.aiRole === "cta" && b.backgroundColor.toLowerCase() === accent.toLowerCase() ? "#FFFFFF" : accent;
    const actualBg = b.type === "button" ? (b.buttonStyle === "outline" ? bg : buttonBg) : bg;
    const fg = b.aiRole === "cta" && b.type === "button" ? readableColor("#FFFFFF", buttonBg) : b.textColor;
    const minimum = (b.type === "heading" || b.type === "logo") && b.fontSize >= 24 ? 3 : 4.5;
    const ratio = contrastRatio(fg, actualBg);
    if (ratio < minimum) contrast.push({ blockId: b.id, message: `Контраст текста ${fg} на ${actualBg}: ${ratio.toFixed(2)}:1, требуется ${minimum}:1. Измените цвет текста или фона.` });
    if (!["logo", "footer"].includes(b.type) && b.fontSize < 14) fonts.push({ blockId: b.id, message: `Основной текст ${b.fontSize} px. Увеличьте минимум до 14 px.` });
    if ((b.paddingLeft || 0) + (b.paddingRight || 0) > document.contentWidth * 0.4) spacing.push({ blockId: b.id, message: "Боковые отступы занимают больше 40% ширины письма. Уменьшите их, чтобы осталось место тексту." });
  }
  check("contrast", "Контраст текста", 25, contrast, "Проверенные пары цветов соответствуют порогам 4,5:1 для текста и 3:1 для крупных заголовков.");
  check("type", "Размер текста", 10, fonts, "Основной текст не мельче 14 px; подписи и подвал проверяются отдельно визуально.");
  check("spacing", "Место для содержимого", 10, spacing, "Боковые отступы оставляют не менее 60% ширины для содержимого.");
  const images = document.blocks.filter(b => b.type === "image" || b.type === "pattern" || b.imageHref);
  check("images", "Изображения", 10, images.flatMap(b => {
    if (!b.imageHref && !b.href || /placehold\.co/.test(b.imageHref || b.href || "")) return [{ blockId: b.id, message: "Изображение не подготовлено. Добавьте файл или повторите генерацию." }];
    if (b.type !== "pattern" && !(b.imageHref ? b.imageAlt : b.content)?.trim()) return [{ blockId: b.id, message: "Добавьте описание изображения для получателей, у которых картинки отключены." }];
    return [];
  }), images.length ? "У изображений есть адреса; у содержательных иллюстраций — описания." : "Изображений нет: это допустимо, баллы не снимаются.");
  const duplicate = new Set<string>(); const repeats: Array<{ blockId: string; message: string }> = [];
  for (const b of contentBlocks.filter(b => !["button", "footer", "logo"].includes(b.type))) {
    const value = normalize(b.content); if (value.length < 60) continue;
    if (duplicate.has(value)) repeats.push({ blockId: b.id, message: "Этот блок дословно повторяет другой блок письма. Удалите повтор или добавьте новые сведения." });
    duplicate.add(value);
  }
  check("repetition", "Дословные повторы", 10, repeats, "Одинаковые содержательные блоки не найдены. Повтор основной кнопки допустим.");
  checks.push({ id: "visual", title: "Вид в почтовых клиентах", maximum: 0, points: 0, status: "not_checked", detail: "Скриншоты почтовых клиентов не проверялись. Оценка не подтверждает красоту макета, прозрачность загруженных ранее файлов или доставку письма." });
  const seen = new Set<string>();
  for (const finding of editorial?.findings || []) {
    const block = finding.blockId ? document.blocks.find(b => b.id === finding.blockId) : undefined;
    if (finding.blockId && !block) continue;
    const source = block ? [block.content, block.label, block.badge].filter(Boolean).join(" ") : [document.subject, document.previewText].join(" ");
    const evidence = normalize(finding.evidence);
    // A comment must cite an actual passage from the identified block or envelope.
    if (evidence.length < 5 || !normalize(source).includes(evidence) || !finding.suggestion.trim()) continue;
    const key = `${finding.blockId}:${evidence}`; if (seen.has(key)) continue; seen.add(key);
    issues.push({ source: "editor", severity: "low", blockId: finding.blockId || undefined, evidence: finding.evidence, message: finding.message, suggestion: finding.suggestion });
  }
  return { score: contentBlocks.length || images.length ? checks.reduce((n, c) => n + c.points, 0) : null, rubricVersion: "rules-v1", fingerprint: emailReviewFingerprint(document, brief), checkedAt: new Date().toISOString(), checks, issues, suggestions: [], ...(!editorial ? { unavailable: true } : {}) };
}
