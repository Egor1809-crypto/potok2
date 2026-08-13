import type {
  EmailBlock,
  EmailBlockType,
  EmailTemplate,
} from "@/types";
import type { EmailBuilderDocumentInput, EmailTemplateRecord } from "@/types/api";
import { BRAND_NAME } from "@/config/brand";
import { emailPatternPresets } from "./pattern-presets";
import type { EmailFrameStyle } from "./frame-presets";

export type PreviewMode = "desktop" | "mobile";
export type BuilderPanel = "blocks" | "canvas" | "properties";

export type BuilderBlock = EmailBlock & {
  paddingTop: number;
  paddingBottom: number;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  borderRadius: number;
  fontFamily: "Arial" | "Georgia" | "Verdana" | "Trebuchet MS";
  fontWeight: 400 | 500 | 600 | 700;
  lineHeight: number;
  letterSpacing: number;
  paddingLeft: number;
  paddingRight: number;
  borderWidth: number;
  borderColor: string;
  widthPercent: number;
  buttonStyle: "solid" | "outline" | "soft";
};

export type BuilderDocument = {
  templateId: string;
  subject: string;
  previewText: string;
  accentColor: string;
  bodyBackground: string;
  workspaceBackground: string;
  contentWidth: number;
  frameStyle: EmailFrameStyle;
  frameColor: string;
  frameRadius: number;
  blocks: BuilderBlock[];
};

const advancedBlockDefaults = Object.fromEntries(([
  "logo", "heading", "text", "image", "button", "columns", "divider", "spacer", "social", "footer", "hero", "quote", "checklist", "stats", "product", "signature", "pattern", "banner", "timeline", "faq", "coupon", "video", "notice", "comparison", "document", "compliance",
] satisfies EmailBlockType[]).map((type) => [type, {
  fontFamily: "Arial",
  fontWeight: type === "heading" || type === "hero" || type === "logo" ? 700 : 400,
  lineHeight: type === "heading" || type === "hero" ? 115 : 155,
  letterSpacing: type === "logo" || type === "pattern" ? 2 : 0,
  paddingLeft: 40,
  paddingRight: 40,
  borderWidth: 0,
  borderColor: "#e5e7eb",
  widthPercent: 100,
  buttonStyle: "solid",
}])) as Record<EmailBlockType, Pick<BuilderBlock, "fontFamily" | "fontWeight" | "lineHeight" | "letterSpacing" | "paddingLeft" | "paddingRight" | "borderWidth" | "borderColor" | "widthPercent" | "buttonStyle">>;

const legacyBlockDefaults: Record<EmailBlockType, Pick<BuilderBlock, "paddingTop" | "paddingBottom" | "backgroundColor" | "textColor" | "fontSize" | "borderRadius">> = {
  logo: {
    paddingTop: 28,
    paddingBottom: 14,
    backgroundColor: "transparent",
    textColor: "#1f2937",
    fontSize: 12,
    borderRadius: 0,
  },
  heading: {
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: "transparent",
    textColor: "#111827",
    fontSize: 38,
    borderRadius: 0,
  },
  text: {
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "transparent",
    textColor: "#4b5563",
    fontSize: 15,
    borderRadius: 0,
  },
  image: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#6b7280",
    fontSize: 13,
    borderRadius: 14,
  },
  button: {
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: "transparent",
    textColor: "#ffffff",
    fontSize: 14,
    borderRadius: 9,
  },
  columns: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#374151",
    fontSize: 14,
    borderRadius: 10,
  },
  divider: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#e5e7eb",
    fontSize: 1,
    borderRadius: 0,
  },
  spacer: {
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "transparent",
    textColor: "#ffffff",
    fontSize: 1,
    borderRadius: 0,
  },
  social: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#64748b",
    fontSize: 12,
    borderRadius: 8,
  },
  footer: {
    paddingTop: 22,
    paddingBottom: 28,
    backgroundColor: "transparent",
    textColor: "#8b91a1",
    fontSize: 11,
    borderRadius: 0,
  },
  hero: {
    paddingTop: 34,
    paddingBottom: 34,
    backgroundColor: "#f3f2ff",
    textColor: "#171927",
    fontSize: 34,
    borderRadius: 16,
  },
  quote: {
    paddingTop: 22,
    paddingBottom: 22,
    backgroundColor: "#f8f8fb",
    textColor: "#303447",
    fontSize: 18,
    borderRadius: 12,
  },
  checklist: {
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "transparent",
    textColor: "#374151",
    fontSize: 15,
    borderRadius: 10,
  },
  stats: {
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#f7f8fc",
    textColor: "#111827",
    fontSize: 14,
    borderRadius: 12,
  },
  product: {
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#f8f8fb",
    textColor: "#1f2937",
    fontSize: 15,
    borderRadius: 14,
  },
  signature: {
    paddingTop: 18,
    paddingBottom: 24,
    backgroundColor: "transparent",
    textColor: "#475569",
    fontSize: 13,
    borderRadius: 10,
  },
  pattern: {
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#f3edff",
    textColor: "#7c3aed",
    fontSize: 18,
    borderRadius: 12,
  },
  banner: { paddingTop: 18, paddingBottom: 18, backgroundColor: "#1f1433", textColor: "#ffffff", fontSize: 16, borderRadius: 14 },
  timeline: { paddingTop: 20, paddingBottom: 20, backgroundColor: "transparent", textColor: "#302938", fontSize: 14, borderRadius: 12 },
  faq: { paddingTop: 18, paddingBottom: 18, backgroundColor: "#f8f6fb", textColor: "#302938", fontSize: 14, borderRadius: 12 },
  coupon: { paddingTop: 20, paddingBottom: 20, backgroundColor: "#f3edff", textColor: "#24182d", fontSize: 18, borderRadius: 14 },
  video: { paddingTop: 18, paddingBottom: 18, backgroundColor: "#17121c", textColor: "#ffffff", fontSize: 15, borderRadius: 14 },
  notice: { paddingTop: 20, paddingBottom: 20, backgroundColor: "#fff7e6", textColor: "#3f2d16", fontSize: 15, borderRadius: 12 },
  comparison: { paddingTop: 20, paddingBottom: 20, backgroundColor: "transparent", textColor: "#302938", fontSize: 14, borderRadius: 12 },
  document: { paddingTop: 20, paddingBottom: 20, backgroundColor: "#f7f7fa", textColor: "#26222b", fontSize: 14, borderRadius: 12 },
  compliance: { paddingTop: 18, paddingBottom: 18, backgroundColor: "#eef7f3", textColor: "#173d31", fontSize: 14, borderRadius: 12 },
};

