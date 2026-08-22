import type { EmailBlockType } from "@/types";

import type { BuilderBlock, BuilderDocument } from "./builder-types";

export type EmailDesignSystemId =
  | "executive-brief"
  | "editorial-paper"
  | "quiet-luxury"
  | "product-signal"
  | "monochrome-journal"
  | "cobalt-precision"
  | "botanical-calm"
  | "warm-human"
  | "data-night"
  | "gallery-white"
  | "sunrise-energy"
  | "civic-trust";

export type EmailDesignSystem = {
  id: EmailDesignSystemId;
  name: string;
  eyebrow: string;
  description: string;
  bestFor: string;
  palette: [string, string, string, string];
  accentColor: string;
  bodyBackground: string;
  workspaceBackground: string;
  textColor: string;
  mutedColor: string;
  cardBackground: string;
  borderColor: string;
  headingFont: BuilderBlock["fontFamily"];
  bodyFont: BuilderBlock["fontFamily"];
  radius: number;
  contentWidth: number;
  frameStyle: BuilderDocument["frameStyle"];
};

export const emailDesignSystems: EmailDesignSystem[] = [
  {
    id: "executive-brief",
    name: "Executive brief",
    eyebrow: "Строго и уверенно",
    description:
      "Белое поле, тёмная типографика, один кобальтовый акцент и чёткая деловая иерархия.",
    bestFor: "B2B, отчёты, приглашения, юридические уведомления",
    palette: ["#F7F8FA", "#FFFFFF", "#172033", "#3157D5"],
    accentColor: "#3157D5",
    bodyBackground: "#FFFFFF",
    workspaceBackground: "#F1F3F6",
    textColor: "#172033",
    mutedColor: "#5C667A",
    cardBackground: "#F5F7FB",
    borderColor: "#D9DEE8",
    headingFont: "Arial",
    bodyFont: "Arial",
    radius: 8,
    contentWidth: 620,
    frameStyle: "hairline",
  },
  {
    id: "editorial-paper",
    name: "Editorial paper",
    eyebrow: "Редакционный голос",
    description:
      "Тёплая бумага, засечковый заголовок, киноварный акцент и почти журнальный ритм без декоративного шума.",
    bestFor: "Колонки, дайджесты, founder letters, культурные проекты",
    palette: ["#EEE9DF", "#FBF8F1", "#24201C", "#A23D2B"],
    accentColor: "#A23D2B",
    bodyBackground: "#FBF8F1",
    workspaceBackground: "#EEE9DF",
    textColor: "#24201C",
    mutedColor: "#6E655B",
    cardBackground: "#F3EEE4",
    borderColor: "#D9CFC0",
    headingFont: "Georgia",
    bodyFont: "Arial",
    radius: 2,
    contentWidth: 600,
    frameStyle: "editorial",
  },
  {
    id: "quiet-luxury",
    name: "Quiet luxury",
    eyebrow: "Тихая премиальность",
    description:
      "Графит, тёплое золото, кремовый текст и тонкие линии. Премиальность создаёт ритм, а не блеск.",
    bestFor: "VIP, закрытые события, премиальные услуги, private sales",
    palette: ["#E9E3D8", "#161512", "#F6F0E5", "#C4A66A"],
    accentColor: "#C4A66A",
    bodyBackground: "#161512",
    workspaceBackground: "#E9E3D8",
    textColor: "#F6F0E5",
    mutedColor: "#C8C0B3",
    cardBackground: "#211F1A",
    borderColor: "#514631",
    headingFont: "Georgia",
    bodyFont: "Arial",
    radius: 6,
    contentWidth: 600,
    frameStyle: "luxury",
  },
  {
    id: "product-signal",
    name: "Product signal",
    eyebrow: "Ясный продуктовый акцент",
    description:
      "Холодный светлый фон, чернильный текст и насыщенный зелёный сигнал для одного главного действия.",
    bestFor: "Запуски, SaaS, обновления продукта, onboarding",
    palette: ["#EEF2F1", "#FFFFFF", "#13201D", "#087A5B"],
    accentColor: "#087A5B",
    bodyBackground: "#FFFFFF",
    workspaceBackground: "#EEF2F1",
    textColor: "#13201D",
    mutedColor: "#50615C",
    cardBackground: "#EDF7F3",
    borderColor: "#CDE0D9",
    headingFont: "Trebuchet MS",
    bodyFont: "Arial",
    radius: 12,
    contentWidth: 640,
    frameStyle: "top-accent",
  },
  {
    id: "monochrome-journal",
    name: "Monochrome journal",
    eyebrow: "Интеллектуальная простота",
    description:
      "Молочно-белая бумага, почти чёрный текст, тонкие линейки и газетная типографика без лишнего цвета.",
    bestFor: "Исследования, эссе, авторские колонки, аналитические дайджесты",
    palette: ["#EFEDE8", "#FCFBF8", "#171717", "#171717"],
    accentColor: "#171717",
    bodyBackground: "#FCFBF8",
    workspaceBackground: "#EFEDE8",
    textColor: "#171717",
    mutedColor: "#66625C",
    cardBackground: "#F5F3EE",
    borderColor: "#CBC7BE",
    headingFont: "Georgia",
    bodyFont: "Arial",
    radius: 0,
    contentWidth: 590,
    frameStyle: "editorial",
  },
  {
    id: "cobalt-precision",
    name: "Cobalt precision",
    eyebrow: "Технологичная точность",
    description:
      "Светлая инженерная сетка, кобальтовый сигнал и компактная типографика для сложной информации.",
    bestFor: "SaaS, финтех, инфраструктура, продуктовые релизы",
    palette: ["#EAF0FF", "#FFFFFF", "#0E1B3D", "#1748D1"],
    accentColor: "#1748D1",
    bodyBackground: "#FFFFFF",
    workspaceBackground: "#EAF0FF",
    textColor: "#0E1B3D",
    mutedColor: "#52617E",
    cardBackground: "#F1F5FF",
    borderColor: "#C8D5F2",
    headingFont: "Trebuchet MS",
    bodyFont: "Arial",
    radius: 4,
    contentWidth: 640,
    frameStyle: "blueprint",
  },
  {
    id: "botanical-calm",
    name: "Botanical calm",
    eyebrow: "Естественный ритм",
    description:
      "Мягкий шалфей, тёплый кремовый фон и спокойные интервалы для заботливого, человеческого тона.",
    bestFor: "Wellness, образование, экопроекты, гостиницы и сервис",
    palette: ["#E7ECE3", "#FBFAF5", "#243128", "#5E765D"],
    accentColor: "#5E765D",
    bodyBackground: "#FBFAF5",
    workspaceBackground: "#E7ECE3",
    textColor: "#243128",
    mutedColor: "#667267",
    cardBackground: "#EFF3EA",
    borderColor: "#CCD6C7",
    headingFont: "Georgia",
    bodyFont: "Arial",
    radius: 14,
    contentWidth: 610,
    frameStyle: "soft",
  },
  {
    id: "warm-human",
    name: "Warm human",
    eyebrow: "Тёплый личный голос",
    description:
      "Слоновая кость, терракотовый акцент и дружелюбная типографика для писем, которые должны звучать как человек.",
    bestFor: "Founder letters, сообщества, приглашения, благодарности",
    palette: ["#F1E8DE", "#FFF9F2", "#35251E", "#C45E3C"],
    accentColor: "#C45E3C",
    bodyBackground: "#FFF9F2",
    workspaceBackground: "#F1E8DE",
    textColor: "#35251E",
    mutedColor: "#75655D",
    cardBackground: "#F9EDE2",
    borderColor: "#E3CBB9",
    headingFont: "Georgia",
    bodyFont: "Arial",
    radius: 10,
    contentWidth: 600,
    frameStyle: "postcard",
  },
  {
    id: "data-night",
    name: "Data night",
    eyebrow: "Сигнал в тёмном поле",
    description:
      "Глубокий синий фон, светлая типографика и бирюзовый акцент для данных, технологий и сильного запуска.",
    bestFor: "AI, кибербезопасность, аналитика, developer updates",
    palette: ["#111827", "#0B1020", "#F2F7FF", "#25C5B4"],
    accentColor: "#25C5B4",
    bodyBackground: "#0B1020",
    workspaceBackground: "#111827",
    textColor: "#F2F7FF",
    mutedColor: "#AAB7CA",
    cardBackground: "#141E32",
    borderColor: "#2A4055",
    headingFont: "Trebuchet MS",
    bodyFont: "Arial",
    radius: 8,
    contentWidth: 640,
    frameStyle: "blueprint",
  },
  {
    id: "gallery-white",
    name: "Gallery white",
    eyebrow: "Воздух и изображение",
    description:
      "Чистое белое поле, графитовая типографика и едва заметные серые линии — контент получает максимум воздуха.",
    bestFor: "Портфолио, архитектура, фотография, fashion и культура",
    palette: ["#F1F1EF", "#FFFFFF", "#202124", "#686B70"],
    accentColor: "#202124",
    bodyBackground: "#FFFFFF",
    workspaceBackground: "#F1F1EF",
    textColor: "#202124",
    mutedColor: "#6F7378",
    cardBackground: "#F8F8F6",
    borderColor: "#DDDEDC",
    headingFont: "Arial",
    bodyFont: "Arial",
    radius: 0,
    contentWidth: 660,
    frameStyle: "side-lines",
  },
  {
    id: "sunrise-energy",
    name: "Sunrise energy",
    eyebrow: "Энергия запуска",
    description:
      "Тёплый светлый фон, коралловый CTA и янтарные поверхности для динамичных анонсов без рекламного крика.",
    bestFor: "Запуски, мероприятия, новые коллекции, сезонные кампании",
    palette: ["#FFF0DE", "#FFF9F0", "#3B221B", "#EF5B37"],
    accentColor: "#EF5B37",
    bodyBackground: "#FFF9F0",
    workspaceBackground: "#FFF0DE",
    textColor: "#3B221B",
    mutedColor: "#7A6258",
    cardBackground: "#FFE8CF",
    borderColor: "#F1C9A8",
    headingFont: "Trebuchet MS",
    bodyFont: "Arial",
    radius: 16,
    contentWidth: 620,
    frameStyle: "top-ribbon",
  },
  {
    id: "civic-trust",
    name: "Civic trust",
    eyebrow: "Доверие и ясность",
    description:
      "Спокойный сине-серый строй, строгие карточки и доступная типографика для важных решений и уведомлений.",
    bestFor: "Госсектор, право, медицина, финансы, обязательные уведомления",
    palette: ["#E9EEF2", "#FFFFFF", "#172734", "#24678A"],
    accentColor: "#24678A",
    bodyBackground: "#FFFFFF",
    workspaceBackground: "#E9EEF2",
    textColor: "#172734",
    mutedColor: "#5D6C76",
    cardBackground: "#F0F5F7",
    borderColor: "#CAD6DC",
    headingFont: "Arial",
    bodyFont: "Arial",
    radius: 6,
    contentWidth: 620,
    frameStyle: "focus",
  },
];

