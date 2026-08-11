"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
} from "react";
import { Blocks, SlidersHorizontal, SquareDashedMousePointer } from "lucide-react";

import { templates } from "@/data/templates";
import type { EmailBlockType } from "@/types";
import { ToastProvider, useToast } from "@/components/ui";
import { cn } from "@/components/ui/utils";

import { BlockLibrary, blockLibrary } from "./BlockLibrary";
import { BuilderTopbar, MobilePreviewToggle } from "./BuilderTopbar";
import { EmailCanvas } from "./EmailCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import {
  cloneBlock,
  createBlock,
  createHistory,
  documentFromTemplate,
  historyReducer,
  type BuilderBlock,
  type BuilderDocument,
  type BuilderPanel,
  type PreviewMode,
} from "./builder-types";

export type EmailBuilderViewProps = {
  templateId?: string;
  campaignName?: string;
  continueHref?: string;
};

type EmailBuilderWorkspaceProps = EmailBuilderViewProps & {
  restoredDocument?: BuilderDocument;
  handoffStorageKey?: string;
};

const CAMPAIGN_WIZARD_HANDOFF_STORAGE_PREFIX =
  "mailflow:campaign-wizard-handoff:";
const emailBlockTypes = new Set<EmailBlockType>([
  "logo",
  "heading",
  "text",
  "image",
  "button",
  "columns",
  "divider",
  "spacer",
  "social",
  "footer",
]);

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getBrowserSearch() {
  return window.location.search;
}

function getServerSearch() {
  return "";
}

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getServerStorageSnapshot() {
  return "";
}

function safeCampaignReturnPath(value: string | null): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

function safeStorageToken(value: string | null): string | undefined {
  if (!value || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) return undefined;
  return value;
}

