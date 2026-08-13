"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Mail,
  MessageCircle,
  PencilLine,
  RefreshCw,
  Save,
  Send,
  SendHorizontal,
  Settings2,
  ShieldCheck,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Stepper,
  Textarea,
  buttonVariants,
  cn,
} from "@/components/ui";
import {
  campaignChannelDefinitions,
  campaignChannelProviders,
  defaultCampaignChannelProvider,
  getCampaignChannelDefinition,
  getCampaignChannelProvider,
  type CampaignChannel,
} from "./campaignChannels";
import {
  campaignEmailPatchFromTemplate,
  patchEmailDocumentMetadata,
  resolveCampaignTemplateId,
  shouldApplyTemplateQuery,
  unlinkEmailTemplateDocument,
} from "@/lib/campaign-email-draft";
import {
  campaignHandoffStorageKey,
  createCampaignHandoffToken,
  normalizeCampaignHandoffToken,
  readCampaignHandoffSnapshot,
  writeCampaignHandoffSnapshot,
} from "@/lib/campaign-handoff";
import {
  PREFERRED_PROVIDERS_STORAGE_KEY,
  integrationProviderById,
  type IntegrationProviderId,
} from "@/config/integrations";
import type {
  ApiError,
  CampaignCreateInput,
  CampaignEvaluation,
  CampaignMutationResponse,
  CampaignRecord,
  ContactRecord,
  DeliveryPlanRecord,
  EmailBuilderDocumentInput,
  EmailTemplateRecord,
  EmailTemplatesListResponse,
  IntegrationConnectionStatus,
  PresentationProjectRecord,
  PresentationsListResponse,
  SegmentRecord,
  WorkspaceSnapshot,
} from "@/types/api";

type ApiMode = "loading" | "online" | "offline";
type ConnectionStatus = IntegrationConnectionStatus;

type AudienceContact = Pick<
  ContactRecord,
  "id" | "fullName" | "email" | "companyName" | "jobTitle" | "city" | "tags" | "status"
> & Partial<Pick<
  ContactRecord,
  "emailConsent" | "telegramChatId" | "telegramConsent" | "vkUserId" | "vkConsent"
>>;

type AudienceSegment = Pick<
  SegmentRecord,
  "id" | "name" | "description" | "contactCount"
>;

type IntegrationSnapshot = {
  providerId: IntegrationProviderId;
  status: ConnectionStatus;
};

type Evaluation = CampaignEvaluation;

type WizardDraft = {
  campaignId?: string | null;
  campaignName: string;
  name?: string;
  audienceType: "none" | "segment" | "contacts";
  segmentId: string;
  contactIds: string[];
  subject: string;
  previewText: string;
  emailBodyText: string;
  emailBuilderDocument: EmailBuilderDocumentInput | null;
  templateId: string | null;
  presentationId: string | null;
  consumedTemplateQueryId: string | null;
  messengerMessage: string;
  channels: CampaignChannel[];
  providers: Record<CampaignChannel, IntegrationProviderId>;
  senderName: string;
  senderEmail: string;
};

export type CampaignWizardSearchParams = Record<string, string | string[] | undefined>;

export interface CampaignWizardProps {
  searchParams?: CampaignWizardSearchParams | URLSearchParams;
}

const steps = [
  { label: "Аудитория", description: "Кому отправляем" },
  { label: "Сообщение", description: "Что отправляем" },
  { label: "Каналы", description: "Как доставляем" },
  { label: "Готовность", description: "Охват и проверка" },
];

const channelIcons: Record<CampaignChannel, typeof Mail> = {
  email: Mail,
  telegram: SendHorizontal,
  vk: MessageCircle,
};

const connectionLabels: Record<ConnectionStatus, string> = {
  connected: "Подключено",
  needs_attention: "Нужна настройка",
  disconnected: "Не подключено",
};

function subscribeToBrowser(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
  };
}

function getBrowserSnapshot() {
  let draft = "";
  try {
    const query = new URLSearchParams(window.location.search);
    const handoffToken = normalizeCampaignHandoffToken(query.get("handoff"));
    draft = handoffToken
      ? readCampaignHandoffSnapshot(window.sessionStorage, handoffToken) ?? ""
      : "";
  } catch {
    // The wizard remains usable without local recovery.
  }
  return JSON.stringify({ search: window.location.search, draft, builderDraft: draft });
}

function getServerSnapshot() {
  return JSON.stringify({ search: "", draft: "", builderDraft: "" });
}

function serializeParams(params?: CampaignWizardSearchParams | URLSearchParams) {
  if (!params) return null;
  if (params instanceof URLSearchParams) return params.toString();
  const result = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => result.append(key, item));
    else if (value !== undefined) result.set(key, value);
  });
  return result.toString();
}

function safeParseDraft(value: string): Partial<WizardDraft> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<WizardDraft>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseBuilderDraft(value: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      campaignName?: string;
      name?: string;
      document?: EmailBuilderDocumentInput;
      builderDocument?: EmailBuilderDocumentInput;
      emailBuilderDocument?: EmailBuilderDocumentInput;
      emailBodyText?: string;
      templateId?: string | null;
    };
    if (!parsed || typeof parsed !== "object") return null;
    return {
      campaignName: parsed.campaignName ?? parsed.name,
      document: parsed.document ?? parsed.builderDocument ?? parsed.emailBuilderDocument,
      emailBodyText: parsed.emailBodyText,
      templateId: Object.prototype.hasOwnProperty.call(parsed, "templateId")
        ? parsed.templateId ?? null
        : undefined,
    };
  } catch {
    return null;
  }
}

function parseStep(value: string | null) {
  if (value === "content" || value === "message") return 1;
  if (value === "sender" || value === "channels") return 2;
  if (value === "review") return 3;
  return 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatRecipientCount(value: number) {
  const absolute = Math.abs(value);
  const lastTwoDigits = absolute % 100;
  const lastDigit = absolute % 10;
  const noun = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? "получателей"
    : lastDigit === 1
      ? "получатель"
      : lastDigit >= 2 && lastDigit <= 4
        ? "получателя"
        : "получателей";
  return `${formatNumber(value)} ${noun}`;
}

function isProviderId(value: unknown): value is IntegrationProviderId {
  return typeof value === "string" && value in integrationProviderById;
}

function initialProviders(params: URLSearchParams, draft: Partial<WizardDraft> | null) {
  let preferred: Partial<Record<CampaignChannel, IntegrationProviderId>> = {};
  try {
    preferred = JSON.parse(
      window.localStorage.getItem(PREFERRED_PROVIDERS_STORAGE_KEY) ?? "{}",
    ) as Partial<Record<CampaignChannel, IntegrationProviderId>>;
  } catch {
    // Defaults below are safe.
  }
  return Object.fromEntries(
    campaignChannelDefinitions.map((channel) => {
      const fromQuery = params.get(`provider_${channel.id}`);
      const candidates = [fromQuery, draft?.providers?.[channel.id], preferred[channel.id]];
      const provider = candidates.find(
        (candidate): candidate is IntegrationProviderId =>
          isProviderId(candidate) &&
          campaignChannelProviders[channel.id].some((item) => item.id === candidate),
      );
      return [channel.id, provider ?? defaultCampaignChannelProvider[channel.id]];
    }),
  ) as Record<CampaignChannel, IntegrationProviderId>;
}

function initialChannels(params: URLSearchParams, draft: Partial<WizardDraft> | null) {
  const requested = params.getAll("channel").filter(
    (value): value is CampaignChannel =>
      campaignChannelDefinitions.some((channel) => channel.id === value),
  );
  if (requested.length > 0) return Array.from(new Set(requested));
  if (Array.isArray(draft?.channels) && draft.channels.length > 0) return draft.channels;
  return ["email"] as CampaignChannel[];
}

function normalizeBlockers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((blocker) => {
    if (typeof blocker === "string") return blocker;
    if (blocker && typeof blocker === "object") {
      const item = blocker as Record<string, unknown>;
      return String(item.message ?? item.reason ?? item.code ?? "Неизвестная причина");
    }
    return String(blocker);
  });
}

