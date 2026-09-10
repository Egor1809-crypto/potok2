import type { EmailBuilderDocumentInput } from "@/types/api";
import { readableColor } from "./design-readability";

/** Apply mechanical email constraints without rewriting the designed composition. */
export function normalizeEmailVisualDesign(document: EmailBuilderDocumentInput) {
  const headings = new Set(["heading", "hero", "banner"]);
  const decorative = new Set(["image", "logo", "pattern", "spacer", "divider"]);
  for (const block of document.blocks) {
    const background = block.backgroundColor === "transparent" ? document.bodyBackground : block.backgroundColor;
    if (!decorative.has(block.type)) {
      const buttonBackground = block.buttonStyle === "outline" || block.buttonStyle === "soft" ? background : block.accentColor ?? document.accentColor;
      block.textColor = readableColor(block.textColor, block.type === "button" ? buttonBackground : background);
      block.fontSize = Math.max(block.type === "footer" || block.type === "social" ? 12 : headings.has(block.type) ? 22 : 16, block.fontSize);
      block.lineHeight = headings.has(block.type) ? Math.max(115, Math.min(135, block.lineHeight ?? 120)) : Math.max(145, Math.min(175, block.lineHeight ?? 155));
      if (!headings.has(block.type) && block.type !== "button" && block.content.length > 150) block.alignment = "left";
    }
    // A common gutter prevents the jagged edge caused by independently styled blocks.
    block.paddingLeft = Math.max(24, Math.min(48, block.paddingLeft ?? 36));
    block.paddingRight = block.paddingLeft;
    block.letterSpacing = 0;
  }
  return document;
}

export function emailCompositionGuidance() {
  return `Сначала выбери композицию по функции письма, а не по числу доступных блоков.
Личное письмо: короткий heading, связный текст, подпись; никаких обязательных карточек.
Деловое событие: лаконичный вход, программа или детали, действие. Дайджест: несколько редакционных разделов. Релиз: демонстрация и практическая польза. Сервисное письмо: главное состояние и следующее действие.
Это примеры ритма, а не обязательные шаблоны. Обычно 3–9 блоков, без минимальной квоты на декоративные или составные модули. Каждый блок содержит новую информацию. Не превращай короткое письмо в длинную лендинговую воронку.
Макет должен иметь одну визуальную доминанту и спокойные остальные разделы: цветовая полоса, типографический вход, предметное изображение или большое число из фактов. Не используй всё сразу. Не оборачивай каждый блок в карточку. Чередуй плотный смысловой участок с воздухом, а не ставь одинаковый отступ везде.
Все тексты, включая subject и прехедер, создавай вместе с макетом. body — текстовая версия того же письма, а не дополнительный текст для вставки. Заголовок внутри письма может отличаться от subject. Не повторяй те же факты в hero, text и checklist.
Согласуй headingFont/bodyFont и единую иерархию: главный заголовок 28–34, разделы 22–26, текст 16–17, служебный footer 12–14 px. Для каждого блока укажи согласованные горизонтальные поля 24–48, вертикальные 4–40, lineHeight, fontWeight и buttonStyle. Составные модули используй лишь при наличии подходящих данных.`;
}