const cardTypes = new Set<EmailBlockType>([
  "hero",
  "columns",
  "quote",
  "checklist",
  "stats",
  "product",
  "banner",
  "timeline",
  "faq",
  "coupon",
  "notice",
  "comparison",
  "document",
  "compliance",
]);

const quietTypes = new Set<EmailBlockType>([
  "text",
  "footer",
  "signature",
  "social",
]);

function styleBlock(
  block: BuilderBlock,
  system: EmailDesignSystem,
): BuilderBlock {
  const heading = block.type === "heading" || block.type === "hero";
  const action = block.type === "button";
  const decorative = block.type === "divider" || block.type === "spacer";
  const card = cardTypes.has(block.type);
  const compact = ["logo", "footer", "social", "divider", "spacer"].includes(
    block.type,
  );
  const fontSize =
    block.type === "hero"
      ? 32
      : block.type === "heading"
        ? 28
        : block.type === "quote"
          ? 18
          : block.type === "footer" || block.type === "social"
            ? 12
            : block.type === "logo"
              ? 13
              : block.type === "button"
                ? 14
                : 16;

  return {
    ...block,
    alignment:
      block.type === "logo" || block.type === "social"
        ? block.alignment
        : block.content.length > 80
          ? "left"
          : block.alignment,
    backgroundColor: action
      ? "transparent"
      : card
        ? system.cardBackground
        : "transparent",
    textColor:
      block.type === "divider"
        ? system.borderColor
        : quietTypes.has(block.type)
          ? system.mutedColor
          : system.textColor,
    fontFamily: heading ? system.headingFont : system.bodyFont,
    fontWeight:
      heading || block.type === "logo"
        ? 700
        : block.type === "button"
          ? 600
          : 400,
    fontSize,
    lineHeight: heading ? 118 : compact ? 145 : 160,
    letterSpacing: block.type === "logo" ? 1.4 : 0,
    paddingTop: compact ? 16 : heading ? 28 : 18,
    paddingBottom: compact ? 16 : heading ? 28 : 18,
    paddingLeft: 36,
    paddingRight: 36,
    borderWidth: card && system.id !== "product-signal" ? 1 : 0,
    borderColor: system.borderColor,
    borderRadius: decorative ? 0 : action ? Math.min(system.radius, 8) : card ? system.radius : 0,
    widthPercent: 100,
    buttonStyle: action ? "solid" : block.buttonStyle,
  };
}