export function CampaignWizard({ searchParams }: CampaignWizardProps) {
  const browserSnapshot = React.useSyncExternalStore(
    subscribeToBrowser,
    getBrowserSnapshot,
    getServerSnapshot,
  );
  const snapshot = JSON.parse(browserSnapshot) as {
    search: string;
    draft: string;
    builderDraft: string;
  };
  const providedSearch = serializeParams(searchParams);
  const resolvedSearch = providedSearch ?? snapshot.search.replace(/^\?/, "");
  const resolvedParams = new URLSearchParams(resolvedSearch);
  if (!normalizeCampaignHandoffToken(resolvedParams.get("handoff"))) {
    return <CampaignWizardTokenBootstrap />;
  }

  return (
    <CampaignWizardState
      key={`${resolvedSearch}:${snapshot.builderDraft}`}
      params={resolvedParams}
      recoveredDraft={safeParseDraft(snapshot.draft)}
      builderDraft={parseBuilderDraft(snapshot.builderDraft)}
    />
  );
}

function CampaignWizardTokenBootstrap() {
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = new URL(window.location.href);
      if (!normalizeCampaignHandoffToken(target.searchParams.get("handoff"))) {
        target.searchParams.set("handoff", createCampaignHandoffToken());
        window.history.replaceState({}, "", `${target.pathname}${target.search}${target.hash}`);
      }
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <div className="card grid min-h-64 place-items-center p-8 text-center text-[12px] text-text-muted">Готовим изолированный черновик рассылки…</div>;
}