const blockDefaults = Object.fromEntries(
  (Object.keys(legacyBlockDefaults) as EmailBlockType[]).map((type) => [type, { ...legacyBlockDefaults[type], ...advancedBlockDefaults[type] }]),
) as Record<EmailBlockType, Pick<BuilderBlock, "paddingTop" | "paddingBottom" | "backgroundColor" | "textColor" | "fontSize" | "borderRadius" | "fontFamily" | "fontWeight" | "lineHeight" | "letterSpacing" | "paddingLeft" | "paddingRight" | "borderWidth" | "borderColor" | "widthPercent" | "buttonStyle">>;

const initialContent: Record<EmailBlockType, Pick<EmailBlock, "content" | "label" | "href">> = {
  logo: { content: BRAND_NAME, label: undefined, href: undefined },
  heading: { content: "Понятный заголовок", label: undefined, href: undefined },
  text: {
    content: "Здравствуйте, {{first_name}}. Добавьте короткое сообщение, которое заинтересует читателя.",
    label: undefined,
    href: undefined,
  },
  image: {
    content: "Изображение кампании",
    label: "Изображение кампании",
    href: undefined,
  },
  button: {
    content: "Продолжить",
    label: "Продолжить",
    href: "https://mailflow.example",
  },
  columns: {
    content: "Единая упорядоченная база контактов|Кампании с понятными показателями",
    label: undefined,
    href: undefined,
  },
  divider: { content: "", label: undefined, href: undefined },
  spacer: { content: "", label: undefined, href: undefined },
  social: {
    content: "LinkedIn|Сайт|X",
    label: undefined,
    href: undefined,
  },
  footer: {
    content: `${BRAND_NAME} · Настроить подписку · Отписаться`,
    label: undefined,
    href: undefined,
  },
  hero: {
    content: "Главная идея письма|Коротко объясните ценность предложения",
    label: undefined,
    href: undefined,
  },
  quote: {
    content: "Цитата клиента или важная мысль|Имя, должность",
    label: undefined,
    href: undefined,
  },
  checklist: {
    content: "Первое преимущество|Второе преимущество|Понятный следующий шаг",
    label: undefined,
    href: undefined,
  },
  stats: {
    content: "42%|Рост откликов|3×|Быстрее запуск",
    label: undefined,
    href: undefined,
  },
  product: {
    content: "Название предложения|Короткое описание пользы|от 9 900 ₽",
    label: "Узнать подробнее",
    href: "https://mailflow.example",
  },
  signature: {
    content: "Егор Сабалин|Основатель Поток|egor@example.ru",
    label: undefined,
    href: undefined,
  },
  pattern: {
    content: emailPatternPresets[0].content,
    label: undefined,
    href: undefined,
  },
  banner: { content: "Важное объявление|Короткое пояснение", label: "Подробнее", href: "https://tech-pravo.ru/" },
  timeline: { content: "Шаг 1|Подготовка|Шаг 2|Согласование|Шаг 3|Результат", label: undefined, href: undefined },
  faq: { content: "Что входит?|Короткий и понятный ответ|Как начать?|Оставьте заявку по кнопке", label: undefined, href: undefined },
  coupon: { content: "ПРОМОКОД|TECH2026|Действует до конца месяца", label: "Скопировать код", href: undefined },
  video: { content: "Посмотрите короткое видео|2 минуты", label: "Смотреть видео", href: "https://tech-pravo.ru/" },
  notice: { content: "ВАЖНОЕ УВЕДОМЛЕНИЕ|Изменения вступят в силу 1 октября 2026 года.|Никаких действий не требуется", label: undefined, href: undefined },
  comparison: { content: "Что было|Старые условия и прежний порядок|Что изменится|Новые условия и обновлённый порядок", label: undefined, href: undefined },
  document: { content: "Дополнительное соглашение № 4|PDF · 428 КБ|Подписать до 30 сентября", label: "Открыть документ", href: "https://tech-pravo.ru/" },
  compliance: { content: "Ваш выбор|Согласен получать информационные письма|Настроить согласие", label: "Управлять согласием", href: "https://tech-pravo.ru/" },
};

