function capitalize(value: string) {
  const index = value.search(/[\p{L}\p{N}]/u);
  if (index < 0) return value;
  return `${value.slice(0, index)}${value[index].toLocaleUpperCase("ru-RU")}${value.slice(index + 1)}`;
}

export function normalizePresentationTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const withoutCommand = normalized
    .replace(
      /^(?:(?:нужно|надо)\s+)?(?:сделать|создать|подготовить|собрать|разработать)\s+(?:мне\s+)?(?:презентаци(?:ю|я)|слайд(?:ы|ов)?)\s*[:—-]?\s*/iu,
      "",
    )
    .replace(/^(?:на\s+тему|про|для)(?:\s+|(?=[:—-]))[:—-]?\s*/iu, "")
    .replace(/^(?:презентаци(?:я|ю))(?=\s|[:—-]|$)\s*[:—-]?\s*/iu, "")
    .replace(/^(?:на\s+тему|про|для)(?:\s+|(?=[:—-]))[:—-]?\s*/iu, "")
    .trim();
  const capitalized = capitalize(withoutCommand || normalized);
  return capitalized;
}

export function normalizePresentationBody(value: string) {
  return capitalize(value.replace(/\s+/g, " ").trim());
}

export function normalizePresentationBullet(value: string) {
  return capitalize(value.replace(/\s+/g, " ").trim());
}

export function normalizePresentationEyebrow(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleUpperCase("ru-RU");
}
