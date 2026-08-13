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
import Link from "next/link";
import { Blocks, Library, PenTool, Save, SlidersHorizontal, Sparkles, SquareDashedMousePointer, WandSparkles } from "lucide-react";

import type { EmailBlockType, TemplateCategory } from "@/types";
import type {
  ApiError,
  EmailTemplateMutationResponse,
  EmailTemplatesListResponse,
  EmailTemplateRecord,
} from "@/types/api";
import {
  Alert,
  Button,
  FormField,
  Input,
  Select,
  ToastProvider,
  buttonVariants,
  useToast,
} from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { overlayEmailDocumentMetadata } from "@/lib/campaign-email-draft";
import {
  campaignHandoffStorageKey,
  normalizeCampaignHandoffToken,
  readCampaignHandoffSnapshot,
  writeCampaignHandoffSnapshot,
} from "@/lib/campaign-handoff";

import { BlockLibrary, blockLibrary } from "./BlockLibrary";
import { BuilderTopbar, MobilePreviewToggle } from "./BuilderTopbar";
import { EmailExportMenu } from "./EmailExportMenu";
import { EmailCanvas } from "./EmailCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { AiEmailAssistant } from "./AiEmailAssistant";
import {
  cloneBlock,
  createBlankDocument,
  createBlock,
  createPlainTextDocument,
  createHistory,
  documentFromApiTemplate,
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
  initialDocument: BuilderDocument;
  handoffStorageKey?: string;
  handoffToken?: string;
  mode: "campaign" | "template";
  templateRecord?: EmailTemplateRecord | null;
};

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
  "hero",
  "quote",
  "checklist",
  "stats",
  "product",
  "signature",
  "pattern",
  "banner",
  "timeline",
  "faq",
  "coupon",
  "video",
  "notice",
  "comparison",
  "document",
  "compliance",
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

function handoffTokenFromReturnPath(path: string | undefined) {
  if (!path) return undefined;
  try {
    const target = new URL(path, "https://mailflow.local");
    return normalizeCampaignHandoffToken(target.searchParams.get("handoff"));
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
    (value.frameStyle === undefined || ["none", "hairline", "accent", "double", "dashed", "top-bottom", "left-band", "soft", "capsule", "stamp", "offset", "inset", "top-accent", "bottom-accent", "right-band", "editorial", "ticket", "window", "railway", "archive", "corner-cut", "top-ribbon", "side-lines", "luxury", "blueprint", "poster", "postcard", "focus"].includes(String(value.frameStyle))) &&
    (value.frameColor === undefined || typeof value.frameColor === "string") &&
    (value.frameRadius === undefined || isFiniteNumber(value.frameRadius)) &&
    Array.isArray(value.blocks) &&
    value.blocks.every(isBuilderBlock)
  );
}