let blockSequence = 0;

export function createBlock(type: EmailBlockType): BuilderBlock {
  blockSequence += 1;
  return {
    id: `block-${type}-${Date.now()}-${blockSequence}`,
    type,
    alignment: type === "button" || type === "logo" ? "center" : "left",
    ...initialContent[type],
    ...blockDefaults[type],
  };
}

export function extendBlock(block: EmailBlock): BuilderBlock {
  return {
    ...block,
    ...blockDefaults[block.type],
  };
}

export function documentFromTemplate(template: EmailTemplate): BuilderDocument {
  return {
    templateId: template.id,
    subject: template.subject,
    previewText: template.previewText,
    accentColor: template.accentColor,
    bodyBackground: "#ffffff",
    workspaceBackground: template.backgroundColor,
    contentWidth: 640,
    frameStyle: "none",
    frameColor: template.accentColor,
    frameRadius: 0,
    blocks: template.blocks.map(extendBlock),
  };
}

export function documentFromApiTemplate(
  template: EmailTemplateRecord,
): BuilderDocument {
  return {
    frameStyle: "none",
    frameColor: template.builderDocument.accentColor,
    frameRadius: 0,
    ...template.builderDocument,
    blocks: template.builderDocument.blocks.map((block) => ({ ...blockDefaults[block.type], ...block })),
  };
}

export function createBlankDocument(): BuilderDocument {
  return {
    templateId: "",
    subject: "Тема письма",
    previewText: "",
    accentColor: "#6558e8",
    bodyBackground: "#ffffff",
    workspaceBackground: "#f3f4f8",
    contentWidth: 640,
    frameStyle: "none",
    frameColor: "#7c3aed",
    frameRadius: 0,
    blocks: [],
  } satisfies EmailBuilderDocumentInput;
}

export function createPlainTextDocument({
  templateId = "",
  subject,
  previewText,
  text,
}: {
  templateId?: string;
  subject: string;
  previewText: string;
  text: string;
}): BuilderDocument {
  const base = createBlankDocument();
  const textBlock = base.blocks.find((block) => block.type === "text") ?? createBlock("text");
  return {
    ...base,
    templateId,
    subject,
    previewText,
    blocks: [{ ...textBlock, content: text }],
  };
}

export function cloneBlock(block: BuilderBlock): BuilderBlock {
  blockSequence += 1;
  return {
    ...block,
    id: `${block.id}-copy-${Date.now()}-${blockSequence}`,
  };
}

export type HistoryState = {
  past: BuilderDocument[];
  present: BuilderDocument;
  future: BuilderDocument[];
};

export type HistoryAction =
  | { type: "update"; update: (document: BuilderDocument) => BuilderDocument }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; document: BuilderDocument };

export function createHistory(document: BuilderDocument): HistoryState {
  return { past: [], present: document, future: [] };
}

export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  if (action.type === "update") {
    const next = action.update(state.present);
    if (next === state.present) return state;
    return {
      past: [...state.past.slice(-49), state.present],
      present: next,
      future: [],
    };
  }
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    };
  }
  if (action.type === "redo") {
    const next = state.future[0];
    if (!next) return state;
    return {
      past: [...state.past, state.present],
      present: next,
      future: state.future.slice(1),
    };
  }
  return createHistory(action.document);
}