export function applyEmailDesignSystem(
  document: BuilderDocument,
  systemId: EmailDesignSystemId,
): BuilderDocument {
  const system =
    emailDesignSystems.find((item) => item.id === systemId) ??
    emailDesignSystems[0];
  return {
    ...document,
    rawHtml: undefined,
    accentColor: system.accentColor,
    bodyBackground: system.bodyBackground,
    backgroundImageUrl: undefined,
    workspaceBackground: system.workspaceBackground,
    contentWidth: system.contentWidth,
    frameStyle: system.frameStyle,
    frameColor: system.accentColor,
    frameRadius: system.radius,
    blocks: document.blocks.map((block) => styleBlock(block, system)),
  };
}

export type NarrativeRecipeId =
  | "one-idea"
  | "founder-note"
  | "evidence-first"
  | "event-arc"
  | "problem-solution"
  | "launch-story"
  | "invitation-rsvp"
  | "digest-scan"
  | "trust-before-action"
  | "onboarding-path";

export type NarrativeRecipe = {
  id: NarrativeRecipeId;
  name: string;
  eyebrow: string;
  description: string;
  sequence: string[];
  designSystem: EmailDesignSystemId;
};

export const emailNarrativeRecipes: NarrativeRecipe[] = [
  {
    id: "one-idea",
    name: "Одна ясная мысль",
    eyebrow: "Универсальный сценарий",
    description:
      "Ситуация читателя → одна ценность → доказательство → одно действие. Без повторов и витрины из карточек.",
    sequence: ["Контекст", "Польза", "Доказательство", "Действие"],
    designSystem: "executive-brief",
  },
  {
    id: "founder-note",
    name: "Письмо от человека",
    eyebrow: "Анти-ИИ по конструкции",
    description:
      "Короткий личный заход, один содержательный абзац, подпись и необязательная спокойная ссылка.",
    sequence: ["Личный заход", "Суть", "Подпись", "Мягкий CTA"],
    designSystem: "editorial-paper",
  },
  {
    id: "evidence-first",
    name: "Сначала доказательство",
    eyebrow: "Для рациональной аудитории",
    description:
      "Факт или результат открывает письмо, затем следует объяснение, сравнение и конкретный следующий шаг.",
    sequence: ["Факт", "Разбор", "До / после", "Действие"],
    designSystem: "executive-brief",
  },
  {
    id: "event-arc",
    name: "Событие без афиши",
    eyebrow: "Приглашение с драматургией",
    description:
      "Почему встреча важна → что произойдёт → кому подходит → регистрация. Содержание сильнее декора.",
    sequence: ["Зачем прийти", "Программа", "Для кого", "Регистрация"],
    designSystem: "product-signal",
  },
  {
    id: "problem-solution",
    name: "От напряжения к решению",
    eyebrow: "Продажа через понимание",
    description:
      "Узнаваемая проблема → цена бездействия → принцип решения → доказательство → один следующий шаг.",
    sequence: ["Напряжение", "Последствие", "Решение", "Доказательство", "CTA"],
    designSystem: "cobalt-precision",
  },
  {
    id: "launch-story",
    name: "Запуск как история",
    eyebrow: "Новость с причиной",
    description:
      "Что изменилось → почему это важно сейчас → что получает читатель → как попробовать. Не список функций, а переход состояния.",
    sequence: ["Изменение", "Почему сейчас", "Новая ценность", "Попробовать"],
    designSystem: "sunrise-energy",
  },
  {
    id: "invitation-rsvp",
    name: "Приглашение с ответом",
    eyebrow: "Событие и решение",
    description:
      "Образ вечера → причина быть там → конкретика без перегруза → простой RSVP. Визуал поддерживает атмосферу.",
    sequence: ["Атмосфера", "Зачем прийти", "Детали", "RSVP"],
    designSystem: "warm-human",
  },
  {
    id: "digest-scan",
    name: "Дайджест для сканирования",
    eyebrow: "Быстро понять главное",
    description:
      "Редакторский ввод → три приоритетные темы → короткий вывод → спокойная навигация к подробностям.",
    sequence: ["Редакторский ввод", "Главное", "Ещё два сигнала", "Подробнее"],
    designSystem: "monochrome-journal",
  },
  {
    id: "trust-before-action",
    name: "Сначала доверие",
    eyebrow: "Для важных решений",
    description:
      "Контекст → прозрачное объяснение → ограничения и гарантии → действие. Подходит там, где нельзя давить на читателя.",
    sequence: ["Контекст", "Объяснение", "Гарантии", "Действие"],
    designSystem: "civic-trust",
  },
  {
    id: "onboarding-path",
    name: "Путь первого результата",
    eyebrow: "Онбординг без перегруза",
    description:
      "Ожидаемый результат → первый маленький шаг → второй шаг → точка успеха → куда обратиться за помощью.",
    sequence: ["Результат", "Шаг 1", "Шаг 2", "Готово", "Поддержка"],
    designSystem: "product-signal",
  },
];

