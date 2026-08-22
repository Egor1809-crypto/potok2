export type EmailVisualStyle = "minimal" | "editorial" | "bold" | "premium";

export type EmailTypographyFont =
  | "Arial"
  | "Georgia"
  | "Verdana"
  | "Trebuchet MS";

export type EmailTypographySystem = {
  name: string;
  headingFont: EmailTypographyFont;
  bodyFont: EmailTypographyFont;
  heroSize: number;
  headingSize: number;
  bodySize: number;
  heroLineHeight: number;
  headingLineHeight: number;
  bodyLineHeight: number;
  headingWeight: 600 | 700;
};

export type EmailPatternArtwork = {
  id: string;
  name: string;
  imageUrl: string;
  alt: string;
};

export type EmailVisualPalette = {
  accent: string;
  secondaryAccent?: string;
  patternBackground?: string;
  soft: string;
  body: string;
  workspace: string;
  text: string;
  muted: string;
  border: string;
  buttonText: string;
  name: string;
};

type PaletteInput = {
  goal: string;
  designBrief?: string;
  visualStyle: EmailVisualStyle;
  primaryColor?: string;
  modelAccent?: unknown;
  modelBody?: unknown;
  modelWorkspace?: unknown;
};

function validHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim());
}

function normalizedHex(value: unknown, fallback: string) {
  return validHex(value) ? value.trim().toUpperCase() : fallback;
}

