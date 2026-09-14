import type { PresentationProjectRecord, PresentationSlide } from "@/types/api";
import type { SlideDirection } from "./direction";
export type SlideReview = { fingerprint: string; direction: SlideDirection };
export type DeckDirection = {
  summary: string;
  recommendations: { text: string; slides: number[] }[];
};
export function slideFingerprint(
  project: PresentationProjectRecord,
  slide: PresentationSlide,
) {
  const text = JSON.stringify([
    project.themeId,
    project.backgroundColor,
    project.textColor,
    project.accentColor,
    slide,
  ]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${hash >>> 0}`;
}
export function parseDeckDirection(
  value: unknown,
  slideCount: number,
): DeckDirection {
  const d = value as DeckDirection;
  if (
    !d ||
    typeof d.summary !== "string" ||
    !d.summary.trim() ||
    d.summary.length > 4000 ||
    !Array.isArray(d.recommendations) ||
    d.recommendations.length > 12
  )
    throw new Error("Некорректный общий разбор.");
  for (const r of d.recommendations)
    if (
      !r ||
      typeof r.text !== "string" ||
      !r.text.trim() ||
      r.text.length > 2000 ||
      !Array.isArray(r.slides) ||
      r.slides.length > slideCount ||
      r.slides.some((n) => !Number.isInteger(n) || n < 1 || n > slideCount) ||
      new Set(r.slides).size !== r.slides.length
    )
      throw new Error("Некорректные рекомендации по слайдам.");
  return {
    summary: d.summary,
    recommendations: d.recommendations.map((r) => ({
      text: r.text,
      slides: r.slides,
    })),
  };
}