type NarrativeRole =
  | "brand"
  | "opener"
  | "visual"
  | "context"
  | "value"
  | "proof"
  | "detail"
  | "audience"
  | "action"
  | "signature"
  | "separator"
  | "legal";

const narrativeRoleOrder: Record<
  NarrativeRecipeId,
  Record<NarrativeRole, number>
> = {
  "one-idea": {
    brand: 0,
    opener: 10,
    visual: 15,
    context: 20,
    value: 30,
    proof: 40,
    detail: 50,
    audience: 55,
    action: 60,
    signature: 70,
    separator: 80,
    legal: 90,
  },
  "founder-note": {
    brand: 0,
    opener: 10,
    visual: 15,
    context: 20,
    value: 30,
    proof: 40,
    detail: 45,
    audience: 48,
    signature: 55,
    action: 60,
    separator: 80,
    legal: 90,
  },
  "evidence-first": {
    brand: 0,
    proof: 10,
    opener: 20,
    visual: 25,
    context: 30,
    value: 40,
    detail: 50,
    audience: 55,
    action: 60,
    signature: 70,
    separator: 80,
    legal: 90,
  },
  "event-arc": {
    brand: 0,
    opener: 10,
    visual: 15,
    context: 20,
    detail: 30,
    audience: 40,
    proof: 45,
    value: 50,
    action: 60,
    signature: 70,
    separator: 80,
    legal: 90,
  },
  "problem-solution": {
    brand: 0, opener: 10, context: 20, visual: 25, value: 35, proof: 45,
    detail: 50, audience: 55, action: 60, signature: 70, separator: 80, legal: 90,
  },
  "launch-story": {
    brand: 0, opener: 10, visual: 16, context: 22, value: 32, proof: 42,
    detail: 48, audience: 52, action: 60, signature: 70, separator: 80, legal: 90,
  },
  "invitation-rsvp": {
    brand: 0, opener: 10, visual: 14, context: 20, value: 28, detail: 36,
    audience: 44, proof: 50, action: 60, signature: 70, separator: 80, legal: 90,
  },
  "digest-scan": {
    brand: 0, opener: 10, context: 18, value: 26, proof: 34, detail: 42,
    visual: 48, audience: 52, action: 60, signature: 70, separator: 80, legal: 90,
  },
  "trust-before-action": {
    brand: 0, opener: 10, context: 18, proof: 28, detail: 36, value: 44,
    audience: 50, visual: 54, action: 60, signature: 70, separator: 80, legal: 90,
  },
  "onboarding-path": {
    brand: 0, opener: 10, value: 18, context: 24, detail: 32, visual: 38,
    proof: 46, audience: 52, action: 60, signature: 70, separator: 80, legal: 90,
  },
};

