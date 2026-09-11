import type { AiEmailBlockType } from "@/types/email-ai";
import type { EmailBuilderBlockInput } from "@/types/api";

export const emailBlockVariants: Record<AiEmailBlockType, readonly string[]> = {
  header: ["header-logo-left", "header-centered", "header-minimal"],
  hero: ["hero-centered", "hero-image-right", "hero-image-left", "hero-image-top", "hero-dark", "hero-minimal"],
  text: ["text-default", "text-highlight", "text-centered"],
  image: ["image-wide", "image-inset"],
  benefits: ["benefits-list", "benefits-cards", "benefits-2-column", "benefits-3-column"],
  cards: ["cards-two", "cards-three"],
  stats: ["stats-inline", "stats-cards", "stats-dark"],
  speakers: ["speakers-list", "speakers-cards"],
  products: ["products-list", "products-cards"],
  quote: ["quote-default", "quote-highlight"],
  review: ["review-default", "review-card"],
  divider: ["divider-line"], urgency: ["urgency-notice", "urgency-banner"],
  cta: ["cta-centered", "cta-banner", "cta-dark"], ps: ["ps-default"],
  footer: ["footer-minimal", "footer-full"], spacer: ["spacer-small", "spacer-large"],
  pattern: ["pattern-strip"],
};

export function isEmailVariant(value: unknown): value is string {
  return typeof value === "string" && Object.values(emailBlockVariants).some(variants => variants.includes(value));
}

export function emailVariantLabel(variant: string): string {
  const name = variant.replace(/^[^-]+-/, "");
  return ({ "logo-left": "Логотип слева", centered: "По центру", minimal: "Лаконичный", "image-right": "Изображение справа", "image-left": "Изображение слева", "image-top": "Изображение сверху", dark: "Тёмный фон", default: "Обычный", highlight: "С акцентом", wide: "Во всю ширину", inset: "С отступами", list: "Список", cards: "Карточки", "2-column": "Две колонки", "3-column": "Три колонки", two: "Две колонки", three: "Три колонки", inline: "В строку", card: "Карточка", line: "Линия", notice: "Примечание", banner: "Цветная плашка", full: "Подробный", small: "Небольшой", large: "Большой", strip: "Декоративная полоса" } as Record<string, string>)[name] || name;
}

/** Variants change the existing block, so the same undo history and save flow apply. */
export function applyEmailVariant(block: EmailBuilderBlockInput, variant: string, document: Pick<import("@/types/api").EmailBuilderDocumentInput, "accentColor" | "bodyBackground">): EmailBuilderBlockInput {
  const role = block.aiRole;
  if (!role || !emailBlockVariants[role].includes(variant)) return block;
  const dark = variant.endsWith("-dark");
  return {
    ...block, variant,
    alignment: /centered|stats/.test(variant) ? "center" : "left",
    backgroundColor: dark ? "#18212D" : /highlight|banner|cards|card$/.test(variant) ? "#F1F3F5" : document.bodyBackground,
    textColor: dark ? "#FFFFFF" : "#202632",
    borderRadius: /cards|card$/.test(variant) ? 12 : 0,
    paddingTop: /minimal|default|small/.test(variant) ? 16 : 28,
    paddingBottom: /minimal|default|small/.test(variant) ? 16 : 28,
  };
}