function handoffTokenFromReturnPath(path: string | undefined) {
  if (!path) return undefined;
  try {
    const target = new URL(path, "https://mailflow.local");
    return safeStorageToken(target.searchParams.get("handoff"));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBuilderBlock(value: unknown): value is BuilderBlock {
  if (!isRecord(value)) return false;
  const alignment = value.alignment;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    emailBlockTypes.has(value.type as EmailBlockType) &&
    typeof value.content === "string" &&
    (alignment === undefined ||
      alignment === "left" ||
      alignment === "center" ||
      alignment === "right") &&
    (value.href === undefined || typeof value.href === "string") &&
    (value.label === undefined || typeof value.label === "string") &&
    isFiniteNumber(value.paddingTop) &&
    isFiniteNumber(value.paddingBottom) &&
    typeof value.backgroundColor === "string" &&
    typeof value.textColor === "string" &&
    isFiniteNumber(value.fontSize) &&
    isFiniteNumber(value.borderRadius)
  );
}

function isBuilderDocument(value: unknown): value is BuilderDocument {
  if (!isRecord(value)) return false;
  return (
    typeof value.templateId === "string" &&
    typeof value.subject === "string" &&
    typeof value.previewText === "string" &&
    typeof value.accentColor === "string" &&
    typeof value.bodyBackground === "string" &&
    typeof value.workspaceBackground === "string" &&
    isFiniteNumber(value.contentWidth) &&
    Array.isArray(value.blocks) &&
    value.blocks.length > 0 &&
    value.blocks.every(isBuilderBlock)
  );
}

function documentToPlainText(document: BuilderDocument) {
  return document.blocks
    .filter((block) => !["logo", "image", "divider", "spacer", "social"].includes(block.type))
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

function parseWizardBuilderSnapshot(snapshot: string) {
  if (!snapshot) return {};
  try {
    const value: unknown = JSON.parse(snapshot);
    if (!isRecord(value)) return {};
    return {
      campaignName: typeof value.name === "string" ? value.name : undefined,
      document: isBuilderDocument(value.builderDocument)
        ? value.builderDocument
        : undefined,
    };
  } catch {
    return {};
  }
}

function storageSnapshotFingerprint(snapshot: string) {
  let hash = 2166136261;
  for (let index = 0; index < snapshot.length; index += 1) {
    hash ^= snapshot.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${snapshot.length}-${hash >>> 0}`;
}

export function EmailBuilderView(props: EmailBuilderViewProps) {
  const browserSearch = useSyncExternalStore(
    subscribeToLocation,
    getBrowserSearch,
    getServerSearch,
  );
  const query = useMemo(() => new URLSearchParams(browserSearch), [browserSearch]);
  const requestedTemplateId = props.templateId ?? query.get("template") ?? undefined;
  const requestedContinueHref =
    props.continueHref ?? safeCampaignReturnPath(query.get("returnTo"));
  const handoffToken =
    safeStorageToken(query.get("handoff")) ??
    handoffTokenFromReturnPath(requestedContinueHref);
  const handoffStorageKey = handoffToken
    ? `${CAMPAIGN_WIZARD_HANDOFF_STORAGE_PREFIX}${handoffToken}`
    : undefined;
  const getHandoffSnapshot = useCallback(() => {
    if (!handoffStorageKey) return "";
    try {
      return window.localStorage.getItem(handoffStorageKey) ?? "";
    } catch {
      return "";
    }
  }, [handoffStorageKey]);
  const handoffSnapshot = useSyncExternalStore(
    subscribeToStorage,
    getHandoffSnapshot,
    getServerStorageSnapshot,
  );
  const restoredState = useMemo(
    () => parseWizardBuilderSnapshot(handoffSnapshot),
    [handoffSnapshot],
  );
  const restoredDocument =
    restoredState.document &&
    (!requestedTemplateId ||
      restoredState.document.templateId === requestedTemplateId)
      ? restoredState.document
      : undefined;
  const resolvedTemplateId =
    requestedTemplateId ?? restoredDocument?.templateId;
  const resolvedTemplate = templates.find(
    (template) => template.id === resolvedTemplateId,
  );
  const resolvedCampaignName =
    props.campaignName ??
    query.get("campaign") ??
    restoredState.campaignName ??
    resolvedTemplate?.name ??
    "Кампания без названия";
  const resolvedContinueHref =
    requestedContinueHref ??
    `/campaigns/new?step=sender&builderDraft=1${
      resolvedTemplateId ? `&template=${encodeURIComponent(resolvedTemplateId)}` : ""
    }`;

  return (
    <ToastProvider>
      <EmailBuilderWorkspace
        key={`${resolvedTemplateId ?? "default"}:${resolvedCampaignName}:${resolvedContinueHref}:${storageSnapshotFingerprint(handoffSnapshot)}`}
        templateId={resolvedTemplateId}
        campaignName={resolvedCampaignName}
        continueHref={resolvedContinueHref}
        restoredDocument={restoredDocument}
        handoffStorageKey={handoffStorageKey}
      />
    </ToastProvider>
  );
}

function EmailBuilderWorkspace({
  templateId,
  campaignName: initialCampaignName = "Приглашение на юридическую конференцию",
  continueHref = "/campaigns/new?step=sender",
  restoredDocument,
  handoffStorageKey,
}: EmailBuilderWorkspaceProps) {
  const toast = useToast();
  const initialTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? templates[0],
    [templateId],
  );
  const initialDocument = useMemo(
    () => restoredDocument ?? documentFromTemplate(initialTemplate),
    [initialTemplate, restoredDocument],
  );
  const [history, dispatch] = useReducer(
    historyReducer,
    initialDocument,
    createHistory,
  );
  const [selectedBlockId, setSelectedBlockId] = useState(
    initialDocument.blocks.find((block) => block.type === "heading")?.id ??
      initialDocument.blocks[0]?.id ??
      "",
  );
  const [campaignName, setCampaignName] = useState(initialCampaignName);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [mobilePanel, setMobilePanel] = useState<BuilderPanel>("canvas");
  const [dirty, setDirty] = useState(false);

  const document = history.present;
  const selectedBlock =
    document.blocks.find((block) => block.id === selectedBlockId) ??
    document.blocks[0];

  const mutateDocument = useCallback(
    (update: (current: BuilderDocument) => BuilderDocument) => {
      dispatch({ type: "update", update });
      setDirty(true);
    },
    [],
  );

  const updateBlock = (blockId: string, patch: Partial<BuilderBlock>) => {
    mutateDocument((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === blockId ? { ...block, ...patch } : block,
      ),
    }));
  };

  const updateDocument = (patch: Partial<BuilderDocument>) => {
    mutateDocument((current) => ({ ...current, ...patch }));
  };

  const addBlock = (type: EmailBlockType) => {
    const block = createBlock(type);
    mutateDocument((current) => {
      const selectedIndex = current.blocks.findIndex(
        (item) => item.id === selectedBlockId,
      );
      const insertAt = selectedIndex < 0 ? current.blocks.length : selectedIndex + 1;
      return {
        ...current,
        blocks: [
          ...current.blocks.slice(0, insertAt),
          block,
          ...current.blocks.slice(insertAt),
        ],
      };
    });
    setSelectedBlockId(block.id);
    setMobilePanel("canvas");
    const blockLabel = blockLibrary.find((item) => item.type === type)?.label ?? "Блок";
    toast.success("Блок добавлен", `${blockLabel} готов к редактированию.`);
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    mutateDocument((current) => {
      const from = current.blocks.findIndex((block) => block.id === blockId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...current, blocks };
    });
  };

  const duplicateBlock = (blockId: string) => {
    const source = document.blocks.find((block) => block.id === blockId);
    if (!source) return;
    const duplicate = cloneBlock(source);
    mutateDocument((current) => {
      const index = current.blocks.findIndex((block) => block.id === blockId);
      if (index < 0) return current;
      const blocks = [...current.blocks];
      blocks.splice(index + 1, 0, duplicate);
      return { ...current, blocks };
    });
    setSelectedBlockId(duplicate.id);
    toast.success("Блок продублирован", "Копия размещена под исходным блоком.");
  };

  const deleteBlock = (blockId: string) => {
    if (document.blocks.length === 1) {
      toast.warning("Оставьте один блок", "В письме должен быть хотя бы один блок контента.");
      return;
    }
    const index = document.blocks.findIndex((block) => block.id === blockId);
    const nextSelection =
      document.blocks[index + 1]?.id ?? document.blocks[index - 1]?.id ?? "";
    mutateDocument((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== blockId),
    }));
    setSelectedBlockId(nextSelection);
    toast.info("Блок удалён", "Если передумаете, отмените действие.");
  };

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
    setDirty(true);
  }, []);

  const persistDraft = useCallback(() => {
    const emailBodyText = documentToPlainText(document);
    try {
      window.localStorage.setItem(
        "mailflow:email-draft",
        JSON.stringify({ campaignName, document, emailBodyText }),
      );
    } catch {
      // Saving remains successful for the current demo session.
    }
    if (handoffStorageKey) {
      try {
        const storedValue: unknown = JSON.parse(
          window.localStorage.getItem(handoffStorageKey) ?? "{}",
        );
        if (isRecord(storedValue)) {
          window.localStorage.setItem(
            handoffStorageKey,
            JSON.stringify({
              ...storedValue,
              name: campaignName,
              subject: document.subject,
              previewText: document.previewText,
              emailBodyText,
              builderDocument: document,
            }),
          );
        }
      } catch {
        // The global builder draft still preserves the current demo edit.
      }
    }
    setDirty(false);
  }, [campaignName, document, handoffStorageKey]);

  const save = useCallback(() => {
    persistDraft();
    toast.success("Черновик сохранён", "Изменения будут переданы в мастер кампании.");
  }, [persistDraft, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing =
        target.matches("input, textarea, select") || target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
      if (!editing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.document.addEventListener("keydown", onKeyDown);
    return () => window.document.removeEventListener("keydown", onKeyDown);
  }, [redo, save, undo]);

  const setCampaignNameDirty = (name: string) => {
    setCampaignName(name);
    setDirty(true);
  };

  if (!selectedBlock) return null;

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
      <BuilderTopbar
        campaignName={campaignName}
        onCampaignNameChange={setCampaignNameDirty}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        dirty={dirty}
        onUndo={undo}
        onRedo={redo}
        onSave={save}
        onContinue={persistDraft}
        continueHref={continueHref}
      />

      <div className="flex h-11 items-center justify-between gap-3 border-b border-border bg-surface px-3 lg:hidden">
        <div className="flex items-center rounded-[9px] bg-surface-subtle p-1">
          {(
            [
              ["blocks", Blocks],
              ["canvas", SquareDashedMousePointer],
              ["properties", SlidersHorizontal],
            ] as const
          ).map(([panel, Icon]) => (
            <button
              key={panel}
              type="button"
              aria-pressed={mobilePanel === panel}
              onClick={() => setMobilePanel(panel)}
              className="flex h-7 items-center gap-1.5 rounded-[7px] px-2 text-[10px] font-medium capitalize text-text-muted outline-none transition aria-pressed:bg-surface aria-pressed:text-primary aria-pressed:shadow-[var(--shadow-xs)] focus-visible:ring-2 focus-visible:ring-primary/30 sm:px-2.5"
            >
              <Icon aria-hidden="true" className="size-3" />
              <span className="hidden min-[420px]:inline">{panel === "blocks" ? "Блоки" : panel === "canvas" ? "Холст" : "Свойства"}</span>
            </button>
          ))}
        </div>
        <MobilePreviewToggle value={previewMode} onChange={setPreviewMode} />
      </div>

      <div className="grid h-[calc(100dvh-200px)] min-h-[560px] max-h-[920px] lg:grid-cols-[210px_minmax(420px,1fr)_260px] xl:grid-cols-[232px_minmax(520px,1fr)_286px]">
        <BlockLibrary
          onAdd={addBlock}
          className={cn(
            "min-h-0 border-r border-border",
            mobilePanel === "blocks" ? "flex" : "hidden",
            "lg:flex",
          )}
        />
        <EmailCanvas
          document={document}
          previewMode={previewMode}
          selectedBlockId={selectedBlock.id}
          onSelect={setSelectedBlockId}
          onMove={moveBlock}
          onDuplicate={duplicateBlock}
          onDelete={deleteBlock}
          onOpenBlocks={() => setMobilePanel("blocks")}
          className={cn(
            "min-h-0",
            mobilePanel === "canvas" ? "flex" : "hidden",
            "lg:flex",
          )}
        />
        <PropertiesPanel
          block={selectedBlock}
          document={document}
          onUpdateBlock={(patch) => updateBlock(selectedBlock.id, patch)}
          onUpdateDocument={updateDocument}
          onDuplicate={() => duplicateBlock(selectedBlock.id)}
          onDelete={() => deleteBlock(selectedBlock.id)}
          className={cn(
            "min-h-0 border-l border-border",
            mobilePanel === "properties" ? "flex" : "hidden",
            "lg:flex",
          )}
        />
      </div>
    </div>
  );
}