function narrativeRole(block: BuilderBlock, recipeId: NarrativeRecipeId) {
  const content = `${block.content} ${block.label ?? ""}`.toLocaleLowerCase(
    "ru-RU",
  );
  if (block.type === "logo") return "brand" as const;
  if (["hero", "heading", "banner"].includes(block.type))
    return "opener" as const;
  if (["image", "video", "pattern"].includes(block.type))
    return "visual" as const;
  if (["button", "coupon", "document", "product"].includes(block.type))
    return "action" as const;
  if (block.type === "signature") return "signature" as const;
  if (["footer", "social", "compliance"].includes(block.type))
    return "legal" as const;
  if (["divider", "spacer"].includes(block.type))
    return "separator" as const;
  if (["stats", "quote", "comparison"].includes(block.type))
    return "proof" as const;
  if (block.type === "columns") return "audience" as const;
  if (["timeline", "faq"].includes(block.type)) return "detail" as const;
  if (block.type === "checklist")
    return recipeId === "event-arc" ? ("detail" as const) : ("value" as const);
  if (/для кого|кому подойд|участник|аудитори|руководител|специалист/.test(content))
    return "audience" as const;
  if (/\d|%|факт|данн|исслед|результат|отзыв|доказ|кейс|показател/.test(content))
    return "proof" as const;
  if (/зарегистр|запис|ответьте|перейд|оставьте|подтверд|выберите|скачайте/.test(content))
    return "action" as const;
  if (/польз|получит|сможет|поможет|эконом|упрост|ценност|выгод/.test(content))
    return "value" as const;
  if (block.type === "notice") return "context" as const;
  return "context" as const;
}

function narrativeWeight(
  blocks: BuilderBlock[],
  index: number,
  recipeId: NarrativeRecipeId,
) {
  const block = blocks[index];
  const order = narrativeRoleOrder[recipeId];
  const role = narrativeRole(block, recipeId);
  if (role === "legal") {
    if (block.type === "footer") return order.legal + 2;
    if (block.type === "compliance") return order.legal + 1;
    return order.legal;
  }
  if (role !== "separator") return order[role];

  const previous = blocks
    .slice(0, index)
    .reverse()
    .find((item) => narrativeRole(item, recipeId) !== "separator");
  const next = blocks
    .slice(index + 1)
    .find((item) => narrativeRole(item, recipeId) !== "separator");
  const previousWeight = previous
    ? order[narrativeRole(previous, recipeId)]
    : undefined;
  const nextWeight = next ? order[narrativeRole(next, recipeId)] : undefined;
  if (previousWeight !== undefined && nextWeight !== undefined)
    return (previousWeight + nextWeight) / 2;
  if (nextWeight !== undefined) return nextWeight - 0.5;
  if (previousWeight !== undefined) return previousWeight + 0.5;
  return order.separator;
}

function narrativeOrder(
  document: BuilderDocument,
  recipeId: NarrativeRecipeId,
) {
  return document.blocks
    .map((block, index) => ({
      block,
      index,
      weight: narrativeWeight(document.blocks, index, recipeId),
    }))
    .sort((left, right) => left.weight - right.weight || left.index - right.index)
    .map((item) => item.block);
}