function documentToPlainText(document: BuilderDocument) {
  return document.blocks
    .filter((block) => !["logo", "image", "divider", "spacer", "social", "pattern"].includes(block.type))
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
      campaignName:
        typeof value.name === "string"
          ? value.name
          : typeof value.campaignName === "string"
            ? value.campaignName
            : undefined,
      subject: typeof value.subject === "string" ? value.subject : undefined,
      previewText: typeof value.previewText === "string" ? value.previewText : undefined,
      emailBodyText: typeof value.emailBodyText === "string" ? value.emailBodyText : undefined,
      templateId: value.templateId === null
        ? null
        : typeof value.templateId === "string"
          ? value.templateId
          : undefined,
      document: isBuilderDocument(value.builderDocument)
        ? value.builderDocument
        : isBuilderDocument(value.emailBuilderDocument)
          ? value.emailBuilderDocument
        : isBuilderDocument(value.document)
          ? value.document
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
  const createNew = query.get("new") === "1";
  const requestedTemplateId = createNew
    ? undefined
    : props.templateId ?? query.get("template") ?? undefined;
  const requestedContinueHref =
    props.continueHref ?? safeCampaignReturnPath(query.get("returnTo"));
  const handoffToken =
    normalizeCampaignHandoffToken(query.get("handoff")) ??
    handoffTokenFromReturnPath(requestedContinueHref);
  const handoffStorageKey = handoffToken
    ? campaignHandoffStorageKey(handoffToken)
    : undefined;
  const getBrowserDraftSnapshot = useCallback(() => {
    if (!handoffStorageKey) return "";
    try {
      return handoffToken
        ? readCampaignHandoffSnapshot(window.sessionStorage, handoffToken) ?? ""
        : "";
    } catch {
      return "";
    }
  }, [handoffStorageKey, handoffToken]);
  const browserDraftSnapshot = useSyncExternalStore(
    subscribeToStorage,
    getBrowserDraftSnapshot,
    getServerStorageSnapshot,
  );
  const restoredState = useMemo(
    () => parseWizardBuilderSnapshot(browserDraftSnapshot),
    [browserDraftSnapshot],
  );
  const campaignMode = Boolean(handoffStorageKey || requestedContinueHref);
  const restoredDocument =
    campaignMode &&
    !createNew &&
    restoredState.document &&
    (!requestedTemplateId ||
      restoredState.document.templateId === requestedTemplateId)
      ? restoredState.document
      : undefined;
  const [templateRecord, setTemplateRecord] = useState<EmailTemplateRecord | null>(null);
  const [templateLoadState, setTemplateLoadState] = useState<"loading" | "ready" | "error">(
    requestedTemplateId ? "loading" : "ready",
  );

  useEffect(() => {
    if (!requestedTemplateId) {
      const frame = window.requestAnimationFrame(() => {
        setTemplateRecord(null);
        setTemplateLoadState("ready");
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => setTemplateLoadState("loading"));
    void fetch(`/api/templates?id=${encodeURIComponent(requestedTemplateId)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as EmailTemplateMutationResponse | ApiError;
        if (!response.ok || !("template" in body)) {
          throw new Error("error" in body ? body.error : "Шаблон не загружен.");
        }
        setTemplateRecord(body.template);
        setTemplateLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setTemplateRecord(null);
        setTemplateLoadState("error");
      });
    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [requestedTemplateId]);

  const resolvedTemplateId = createNew
    ? undefined
    : requestedTemplateId ??
      (restoredState.templateId !== undefined
        ? restoredState.templateId ?? undefined
        : restoredDocument?.templateId || undefined);
  const resolvedCampaignName =
    props.campaignName ??
    query.get("campaign") ??
    (campaignMode ? restoredState.campaignName : undefined) ??
    (templateRecord
      ? !campaignMode && templateRecord.isStarter
        ? `${templateRecord.name} — мой вариант`
        : templateRecord.name
      : undefined) ??
    (campaignMode ? "Кампания без названия" : "Новый email-шаблон");
  const resolvedContinueHref =
    requestedContinueHref ??
    (campaignMode
      ? `/campaigns/new?step=message&builderDraft=1${
          resolvedTemplateId ? `&template=${encodeURIComponent(resolvedTemplateId)}` : ""
        }`
      : "/templates?scope=mine");

  if (templateLoadState === "loading") {
    return <div className="card grid min-h-[560px] place-items-center p-8 text-center text-[13px] text-text-muted">Загружаем шаблон с сервера…</div>;
  }
  if (templateLoadState === "error") {
    return (
      <div className="card mx-auto max-w-xl p-6">
        <Alert tone="danger" title="Шаблон не загружен">
          Запись не найдена или сервер временно недоступен. Локальная копия не показывается как серверная.
        </Alert>
        <Link href="/templates" className={buttonVariants({ variant: "primary", className: "mt-4" })}>Вернуться к шаблонам</Link>
      </div>
    );
  }

  const baseDocument = createNew
    ? createBlankDocument()
    : restoredDocument ??
    (campaignMode && restoredState.emailBodyText
      ? createPlainTextDocument({
          templateId: resolvedTemplateId ?? "",
          subject: restoredState.subject ?? templateRecord?.subject ?? "Тема письма",
          previewText: restoredState.previewText ?? templateRecord?.previewText ?? "",
          text: restoredState.emailBodyText,
        })
      : templateRecord
        ? documentFromApiTemplate(templateRecord)
        : createBlankDocument());
  const normalizedBaseDocument: BuilderDocument = {
    ...baseDocument,
    frameStyle: baseDocument.frameStyle ?? "none",
    frameColor: baseDocument.frameColor ?? baseDocument.accentColor,
    frameRadius: baseDocument.frameRadius ?? 0,
  };
  const metadataDocument = campaignMode && restoredState.templateId === null
    ? { ...normalizedBaseDocument, templateId: "" }
    : normalizedBaseDocument;
  const initialDocument = campaignMode && !createNew
    ? overlayEmailDocumentMetadata(metadataDocument, {
        subject: restoredState.subject,
        previewText: restoredState.previewText,
      })
    : metadataDocument;

  return (
    <ToastProvider>
      <EmailBuilderWorkspace
        key={`${createNew ? "blank" : resolvedTemplateId ?? "new"}:${resolvedCampaignName}:${resolvedContinueHref}:${campaignMode ? storageSnapshotFingerprint(browserDraftSnapshot) : "server"}`}
        templateId={resolvedTemplateId}
        campaignName={resolvedCampaignName}
        continueHref={resolvedContinueHref}
        initialDocument={initialDocument}
        handoffStorageKey={handoffStorageKey}
        handoffToken={handoffToken}
        mode={campaignMode ? "campaign" : "template"}
        templateRecord={templateRecord}
      />
    </ToastProvider>
  );
}

function EmailBuilderWorkspace({
  templateId,
  campaignName: initialCampaignName = "Новый email-шаблон",
  continueHref = "/templates",
  initialDocument,
  handoffStorageKey,
  handoffToken,
  mode,
  templateRecord,
}: EmailBuilderWorkspaceProps) {
  const toast = useToast();
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
  const [templateDescription, setTemplateDescription] = useState(templateRecord?.description ?? "");
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>(templateRecord?.category ?? "Business");
  const editingStarter = mode === "template" && Boolean(templateRecord?.isStarter);
  const [savedTemplateId, setSavedTemplateId] = useState(editingStarter ? null : templateRecord?.id ?? templateId ?? null);
  const [templateRevision, setTemplateRevision] = useState(editingStarter ? null : templateRecord?.updatedAt ?? null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [mobilePanel, setMobilePanel] = useState<BuilderPanel>("canvas");
  const [dirty, setDirty] = useState(mode === "template" ? !templateRecord || editingStarter : true);
  const [creationMode, setCreationMode] = useState<"start" | "manual" | "ai">(
    mode === "template" && !templateRecord && initialDocument.blocks.length === 0 ? "start" : "manual",
  );
  const editRevisionRef = useRef(0);
  const savingTemplateRef = useRef(false);

  const document = history.present;
  const selectedBlock =
    document.blocks.find((block) => block.id === selectedBlockId) ??
    document.blocks[0];

  const markDirty = useCallback(() => {
    editRevisionRef.current += 1;
    setDirty(true);
  }, []);

  const mutateDocument = useCallback(
    (update: (current: BuilderDocument) => BuilderDocument) => {
      dispatch({ type: "update", update });
      markDirty();
    },
    [markDirty],
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

  const addBlock = (type: EmailBlockType, patch?: { content?: string; fontSize?: number; letterSpacing?: number }) => {
    const block = { ...createBlock(type), ...patch };
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
    markDirty();
  }, [markDirty]);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
    markDirty();
  }, [markDirty]);

  const persistDraft = useCallback(() => {
    const emailBodyText = documentToPlainText(document);
    let savedToBrowser = Boolean(handoffStorageKey && handoffToken);
    if (handoffStorageKey && handoffToken) {
      try {
        const serialized = handoffToken
          ? readCampaignHandoffSnapshot(window.sessionStorage, handoffToken)
          : undefined;
        if (!serialized) throw new Error("Campaign handoff source is missing");
        const storedValue: unknown = JSON.parse(serialized);
        if (isRecord(storedValue)) {
          writeCampaignHandoffSnapshot(
            window.sessionStorage,
            handoffToken,
            JSON.stringify({
              ...storedValue,
              name: campaignName,
              subject: document.subject,
              previewText: document.previewText,
              emailBodyText,
              templateId: document.templateId || null,
              builderDocument: document,
            }),
          );
        } else {
          savedToBrowser = false;
        }
      } catch {
        savedToBrowser = false;
      }
    }
    if (savedToBrowser) setDirty(false);
    return savedToBrowser;
  }, [campaignName, document, handoffStorageKey, handoffToken]);

  const saveTemplate = useCallback(async () => {
    if (savingTemplateRef.current) return;
    if (!campaignName.trim()) {
      toast.warning("Нужно название", "Укажите понятное название шаблона.");
      return;
    }
    if (document.blocks.length === 0) {
      toast.warning("Холст пуст", "Добавьте хотя бы один блок перед сохранением шаблона.");
      return;
    }
    if (savedTemplateId && !templateRevision) {
      toast.warning("Версия шаблона неизвестна", "Перезагрузите редактор перед сохранением.");
      return;
    }
    const submittedEditRevision = editRevisionRef.current;
    savingTemplateRef.current = true;
    setSavingTemplate(true);
    try {
      let saveName = campaignName.trim();
      let renamedCopy = false;
      if (!savedTemplateId) {
        const listResponse = await fetch("/api/templates", { headers: { Accept: "application/json" } });
        const listBody = await listResponse.json() as EmailTemplatesListResponse | ApiError;
        if (!listResponse.ok || !("templates" in listBody)) {
          throw new Error("error" in listBody ? listBody.error : "Не удалось проверить название шаблона.");
        }
        const occupied = new Set(listBody.templates.map((template) => template.name.trim().toLocaleLowerCase("ru-RU")));
        const root = saveName;
        for (let copyNumber = 1; occupied.has(saveName.toLocaleLowerCase("ru-RU")); copyNumber += 1) {
          saveName = `${root} — вариант ${copyNumber + 1}`;
          renamedCopy = true;
        }
      }
      const response = await fetch("/api/templates", {
        method: savedTemplateId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...(savedTemplateId
            ? { id: savedTemplateId, expectedUpdatedAt: templateRevision }
            : {}),
          name: saveName,
          description: templateDescription.trim(),
          category: templateCategory,
          subject: document.subject.trim(),
          previewText: document.previewText.trim(),
          builderDocument: document,
        }),
      });
      const body = await response.json() as EmailTemplateMutationResponse | ApiError;
      if (!response.ok || !("template" in body)) {
        throw new Error("error" in body
          ? [body.error, ...(body.details ?? [])].join(" ")
          : "Сервер не сохранил шаблон.");
      }
      setSavedTemplateId(body.template.id);
      setTemplateRevision(body.template.updatedAt);
      const hasNewerLocalChanges = editRevisionRef.current !== submittedEditRevision;
      if (!hasNewerLocalChanges) {
        setCampaignName(body.template.name);
        setTemplateDescription(body.template.description);
        setTemplateCategory(body.template.category);
        dispatch({ type: "reset", document: documentFromApiTemplate(body.template) });
        setDirty(false);
      }
      window.history.replaceState(
        {},
        "",
        `/email-builder?template=${encodeURIComponent(body.template.id)}`,
      );
      toast.success(
        savedTemplateId ? "Изменения сохранены" : "Добавлено в «Мои шаблоны»",
        renamedCopy
          ? `Название было занято. Шаблон сохранён как «${body.template.name}» — его можно изменить в поле имени.`
          : hasNewerLocalChanges
          ? "Версия на момент нажатия сохранена. Более новые правки остаются в редакторе и требуют повторного сохранения."
          : "HTML и текстовая версия повторно собраны на сервере.",
      );
    } catch (error) {
      toast.warning(
        "Шаблон не сохранён",
        error instanceof Error ? error.message : "Повторите попытку.",
      );
    } finally {
      savingTemplateRef.current = false;
      setSavingTemplate(false);
    }
  }, [campaignName, document, savedTemplateId, templateCategory, templateDescription, templateRevision, toast]);

  const save = useCallback(() => {
    if (mode === "template") {
      void saveTemplate();
      return;
    }
    if (!persistDraft()) {
      toast.warning(
        "Не удалось записать черновик",
        "Изменения остаются в открытом редакторе, но браузер их не сохранил.",
      );
      return;
    }
    toast.success(
      "Черновик подготовлен",
      "Мастер кампании получит макет; долговечная копия появится после сохранения кампании.",
    );
  }, [mode, persistDraft, saveTemplate, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing =
        target.matches("input, textarea, select") || target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
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

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  const continueFromEditor = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (mode === "campaign") {
      if (!persistDraft()) event.preventDefault();
      return;
    }
    if (dirty && !window.confirm("Выйти без сохранения? Несохранённые изменения шаблона будут потеряны.")) {
      event.preventDefault();
    }
  }, [dirty, mode, persistDraft]);

  const setCampaignNameDirty = (name: string) => {
    setCampaignName(name);
    markDirty();
  };

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
        campaignHandoff={mode === "campaign"}
        nameLabel={mode === "template" ? "Название шаблона" : "Название кампании"}
        saving={savingTemplate}
        saveLabel={mode === "template" ? (savedTemplateId ? "Сохранить изменения" : "Сохранить в мои шаблоны") : "Сохранить черновик"}
        continueLabel={mode === "template" ? "Мои шаблоны" : "Применить к кампании"}
        statusText={mode === "template" ? "Шаблон сохранён на сервере" : undefined}
        dirtyText={mode === "template" ? "Изменения не сохранены на сервере" : "Изменения не переданы в мастер кампании"}
        onUndo={undo}
        onRedo={redo}
        onSave={save}
        onContinue={continueFromEditor}
        continueHref={continueHref}
        tools={<EmailExportMenu document={document} name={campaignName} />}
      />

      <div className="flex flex-wrap items-center justify-center gap-1 border-b border-border bg-surface px-4 py-2.5" role="tablist" aria-label="Способ создания письма">
        <Link href="/templates" className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[12px] font-semibold text-text-muted outline-none transition hover:bg-surface-subtle hover:text-text-strong focus-visible:ring-2 focus-visible:ring-primary/30"><Library aria-hidden="true" className="size-4" />Выбрать шаблон</Link>
        <button type="button" role="tab" aria-selected={creationMode === "manual"} onClick={() => setCreationMode("manual")} className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[12px] font-semibold text-text-muted outline-none transition hover:bg-surface-subtle aria-selected:bg-primary aria-selected:text-white focus-visible:ring-2 focus-visible:ring-primary/30"><PenTool aria-hidden="true" className="size-4" />Собрать вручную</button>
        <button type="button" role="tab" aria-selected={creationMode === "ai"} onClick={() => setCreationMode("ai")} className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[12px] font-semibold text-text-muted outline-none transition hover:bg-surface-subtle aria-selected:bg-primary aria-selected:text-white focus-visible:ring-2 focus-visible:ring-primary/30"><Sparkles aria-hidden="true" className="size-4" />Создать с ИИ</button>
      </div>

      {creationMode === "start" ? (
        <section className="bg-surface-subtle/55 px-5 py-10 sm:px-8 sm:py-14" aria-labelledby="builder-start-title">
          <div className="mx-auto max-w-5xl text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-[var(--shadow-md)]"><WandSparkles aria-hidden="true" className="size-5" /></span>
            <h2 id="builder-start-title" className="mt-5 text-[24px] font-semibold tracking-[-.03em] text-text-strong">С чего начнём письмо?</h2>
            <p className="mx-auto mt-2 max-w-xl text-[12px] leading-5 text-text-muted">Выберите готовую визуальную систему, начните с чистого холста или опишите задачу ИИ.</p>
            <div className="mt-7 grid gap-3 text-left md:grid-cols-3">
              <Link href="/templates" className="rounded-2xl border border-border bg-surface p-5 transition hover:border-primary/40 hover:shadow-[var(--shadow-sm)]"><span className="grid size-10 place-items-center rounded-xl bg-primary-subtle text-primary"><Library aria-hidden="true" className="size-5" /></span><strong className="mt-4 block text-[14px] text-text-strong">Выбрать шаблон</strong><span className="mt-1.5 block text-[11px] leading-5 text-text-muted">150+ готовых макетов с фильтрами по задаче и стилю.</span></Link>
              <button type="button" onClick={() => setCreationMode("manual")} className="rounded-2xl border border-border bg-surface p-5 text-left transition hover:border-primary/40 hover:shadow-[var(--shadow-sm)]"><span className="grid size-10 place-items-center rounded-xl bg-primary-subtle text-primary"><PenTool aria-hidden="true" className="size-5" /></span><strong className="mt-4 block text-[14px] text-text-strong">Пустой холст</strong><span className="mt-1.5 block text-[11px] leading-5 text-text-muted">Соберите письмо вручную из блоков, структур и декора.</span></button>
              <button type="button" onClick={() => setCreationMode("ai")} className="rounded-2xl border border-primary/25 bg-primary-subtle/55 p-5 text-left transition hover:border-primary/50 hover:shadow-[var(--shadow-sm)]"><span className="grid size-10 place-items-center rounded-xl bg-primary text-white"><Sparkles aria-hidden="true" className="size-5" /></span><strong className="mt-4 block text-[14px] text-text-strong">Создать с ИИ</strong><span className="mt-1.5 block text-[11px] leading-5 text-text-muted">Опишите аудиторию, цель и настроение — ИИ уточнит детали и соберёт вариант.</span></button>
            </div>
          </div>
        </section>
      ) : creationMode === "ai" ? (
        <AiEmailAssistant document={document} onApply={(next) => { mutateDocument(() => next); setSelectedBlockId(next.blocks[0]?.id ?? ""); setCreationMode("manual"); }} />
      ) : (
        <>

      {mode === "template" ? (
        <div className="border-b border-border bg-surface-subtle/45 px-4 py-3">
          {editingStarter && !savedTemplateId ? (
            <div className="mb-3 rounded-xl border border-primary/20 bg-primary-subtle/60 px-3 py-2.5 text-[11px] leading-5 text-text-muted">
              Это готовый макет из библиотеки. Кнопка «Сохранить в мои шаблоны» создаст вашу отдельную копию — исходный шаблон останется без изменений.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_190px] md:items-end">
          <FormField label="Имя шаблона" htmlFor="builder-template-name" hint="Так он появится в разделе «Мои шаблоны»">
            <Input
              id="builder-template-name"
              value={campaignName}
              maxLength={160}
              onChange={(event) => setCampaignNameDirty(event.target.value)}
              placeholder="Например, Приглашение на конференцию"
              className="font-semibold"
            />
          </FormField>
          <FormField label="Категория" htmlFor="builder-template-category">
            <Select
              id="builder-template-category"
              value={templateCategory}
              onChange={(event) => {
                setTemplateCategory(event.target.value as TemplateCategory);
                markDirty();
              }}
              options={[
                { value: "Business", label: "Бизнес" },
                { value: "Events", label: "События" },
                { value: "Outreach", label: "Первичный контакт" },
                { value: "Newsletter", label: "Дайджест" },
                { value: "Follow-up", label: "Продолжение" },
                { value: "Transactional", label: "Сервисное" },
              ]}
            />
          </FormField>
          <FormField label="Описание" htmlFor="builder-template-description" hint="Помогает найти нужный шаблон в библиотеке" className="md:col-span-2">
            <Input
              id="builder-template-description"
              value={templateDescription}
              maxLength={1000}
              onChange={(event) => {
                setTemplateDescription(event.target.value);
                markDirty();
              }}
              placeholder="Для какой задачи подходит этот макет"
            />
          </FormField>
          </div>
        </div>
      ) : null}

      {mode === "template" && creationMode === "manual" ? (
        <div className="flex flex-col gap-3 border-b border-primary/15 bg-primary-subtle/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <strong className="block text-[12px] text-text-strong">Сохраните результат как рабочий шаблон</strong>
            <span className="mt-0.5 block text-[10px] leading-4 text-text-muted">Текущий дизайн, текст, логотипы и фотографии появятся в разделе «Мои шаблоны».</span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/templates?scope=mine" onClick={continueFromEditor} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Library aria-hidden="true" className="size-3.5" />
              Мои шаблоны
            </Link>
            <Button type="button" variant="primary" size="md" loading={savingTemplate} loadingText="Сохраняем…" onClick={save}>
              <Save aria-hidden="true" className="size-4" />
              {savedTemplateId ? "Сохранить изменения" : "Сохранить в «Мои шаблоны»"}
            </Button>
          </div>
        </div>
      ) : null}

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
              aria-label={panel === "blocks" ? "Блоки" : panel === "canvas" ? "Холст" : "Свойства"}
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

      <div className="grid h-[calc(100dvh-176px)] min-h-[620px] lg:grid-cols-[210px_minmax(560px,1fr)_285px] xl:grid-cols-[220px_minmax(680px,1fr)_305px]">
        <BlockLibrary
          onAdd={addBlock}
          document={document}
          onUpdateDocument={updateDocument}
          className={cn(
            "min-h-0 border-r border-border",
            mobilePanel === "blocks" ? "flex" : "hidden",
            "lg:flex",
          )}
        />
        <EmailCanvas
          document={document}
          previewMode={previewMode}
          selectedBlockId={selectedBlock?.id ?? ""}
          onSelect={setSelectedBlockId}
          onMove={moveBlock}
          onDuplicate={duplicateBlock}
          onDelete={deleteBlock}
          onInlineEdit={(blockId, content) => updateBlock(blockId, { content })}
          onOpenBlocks={() => setMobilePanel("blocks")}
          className={cn(
            "min-h-0",
            mobilePanel === "canvas" ? "flex" : "hidden",
            "lg:flex",
          )}
        />
        {selectedBlock ? <PropertiesPanel
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
        /> : (
          <aside aria-label="Свойства пустого холста" className={cn("min-h-0 border-l border-border bg-surface p-5", mobilePanel === "properties" ? "block" : "hidden", "lg:block")}>
            <h2 className="m-0 text-[13px] font-semibold text-text-strong">Холст пуст</h2>
            <p className="mt-2 text-[11px] leading-5 text-text-muted">Добавьте блок на панели слева. Окантовку всего письма можно выбрать на вкладке «Окантовки».</p>
          </aside>
        )}
      </div>
        </>
      )}
    </div>
  );
}
