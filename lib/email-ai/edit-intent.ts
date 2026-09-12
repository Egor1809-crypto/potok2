import type { EmailBuilderDocumentInput } from "@/types/api";

/** Only explicit image replacement commands change the selected target. */
export function emailImageReplacement(document: EmailBuilderDocumentInput, instruction: string, selectedId?: string) {
  const noun = "(?:фото[а-яё]*|картинк[а-яё]*|изображен[а-яё]*|иллюстрац[а-яё]*)";
  const replace = new RegExp(`(?:замен[а-яё]*|поменя[а-яё]*|измен[а-яё]*|пересозда[а-яё]*|обнов[а-яё]*|сгенерир[а-яё]*)\\s+(?:(?:эту|это|новую|новое|основную|основное|главную|главное|другую|другое|выбранную|выбранное)\\s+)?${noun}|(?:replace|regenerate|change)\\s+(?:the\\s+)?(?:photo|image|picture)`, "iu");
  if (!replace.test(instruction) || /(?:не\s+(?:меня|измен|замен)|остав[а-яё]*\s+(?:фото|картинк|изображен))/iu.test(instruction)) return { requested: false };
  const images = document.blocks.filter(b => b.type === "image" || b.type === "hero" && b.imageHref);
  const selected = images.find(b => b.id === selectedId);
  const target = selected || (images.length === 1 ? images[0] : undefined);
  if (target) return { requested: true, blockId: target.id };
  return { requested: true, error: images.length ? "В письме несколько изображений. Выберите нужную картинку на холсте и повторите команду." : "В письме нет фотографии для замены. Добавьте блок изображения или первый экран с фотографией." };
}