function CampaignWizardState({
  params,
  recoveredDraft,
  builderDraft,
}: {
  params: URLSearchParams;
  recoveredDraft: Partial<WizardDraft> | null;
  builderDraft: ReturnType<typeof parseBuilderDraft>;
}) {
  const builderResult = params.get("builderDraft") === "1" ? builderDraft : null;
  const handoffToken = normalizeCampaignHandoffToken(params.get("handoff"));
  if (!handoffToken) throw new Error("Ключ черновика кампании не создан.");
  const handoffStorageKey = campaignHandoffStorageKey(handoffToken);
  const sourceId = params.get("campaign") ?? params.get("draft") ?? params.get("duplicate");
  const duplicate = params.has("duplicate") || params.get("copy") === "1";
  const queryTemplateId = params.get("template")?.trim() || null;
  const queryPresentationId = params.get("presentation")?.trim() || null;
  const querySegmentId = params.get("segment") ?? params.get("audience");
  const queryContactIds = params.getAll("contact").filter(Boolean);
  const seedDraft = recoveredDraft;

  const [apiMode, setApiMode] = React.useState<ApiMode>("loading");
  const [workspaceContacts, setWorkspaceContacts] = React.useState<AudienceContact[]>([]);
  const [workspaceSegments, setWorkspaceSegments] = React.useState<AudienceSegment[]>([]);
  const [workspaceTemplates, setWorkspaceTemplates] = React.useState<EmailTemplateRecord[]>([]);
  const [workspacePresentations, setWorkspacePresentations] = React.useState<PresentationProjectRecord[]>([]);
  const [templateLoadState, setTemplateLoadState] = React.useState<"loading" | "ready" | "error">("loading");
  const [integrations, setIntegrations] = React.useState<IntegrationSnapshot[]>([]);
  const [currentStep, setCurrentStep] = React.useState(() => parseStep(params.get("step")));
  const [campaignId, setCampaignId] = React.useState<string | null>(
    duplicate ? null : sourceId ?? seedDraft?.campaignId ?? null,
  );
  const [campaignName, setCampaignName] = React.useState(
    builderResult?.campaignName ??
      params.get("name") ?? seedDraft?.campaignName ?? "Новая рассылка",
  );
  const [audienceType, setAudienceType] = React.useState<"none" | "segment" | "contacts">(
    queryContactIds.length > 0 || params.get("audienceType") === "contacts"
      ? "contacts"
      : querySegmentId || params.get("audienceType") === "segment"
        ? "segment"
        : seedDraft?.audienceType ?? "none",
  );
  const [segmentId, setSegmentId] = React.useState(
    querySegmentId ?? seedDraft?.segmentId ?? "",
  );
  const [contactIds, setContactIds] = React.useState<string[]>(
    queryContactIds.length > 0 ? queryContactIds : seedDraft?.contactIds ?? [],
  );
  const [subject, setSubject] = React.useState(
    builderResult?.document?.subject ?? seedDraft?.subject ?? "",
  );
  const [previewText, setPreviewText] = React.useState(
    builderResult?.document?.previewText ?? seedDraft?.previewText ?? "",
  );
  const [emailBodyText, setEmailBodyText] = React.useState(
    builderResult?.emailBodyText ?? seedDraft?.emailBodyText ?? "",
  );
  const [emailBuilderDocument, setEmailBuilderDocument] = React.useState<EmailBuilderDocumentInput | null>(
    builderResult?.document ?? seedDraft?.emailBuilderDocument ?? null,
  );
  const [templateId, setTemplateId] = React.useState<string | null>(() =>
    resolveCampaignTemplateId({
      builderRootTemplateId: builderResult?.templateId,
      builderDocumentTemplateId: builderResult?.document?.templateId,
      queryTemplateId,
      draftTemplateId: seedDraft && Object.prototype.hasOwnProperty.call(seedDraft, "templateId")
        ? seedDraft.templateId
        : undefined,
    }));
  const [consumedTemplateQueryId, setConsumedTemplateQueryId] = React.useState<string | null>(
    seedDraft?.consumedTemplateQueryId ?? null,
  );
  const [presentationId, setPresentationId] = React.useState<string | null>(queryPresentationId ?? seedDraft?.presentationId ?? null);
  const [messengerMessage, setMessengerMessage] = React.useState(
    params.get("message") ?? seedDraft?.messengerMessage ?? "",
  );
  const [channels, setChannels] = React.useState<CampaignChannel[]>(
    () => initialChannels(params, seedDraft),
  );
  const [providers, setProviders] = React.useState<Record<CampaignChannel, IntegrationProviderId>>(
    () => initialProviders(params, seedDraft),
  );
  const [senderName, setSenderName] = React.useState(
    seedDraft?.senderName ?? "",
  );
  const [senderEmail, setSenderEmail] = React.useState(
    seedDraft?.senderEmail ?? "",
  );
  const [busyAction, setBusyAction] = React.useState<"save" | "launch" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [evaluation, setEvaluation] = React.useState<Evaluation | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = React.useState(false);
  const [finishedCampaign, setFinishedCampaign] = React.useState<{ id: string; status: string } | null>(null);
  const hydratedCampaignId = React.useRef<string | null>(null);
  const hydratedQueryTemplateId = React.useRef<string | null>(null);
  const recoveredCampaignId = seedDraft?.campaignId;

  // Setter identities are stable; only the source and copy mode alter hydration.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const loadWorkspace = React.useCallback(async () => {
    setApiMode("loading");
    try {
      const [response, templatesResponse, presentationsResponse] = await Promise.all([
        fetch("/api/workspace", { headers: { Accept: "application/json" } }),
        fetch("/api/templates", { headers: { Accept: "application/json" } }),
        fetch("/api/presentations", { headers: { Accept: "application/json" } }),
      ]);
      if (!response.ok) throw new Error("Рабочее пространство недоступно");
      const body = await response.json() as WorkspaceSnapshot;
      if (templatesResponse.ok) {
        const templateBody = await templatesResponse.json() as EmailTemplatesListResponse;
        setWorkspaceTemplates(Array.isArray(templateBody.templates) ? templateBody.templates : []);
        setTemplateLoadState("ready");
      } else {
        setWorkspaceTemplates([]);
        setTemplateLoadState("error");
      }
      if (presentationsResponse.ok) {
        const presentationBody = await presentationsResponse.json() as PresentationsListResponse;
        setWorkspacePresentations(Array.isArray(presentationBody.presentations) ? presentationBody.presentations : []);
      } else {
        setWorkspacePresentations([]);
      }
      if (Array.isArray(body.contacts)) setWorkspaceContacts(body.contacts);
      if (Array.isArray(body.segments)) setWorkspaceSegments(body.segments);
      setIntegrations((body.integrations ?? []).flatMap((record) => {
        if (!isProviderId(record.providerId)) return [];
        if (record.status !== "connected" && record.status !== "needs_attention" && record.status !== "disconnected") return [];
        return [{ providerId: record.providerId, status: record.status }];
      }));

      if (!sourceId) {
        setSenderName((current) => current || body.workspace.defaultSenderName);
        setSenderEmail((current) => current || body.workspace.defaultSenderEmail);
        if (
          recoveredCampaignId &&
          !body.campaigns?.some((campaign) => campaign.id === recoveredCampaignId)
        ) {
          setCampaignId((current) => current === recoveredCampaignId ? null : current);
          setEvaluation(null);
          setNotice("Предыдущий серверный черновик уже удалён. При проверке будет создана новая рассылка.");
        }
      }

      if (sourceId && hydratedCampaignId.current !== sourceId) {
        const item = body.campaigns?.find((campaign) => campaign.id === sourceId);
        if (item) {
          hydrateFromApiCampaign(
            item,
            body.deliveryPlans.filter((plan) => plan.campaignId === item.id),
            {
            setCampaignId,
            setCampaignName,
            setAudienceType,
            setSegmentId,
            setContactIds,
            setSubject,
            setPreviewText,
            setEmailBodyText,
            setEmailBuilderDocument,
            setTemplateId,
            setPresentationId,
            setMessengerMessage,
            setChannels,
            setProviders,
            setSenderName,
            setSenderEmail,
            },
          );
          if (duplicate) {
            setCampaignId(null);
            setCampaignName(`${item.name} — копия`);
          }
          hydratedCampaignId.current = sourceId;
        } else {
          setError("Исходная кампания не найдена в рабочем пространстве.");
        }
      }
      setApiMode("online");
    } catch {
      setWorkspaceContacts([]);
      setWorkspaceSegments([]);
      setWorkspaceTemplates([]);
      setWorkspacePresentations([]);
      setIntegrations([]);
      setTemplateLoadState("error");
      setApiMode("offline");
    }
  }, [duplicate, recoveredCampaignId, sourceId]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadWorkspace());
    return () => window.cancelAnimationFrame(frame);
  }, [loadWorkspace]);

  React.useEffect(() => {
    if (!shouldApplyTemplateQuery(queryTemplateId, consumedTemplateQueryId) || sourceId || builderResult || templateLoadState !== "ready") return;
    if (hydratedQueryTemplateId.current === queryTemplateId) return;
    const frame = window.requestAnimationFrame(() => {
      const template = workspaceTemplates.find((item) => item.id === queryTemplateId);
      if (!template) {
        setError("Выбранный email-шаблон не найден в рабочем пространстве.");
        hydratedQueryTemplateId.current = queryTemplateId;
        return;
      }
      const patch = campaignEmailPatchFromTemplate(template);
      setTemplateId(patch.templateId);
      setSubject(patch.subject);
      setPreviewText(patch.previewText);
      setEmailBodyText(patch.emailBodyText);
      setEmailBuilderDocument(patch.emailBuilderDocument);
      setConsumedTemplateQueryId(queryTemplateId);
      hydratedQueryTemplateId.current = queryTemplateId;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [builderResult, consumedTemplateQueryId, queryTemplateId, sourceId, templateLoadState, workspaceTemplates]);

  const selectedSegment = workspaceSegments.find((segment) => segment.id === segmentId);
  const selectedContacts = workspaceContacts.filter((contact) => contactIds.includes(contact.id));
  const recipientCount = audienceType === "segment"
    ? selectedSegment?.contactCount ?? 0
    : audienceType === "contacts"
      ? selectedContacts.length
      : 0;
  const audienceLabel = audienceType === "segment"
    ? selectedSegment?.name ?? "Сегмент не выбран"
    : audienceType === "contacts"
      ? selectedContacts.length === 1
        ? selectedContacts[0].fullName
        : `Выбрано контактов: ${formatNumber(selectedContacts.length)}`
      : "Аудитория не выбрана";

  const coverage = React.useMemo(() => Object.fromEntries(
    campaignChannelDefinitions.map((channel) => [
      channel.id,
      audienceType === "contacts"
        ? countAudienceReachable(selectedContacts, channel.id)
        : 0,
    ]),
  ) as Record<CampaignChannel, number>, [audienceType, selectedContacts]);

  const integrationByProvider = React.useMemo(
    () => Object.fromEntries(integrations.map((item) => [item.providerId, item])) as
      Partial<Record<IntegrationProviderId, IntegrationSnapshot>>,
    [integrations],
  );

  const clientBlockers = React.useMemo(() => {
    const blockers: string[] = [];
    if (audienceType === "none") {
      blockers.push("Выберите сегмент или конкретные контакты.");
    } else if (recipientCount <= 0) {
      blockers.push(
        audienceType === "segment"
          ? "В выбранной аудитории пока нет контактов. Добавьте подходящие контакты или выберите другую аудиторию."
          : "Выберите хотя бы один контакт.",
      );
    }
    if (!campaignName.trim()) blockers.push("Укажите внутреннее название рассылки.");
    if (channels.length === 0) blockers.push("Выберите хотя бы один канал доставки.");
    if (channels.includes("email") && !subject.trim()) blockers.push("Добавьте тему email-письма.");
    if (channels.includes("email") && !emailBodyText.trim()) blockers.push("Добавьте текст email-письма.");
    if (channels.some((channel) => channel !== "email") && !messengerMessage.trim()) {
      blockers.push("Добавьте сообщение для Telegram или ВКонтакте.");
    }
    if (channels.includes("email") && (!senderName.trim() || !/^\S+@\S+\.\S+$/.test(senderEmail))) {
      blockers.push("Укажите имя и корректный email отправителя.");
    }
    if (presentationId && (!channels.includes("email") || providers.email !== "unisender")) {
      blockers.push("Презентацию во вложении можно отправить только по Email через UniSender.");
    }
    channels.forEach((channel) => {
      const providerId = providers[channel];
      if (!providerId) blockers.push(`Выберите провайдера для канала ${getCampaignChannelDefinition(channel).shortLabel}.`);
      else if (integrationByProvider[providerId]?.status !== "connected") {
        blockers.push(`${integrationProviderById[providerId].name} не подключён для канала ${getCampaignChannelDefinition(channel).shortLabel}.`);
      }
    });
    return Array.from(new Set(blockers));
  }, [audienceType, campaignName, channels, emailBodyText, integrationByProvider, messengerMessage, presentationId, providers, recipientCount, senderEmail, senderName, subject]);

  const draft: WizardDraft = {
    campaignId,
    campaignName,
    name: campaignName,
    audienceType,
    segmentId,
    contactIds,
    subject,
    previewText,
    emailBodyText,
    emailBuilderDocument,
    templateId,
    presentationId,
    consumedTemplateQueryId,
    messengerMessage,
    channels,
    providers,
    senderName,
    senderEmail,
  };
  const draftJson = JSON.stringify(draft);
  const editorReturnParams = new URLSearchParams({
    step: "message",
    builderDraft: "1",
    handoff: handoffToken,
  });
  const editorQuery = new URLSearchParams({
    campaign: campaignName,
    handoff: handoffToken,
    returnTo: `/campaigns/new?${editorReturnParams.toString()}`,
  });
  if (templateId) editorQuery.set("template", templateId);
  const editorHref = `/email-builder?${editorQuery.toString()}`;
  const libraryReturnParams = new URLSearchParams({
    step: "message",
    handoff: handoffToken,
  });
  const templateLibraryQuery = new URLSearchParams({
    campaign: campaignName,
    returnTo: `/campaigns/new?${libraryReturnParams.toString()}`,
    backTo: `/campaigns/new?${libraryReturnParams.toString()}`,
  });
  const templateLibraryHref = `/templates?${templateLibraryQuery.toString()}`;

  React.useEffect(() => {
    try {
      writeCampaignHandoffSnapshot(window.sessionStorage, handoffToken, draftJson);
    } catch {
      // API saving remains available if browser recovery is disabled.
    }
  }, [draftJson, handoffStorageKey, handoffToken]);

  const validateStep = (step: number) => {
    let message: string | null = null;
    if (step === 0 && audienceType === "none") {
      message = "Выберите сегмент или конкретные контакты.";
    } else if (step === 0 && recipientCount <= 0) {
      message = audienceType === "segment"
        ? "В выбранной аудитории пока нет контактов. Добавьте подходящие контакты или выберите другую аудиторию."
        : "Выберите хотя бы один контакт.";
    }
    if (step === 1 && !campaignName.trim()) message = "Укажите внутреннее название рассылки.";
    if (step === 1 && channels.includes("email") && (!subject.trim() || !emailBodyText.trim())) {
      message = "Заполните тему и текст email-письма.";
    }
    if (step === 1 && channels.some((channel) => channel !== "email") && !messengerMessage.trim()) {
      message = "Добавьте текст для мессенджеров.";
    }
    if (step === 2 && channels.length === 0) message = "Выберите хотя бы один канал.";
    if (step === 2 && channels.includes("email") && (!subject.trim() || !emailBodyText.trim())) {
      message = "Вернитесь к шагу «Сообщение» и заполните email-версию.";
    }
    if (step === 2 && channels.some((channel) => channel !== "email") && !messengerMessage.trim()) {
      message = "Вернитесь к шагу «Сообщение» и добавьте текст для мессенджеров.";
    }
    setError(message);
    return !message;
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((step) => Math.min(3, step + 1));
  };

  const toggleChannel = (channel: CampaignChannel) => {
    setChannels((current) => current.includes(channel)
      ? current.filter((item) => item !== channel)
      : [...current, channel]);
    setEvaluation(null);
    setError(null);
  };

  const toggleContact = (contactId: string) => {
    setContactIds((current) => current.includes(contactId)
      ? current.filter((id) => id !== contactId)
      : [...current, contactId]);
    setEvaluation(null);
  };

  const campaignPayload = (): CampaignCreateInput => ({
    name: campaignName.trim(),
    audienceType,
    ...(audienceType === "segment"
      ? { segmentId }
      : audienceType === "contacts"
        ? { contactIds }
        : {}),
    senderName: senderName.trim(),
    senderEmail: senderEmail.trim(),
    subject: subject.trim(),
    previewText: previewText.trim(),
    emailBodyText: emailBodyText.trim(),
    emailBuilderDocument,
    templateId,
    presentationId,
    messengerMessage: messengerMessage.trim(),
    channels: channels.map((channel) => ({
      channel,
      providerId: providers[channel],
    })),
    scheduledAt: null,
  });

  const mutateCampaign = async (action: "save" | "launch") => {
    if (action === "launch" && clientBlockers.some((blocker) => !blocker.includes("не подключён"))) {
      setEvaluation({ status: "blocked", eligibleByChannel: {}, blockers: clientBlockers });
      setError("Исправьте обязательные поля перед серверной проверкой.");
      setSetupDialogOpen(true);
      return;
    }

    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      let id = campaignId;
      const createDraft = async () => {
        const createResponse = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(campaignPayload()),
        });
        const createBody = await createResponse.json() as CampaignMutationResponse | ApiError;
        if (!createResponse.ok || !("campaign" in createBody)) {
          throw new Error("error" in createBody ? createBody.error : "Не удалось создать черновик кампании.");
        }
        setCampaignId(createBody.campaign.id);
        return createBody.campaign.id;
      };
      if (!id) id = await createDraft();

      const updateDraft = async (campaignDraftId: string) => {
        const response = await fetch("/api/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ id: campaignDraftId, ...campaignPayload(), action }),
        });
        const body = await response.json() as CampaignMutationResponse | ApiError;
        return { response, body };
      };
      let { response: updateResponse, body: updateBody } = await updateDraft(id);
      if (
        updateResponse.status === 404 &&
        !sourceId &&
        "error" in updateBody &&
        updateBody.error.includes("Кампания не найдена")
      ) {
        id = await createDraft();
        ({ response: updateResponse, body: updateBody } = await updateDraft(id));
      }
      if (!updateResponse.ok || !("campaign" in updateBody)) {
        throw new Error("error" in updateBody ? updateBody.error : "Сервер не сохранил кампанию.");
      }
      const body = updateBody;

      setApiMode("online");
      setCampaignId(body.campaign.id);
      if (action === "save") {
        setNotice("Черновик сохранён в рабочем пространстве.");
        return;
      }

      const serverEvaluation: Evaluation = {
        status: body.evaluation?.status ?? (body.campaign.status === "scheduled" ? "scheduled" : body.campaign.status === "blocked" ? "blocked" : "ready"),
        eligibleByChannel: body.evaluation?.eligibleByChannel ?? {},
        blockers: normalizeBlockers(body.evaluation?.blockers),
      };
      setEvaluation(serverEvaluation);
      if (serverEvaluation.blockers.length > 0 || serverEvaluation.status === "blocked") {
        setError("План не готов: устраните причины, затем повторите проверку.");
        setSetupDialogOpen(true);
      } else {
        try {
          window.sessionStorage.removeItem(handoffStorageKey);
        } catch {
          // The durable API already contains the ready campaign.
        }
        setFinishedCampaign({
          id: body.campaign.id,
          status: body.campaign.status ?? serverEvaluation.status ?? "ready",
        });
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error
        ? mutationError.message
        : "Не удалось связаться с сервером рабочего пространства.");
    } finally {
      setBusyAction(null);
    }
  };

  if (finishedCampaign) {
    return (
      <div className="mx-auto flex min-h-[560px] max-w-2xl items-center py-10">
        <section className="card w-full p-7 text-center sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-subtle text-success">
            <CheckCircle2 aria-hidden="true" className="size-7" />
          </span>
          <Badge variant="success" className="mt-5">Готовность подтверждена</Badge>
          <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.035em] text-text-strong">
            План кампании сохранён
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-[14px] leading-6 text-text-muted">
            Сервер сохранил аудиторию, сообщения, маршруты и результат проверки.
            Внешняя отправка не выполнялась.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/campaigns" className={buttonVariants({ variant: "secondary" })}>Все рассылки</Link>
            <Link href={`/campaigns/${finishedCampaign.id}`} className={buttonVariants({ variant: "primary" })}>
              Открыть кампанию
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <Modal
        open={setupDialogOpen}
        onOpenChange={setSetupDialogOpen}
        title="Что нужно для реальной отправки"
        description="Платформа не скрывает обязательные действия и не показывает фиктивный успех. Выполните пункты ниже и повторите проверку."
        size="md"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSetupDialogOpen(false)}>Вернуться к рассылке</Button>
            <Link href="/settings" className={buttonVariants({ variant: "secondary" })}>Данные отправителя</Link>
            <Link href="/integrations" className={buttonVariants({ variant: "primary" })}>Настроить провайдера</Link>
          </>
        )}
      >
        <ol className="m-0 grid list-none gap-3 p-0">
          {(evaluation?.blockers.length ? evaluation.blockers : clientBlockers).map((blocker, index) => (
            <li key={blocker} className="flex gap-3 rounded-xl border border-border bg-surface-subtle p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-subtle text-[12px] font-semibold text-primary">{index + 1}</span>
              <p className="m-0 pt-0.5 text-[13px] leading-5 text-text-strong">{blocker}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] leading-5 text-text-muted">
          Пароль или ключ провайдера хранится только на сервере. Браузерное разрешение для этого не требуется.
        </p>
      </Modal>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-strong">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Кампании
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-text-strong">Новая рассылка</h1>
            <Badge variant={apiMode === "online" ? "success" : "warning"} dot>
              {campaignId ? "Черновик на сервере" : "Не сохранена"}
            </Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-text-muted">
            Четыре шага: аудитория, сообщение, маршрут доставки и серверная проверка.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void mutateCampaign("save")}
          loading={busyAction === "save"}
          loadingText="Сохраняем…"
          leadingIcon={<Save aria-hidden="true" className="size-4" />}
        >
          Сохранить черновик
        </Button>
      </header>

      {apiMode === "offline" ? (
        <Alert tone="danger" title="Рабочее пространство недоступно">
          Контакты, аудитории и подключения не загружены. Черновик формы останется
          в этом браузере, но кампания не будет создана без ответа сервера.
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void loadWorkspace()}
            leadingIcon={<RefreshCw aria-hidden="true" className="size-3.5" />}
          >
            Повторить подключение
          </Button>
        </Alert>
      ) : null}

      <section className="card px-4 py-5 sm:px-7" aria-label="Этапы создания рассылки">
        <Stepper steps={steps} currentStep={currentStep} aria-label="Этапы создания рассылки" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card min-w-0 p-5 sm:p-7">
          {currentStep === 0 ? (
            <AudienceStep
              audienceType={audienceType}
              onAudienceTypeChange={(value) => { setAudienceType(value); setEvaluation(null); }}
              segments={workspaceSegments}
              selectedSegmentId={segmentId}
              onSegmentChange={setSegmentId}
              contacts={workspaceContacts}
              contactIds={contactIds}
              onToggleContact={toggleContact}
              onSetContacts={(ids) => { setContactIds(ids); setEvaluation(null); }}
            />
          ) : null}

          {currentStep === 1 ? (
            <MessageStep
              campaignName={campaignName}
              onCampaignNameChange={setCampaignName}
              subject={subject}
              onSubjectChange={(value) => {
                setSubject(value);
                setEmailBuilderDocument((current) => patchEmailDocumentMetadata(current, { subject: value }));
              }}
              previewText={previewText}
              onPreviewTextChange={(value) => {
                setPreviewText(value);
                setEmailBuilderDocument((current) => patchEmailDocumentMetadata(current, { previewText: value }));
              }}
              emailBodyText={emailBodyText}
              visualDocumentActive={Boolean(emailBuilderDocument)}
              onEmailBodyTextChange={(value) => {
                if (
                  emailBuilderDocument &&
                  !window.confirm("Перейти к обычному тексту? Визуальная структура письма будет отвязана от кампании, но сам текст сохранится.")
                ) return;
                setEmailBodyText(value);
                setEmailBuilderDocument(null);
                setTemplateId(null);
                if (queryTemplateId) setConsumedTemplateQueryId(queryTemplateId);
              }}
              templates={workspaceTemplates}
              templateId={templateId}
              templateLoadState={templateLoadState}
              presentations={workspacePresentations}
              presentationId={presentationId}
              onPresentationChange={setPresentationId}
              onTemplateChange={(nextTemplateId) => {
                if (!nextTemplateId) {
                  setTemplateId(null);
                  setEmailBuilderDocument(unlinkEmailTemplateDocument);
                  if (queryTemplateId) setConsumedTemplateQueryId(queryTemplateId);
                  setEvaluation(null);
                  return;
                }
                if (
                  nextTemplateId !== templateId &&
                  (subject.trim() || previewText.trim() || emailBodyText.trim()) &&
                  !window.confirm("Заменить текущее email-письмо выбранным шаблоном? Тема, прехедер, текст и визуальный макет будут заменены.")
                ) return;
                const template = workspaceTemplates.find((item) => item.id === nextTemplateId);
                if (!template) {
                  setError("Шаблон не загружен. Обновите библиотеку и повторите выбор.");
                  return;
                }
                const patch = campaignEmailPatchFromTemplate(template);
                setTemplateId(patch.templateId);
                setSubject(patch.subject);
                setPreviewText(patch.previewText);
                setEmailBodyText(patch.emailBodyText);
                setEmailBuilderDocument(patch.emailBuilderDocument);
                if (queryTemplateId) setConsumedTemplateQueryId(queryTemplateId);
                setEvaluation(null);
                setError(null);
              }}
              messengerMessage={messengerMessage}
              onMessengerMessageChange={setMessengerMessage}
              editorHref={editorHref}
              templateLibraryHref={templateLibraryHref}
            />
          ) : null}

          {currentStep === 2 ? (
            <ChannelsStep
              channels={channels}
              onToggleChannel={toggleChannel}
              providers={providers}
              onProviderChange={(channel, providerId) => {
                setProviders((current) => ({ ...current, [channel]: providerId }));
                setEvaluation(null);
              }}
              integrationByProvider={integrationByProvider}
              coverage={coverage}
              recipientCount={recipientCount}
              senderName={senderName}
              senderEmail={senderEmail}
              onSenderNameChange={setSenderName}
              onSenderEmailChange={setSenderEmail}
              audienceType={audienceType}
            />
          ) : null}

          {currentStep === 3 ? (
            <ReviewStep
              campaignName={campaignName}
              audienceLabel={audienceLabel}
              recipientCount={recipientCount}
              channels={channels}
              providers={providers}
              coverage={evaluation?.eligibleByChannel ?? coverage}
              coveragePending={audienceType === "segment" && !evaluation}
              clientBlockers={clientBlockers}
              evaluation={evaluation}
              manualVkWorkspace={channels.includes("email") && providers.email === "vk-workspace"}
            />
          ) : null}

          {error ? <Alert tone="danger" title="Нужно исправить" className="mt-6">{error}</Alert> : null}
          {notice ? <Alert tone="success" title="Готово" className="mt-6">{notice}</Alert> : null}

          <footer className="mt-7 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {currentStep === 0 ? (
              <Link href="/campaigns" className={buttonVariants({ variant: "ghost" })}>Отмена</Link>
            ) : (
              <Button variant="ghost" onClick={() => { setCurrentStep((step) => step - 1); setError(null); }} leadingIcon={<ArrowLeft className="size-4" />}>
                Назад
              </Button>
            )}
            {currentStep < 3 ? (
              <Button onClick={goNext} trailingIcon={<ArrowRight className="size-4" />}>
                Далее: {steps[currentStep + 1].label}
              </Button>
            ) : (
              <Button
                onClick={() => void mutateCampaign("launch")}
                loading={busyAction === "launch"}
                loadingText="Проверяем…"
                leadingIcon={<Send className="size-4" />}
              >
                {evaluation?.blockers.length
                  ? "Проверить повторно"
                  : channels.includes("email") && providers.email === "vk-workspace"
                    ? "Подготовить запуск через VK WorkSpace"
                    : "Проверить готовность"}
              </Button>
            )}
          </footer>
        </section>

        <CampaignSummary
          currentStep={currentStep}
          audienceLabel={audienceLabel}
          recipientCount={recipientCount}
          campaignName={campaignName}
          channels={channels}
          providers={providers}
          blockers={evaluation?.blockers.length ? evaluation.blockers : clientBlockers}
        />
      </div>
    </div>
  );
}