function mixHex(first: string, second: string, secondWeight: number) {
  const safeFirst = normalizedHex(first, "#000000").slice(1);
  const safeSecond = normalizedHex(second, "#FFFFFF").slice(1);
  const channel = (offset: number) =>
    Math.round(
      Number.parseInt(safeFirst.slice(offset, offset + 2), 16) *
        (1 - secondWeight) +
        Number.parseInt(safeSecond.slice(offset, offset + 2), 16) *
          secondWeight,
    )
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

function isDark(value: string) {
  const hex = normalizedHex(value, "#000000").slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 142;
}

const namedPalettes: Array<{
  pattern: RegExp;
  palette: Omit<EmailVisualPalette, "buttonText">;
}> = [
  {
    pattern: /розов|пудров|фукси|малинов|pink|rose/i,
    palette: {
      name: "Пудровый розовый",
      accent: "#D64F87",
      soft: "#FCEBF2",
      body: "#FFF9FC",
      workspace: "#F7EEF3",
      text: "#2C1822",
      muted: "#765564",
      border: "#EBC6D6",
    },
  },
  {
    pattern: /красн|алый|бордов|red|wine/i,
    palette: {
      name: "Киноварь",
      accent: "#B83C4B",
      soft: "#F9E9EB",
      body: "#FFFBFB",
      workspace: "#F6ECEE",
      text: "#2B171A",
      muted: "#75565B",
      border: "#E6C2C7",
    },
  },
  {
    pattern: /оранж|персик|коралл|orange|coral/i,
    palette: {
      name: "Тёплый коралл",
      accent: "#D86342",
      soft: "#FCEDE7",
      body: "#FFFBF8",
      workspace: "#F7F0EB",
      text: "#2D1D18",
      muted: "#765C52",
      border: "#EACBBF",
    },
  },
  {
    pattern: /зел[её]н|изумруд|green|emerald/i,
    palette: {
      name: "Спокойный изумруд",
      accent: "#25735D",
      soft: "#E8F4EF",
      body: "#FBFEFD",
      workspace: "#EDF5F1",
      text: "#173129",
      muted: "#536E65",
      border: "#BFDBD1",
    },
  },
  {
    pattern: /голуб|син|лазур|blue|navy|кобальт/i,
    palette: {
      name: "Чистый кобальт",
      accent: "#3157D5",
      soft: "#ECF1FF",
      body: "#FCFDFF",
      workspace: "#F1F4FA",
      text: "#172033",
      muted: "#59657D",
      border: "#CBD5EF",
    },
  },
  {
    pattern: /фиолет|сирен|лаванд|purple|violet/i,
    palette: {
      name: "Спокойная лаванда",
      accent: "#7255C8",
      soft: "#F1EDFC",
      body: "#FDFBFF",
      workspace: "#F3F0F8",
      text: "#261D36",
      muted: "#685B79",
      border: "#D8CDED",
    },
  },
];

function customAccentPalette(accent: string): EmailVisualPalette {
  return {
    name: "Цвет из брифа",
    accent,
    soft: mixHex(accent, "#FFFFFF", 0.88),
    body: mixHex(accent, "#FFFFFF", 0.97),
    workspace: mixHex(accent, "#FFFFFF", 0.93),
    text: mixHex(accent, "#111827", 0.78),
    muted: mixHex(accent, "#4B5563", 0.68),
    border: mixHex(accent, "#FFFFFF", 0.72),
    buttonText: isDark(accent) ? "#FFFFFF" : "#17121C",
  };
}

function premiumAccentPalette(accent: string, name: string): EmailVisualPalette {
  return {
    name: `${name}, тёмная версия`,
    accent,
    soft: mixHex(accent, "#11110F", 0.82),
    body: "#11110F",
    workspace: mixHex(accent, "#F3EEE6", 0.88),
    text: "#F8F2E7",
    muted: "#D8D1C4",
    border: mixHex(accent, "#11110F", 0.48),
    buttonText: isDark(accent) ? "#FFFFFF" : "#11110F",
  };
}

export function resolveEmailVisualPalette(
  input: PaletteInput,
): EmailVisualPalette {
  const brief = `${input.goal}\n${input.designBrief ?? ""}`;
  const explicitHexes = [...brief.matchAll(/#[0-9a-f]{6}\b/gi)].map(
    (match) => match[0].toUpperCase(),
  );
  if (explicitHexes.length >= 2) {
    const [accent, secondaryAccent] = explicitHexes;
    return {
      ...customAccentPalette(accent),
      name: "Два цвета из брифа",
      secondaryAccent,
      soft: mixHex(secondaryAccent, "#FFFFFF", 0.88),
      body: mixHex(accent, "#FFFFFF", 0.97),
      workspace: mixHex(secondaryAccent, accent, 0.5),
      border: mixHex(secondaryAccent, accent, 0.5),
      patternBackground: mixHex(accent, "#FFFFFF", 0.88),
    };
  }
  const explicitHex = explicitHexes[0];
  if (explicitHex)
    return input.visualStyle === "premium"
      ? premiumAccentPalette(explicitHex, "Цвет из брифа")
      : customAccentPalette(explicitHex);

  const hasPink = /розов|пудров|фукси|малинов|pink|rose/i.test(brief);
  const hasBlue = /голуб|син|лазур|blue|navy|кобальт/i.test(brief);
  if (hasPink && hasBlue) {
    return {
      name: "Голубой + розовый",
      accent: "#D64F87",
      secondaryAccent: "#4F83D6",
      patternBackground: "#FCEBF2",
      soft: "#EAF2FD",
      body: "#FFF9FC",
      workspace: "#F3EFF8",
      text: "#281D32",
      muted: "#685A74",
      border: "#D8C9E8",
      buttonText: "#FFFFFF",
    };
  }

  const named = namedPalettes.find((item) => item.pattern.test(brief));
  if (named) {
    if (input.visualStyle === "premium")
      return premiumAccentPalette(named.palette.accent, named.palette.name);
    return {
      ...named.palette,
      buttonText: isDark(named.palette.accent) ? "#FFFFFF" : "#17121C",
    };
  }

  if (input.visualStyle === "premium") {
    return {
      name: "Тихое золото",
      accent: "#C6A15B",
      soft: "#1B1915",
      body: "#11110F",
      workspace: "#EDE8DF",
      text: "#F8F2E7",
      muted: "#D8D1C4",
      border: "#574A31",
      buttonText: "#11110F",
    };
  }

  const styleAccent =
    input.visualStyle === "editorial"
      ? "#A23D2B"
      : input.visualStyle === "bold"
        ? "#6D28D9"
        : "#3157D5";
  const accent = normalizedHex(
    input.primaryColor ?? input.modelAccent,
    styleAccent,
  );
  const generated = customAccentPalette(accent);
  return {
    ...generated,
    name:
      input.visualStyle === "editorial"
        ? "Редакционная бумага"
        : input.visualStyle === "bold"
          ? "Выразительный контраст"
          : "Чистый минимализм",
    body: normalizedHex(input.modelBody, generated.body),
    workspace: normalizedHex(input.modelWorkspace, generated.workspace),
  };
}

export function normalizeDisplayHeading(value: string) {
  return value
    .split("|")
    .map((part) => {
      const trimmed = part.trim();
      const index = trimmed.search(/[\p{L}\p{N}]/u);
      if (index < 0) return trimmed;
      return `${trimmed.slice(0, index)}${trimmed[index].toLocaleUpperCase("ru-RU")}${trimmed.slice(index + 1)}`;
    })
    .join("|");
}

function semanticWords(value: string) {
  const stop = new Set([
    "который",
    "которая",
    "которые",
    "чтобы",
    "этого",
    "просто",
    "письмо",
    "сделать",
    "нужно",
    "хочу",
    "будет",
  ]);
  return new Set(
    value
      .toLocaleLowerCase("ru-RU")
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((word) => word.length >= 4 && !stop.has(word)) ?? [],
  );
}

export function semanticOverlap(first: string, second: string) {
  const left = semanticWords(first);
  const right = semanticWords(second);
  if (!left.size || !right.size) return 0;
  const common = [...left].filter((word) => right.has(word)).length;
  return common / Math.min(left.size, right.size);
}

export function distributeEditorialBody(value: string, slots: number) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (slots <= 1 || paragraphs.length <= 1) return [value.trim()];
  const usedSlots = Math.min(slots, paragraphs.length);
  const groups = Array.from({ length: usedSlots }, () => [] as string[]);
  paragraphs.forEach((paragraph, index) => {
    groups[Math.min(usedSlots - 1, Math.floor((index * usedSlots) / paragraphs.length))].push(
      paragraph,
    );
  });
  return groups.map((group) => group.join("\n\n"));
}

export function decorativePatternFor(value: string) {
  const text = value.toLocaleLowerCase("ru-RU");
  if (/свидан|роман|любов|свадьб|ужин|ресторан|цвет|красот/.test(text))
    return "♡  ·  ✦  ·  ♡  ·  ✦  ·  ♡";
  if (/чай|кофе|ботан|растен|природ|эко|сад|лес|трав|органик/.test(text))
    return "❦  ·  ◦  ·  ❦  ·  ◦  ·  ❦";
  if (
    /технолог|данн|цифр|разработ|сервис|продукт/.test(text) ||
    /(?:^|[^\p{L}])(?:ии|ai)(?:[^\p{L}]|$)/u.test(text)
  )
    return "◦  ─  ◦  ─  ◦  ─  ◦";
  if (/событ|встреч|конференц|вебинар|приглаш/.test(text))
    return "✦  ·  ◇  ·  ✦  ·  ◇  ·  ✦";
  if (/празд|поздрав|день рожд|юбиле/.test(text))
    return "✦  ·  ✧  ·  ✦  ·  ✧  ·  ✦";
  return "✦  ·  ✦  ·  ✦  ·  ✦";
}

export function resolveEmailTypography(input: {
  goal: string;
  designBrief?: string;
  visualStyle: EmailVisualStyle;
}): EmailTypographySystem {
  const text = `${input.goal}\n${input.designBrief ?? ""}`.toLocaleLowerCase(
    "ru-RU",
  );
  const elegant =
    input.visualStyle === "premium" ||
    input.visualStyle === "editorial" ||
    /свидан|роман|ресторан|свадьб|мод|искусств|галере|театр|культур|люкс|премиаль|чай|кофе/.test(
      text,
    );
  if (elegant) {
    return {
      name: "Editorial elegance",
      headingFont: "Georgia",
      bodyFont: "Trebuchet MS",
      heroSize: input.visualStyle === "premium" ? 31 : 30,
      headingSize: 24,
      bodySize: 16,
      heroLineHeight: 118,
      headingLineHeight: 124,
      bodyLineHeight: 154,
      headingWeight: 700,
    };
  }
  if (
    input.visualStyle === "bold" ||
    /фестив|молод|игр|ярк|дерзк|запуск|релиз/.test(text)
  ) {
    return {
      name: "Expressive clarity",
      headingFont: "Trebuchet MS",
      bodyFont: "Verdana",
      heroSize: 31,
      headingSize: 24,
      bodySize: 15,
      heroLineHeight: 116,
      headingLineHeight: 122,
      bodyLineHeight: 152,
      headingWeight: 700,
    };
  }
  return {
    name: "Swiss clarity",
    headingFont: "Arial",
    bodyFont: "Arial",
    heroSize: 29,
    headingSize: 23,
    bodySize: 16,
    heroLineHeight: 120,
    headingLineHeight: 126,
    bodyLineHeight: 150,
    headingWeight: 700,
  };
}

export function selectEmailPatternArtwork(
  value: string,
  style: EmailVisualStyle,
): EmailPatternArtwork {
  const text = value.toLocaleLowerCase("ru-RU");
  const scored = emailPatternLibrary
    .map((pattern) => {
      const keywordHits = pattern.keywords.filter((keyword) =>
        new RegExp(keyword, "iu").test(text),
      ).length;
      const styleFit = pattern.styles.includes(style) ? 1 : 0;
      const nativePriority = pattern.source === "potok" ? 0.35 : 0;
      return {
        pattern,
        score: keywordHits * 4 + styleFit + nativePriority,
      };
    })
    .sort((left, right) => right.score - left.score);
  const bestScore = scored[0]?.score ?? 0;
  const candidates = scored.filter(
    (candidate) => candidate.score >= Math.max(1, bestScore - 0.01),
  );
  const fallbackId =
    style === "premium"
      ? "quiet-luxury"
      : style === "editorial"
        ? "editorial-rules"
        : style === "bold"
          ? "terrazzo-studio"
          : "paper-grain";
  const selected =
    (bestScore >= 4 ? candidates[0]?.pattern : undefined) ??
    emailPatternLibrary.find((pattern) => pattern.id === fallbackId)!;
  return {
    id: selected.id,
    name: selected.name,
    imageUrl: selected.imageUrl,
    alt: `Декоративный узор «${selected.name}»`,
  };
}

export function fallbackEmailImagePrompt(
  goal: string,
  subject: string,
  style: EmailVisualStyle,
  palette: EmailVisualPalette,
) {
  const text = `${goal} ${subject}`.toLocaleLowerCase("ru-RU");
  const scene = /свидан|роман|ужин|ресторан/.test(text)
    ? "элегантный столик на двоих в современном ресторане, мягкий вечерний свет, живые цветы и спокойная интимная атмосфера, без людей"
    : /конференц|вебинар|событ|мероприят/.test(text)
      ? "современное пространство события перед началом, выразительный свет, аккуратная архитектура и ощущение ожидания"
      : /технолог|данн|цифр|ии|ai|продукт/.test(text)
        ? "один выразительный технологический объект, чистая геометрия, мягкий студийный свет и много свободного пространства"
        : `один предметный образ по теме «${subject.slice(0, 100)}», без буквальной иллюстрации каждого слова`;
  const direction =
    style === "minimal"
      ? "минималистичная премиальная editorial-фотография"
      : style === "editorial"
        ? "живая редакционная фотография с естественными фактурами"
        : style === "premium"
          ? "сдержанная luxury-фотография с глубокими тенями"
          : "современная выразительная editorial-фотография";
  const colors = palette.secondaryAccent
    ? `Два равноценных цветовых акцента: ${palette.accent} и ${palette.secondaryAccent}`
    : `Главный цветовой акцент ${palette.name} ${palette.accent}`;
  return `${scene}. ${direction}. ${colors}. Горизонтальная композиция для email, объект в центральных 70%, безопасное кадрирование. Без текста, букв, логотипов, интерфейсов и водяных знаков.`;
}
import { emailPatternLibrary } from "@/data/email-pattern-library";
