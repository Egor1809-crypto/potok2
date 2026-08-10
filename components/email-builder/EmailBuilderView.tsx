"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Blocks, SlidersHorizontal, SquareDashedMousePointer } from "lucide-react";

import { templates } from "@/data/templates";
import type { EmailBlockType } from "@/types";
import { ToastProvider, useToast } from "@/components/ui";
import { cn } from "@/components/ui/utils";

import { BlockLibrary } from "./BlockLibrary";
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

function safeCampaignReturnPath(value: string | null): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export function EmailBuilderView(props: EmailBuilderViewProps) {
  const browserSearch = useSyncExternalStore(
    subscribeToLocation,
    getBrowserSearch,
    getServerSearch,
  );
  const query = useMemo(() => new URLSearchParams(browserSearch), [browserSearch]);
  const resolvedTemplateId = props.templateId ?? query.get("template") ?? undefined;
  const resolvedTemplate = templates.find(
    (template) => template.id === resolvedTemplateId,
  );
  const resolvedCampaignName =
    props.campaignName ??
    query.get("campaign") ??
    resolvedTemplate?.name ??
    "Untitled campaign";
  const resolvedContinueHref =
    props.continueHref ??
    safeCampaignReturnPath(query.get("returnTo")) ??
    `/campaigns/new?step=sender&builderDraft=1${
      resolvedTemplateId ? `&template=${encodeURIComponent(resolvedTemplateId)}` : ""
    }`;

  return (
    <ToastProvider>
      <EmailBuilderWorkspace
        key={`${resolvedTemplateId ?? "default"}:${resolvedCampaignName}:${resolvedContinueHref}`}
        templateId={resolvedTemplateId}
        campaignName={resolvedCampaignName}
        continueHref={resolvedContinueHref}
      />
    </ToastProvider>
  );
}

function EmailBuilderWorkspace({
  templateId,
  campaignName: initialCampaignName = "Legal Conference Invitation",
  continueHref = "/campaigns/new?step=sender",
}: EmailBuilderViewProps) {
  const toast = useToast();
  const timersRef = useRef<number[]>([]);
  const initialTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? templates[0],
    [templateId],
  );
  const initialDocument = useMemo(
    () => documentFromTemplate(initialTemplate),
    [initialTemplate],
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
  const [sendingTest, setSendingTest] = useState(false);

  const document = history.present;
  const selectedBlock =
    document.blocks.find((block) => block.id === selectedBlockId) ??
    document.blocks[0];

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

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
    toast.success("Block added", `${type[0]?.toUpperCase()}${type.slice(1)} is ready to edit.`);
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
    toast.success("Block duplicated", "The copy was placed below the original.");
  };

  const deleteBlock = (blockId: string) => {
    if (document.blocks.length === 1) {
      toast.warning("Keep one block", "An email needs at least one content block.");
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
    toast.info("Block removed", "Use Undo if you change your mind.");
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
    try {
      window.localStorage.setItem(
        "mailflow:email-draft",
        JSON.stringify({ campaignName, document }),
      );
    } catch {
      // Saving remains successful for the current demo session.
    }
    setDirty(false);
  }, [campaignName, document]);

  const save = useCallback(() => {
    persistDraft();
    toast.success("Draft saved", "Your email is saved in this demo workspace.");
  }, [persistDraft, toast]);

  const sendTest = () => {
    if (sendingTest) return;
    setSendingTest(true);
    const timer = window.setTimeout(() => {
      setSendingTest(false);
      toast.success(
        "Test email sent",
        "A personalized preview is on its way to egor@mailflow.example.",
      );
    }, 850);
    timersRef.current.push(timer);
  };

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
        sendingTest={sendingTest}
        onUndo={undo}
        onRedo={redo}
        onSendTest={sendTest}
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
              <span className="hidden min-[420px]:inline">{panel}</span>
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
