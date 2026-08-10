import type {
  EmailBlock,
  EmailBlockType,
  EmailTemplate,
} from "@/types";
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
  heading: { content: "A clear headline", label: undefined, href: undefined },
  text: {
    content: "Hello, {{first_name}}. Add a concise message that gives your reader a reason to continue.",
    label: undefined,
    href: undefined,
  },
  image: {
    content: "Campaign visual",
    label: "Campaign visual",
    href: undefined,
  },
  button: {
    content: "Continue",
    label: "Continue",
    href: "https://mailflow.example",
  },
  columns: {
    content: "One organized contact database|Campaigns with clear performance",
    label: undefined,
    href: undefined,
  },
  divider: { content: "", label: undefined, href: undefined },
  spacer: { content: "", label: undefined, href: undefined },
  social: {
    content: "LinkedIn|Website|X",
    label: undefined,
    href: undefined,
  },
  footer: {
    content: `${BRAND_NAME} · Manage preferences · Unsubscribe`,
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