function countAudienceReachable(contacts: AudienceContact[], channel: CampaignChannel) {
  return contacts.filter((contact) => {
    if (contact.status !== "active") return false;
    if (channel === "email") {
      return contact.emailConsent !== false && Boolean(contact.email);
    }
    if (channel === "telegram") {
      return Boolean(contact.telegramChatId && contact.telegramConsent);
    }
    return Boolean(contact.vkUserId && contact.vkConsent);
  }).length;
}

function hydrateFromApiCampaign(
  item: CampaignRecord,
  plans: DeliveryPlanRecord[],
  setters: {
    setCampaignId: (value: string | null) => void;
    setCampaignName: (value: string) => void;
    setAudienceType: (value: "none" | "segment" | "contacts") => void;
    setSegmentId: (value: string) => void;
    setContactIds: (value: string[]) => void;
    setSubject: (value: string) => void;
    setPreviewText: (value: string) => void;
    setEmailBodyText: (value: string) => void;
    setEmailBuilderDocument: (value: EmailBuilderDocumentInput | null) => void;
    setTemplateId: (value: string | null) => void;
    setPresentationId: (value: string | null) => void;
    setMessengerMessage: (value: string) => void;
    setChannels: (value: CampaignChannel[]) => void;
    setProviders: React.Dispatch<React.SetStateAction<Record<CampaignChannel, IntegrationProviderId>>>;
    setSenderName: (value: string) => void;
    setSenderEmail: (value: string) => void;
  },
) {
  setters.setCampaignId(item.id);
  setters.setCampaignName(item.name);
  setters.setAudienceType(item.audienceType);
  if (item.segmentId) setters.setSegmentId(item.segmentId);
  setters.setContactIds(item.contactIds);
  setters.setSubject(item.subject);
  setters.setPreviewText(item.previewText);
  setters.setEmailBodyText(item.emailBodyText);
  setters.setEmailBuilderDocument(item.emailBuilderDocument);
  setters.setTemplateId(item.templateId);
  setters.setPresentationId(item.presentationId);
  setters.setMessengerMessage(item.messengerMessage);
  setters.setSenderName(item.senderName);
  setters.setSenderEmail(item.senderEmail);
  if (item.deliveryChannels.length > 0) {
    setters.setChannels(item.deliveryChannels);
    if (plans.length > 0) {
      setters.setProviders((current) => ({
        ...current,
        ...Object.fromEntries(plans.map((plan) => [plan.channel, plan.providerId])),
      }));
    }
  }
}