export function previewNarrativeRecipe(
  document: BuilderDocument,
  recipeId: NarrativeRecipeId,
) {
  const ordered = narrativeOrder(document, recipeId);
  const movedBlocks = ordered.filter(
    (block, index) => document.blocks[index]?.id !== block.id,
  ).length;
  const roles = new Set(
    document.blocks.map((block) => narrativeRole(block, recipeId)),
  );
  return {
    movedBlocks,
    totalBlocks: document.blocks.length,
    hasOpener: roles.has("opener"),
    hasAction: roles.has("action"),
    hasProof: roles.has("proof"),
  };
}

export function applyNarrativeRecipe(
  document: BuilderDocument,
  recipeId: NarrativeRecipeId,
): BuilderDocument {
  const blocks = narrativeOrder(document, recipeId);
  const unchanged = blocks.every(
    (block, index) => block.id === document.blocks[index]?.id,
  );
  if (unchanged && !document.rawHtml) return document;
  return { ...document, rawHtml: undefined, blocks };
}

export type EmailQualitySeverity = "critical" | "warning" | "suggestion";
export type EmailQualityDimension =
  | "copy"
  | "design"
  | "conversion"
  | "trust"
  | "mobile";

export type EmailQualityIssue = {
  id: string;
  severity: EmailQualitySeverity;
  dimension: EmailQualityDimension;
  title: string;
  description: string;
  penalty: number;
  fixId?: EmailQualityFixId;
  fixLabel?: string;
};

export type EmailQualityReport = {
  score: number;
  verdict: string;
  issues: EmailQualityIssue[];
  dimensions: Record<EmailQualityDimension, number>;
  signals: {
    words: number;
    blocks: number;
    actions: number;
    colors: number;
    aiCliches: number;
  };
};

export type EmailQualityFixId =
  | "add-footer"
  | "humanize-copy"
  | "left-align-copy"
  | "normalize-system"
  | "add-preview";

const actionTypes = new Set<EmailBlockType>([
  "button",
  "product",
  "video",
  "document",
  "compliance",
]);
const aiClichePattern =
  /в современном мире|рады сообщить|уникальн(?:ая|ую|ое) возможност|не упустите возможност|откройте для себя|новый уровень|инновационн|революционн|передов(?:ой|ые|ая)|идеальн(?:ое|ый|ая) решени|максимально эффективн|незабываем|настоящим письмом/giu;
const placeholderPattern =
  /понятный заголовок|главная идея письма|коротко объясните|добавьте короткое сообщение|первое преимущество|второе преимущество|название предложения|example\.(?:ru|com)|mailflow\.example/iu;

