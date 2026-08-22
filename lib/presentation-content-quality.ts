function compactAtWord(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const candidate = normalized.slice(0, maxLength + 1);
  const boundary = candidate.lastIndexOf(" ");
  const compact = candidate.slice(0, boundary >= maxLength * 0.68 ? boundary : maxLength);
  return `${compact.replace(/[\s,;:—-]+$/u, "")}…`;
}

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
    .replace(/^(?:на\s+тему|про|для)\s*[:—-]?\s*/iu, "")
    .replace(/^(?:презентаци(?:я|ю))\s*[:—-]?\s*/iu, "")
    .replace(/^(?:на\s+тему|про|для)\s*[:—-]?\s*/iu, "")
    .trim();
  return compactAtWord(capitalize(withoutCommand || normalized), 88);
}

export function normalizePresentationBody(value: string) {
  return compactAtWord(capitalize(value), 360);
}

export function normalizePresentationBullet(value: string) {
  return compactAtWord(capitalize(value), 110);
}

export function normalizePresentationEyebrow(value: string) {
  return compactAtWord(value, 42).toLocaleUpperCase("ru-RU");
}