function StepIntro({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">Шаг {number}</p>
      <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-text-strong">{title}</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-5 text-text-muted">{description}</p>
    </div>
  );
}

function AudienceStep({
  audienceType,
  onAudienceTypeChange,
  segments,
  selectedSegmentId,
  onSegmentChange,
  contacts,
  contactIds,
  onToggleContact,
  onSetContacts,
}: {
  audienceType: "none" | "segment" | "contacts";
  onAudienceTypeChange: (value: "segment" | "contacts") => void;
  segments: AudienceSegment[];
  selectedSegmentId: string;
  onSegmentChange: (value: string) => void;
  contacts: AudienceContact[];
  contactIds: string[];
  onToggleContact: (id: string) => void;
  onSetContacts: (ids: string[]) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [city, setCity] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [tag, setTag] = React.useState("");
  const companies = React.useMemo(() => [...new Set(contacts.map((item) => item.companyName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [contacts]);
  const cities = React.useMemo(() => [...new Set(contacts.map((item) => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [contacts]);
  const jobTitles = React.useMemo(() => [...new Set(contacts.map((item) => item.jobTitle).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [contacts]);
  const tags = React.useMemo(() => [...new Set(contacts.flatMap((item) => item.tags ?? []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [contacts]);
  const filteredContacts = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return contacts.filter((contact) => {
      if (company && contact.companyName !== company) return false;
      if (city && contact.city !== city) return false;
      if (jobTitle && contact.jobTitle !== jobTitle) return false;
      if (tag && !(contact.tags ?? []).includes(tag)) return false;
      if (!query) return true;
      return [contact.fullName, contact.email, contact.companyName, contact.jobTitle, contact.city, ...(contact.tags ?? [])]
        .some((value) => value.toLocaleLowerCase("ru-RU").includes(query));
    });
  }, [city, company, contacts, jobTitle, search, tag]);
  const filteredIds = React.useMemo(
    () => filteredContacts.map((contact) => contact.id),
    [filteredContacts],
  );
  const selectedIds = React.useMemo(() => new Set(contactIds), [contactIds]);
  const filteredIdSet = React.useMemo(() => new Set(filteredIds), [filteredIds]);
  const selectedVisible = filteredIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = filteredIds.length > 0 && selectedVisible === filteredIds.length;
  const filtersActive = Boolean(search || company || city || jobTitle || tag);

  return (
    <div>
      <StepIntro number={1} title="Выберите аудиторию" description="Используйте сохранённый сегмент или выберите конкретные контакты. Охват по каждому каналу посчитается отдельно." />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {([
          { value: "segment" as const, title: "Сегмент", text: "Динамическая аудитория по сохранённым правилам", icon: UsersRound },
          { value: "contacts" as const, title: "Контакты", text: "Точный список получателей для этой рассылки", icon: UserRound },
        ]).map((option) => {
          const Icon = option.icon;
          const selected = audienceType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onAudienceTypeChange(option.value)}
              className={cn(
                "flex min-h-28 items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                selected ? "border-primary/40 bg-primary-subtle" : "border-border hover:border-border-strong",
              )}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", selected ? "bg-primary text-white" : "bg-surface-subtle text-text-muted")}>
                <Icon aria-hidden="true" className="size-4.5" />
              </span>
              <span>
                <span className="block text-[14px] font-semibold text-text-strong">{option.title}</span>
                <span className="mt-1 block text-[12px] leading-5 text-text-muted">{option.text}</span>
              </span>
            </button>
          );
        })}
      </div>

      {audienceType === "segment" ? (
        <div className="mt-6 grid gap-3">
          {segments.map((segment) => {
            const selected = selectedSegmentId === segment.id;
            return (
              <button
                key={segment.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSegmentChange(segment.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  selected ? "border-primary/40 bg-primary-subtle/60" : "border-border hover:border-border-strong",
                )}
              >
                <span className={cn("grid size-6 place-items-center rounded-full border", selected ? "border-primary bg-primary text-white" : "border-border-strong")}>
                  {selected ? <Check aria-hidden="true" className="size-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-text-strong">{segment.name}</span>
                  <span className="mt-0.5 block text-[12px] text-text-muted">{segment.description || "Сохранённая аудитория"}</span>
                </span>
                <strong className="text-[14px] tabular-nums text-text-strong">{formatNumber(segment.contactCount)}</strong>
              </button>
            );
          })}
        </div>
      ) : audienceType === "contacts" ? (
        <fieldset className="mt-6">
          <legend className="text-[13px] font-semibold text-text-strong">Контакты рабочего пространства</legend>
          <div className="mt-3 grid gap-2 rounded-xl border border-border bg-surface-subtle/45 p-3">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по имени, email, компании или должности" className="pl-9" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Select value={company} onChange={(event) => setCompany(event.target.value)} options={[{ value: "", label: "Все компании" }, ...companies.map((value) => ({ value, label: value }))]} />
              <Select value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} options={[{ value: "", label: "Все должности" }, ...jobTitles.map((value) => ({ value, label: value }))]} />
              <Select value={city} onChange={(event) => setCity(event.target.value)} options={[{ value: "", label: "Все города" }, ...cities.map((value) => ({ value, label: value }))]} />
              <Select value={tag} onChange={(event) => setTag(event.target.value)} options={[{ value: "", label: "Все теги" }, ...tags.map((value) => ({ value, label: value }))]} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-text-muted">Найдено: {formatNumber(filteredContacts.length)} · выбрано: {formatNumber(contactIds.length)}</span>
              <div className="flex gap-2">
                {filtersActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setCompany("");
                      setJobTitle("");
                      setCity("");
                      setTag("");
                    }}
                  >
                    Сбросить фильтры
                  </Button>
                ) : null}
                {contactIds.length ? <Button variant="ghost" size="sm" onClick={() => onSetContacts([])}>Снять выбор</Button> : null}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredIds.length === 0}
                  onClick={() => onSetContacts(allVisibleSelected ? contactIds.filter((id) => !filteredIdSet.has(id)) : [...new Set([...contactIds, ...filteredIds])])}
                >
                  {allVisibleSelected ? "Убрать найденных" : "Добавить всех найденных"}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {filteredContacts.map((contact) => (
              <label key={contact.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-subtle">
                <input
                  type="checkbox"
                  checked={selectedIds.has(contact.id)}
                  onChange={() => onToggleContact(contact.id)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text-strong">{contact.fullName}</span>
                  <span className="block truncate text-[11px] text-text-muted">{contact.email}{contact.companyName ? ` · ${contact.companyName}` : ""}</span>
                </span>
                {contact.status && contact.status !== "active" ? <Badge variant="warning">Недоступен</Badge> : null}
              </label>
            ))}
            {filteredContacts.length === 0 ? <p className="m-0 px-4 py-8 text-center text-[12px] text-text-muted">По выбранным фильтрам контактов нет.</p> : null}
          </div>
        </fieldset>
      ) : (
        <Alert tone="info" title="Аудитория пока не выбрана" className="mt-6">
          Выберите сегмент или конкретные контакты. Черновик можно сохранить и без аудитории.
        </Alert>
      )}

      <Alert tone="info" title="Неактивные контакты исключаются автоматически" className="mt-6">
        Сервер не включает в охват отписавшихся, контакты с ошибками доставки и некорректными адресами; дополнительные переключатели не нужны.
      </Alert>
    </div>
  );
}

function MessageStep({
  campaignName,
  onCampaignNameChange,
  subject,
  onSubjectChange,
  previewText,
  onPreviewTextChange,
  emailBodyText,
  onEmailBodyTextChange,
  visualDocumentActive,
  templates,
  templateId,
  templateLoadState,
  presentations,
  presentationId,
  onPresentationChange,
  onTemplateChange,
  messengerMessage,
  onMessengerMessageChange,
  editorHref,
  templateLibraryHref,
}: {
  campaignName: string;
  onCampaignNameChange: (value: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  previewText: string;
  onPreviewTextChange: (value: string) => void;
  emailBodyText: string;
  onEmailBodyTextChange: (value: string) => void;
  visualDocumentActive: boolean;
  templates: EmailTemplateRecord[];
  templateId: string | null;
  templateLoadState: "loading" | "ready" | "error";
  presentations: PresentationProjectRecord[];
  presentationId: string | null;
  onPresentationChange: (value: string | null) => void;
  onTemplateChange: (value: string) => void;
  messengerMessage: string;
  onMessengerMessageChange: (value: string) => void;
  editorHref: string;
  templateLibraryHref: string;
}) {
  const selectedTemplate = templates.find((template) => template.id === templateId);
  return (
    <div>
      <StepIntro number={2} title="Подготовьте сообщение" description="Создайте email-версию и короткий вариант для мессенджеров. На следующем шаге выберите, какие версии отправлять." />
      <div className="mt-6">
        <FormField label="Название рассылки" htmlFor="campaign-name" required hint="Внутреннее название для вашего списка. Получателю оно не показывается.">
          <Input id="campaign-name" value={campaignName} onChange={(event) => onCampaignNameChange(event.target.value)} />
        </FormField>
      </div>
      <section className="mt-5 rounded-xl border border-border bg-surface-subtle/45 p-4" aria-labelledby="campaign-template-title">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto] md:items-end">
          <FormField
            label="Email-шаблон"
            htmlFor="campaign-template"
            hint={selectedTemplate
              ? `В кампанию попадёт копия «${selectedTemplate.name}», а не живая ссылка.`
              : "Можно начать с чистого листа или выбрать сохранённый макет."}
          >
            <Select
              id="campaign-template"
              value={templateId ?? ""}
              disabled={templateLoadState !== "ready"}
              onChange={(event) => onTemplateChange(event.target.value)}
              options={[
                { value: "", label: "Без шаблона · сохранить текущий текст" },
                ...templates.map((template) => ({ value: template.id, label: template.name })),
              ]}
            />
          </FormField>
          <Link href={templateLibraryHref} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Открыть библиотеку
          </Link>
        </div>
        {templateLoadState === "loading" ? (
          <p className="mt-3 text-[11px] text-text-muted">Загружаем шаблоны рабочего пространства…</p>
        ) : templateLoadState === "error" ? (
          <Alert tone="warning" title="Библиотека недоступна" className="mt-3">
            Письмо можно заполнить вручную, но выбрать серверный шаблон до восстановления связи нельзя.
          </Alert>
        ) : null}
      </section>
      <section className="mt-4 rounded-xl border border-border bg-surface p-4" aria-labelledby="campaign-presentation-title">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto] md:items-end">
          <FormField label="Презентация во вложении" htmlFor="campaign-presentation" hint={presentationId ? "Сохранённый PPTX будет приложен при отправке через UniSender." : "Необязательно. VK WorkSpace не принимает вложение через API Поток."}>
            <Select id="campaign-presentation" value={presentationId ?? ""} onChange={(event) => onPresentationChange(event.target.value || null)} options={[{ value: "", label: "Без презентации" }, ...presentations.map((item) => ({ value: item.id, label: `${item.name} · ${item.slides.length} слайдов` }))]} />
          </FormField>
          <Link href="/presentations" className={buttonVariants({ variant: "secondary", size: "sm" })}>Открыть презентации</Link>
        </div>
        {presentationId ? <p className="mb-0 mt-3 rounded-lg bg-info-subtle px-3 py-2 text-[10px] leading-4 text-text-muted">Для автоматической отправки вложения выберите на следующем шаге Email → UniSender. Лимит вложения — 500 КБ; Поток проверит размер перед передачей провайдеру.</p> : null}
      </section>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-5" aria-labelledby="email-message-title">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary-subtle text-primary"><Mail aria-hidden="true" className="size-4" /></span>
            <div>
              <h3 id="email-message-title" className="text-[15px] font-semibold text-text-strong">Email</h3>
              <p className="mt-0.5 text-[11px] text-text-muted">Тема, прехедер и основной текст</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <FormField label="Тема письма" htmlFor="campaign-subject">
              <Input id="campaign-subject" value={subject} onChange={(event) => onSubjectChange(event.target.value)} placeholder="Короткая и конкретная тема" />
            </FormField>
            <FormField label="Прехедер" htmlFor="campaign-preheader" hint="Необязательная строка во входящих">
              <Input id="campaign-preheader" value={previewText} onChange={(event) => onPreviewTextChange(event.target.value)} placeholder="Краткое описание письма" />
            </FormField>
            <FormField label="Текст письма" htmlFor="campaign-email-message" hint={`${emailBodyText.length} символов`}>
              <Textarea id="campaign-email-message" rows={8} value={emailBodyText} onChange={(event) => onEmailBodyTextChange(event.target.value)} placeholder="Здравствуйте, {{first_name}}…" />
            </FormField>
            {visualDocumentActive ? (
              <p className="rounded-lg border border-info/20 bg-info-subtle px-3 py-2 text-[10px] leading-4 text-text-muted">
                Сейчас подключён блочный макет. Тема и прехедер обновляются без потери дизайна; ручное изменение текстовой версии явно переведёт письмо в обычный текст.
              </p>
            ) : null}
            <Link href={editorHref} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <PencilLine aria-hidden="true" className="size-3.5" />
              Открыть визуальный редактор
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border p-5" aria-labelledby="messenger-message-title">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-info-subtle text-info"><MessageCircle aria-hidden="true" className="size-4" /></span>
            <div>
              <h3 id="messenger-message-title" className="text-[15px] font-semibold text-text-strong">Telegram и ВКонтакте</h3>
              <p className="mt-0.5 text-[11px] text-text-muted">Один короткий вариант для выбранных мессенджеров</p>
            </div>
          </div>
          <div className="mt-5">
            <FormField label="Текст сообщения" htmlFor="campaign-messenger-message" hint={`${messengerMessage.length} из 4 000 символов`}>
              <Textarea id="campaign-messenger-message" rows={11} maxLength={4000} value={messengerMessage} onChange={(event) => onMessengerMessageChange(event.target.value)} placeholder="Здравствуйте, {{first_name}}…" />
            </FormField>
          </div>
        </section>
      </div>
      <p className="mt-4 text-[12px] leading-5 text-text-muted">
        Переменная <code className="rounded bg-surface-subtle px-1.5 py-0.5">{"{{first_name}}"}</code> подставит имя контакта перед отправкой.
      </p>
    </div>
  );
}

function ChannelsStep({
  channels,
  onToggleChannel,
  providers,
  onProviderChange,
  integrationByProvider,
  coverage,
  recipientCount,
  senderName,
  senderEmail,
  onSenderNameChange,
  onSenderEmailChange,
  audienceType,
}: {
  channels: CampaignChannel[];
  onToggleChannel: (channel: CampaignChannel) => void;
  providers: Record<CampaignChannel, IntegrationProviderId>;
  onProviderChange: (channel: CampaignChannel, providerId: IntegrationProviderId) => void;
  integrationByProvider: Partial<Record<IntegrationProviderId, IntegrationSnapshot>>;
  coverage: Record<CampaignChannel, number>;
  recipientCount: number;
  senderName: string;
  senderEmail: string;
  onSenderNameChange: (value: string) => void;
  onSenderEmailChange: (value: string) => void;
  audienceType: "none" | "segment" | "contacts";
}) {
  return (
    <div>
      <StepIntro number={3} title="Настройте маршруты доставки" description="Для каждого канала выберите провайдера. Точный охват и причины, мешающие запуску, рассчитает сервер на шаге готовности." />
      <div className="mt-6 space-y-3">
        {campaignChannelDefinitions.map((channel) => {
          const selected = channels.includes(channel.id);
          const providerId = providers[channel.id];
          const provider = getCampaignChannelProvider(channel.id, providerId);
          const connection = integrationByProvider[providerId]?.status ?? "disconnected";
          const Icon = channelIcons[channel.id];
          return (
            <article key={channel.id} className={cn("rounded-xl border p-4 sm:p-5", selected ? "border-primary/35 bg-primary-subtle/25" : "border-border") }>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleChannel(channel.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", selected ? "bg-primary text-white" : "bg-surface-subtle text-text-muted")}><Icon aria-hidden="true" className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-text-strong">{channel.label}</span>
                      <Badge variant={selected ? "accent" : "neutral"}>{selected ? "Выбран" : "Выключен"}</Badge>
                    </span>
                    <span className="mt-1 block text-[12px] text-text-muted">
                      {audienceType === "segment"
                        ? "Точный охват рассчитает сервер"
                        : `Доступно: ${formatNumber(coverage[channel.id])} из ${formatNumber(recipientCount)}`}
                    </span>
                  </span>
                </button>

                {selected ? (
                  <div className="grid gap-2 sm:min-w-72 sm:grid-cols-[1fr_auto] sm:items-end">
                    <FormField label="Провайдер" htmlFor={`campaign-provider-${channel.id}`}>
                      <Select
                        id={`campaign-provider-${channel.id}`}
                        value={providerId}
                        onChange={(event) => onProviderChange(channel.id, event.target.value as IntegrationProviderId)}
                        options={campaignChannelProviders[channel.id].map((item) => ({ value: item.id, label: item.label }))}
                      />
                    </FormField>
                    <Link
                      href={`/integrations?channel=${channel.id}&provider=${providerId}`}
                      className={buttonVariants({ variant: connection === "connected" ? "ghost" : "secondary", size: "sm" })}
                    >
                      <Settings2 aria-hidden="true" className="size-3.5" />
                      {connection === "connected" ? "Открыть" : "Настроить"}
                    </Link>
                  </div>
                ) : null}
              </div>

              {selected ? (
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] leading-5 text-text-muted">{provider?.description}</p>
                  <Badge variant={connection === "connected" ? "success" : connection === "needs_attention" ? "warning" : "neutral"} dot className="w-fit shrink-0">
                    {connectionLabels[connection]}
                  </Badge>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {channels.includes("email") ? (
        <section className="mt-6 rounded-xl border border-border p-5" aria-labelledby="sender-title">
          <h3 id="sender-title" className="text-[15px] font-semibold text-text-strong">Отправитель email</h3>
          <p className="mt-1 text-[12px] text-text-muted">Адрес должен быть подтверждён у выбранного провайдера.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Имя отправителя" htmlFor="sender-name" required>
              <Input id="sender-name" value={senderName} onChange={(event) => onSenderNameChange(event.target.value)} />
            </FormField>
            <FormField label="Email отправителя" htmlFor="sender-email" required>
              <Input id="sender-email" type="email" value={senderEmail} onChange={(event) => onSenderEmailChange(event.target.value)} placeholder="mailing@company.ru" />
            </FormField>
          </div>
        </section>
      ) : null}

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex items-start gap-3">
          <div>
            <p className="text-[13px] font-semibold text-text-strong">Согласия проверяет сервер</p>
            <p className="mt-1 text-[12px] leading-5 text-text-muted">В итоговую аудиторию попадут только доступные контакты с согласием и адресом электронной почты, идентификатором чата Telegram или идентификатором пользователя ВКонтакте.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  campaignName,
  audienceLabel,
  recipientCount,
  channels,
  providers,
  coverage,
  coveragePending,
  clientBlockers,
  evaluation,
  manualVkWorkspace,
}: {
  campaignName: string;
  audienceLabel: string;
  recipientCount: number;
  channels: CampaignChannel[];
  providers: Record<CampaignChannel, IntegrationProviderId>;
  coverage: Partial<Record<CampaignChannel, number>>;
  coveragePending: boolean;
  clientBlockers: string[];
  evaluation: Evaluation | null;
  manualVkWorkspace: boolean;
}) {
  const blockers = evaluation?.blockers.length ? evaluation.blockers : clientBlockers;
  return (
    <div>
      <StepIntro number={4} title="Проверьте готовность" description="Сервер рассчитает точный охват, проверит согласия, подключения и сохранит план. Внешняя отправка на этом шаге не выполняется." />
      <div className="mt-6 divide-y divide-border rounded-xl border border-border">
        <ReviewRow label="Название рассылки" value={campaignName || "Без названия"} />
        <ReviewRow label="Аудитория" value={`${audienceLabel} · ${formatRecipientCount(recipientCount)}`} />
        {channels.map((channel) => (
          <ReviewRow
            key={channel}
            label={getCampaignChannelDefinition(channel).shortLabel}
            value={coveragePending
              ? `${integrationProviderById[providers[channel]].name} · охват после проверки`
              : `${integrationProviderById[providers[channel]].name} · доступно ${formatNumber(coverage[channel] ?? 0)}`}
          />
        ))}
      </div>

      <Alert tone="info" title={manualVkWorkspace ? "VK WorkSpace: отправка вручную" : "Запуск выполняется отдельно"} className="mt-6">
        {manualVkWorkspace
          ? "Поток подготовит адресатов и письмо. Затем на странице рассылки скачайте CSV и загрузите его в раздел «Рассылки» VK WorkSpace. Автоматически письмо не отправляется."
          : "Проверка только фиксирует готовую версию. После неё откройте рассылку и нажмите «Начать отправку». Автоматического запуска по расписанию в текущей версии нет."}
      </Alert>

      <section className={cn("mt-6 rounded-xl border p-5", blockers.length ? "border-warning/30 bg-warning-subtle" : "border-success/25 bg-success-subtle")} aria-labelledby="blockers-title">
        <div className="flex items-center gap-3">
          {blockers.length ? <CircleAlert aria-hidden="true" className="size-5 text-warning" /> : <CheckCircle2 aria-hidden="true" className="size-5 text-success" />}
          <div>
            <h3 id="blockers-title" className="text-[14px] font-semibold text-text-strong">{blockers.length ? `Причин, мешающих запуску: ${blockers.length}` : "Предварительная проверка пройдена"}</h3>
            <p className="mt-1 text-[12px] text-text-muted">{evaluation ? "Результат серверной проверки" : "Предварительная проверка формы"}</p>
          </div>
        </div>
        {blockers.length ? (
          <ul className="mt-4 space-y-2 text-[12px] leading-5 text-text">
            {blockers.map((blocker) => <li key={blocker} className="flex gap-2"><CircleDashed aria-hidden="true" className="mt-1 size-3.5 shrink-0" />{blocker}</li>)}
          </ul>
        ) : (
          <p className="mt-3 text-[12px] leading-5 text-text">Нажмите «Проверить готовность»: сервер рассчитает финальный охват и сохранит план. Внешняя отправка не выполняется.</p>
        )}
      </section>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <span className="text-[12px] font-medium text-text-muted">{label}</span>
      <span className="text-[13px] font-semibold text-text-strong sm:text-right">{value}</span>
    </div>
  );
}

function CampaignSummary({
  currentStep,
  audienceLabel,
  recipientCount,
  campaignName,
  channels,
  providers,
  blockers,
}: {
  currentStep: number;
  audienceLabel: string;
  recipientCount: number;
  campaignName: string;
  channels: CampaignChannel[];
  providers: Record<CampaignChannel, IntegrationProviderId>;
  blockers: string[];
}) {
  return (
    <aside className="card p-5 xl:sticky xl:top-5" aria-label="Сводка рассылки">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text-strong">Сводка</h2>
        <Badge variant={blockers.length === 0 ? "success" : "warning"} dot>{blockers.length === 0 ? "Готово" : `Нужно исправить: ${blockers.length}`}</Badge>
      </div>
      <dl className="mt-5 space-y-4">
        <SummaryRow icon={<Send aria-hidden="true" className="size-4" />} label="Рассылка" value={campaignName || "Не названа"} />
        <SummaryRow icon={<UsersRound aria-hidden="true" className="size-4" />} label="Аудитория" value={`${audienceLabel} · ${formatNumber(recipientCount)}`} />
        <SummaryRow
          icon={<ShieldCheck aria-hidden="true" className="size-4" />}
          label="Маршруты"
          value={currentStep < 2
            ? "Настроите на шаге 3"
            : channels.length
              ? channels.map((channel) => `${getCampaignChannelDefinition(channel).shortLabel}: ${integrationProviderById[providers[channel]].name}`).join("; ")
              : "Не выбраны"}
        />
      </dl>
      <div className="mt-5 rounded-xl bg-surface-subtle p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">Сейчас</p>
        <p className="mt-1 text-[14px] font-semibold text-text-strong">Шаг {currentStep + 1} из 4 · {steps[currentStep].label}</p>
        <p className="mt-2 text-[11px] leading-5 text-text-muted">Черновик формы восстанавливается в этом браузере. Данные кампании считаются сохранёнными только после подтверждения сервера.</p>
      </div>
    </aside>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary">{icon}</dt>
      <dd className="min-w-0">
        <span className="block text-[11px] font-medium text-text-muted">{label}</span>
        <span className="mt-1 block text-[12px] leading-5 font-semibold text-text-strong">{value}</span>
      </dd>
    </div>
  );
}