function wordsIn(document: BuilderDocument) {
  return [document.subject, document.previewText, ...document.blocks.map((block) => block.content)]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function uniqueColors(document: BuilderDocument) {
  return new Set(
    [
      document.accentColor,
      document.bodyBackground,
      document.workspaceBackground,
      document.frameColor,
      ...document.blocks.flatMap((block) => [
        block.backgroundColor,
        block.textColor,
        block.borderColor,
      ]),
    ].filter((color) => /^#[\dA-F]{6}$/i.test(color)),
  ).size;
}

function reportVerdict(score: number) {
  if (score >= 90) return "Готово к сильной отправке";
  if (score >= 75) return "Хорошая основа — нужна редактура";
  if (score >= 55) return "Письмо выглядит собранным, но ещё шаблонным";
  if (score >= 30) return "Макет теряет доверие и фокус";
  return "Нужна новая редакционная логика";
}

export function analyzeEmailQuality(
  document: BuilderDocument,
): EmailQualityReport {
  const issues: EmailQualityIssue[] = [];
  const dimensions: Record<EmailQualityDimension, number> = {
    copy: 100,
    design: 100,
    conversion: 100,
    trust: 100,
    mobile: 100,
  };
  const add = (issue: EmailQualityIssue) => {
    issues.push(issue);
    dimensions[issue.dimension] = Math.max(
      0,
      dimensions[issue.dimension] - issue.penalty * 2,
    );
  };
  if (!document.blocks.length) {
    add({
      id: "empty",
      severity: "critical",
      dimension: "design",
      title: "Холст пуст",
      description: "Начните со сценария письма, а не с набора отдельных блоков.",
      penalty: 45,
    });
  }
  if (!document.subject.trim() || document.subject === "Тема письма") {
    add({
      id: "subject-missing",
      severity: "critical",
      dimension: "copy",
      title: "Нет рабочей темы",
      description: "Тема — часть замысла письма, а не служебное поле перед отправкой.",
      penalty: 14,
    });
  } else if (document.subject.length > 90) {
    add({
      id: "subject-long",
      severity: "warning",
      dimension: "copy",
      title: "Тема длиннее 90 знаков",
      description: "Главная мысль потеряется в мобильном inbox-превью.",
      penalty: 6,
    });
  }
  if (!document.previewText.trim()) {
    add({
      id: "preview-missing",
      severity: "warning",
      dimension: "conversion",
      title: "Прехедер не работает на открытие",
      description: "Без него почтовый клиент покажет случайный первый текст письма.",
      penalty: 8,
      fixId: "add-preview",
      fixLabel: "Добавить основу",
    });
  } else if (
    document.previewText.trim().toLocaleLowerCase("ru-RU") ===
    document.subject.trim().toLocaleLowerCase("ru-RU")
  ) {
    add({
      id: "preview-duplicate",
      severity: "warning",
      dimension: "conversion",
      title: "Прехедер повторяет тему",
      description: "Две строки inbox-превью должны дополнять друг друга.",
      penalty: 6,
    });
  }

  const completeText = document.blocks.map((block) => block.content).join(" ");
  const aiCliches = completeText.match(aiClichePattern)?.length ?? 0;
  if (aiCliches) {
    add({
      id: "ai-cliches",
      severity: aiCliches > 2 ? "critical" : "warning",
      dimension: "copy",
      title: `${aiCliches} ${aiCliches === 1 ? "нейроклише" : "нейроклише"} в тексте`,
      description:
        "Общие рекламные формулы делают письмо обезличенным и снижают доверие.",
      penalty: Math.min(16, 7 + aiCliches * 2),
      fixId: "humanize-copy",
      fixLabel: "Убрать клише",
    });
  }
  if (placeholderPattern.test(completeText)) {
    add({
      id: "placeholder-copy",
      severity: "critical",
      dimension: "trust",
      title: "В письме остались демо-формулировки",
      description:
        "Шаблонный текст и тестовые адреса нельзя выпускать в реальную кампанию.",
      penalty: 16,
    });
  }
  const longestParagraph = completeText
    .split(/\n{2,}|\|/)
    .reduce((max, part) => Math.max(max, part.trim().length), 0);
  if (longestParagraph > 520) {
    add({
      id: "paragraph-long",
      severity: "warning",
      dimension: "copy",
      title: "Есть тяжёлый абзац",
      description:
        "Фрагмент длиннее 520 знаков трудно сканировать на телефоне. Разделите мысль, не дробя её на карточки.",
      penalty: 6,
    });
  }
  const centeredLong = document.blocks.filter(
    (block) => block.alignment === "center" && block.content.length > 100,
  ).length;
  if (centeredLong) {
    add({
      id: "centered-copy",
      severity: "warning",
      dimension: "design",
      title: "Длинный текст выровнен по центру",
      description:
        "Центровка подходит коротким акцентам, но ломает ритм содержательного текста.",
      penalty: 7,
      fixId: "left-align-copy",
      fixLabel: "Выровнять для чтения",
    });
  }
  const fonts = new Set(document.blocks.map((block) => block.fontFamily));
  const radii = new Set(document.blocks.map((block) => block.borderRadius));
  const colors = uniqueColors(document);
  if (fonts.size > 2 || radii.size > 5 || colors > 9) {
    add({
      id: "visual-drift",
      severity: "warning",
      dimension: "design",
      title: "Нет единой дизайн-системы",
      description: `${fonts.size} шрифта, ${radii.size} вариантов радиуса и ${colors} цветов выглядят как набор независимых AI-блоков.`,
      penalty: 11,
      fixId: "normalize-system",
      fixLabel: "Собрать систему",
    });
  }
  const decorativeBlocks = document.blocks.filter((block) =>
    ["pattern", "banner", "coupon", "spacer"].includes(block.type),
  ).length;
  if (decorativeBlocks > 2) {
    add({
      id: "decor-overload",
      severity: "warning",
      dimension: "design",
      title: "Декор конкурирует с сообщением",
      description:
        "Премиальность держится на отступах, типографике и одном акценте — не на количестве плашек.",
      penalty: 8,
    });
  }
  if (document.blocks.length > 13) {
    add({
      id: "too-many-blocks",
      severity: "suggestion",
      dimension: "mobile",
      title: "Письмо слишком долго прокручивать",
      description:
        "Проверьте, можно ли оставить одну мысль, одно доказательство и одно действие.",
      penalty: 5,
    });
  }
  if (document.blocks.some((block) => block.fontSize < 12 && block.type !== "divider" && block.type !== "spacer")) {
    add({
      id: "small-type",
      severity: "warning",
      dimension: "mobile",
      title: "Есть текст мельче 12 пикселей",
      description: "Он ухудшает чтение и доступность на компактных экранах.",
      penalty: 8,
      fixId: "normalize-system",
      fixLabel: "Нормализовать типографику",
    });
  }
  const actions = document.blocks.filter((block) => actionTypes.has(block.type));
  if (!actions.length && document.blocks.length) {
    add({
      id: "cta-missing",
      severity: "suggestion",
      dimension: "conversion",
      title: "Нет следующего шага",
      description:
        "Даже информационному письму полезно ясно сказать, что делать после прочтения.",
      penalty: 5,
    });
  } else if (actions.length > 2) {
    add({
      id: "cta-many",
      severity: "warning",
      dimension: "conversion",
      title: `${actions.length} конкурирующих действия`,
      description:
        "Оставьте одну основную CTA; второе действие допустимо только как спокойная ссылка.",
      penalty: 9,
    });
  }
  const invalidActions = actions.filter(
    (block) =>
      !block.href?.startsWith("https://") ||
      /example\.|mailflow\.example/i.test(block.href),
  ).length;
  if (invalidActions) {
    add({
      id: "cta-links",
      severity: "critical",
      dimension: "trust",
      title: `${invalidActions} ${invalidActions === 1 ? "нерабочая ссылка" : "нерабочие ссылки"}`,
      description: "Проверьте HTTPS-адреса до тестовой отправки.",
      penalty: 15,
    });
  }
  const footer = document.blocks.find((block) => block.type === "footer");
  if (!footer) {
    add({
      id: "footer-missing",
      severity: "critical",
      dimension: "trust",
      title: "Нет служебного подвала",
      description:
        "Добавьте отправителя, управление подпиской и ссылку отписки.",
      penalty: 14,
      fixId: "add-footer",
      fixLabel: "Добавить подвал",
    });
  } else if (!/отпис|подписк/i.test(footer.content)) {
    add({
      id: "unsubscribe-missing",
      severity: "warning",
      dimension: "trust",
      title: "В подвале нет управления подпиской",
      description: "Получатель должен понимать, почему получил письмо и как отказаться.",
      penalty: 9,
    });
  }
  if (!/{{(?:first_name|last_name|company|position|city)}}/.test(completeText)) {
    add({
      id: "personalization-missing",
      severity: "suggestion",
      dimension: "conversion",
      title: "Письмо одинаково для всех",
      description:
        "Добавьте персонализацию только там, где она делает сообщение конкретнее.",
      penalty: 3,
    });
  }
  const imageWithoutSource = document.blocks.filter(
    (block) => block.type === "image" && !block.href,
  ).length;
  if (imageWithoutSource) {
    add({
      id: "images-missing",
      severity: "critical",
      dimension: "trust",
      title: "Есть пустые места изображений",
      description: "Загрузите реальные файлы или удалите блоки до отправки.",
      penalty: 12,
    });
  }

  const severityOrder: Record<EmailQualitySeverity, number> = {
    critical: 0,
    warning: 1,
    suggestion: 2,
  };
  issues.sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      right.penalty - left.penalty,
  );
  const score = document.blocks.length
    ? Math.max(0, 100 - issues.reduce((total, issue) => total + issue.penalty, 0))
    : 0;
  return {
    score,
    verdict: reportVerdict(score),
    issues,
    dimensions,
    signals: {
      words: wordsIn(document),
      blocks: document.blocks.length,
      actions: actions.length,
      colors,
      aiCliches,
    },
  };
}

function humanizeText(value: string) {
  return value
    .replace(/в современном мире[,.]?\s*/giu, "")
    .replace(/мы рады сообщить(?: вам)?(?: о том,? что)?/giu, "")
    .replace(/рады сообщить(?: вам)?(?: о том,? что)?/giu, "")
    .replace(/не упустите (?:уникальную )?возможность/giu, "если вам это актуально,")
    .replace(/откройте для себя/giu, "посмотрите")
    .replace(/об уникальн\p{L}* возможност\p{L}*/giu, "о возможности")
    .replace(/уникальн\p{L}* возможност\p{L}*/giu, "возможность")
    .replace(/идеальное решение/giu, "решение")
    .replace(/новый уровень/giu, "следующий шаг")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[,.;:—-]+\s*/g, "")
    .trim();
}

