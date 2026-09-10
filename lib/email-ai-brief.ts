import type { EmailAiRequest } from "@/types/api";

/** Keep the user's text intact; reading linked pages is a separate preference. */
export function emailPromptFields(goal: string, useLinkedContext: boolean, ctaLabel = "", ctaUrl = "") {
  return { goal, useLinkedContext, ctaLabel: ctaLabel.trim() || undefined, websiteUrl: ctaUrl.trim() || undefined };
}

export function emailBriefText(input: EmailAiRequest) {
  return [input.goal, input.designBrief, ...(input.briefAnswers ?? []).map((item) => `${item.question}: ${item.answer}`)].filter(Boolean).join("\n");
}

export function emailBriefUrls(input: EmailAiRequest) {
  return [...new Set([input.websiteUrl, ...((emailBriefText(input)).match(/https:\/\/[^\s<>«»"“”]+/gu) ?? []).map((url) => url.replace(/[.,;!?):]+$/u, "")), ...(input.socialLinks ?? []).map((link) => link.url)].filter((url): url is string => Boolean(url)))];
}

function forbids(text: string, nouns: string) {
  return new RegExp(`(?:без|никаких|не добавляй|не используй|не нужны|не нужно добавлять)\\s+(?:(?:любых|дополнительных|новых)\\s+)?(?:${nouns})|(?:${nouns})[^.\\n]{0,12}не нуж`, "iu").test(text);
}

/** Only unambiguous constraints are enforced here; the full brief is also reviewed. */
export function emailBriefConstraints(input: EmailAiRequest) {
  const text = emailBriefText(input);
  return {
    noImages: input.visualContent === "none" || input.visualContent === "pattern" || forbids(text, "фото|картин|изображ|иллюстрац") || /только (?:обычный )?текст|только типограф/iu.test(text),
    noPatterns: input.visualContent === "none" || input.visualContent === "image" || forbids(text, "узор|орнамент|паттерн"),
    noButtons: forbids(text, "кноп[ок]|cta") || /ссылк[ауи][^.\n]{0,24}(?:только|обычным) текст/iu.test(text),
    noLogos: forbids(text, "лого"),
  };
}
