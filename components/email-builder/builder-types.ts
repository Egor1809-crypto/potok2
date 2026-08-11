import type {
  EmailBlock,
  EmailBlockType,
  EmailTemplate,
} from "@/types";
import type { EmailBuilderDocumentInput, EmailTemplateRecord } from "@/types/api";
import { BRAND_NAME } from "@/config/brand";

export type PreviewMode = "desktop" | "mobile";
export type BuilderPanel = "blocks" | "canvas" | "properties";

export type BuilderBlock = EmailBlock & {
  paddingTop: number;
  paddingBottom: number;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  borderRadius: number;
};

export type BuilderDocument = {
  templateId: string;
  subject: string;
  previewText: string;
  accentColor: string;
  bodyBackground: string;
  workspaceBackground: string;
  contentWidth: number;
  blocks: BuilderBlock[];
};

const blockDefaults: Record<
  EmailBlockType,
  Pick<
    BuilderBlock,
    | "paddingTop"
    | "paddingBottom"
    | "backgroundColor"
    | "textColor"
    | "fontSize"
    | "borderRadius"
  >
> = {
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
};

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
    blocks: template.blocks.map(extendBlock),
  };
}

export function documentFromApiTemplate(
  template: EmailTemplateRecord,
): BuilderDocument {
  return {
    ...template.builderDocument,
    blocks: template.builderDocument.blocks.map((block) => ({ ...block })),
  };
}

export function createBlankDocument(): BuilderDocument {
  const blocks = [
    createBlock("logo"),
    createBlock("heading"),
    createBlock("text"),
    createBlock("button"),
    createBlock("footer"),
  ];
  return {
    templateId: "",
    subject: "Тема письма",
    previewText: "",
    accentColor: "#6558e8",
    bodyBackground: "#ffffff",
    workspaceBackground: "#f3f4f8",
    contentWidth: 640,
    blocks,
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