export function applyEmailQualityFix(
  document: BuilderDocument,
  fixId: EmailQualityFixId,
): BuilderDocument {
  if (fixId === "add-footer") {
    if (document.blocks.some((block) => block.type === "footer")) return document;
    return { ...document, blocks: [...document.blocks, freshBlock("footer")] };
  }
  if (fixId === "humanize-copy") {
    return {
      ...document,
      blocks: document.blocks.map((block) => ({
        ...block,
        content: humanizeText(block.content),
        ...(block.label ? { label: humanizeText(block.label) } : {}),
      })),
    };
  }
  if (fixId === "left-align-copy") {
    return {
      ...document,
      blocks: document.blocks.map((block) =>
        block.content.length > 100 ? { ...block, alignment: "left" } : block,
      ),
    };
  }
  if (fixId === "add-preview") {
    return {
      ...document,
      previewText:
        document.previewText.trim() ||
        "Главное по теме письма — без повторения заголовка.",
    };
  }
  return applyEmailDesignSystem(document, "executive-brief");
}

export function applyEditorialPolish(document: BuilderDocument) {
  let next = applyEmailDesignSystem(document, "executive-brief");
  next = applyEmailQualityFix(next, "humanize-copy");
  next = applyEmailQualityFix(next, "left-align-copy");
  if (!next.blocks.some((block) => block.type === "footer")) {
    next = applyEmailQualityFix(next, "add-footer");
  }
  return next;
}
