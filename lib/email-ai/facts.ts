import type { AiEmailBrief, AiEmailDocument } from "@/types/email-ai";

export function emailSourceOfTruth(brief: AiEmailBrief, existingText = "") {
  return [brief.description, brief.requiredContent, ...brief.requiredFacts, brief.deadline, brief.brand.name, existingText].filter(Boolean).join("\n");
}
export function emailFactIssues(email: AiEmailDocument, brief: AiEmailBrief, existingText = "") {
  const source = emailSourceOfTruth(brief, existingText);
  const numbers = (value: string) => new Set((value.replace(/^\s*\d+[.)]\s/gm, "").match(/\d+(?:[.,]\d+)?\s*%?/g) || []).map(x => x.replace(/\s/g, "").replace(",", ".")));
  const knownNumbers = numbers(source);
  const visible = [email.subject, email.preheader, ...email.blocks.flatMap(b => [b.title, b.text, b.badge, ...b.items.flatMap(i => [i.title, i.text, i.value, i.label])])].join("\n");
  const issues: string[] = [];
  for (const value of numbers(visible)) if (!knownNumbers.has(value)) issues.push(`Число ${value} отсутствует в исходных фактах. Удали или исправь неподтверждённое утверждение.`);
  if (email.blocks.some(b => b.type === "urgency") && !brief.deadline && !/дедлайн|до\s+\d|остал[^.\n]{0,25}мест|цен[^.\n]{0,30}повыс|скидк[^.\n]{0,30}до/iu.test(source)) issues.push("Пользователь не предоставил ограничение или дедлайн: удали urgency.");
  if (email.blocks.some(b => b.type === "review" || b.type === "quote") && !/отзыв|цитат|«|“|"/iu.test(source)) issues.push("Пользователь не предоставил отзыв или цитату: удали выдуманное доказательство.");
  const urls = new Set([brief.cta.url, brief.brand.website, brief.brand.privacyUrl, ...(source.match(/(?:https?:\/\/|mailto:|tel:)[^\s<>«»"“”]+/gu) || []).map(x => x.replace(/[.,;!?)]+$/, ""))].filter(Boolean));
  for (const block of email.blocks) if (block.button && !urls.has(block.button.url)) issues.push(`В блоке ${block.id} выдумана ссылка. Используй URL из брифа или button=null.`);
  const plain = brief.visuals === "none" || /только (?:обычный )?текст|без изображ|без иллюстрац/iu.test(source);
  if (plain && email.blocks.some(b => b.image || b.type === "image" || b.type === "pattern")) issues.push("В запросе запрещены изображения: убери медиа и декор.");
  if ((brief.visuals === "image" || /без (?:узор|орнамент|декор)/iu.test(source)) && email.blocks.some(b => b.type === "pattern")) issues.push("Пользователь запретил узоры: удали pattern.");
  if (brief.visuals === "pattern" && email.blocks.some(b => b.image && b.type !== "pattern" && b.type !== "header")) issues.push("Пользователь выбрал только узор: убери фото и иллюстрации.");
  return [...new Set(issues)].slice(0, 8);
}
