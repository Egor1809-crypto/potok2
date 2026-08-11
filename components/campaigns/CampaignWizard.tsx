"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  Cable,
  Copy,
  FileText,
  Filter,
  Mail,
  MailCheck,
  MessageCircle,
  PencilLine,
  Save,
  Send,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { campaigns } from "@/data/mockCampaigns";
import { companies } from "@/data/mockCompanies";
import { contacts } from "@/data/mockContacts";
import { segments } from "@/data/mockSegments";
import { templates } from "@/data/templates";
import { createCampaignMetrics } from "@/data/helpers";
import { countReachableContacts } from "@/data/contactChannels";
import type { Campaign, CampaignWizardStep, TemplateCategory } from "@/types";
import { BRAND_NAME } from "@/config/brand";
import { INTEGRATION_DEMO_ROUTES_STORAGE_KEY } from "@/config/integrations";
import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  Select,
  Stepper,
  Switch,
  Textarea,
  ToastSurface,
  buttonVariants,
  cn,
} from "@/components/ui";
import {
  campaignChannelDefinitions,
  campaignChannelProviders,
  defaultCampaignChannelProvider,
  estimateCampaignChannelCoverage,
  getCampaignChannelDefinition,
  getCampaignChannelProvider,
  type CampaignChannel,
} from "@/components/campaigns/campaignChannels";
import type { BuilderDocument } from "@/components/email-builder/builder-types";

type AudienceType = "segment" | "saved-list" | "custom-filter" | "contacts";
type ContentMode = "scratch" | "template" | "duplicate" | "ai";
type SendMode = "now" | "schedule";
type SubmitState = "idle" | "processing" | "success";

type SavedCampaignWizardDraft = {
  name?: string;
  audienceType?: AudienceType;
  segmentId?: string | null;
  savedListId?: string;
  companyId?: string | null;
  contactIds?: string[];
  recipientCount?: number;
  contentMode?: ContentMode;
  templateId?: string | null;
  duplicateCampaignId?: string | null;
  senderName?: string;
  senderEmail?: string;
  subject?: string;
  previewText?: string;
  channels?: CampaignChannel[];
  providers?: Partial<Record<CampaignChannel, string>>;
  messengerMessage?: string;
  channelConsentConfirmed?: boolean;
  excludeUnsubscribed?: boolean;
  excludeBounced?: boolean;
  excludePreviouslyContacted?: boolean;
  sendMode?: SendMode;
  scheduleDate?: string;
  scheduleTime?: string;
  builderDocument?: BuilderDocument;
};

const MESSENGER_MESSAGE_MAX_LENGTH = 4_000;
const CAMPAIGN_WIZARD_DRAFT_STORAGE_KEY = "mailflow:campaign-wizard-draft";
const CAMPAIGN_WIZARD_HANDOFF_STORAGE_PREFIX =
  "mailflow:campaign-wizard-handoff:";
const CAMPAIGN_WIZARD_RESUME_STORAGE_PREFIX =
  "mailflow:campaign-wizard-resume:";
const meaningfulCampaignQueryKeys = new Set([
  "audience",
  "audienceType",
  "builderDraft",
  "campaign",
  "channel",
  "company",
  "consent",
  "contact",
  "count",
  "draft",
  "duplicate",
  "filter",
  "handoff",
  "message",
  "name",
  "provider_email",
  "provider_telegram",
  "provider_vk",
  "resume",
  "copy",
  "savedList",
  "segment",
  "source",
  "step",
  "template",
]);

export type CampaignWizardSearchParams = Record<
  string,
  string | string[] | undefined
>;

export interface CampaignWizardProps {
  searchParams?: CampaignWizardSearchParams | URLSearchParams;
}

const wizardSteps: { value: CampaignWizardStep; label: string; description: string }[] = [
  { value: "audience", label: "Аудитория", description: "Выберите получателей" },
  { value: "content", label: "Каналы", description: "Подготовьте сообщения" },
  { value: "sender", label: "Провайдеры", description: "Выберите платформы" },
  { value: "review", label: "Проверка", description: "Проверьте и запустите" },
];

const audienceOptions: {
  value: AudienceType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "segment",
    label: "Сегмент",
    description: "Использовать динамическую аудиторию по правилам",
    icon: UsersRound,
  },
  {
    value: "saved-list",
    label: "Сохранённый список",
    description: "Отправить выбранному списку контактов",
    icon: FileText,
  },
  {
    value: "custom-filter",
    label: "Собственный фильтр",
    description: "Настроить аудиторию для этой кампании",
    icon: Filter,
  },
  {
    value: "contacts",
    label: "Отдельные контакты",
    description: "Выбрать получателей вручную",
    icon: UserRound,
  },
];

const contentOptions: {
  value: ContentMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "scratch",
    label: "Начать с нуля",
    description: "Создать письмо в редакторе",
    icon: PencilLine,
  },
  {
    value: "template",
    label: "Использовать шаблон",
    description: "Начать с готовой структуры",
    icon: FileText,
  },
  {
    value: "duplicate",
    label: "Дублировать кампанию",
    description: "Использовать предыдущую кампанию",
    icon: Copy,
  },
  {
    value: "ai",
    label: "Черновик с ИИ",
    description: "Создать первый вариант письма",
    icon: Sparkles,
  },
];

const channelIcons: Record<
  CampaignChannel,
  React.ComponentType<{ className?: string }>
> = {
  email: Mail,
  telegram: SendHorizontal,
  vk: MessageCircle,
};

const savedLists = [
  { id: "list-priority-partners", name: "Приоритетные партнёры", count: 612 },
  { id: "list-event-speakers", name: "Спикеры мероприятий", count: 96 },
  { id: "list-client-briefing", name: "Список для клиентского брифинга", count: 1_948 },
];

const senderProfiles = [
  { id: "egor", name: "Егор Сабалин", email: "egor@mailflow.example" },
  { id: "alina", name: "Алина Громова", email: "alina@mailflow.example" },
];

const campaignStatusLabels: Record<Campaign["status"], string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  sending: "Отправляется",
  completed: "Завершена",
};

const templateCategoryLabels: Record<TemplateCategory, string> = {
  Business: "Деловые",
  Events: "Мероприятия",
  Outreach: "Коммуникации",
  Newsletter: "Рассылки",
  "Follow-up": "Продолжение общения",
  Transactional: "Транзакционные",
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

function subscribeToBuilderDraft(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getBuilderDraftSnapshot() {
  try {
    return window.localStorage.getItem("mailflow:email-draft") ?? "";
  } catch {
    return "";
  }
}

function getServerBuilderDraftSnapshot() {
  return "";
}

function getCampaignWizardSnapshot(storageKey: string | null) {
  if (!storageKey) return "";
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function getServerCampaignWizardSnapshot() {
  return "";
}

function safeStorageToken(value: string | null) {
  if (!value || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) return null;
  return value;
}

function getDemoRoutesSnapshot() {
  try {
    return window.localStorage.getItem(INTEGRATION_DEMO_ROUTES_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerDemoRoutesSnapshot() {
  return "";
}

function hasMeaningfulCampaignQuery(params: URLSearchParams) {
  return Array.from(params.keys()).some((key) =>
    meaningfulCampaignQueryKeys.has(key),
  );
}

function parseSavedCampaignWizardDraft(
  snapshot: string,
): SavedCampaignWizardDraft | null {
  if (!snapshot) return null;

  try {
    const value = JSON.parse(snapshot) as SavedCampaignWizardDraft;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function serializeParams(
  input: CampaignWizardSearchParams | URLSearchParams | undefined,
): string | null {
  if (!input) return null;
  if (input instanceof URLSearchParams) return input.toString();
  const result = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => result.append(key, item));
    else if (value !== undefined) result.set(key, value);
  });
  return result.toString();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function stepFromQuery(value: string | null): number {
  const index = wizardSteps.findIndex((step) => step.value === value);
  return index >= 0 ? index : 0;
}

function audienceTypeFromQuery(value: string | null): AudienceType | null {
  return audienceOptions.some((option) => option.value === value)
    ? (value as AudienceType)
    : null;
}

function parseContactIds(params: URLSearchParams): string[] {
  return params
    .getAll("contact")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseCampaignChannels(
  params: URLSearchParams,
  fallback: CampaignChannel[] = ["email"],
): CampaignChannel[] {
  const channels = params
    .getAll("channel")
    .flatMap((value) => value.split(","))
    .filter((value): value is CampaignChannel =>
      campaignChannelDefinitions.some((channel) => channel.id === value),
    );
  return channels.length > 0
    ? Array.from(new Set(channels))
    : fallback.length > 0
      ? [...fallback]
      : ["email"];
}

function getInitialProvider(
  params: URLSearchParams,
  channel: CampaignChannel,
  demoRoutesSnapshot: string,
  restoredProvider?: string,
): string {
  const requested = params.get(`provider_${channel}`);
  if (campaignChannelProviders[channel].some(
    (provider) => provider.id === requested,
  )) return requested!;

  if (campaignChannelProviders[channel].some(
    (provider) => provider.id === restoredProvider,
  )) return restoredProvider!;

  try {
    const demoRoutes = JSON.parse(demoRoutesSnapshot) as Partial<
      Record<CampaignChannel, string | null>
    >;
    const savedProvider = demoRoutes[channel];
    if (campaignChannelProviders[channel].some(
      (provider) => provider.id === savedProvider,
    )) return savedProvider!;
  } catch {
    // Fall through to the recommended provider.
  }

  return defaultCampaignChannelProvider[channel];
}

export function CampaignWizard({ searchParams }: CampaignWizardProps) {
  const browserSearch = React.useSyncExternalStore(
    subscribeToLocation,
    getBrowserSearch,
    getServerSearch,
  );
  const builderDraftSnapshot = React.useSyncExternalStore(
    subscribeToBuilderDraft,
    getBuilderDraftSnapshot,
    getServerBuilderDraftSnapshot,
  );
  const demoRoutesSnapshot = React.useSyncExternalStore(
    subscribeToBuilderDraft,
    getDemoRoutesSnapshot,
    getServerDemoRoutesSnapshot,
  );
  const providedSearch = serializeParams(searchParams);
  const resolvedSearch = providedSearch ?? browserSearch.replace(/^\?/, "");
  const resolvedParams = new URLSearchParams(resolvedSearch);
  const restoreSavedDraft = !hasMeaningfulCampaignQuery(resolvedParams);
  const handoffToken = safeStorageToken(resolvedParams.get("handoff"));
  const resumeCampaignId = safeStorageToken(resolvedParams.get("resume"));
  const restoreStorageKey = handoffToken
    ? `${CAMPAIGN_WIZARD_HANDOFF_STORAGE_PREFIX}${handoffToken}`
    : resumeCampaignId
      ? `${CAMPAIGN_WIZARD_RESUME_STORAGE_PREFIX}${resumeCampaignId}`
      : restoreSavedDraft
        ? CAMPAIGN_WIZARD_DRAFT_STORAGE_KEY
        : null;
  const getRestoreSnapshot = React.useCallback(
    () => getCampaignWizardSnapshot(restoreStorageKey),
    [restoreStorageKey],
  );
  const campaignWizardDraftSnapshot = React.useSyncExternalStore(
    subscribeToBuilderDraft,
    getRestoreSnapshot,
    getServerCampaignWizardSnapshot,
  );

  return (
    <CampaignWizardState
      key={`${resolvedSearch || "campaign-wizard-default"}:${
        resolvedSearch.includes("builderDraft=1") ? builderDraftSnapshot : ""
      }:${demoRoutesSnapshot}:${campaignWizardDraftSnapshot}`}
      params={resolvedParams}
      builderDraftSnapshot={builderDraftSnapshot}
      demoRoutesSnapshot={demoRoutesSnapshot}
      campaignWizardDraftSnapshot={campaignWizardDraftSnapshot}
    />
  );
}

function CampaignWizardState({
  params,
  builderDraftSnapshot,
  demoRoutesSnapshot,
  campaignWizardDraftSnapshot,
}: {
  params: URLSearchParams;
  builderDraftSnapshot: string;
  demoRoutesSnapshot: string;
  campaignWizardDraftSnapshot: string;
}) {
  const generatedHandoffId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const requestedHandoffToken = safeStorageToken(params.get("handoff"));
  const handoffToken =
    requestedHandoffToken ??
    `wizard-${generatedHandoffId || "current"}`;
  const handoffStorageKey =
    `${CAMPAIGN_WIZARD_HANDOFF_STORAGE_PREFIX}${handoffToken}`;
  const builderDraft = (() => {
    if (params.get("builderDraft") !== "1" || !builderDraftSnapshot) return null;
    try {
      return JSON.parse(builderDraftSnapshot) as {
        campaignName?: string;
        document?: BuilderDocument;
      };
    } catch {
      return null;
    }
  })();
  const savedWizardDraft = parseSavedCampaignWizardDraft(
    campaignWizardDraftSnapshot,
  );
  const resumeCampaignId = safeStorageToken(params.get("resume"));
  const copyRestoredCampaign = Boolean(
    resumeCampaignId && params.get("copy") === "1",
  );
  const duplicateId = params.get("duplicate");
  const sourceCampaign = campaigns.find(
    (campaign) =>
      campaign.id === (duplicateId ?? params.get("draft") ?? params.get("campaign")),
  );
  const audienceQuery = params.get("audience")?.trim() ?? "";
  const querySegment = segments.find(
    (segment) =>
      segment.id === audienceQuery ||
      segment.name.toLocaleLowerCase() === audienceQuery.toLocaleLowerCase(),
  );
  const queryContactIds = parseContactIds(params);
  const queryCompany = companies.find(
    (company) =>
      company.id === (params.get("company") ?? savedWizardDraft?.companyId),
  );
  const companyContactIds = queryCompany
    ? contacts
        .filter((contact) => contact.companyId === queryCompany.id)
        .map((contact) => contact.id)
    : [];
  const savedContactIds = Array.isArray(savedWizardDraft?.contactIds)
    ? savedWizardDraft.contactIds.filter((id): id is string => typeof id === "string")
    : [];
  const seededContactIds = queryContactIds.length > 0
    ? queryContactIds
    : companyContactIds.length > 0
      ? companyContactIds
      : savedContactIds;
  const queryCount = Math.max(0, Number.parseInt(params.get("count") ?? "0", 10) || 0);
  const queryFilter = params.get("filter") === "lawyers-moscow-active";
  const queryAudienceType = audienceTypeFromQuery(params.get("audienceType"));
  const savedAudienceType = audienceOptions.some(
    (option) => option.value === savedWizardDraft?.audienceType,
  )
    ? savedWizardDraft!.audienceType!
    : null;
  const fromContacts =
    params.get("source") === "contacts" || seededContactIds.length > 0;
  const queryTemplate = templates.find(
    (template) =>
      template.id === (params.get("template") ?? builderDraft?.document?.templateId),
  );
  const duplicateTemplate = templates.find(
    (template) => template.id === sourceCampaign?.templateId,
  );
  const savedTemplate = templates.find(
    (template) => template.id === savedWizardDraft?.templateId,
  );
  const startingTemplate =
    queryTemplate ?? duplicateTemplate ?? savedTemplate ?? templates[0];
  const savedRecipientCount =
    typeof savedWizardDraft?.recipientCount === "number" &&
    Number.isFinite(savedWizardDraft.recipientCount)
      ? Math.max(0, savedWizardDraft.recipientCount)
      : 0;
  const savedChannels = Array.isArray(savedWizardDraft?.channels)
    ? Array.from(
        new Set(
          savedWizardDraft.channels.filter((value): value is CampaignChannel =>
            campaignChannelDefinitions.some((channel) => channel.id === value),
          ),
        ),
      )
    : undefined;

  const [currentStep, setCurrentStep] = React.useState(() =>
    stepFromQuery(params.get("step")),
  );
  const [campaignName, setCampaignName] = React.useState(
    builderDraft?.campaignName ??
    (sourceCampaign
      ? duplicateId
        ? `${sourceCampaign.name} — копия`
        : sourceCampaign.name
      : params.get("name")?.trim() ||
        (copyRestoredCampaign && savedWizardDraft?.name
          ? `${savedWizardDraft.name} — копия`
          : savedWizardDraft?.name) ||
        "Кампания без названия"),
  );
  const [audienceType, setAudienceType] = React.useState<AudienceType>(() =>
    queryAudienceType ?? savedAudienceType ?? (queryFilter
      ? "custom-filter"
      : querySegment || sourceCampaign?.segmentId
      ? "segment"
      : fromContacts || queryCount > 0 || sourceCampaign
        ? "contacts"
        : "segment"),
  );
  const [selectedSegmentId, setSelectedSegmentId] = React.useState(
    params.get("segment") ??
      querySegment?.id ??
      sourceCampaign?.segmentId ??
      savedWizardDraft?.segmentId ??
      segments[0]?.id ??
      "",
  );
  const [savedListId, setSavedListId] = React.useState(
    savedLists.some((list) => list.id === params.get("savedList"))
      ? params.get("savedList")!
      : savedLists.some((list) => list.id === savedWizardDraft?.savedListId)
        ? savedWizardDraft!.savedListId!
        : savedLists[0].id,
  );
  const [selectedContactIds, setSelectedContactIds] = React.useState<string[]>(
    seededContactIds,
  );
  const [explicitCount, setExplicitCount] = React.useState(
    queryCount ||
      queryCompany?.contactsCount ||
      (sourceCampaign && !sourceCampaign.segmentId
        ? sourceCampaign.metrics.recipients
        : 0) ||
      savedRecipientCount,
  );
  const [excludeUnsubscribed, setExcludeUnsubscribed] = React.useState(
    savedWizardDraft?.excludeUnsubscribed ?? true,
  );
  const [excludeBounced, setExcludeBounced] = React.useState(
    savedWizardDraft?.excludeBounced ?? true,
  );
  const [excludePreviouslyContacted, setExcludePreviouslyContacted] = React.useState(
    savedWizardDraft?.excludePreviouslyContacted ?? false,
  );
  const [selectedChannels, setSelectedChannels] = React.useState<CampaignChannel[]>(
    () =>
      parseCampaignChannels(
        params,
        sourceCampaign?.deliveryChannels ?? savedChannels,
      ),
  );
  const [channelProviders, setChannelProviders] = React.useState<
    Record<CampaignChannel, string>
  >(() => ({
    email: getInitialProvider(
      params,
      "email",
      demoRoutesSnapshot,
      savedWizardDraft?.providers?.email,
    ),
    telegram: getInitialProvider(
      params,
      "telegram",
      demoRoutesSnapshot,
      savedWizardDraft?.providers?.telegram,
    ),
    vk: getInitialProvider(
      params,
      "vk",
      demoRoutesSnapshot,
      savedWizardDraft?.providers?.vk,
    ),
  }));
  const [messengerMessage, setMessengerMessage] = React.useState(
    params.get("message")?.trim() ??
      savedWizardDraft?.messengerMessage ??
      "Здравствуйте, {{first_name}}! Делимся коротким обновлением от нашей команды.",
  );
  const [channelConsentConfirmed, setChannelConsentConfirmed] = React.useState(
    params.get("consent") === "1" ||
      savedWizardDraft?.channelConsentConfirmed === true,
  );
  const [contentMode, setContentMode] = React.useState<ContentMode>(
    sourceCampaign
        ? "duplicate"
        : savedWizardDraft?.contentMode
          ? params.get("template") &&
            params.get("template") !== savedWizardDraft.templateId
            ? "template"
            : savedWizardDraft.contentMode
          : builderDraft
            ? builderDraft.document?.templateId
              ? "template"
              : "scratch"
            : savedWizardDraft
              ? savedTemplate
                ? "template"
                : "scratch"
          : "template",
  );
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(
    savedWizardDraft
      ? templates.find((template) => template.id === params.get("template"))?.id ??
        savedTemplate?.id ??
        ""
      : builderDraft?.document?.templateId ?? startingTemplate?.id ?? "",
  );
  const [selectedDuplicateId, setSelectedDuplicateId] = React.useState(
    sourceCampaign?.id ??
      savedWizardDraft?.duplicateCampaignId ??
      campaigns[0]?.id ??
      "",
  );
  const [senderName, setSenderName] = React.useState(
    sourceCampaign?.senderName ?? savedWizardDraft?.senderName ?? senderProfiles[0].name,
  );
  const [senderEmail, setSenderEmail] = React.useState(
    sourceCampaign?.senderEmail ?? savedWizardDraft?.senderEmail ?? senderProfiles[0].email,
  );
  const [subject, setSubject] = React.useState(
    builderDraft?.document?.subject ??
      sourceCampaign?.subject ??
      savedWizardDraft?.subject ??
      startingTemplate?.subject ??
      "Полезное обновление для {{first_name}}",
  );
  const [previewText, setPreviewText] = React.useState(
    builderDraft?.document?.previewText ??
      sourceCampaign?.previewText ??
      savedWizardDraft?.previewText ??
      startingTemplate?.previewText ??
      "Короткое сообщение от нашей команды.",
  );
  const [sendMode, setSendMode] = React.useState<SendMode>(
    savedWizardDraft?.sendMode === "now" ? "now" : "schedule",
  );
  const [scheduleDate, setScheduleDate] = React.useState(
    savedWizardDraft?.scheduleDate || "2026-08-13",
  );
  const [scheduleTime, setScheduleTime] = React.useState(
    savedWizardDraft?.scheduleTime || "09:00",
  );
  const [submitState, setSubmitState] = React.useState<SubmitState>("idle");
  const [createdCampaignId, setCreatedCampaignId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const submitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId);
  const selectedSavedList = savedLists.find((list) => list.id === savedListId);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const selectedDuplicate = campaigns.find((campaign) => campaign.id === selectedDuplicateId);
  const selectedContacts = contacts.filter((contact) =>
    selectedContactIds.includes(contact.id),
  );

  const recipientCount = (() => {
    if (explicitCount > 0) return explicitCount;
    if (audienceType === "segment") return selectedSegment?.contactCount ?? 0;
    if (audienceType === "saved-list") return selectedSavedList?.count ?? 0;
    if (audienceType === "custom-filter") return 843;
    return selectedContactIds.length;
  })();

  const audienceLabel = (() => {
    if (audienceType === "segment") return selectedSegment?.name ?? "Сегмент не выбран";
    if (audienceType === "saved-list") return selectedSavedList?.name ?? "Список не выбран";
    if (audienceType === "custom-filter") return "Юристы · Москва · Активные";
    if (queryCompany && explicitCount > 0) return `${queryCompany.name}: контакты`;
    if (selectedContacts.length === 1) return selectedContacts[0].fullName;
    return `Выбрано контактов: ${formatNumber(recipientCount)}`;
  })();

  const hasExactChannelCoverage =
    audienceType === "contacts" &&
    selectedContacts.length > 0 &&
    selectedContacts.length === recipientCount;
  const channelCoverage = Object.fromEntries(
    campaignChannelDefinitions.map((channel) => [
      channel.id,
      hasExactChannelCoverage
        ? countReachableContacts(selectedContacts, channel.id)
        : estimateCampaignChannelCoverage(channel.id, recipientCount),
    ]),
  ) as Record<CampaignChannel, number>;
  const channelLabel = selectedChannels
    .map((channel) => getCampaignChannelDefinition(channel).shortLabel)
    .join(" · ");
  const providerLabel = selectedChannels
    .map(
      (channel) =>
        getCampaignChannelProvider(channel, channelProviders[channel])?.label ??
        "Не выбран",
    )
    .join(" · ");

  const selectTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    setSelectedTemplateId(templateId);
    if (template) {
      setSubject(template.subject);
      setPreviewText(template.previewText);
    }
  };

  const selectDuplicate = (campaignId: string) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    setSelectedDuplicateId(campaignId);
    if (campaign) {
      setSelectedTemplateId(campaign.templateId ?? "");
      setSubject(campaign.subject);
      setPreviewText(campaign.previewText);
    }
  };

  const chooseAudienceType = (value: AudienceType) => {
    setAudienceType(value);
    setExplicitCount(0);
    setError(null);
  };

  const toggleContact = (contactId: string) => {
    setExplicitCount(0);
    setSelectedContactIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
    );
  };

  const toggleChannel = (channel: CampaignChannel) => {
    setError(null);
    setSelectedChannels((current) => {
      if (current.includes(channel)) {
        if (current.length === 1) {
          setError("Оставьте хотя бы один канал для кампании.");
          return current;
        }
        return current.filter((item) => item !== channel);
      }
      return [...current, channel];
    });
  };

  const restoredBuilderDocument =
    builderDraft?.document ?? savedWizardDraft?.builderDocument;
  const builderDocument =
    restoredBuilderDocument &&
    (contentMode === "scratch" ||
      contentMode === "ai" ||
      restoredBuilderDocument.templateId === selectedTemplateId)
      ? {
          ...restoredBuilderDocument,
          subject,
          previewText,
        }
      : undefined;

  const wizardSnapshot: SavedCampaignWizardDraft = {
    name: campaignName,
    audienceType,
    segmentId: audienceType === "segment" ? selectedSegmentId : null,
    savedListId,
    companyId: queryCompany?.id ?? null,
    contactIds: selectedContactIds,
    recipientCount,
    contentMode,
    templateId: selectedTemplateId || null,
    duplicateCampaignId: selectedDuplicateId || null,
    senderName,
    senderEmail,
    subject,
    previewText,
    channels: selectedChannels,
    providers: channelProviders,
    messengerMessage,
    channelConsentConfirmed,
    excludeUnsubscribed,
    excludeBounced,
    excludePreviouslyContacted,
    sendMode,
    scheduleDate,
    scheduleTime,
    builderDocument,
  };
  const wizardSnapshotJson = JSON.stringify(wizardSnapshot);

  const persistWizardSnapshot = (storageKey: string) => {
    try {
      window.localStorage.setItem(storageKey, wizardSnapshotJson);
      return true;
    } catch {
      return false;
    }
  };

  React.useEffect(() => {
    if (requestedHandoffToken && !campaignWizardDraftSnapshot) return;
    try {
      window.localStorage.setItem(handoffStorageKey, wizardSnapshotJson);
    } catch {
      // Navigation remains usable with the current in-memory state.
    }
  }, [
    campaignWizardDraftSnapshot,
    handoffStorageKey,
    requestedHandoffToken,
    wizardSnapshotJson,
  ]);

  const editorReturnParams = new URLSearchParams({
    handoff: handoffToken,
    step: "sender",
    builderDraft: "1",
  });
  if (selectedTemplateId) editorReturnParams.set("template", selectedTemplateId);
  const editorQuery = new URLSearchParams({
    campaign: campaignName,
    handoff: handoffToken,
    returnTo: `/campaigns/new?${editorReturnParams.toString()}`,
  });
  if (selectedTemplateId) editorQuery.set("template", selectedTemplateId);
  const editorHref = `/email-builder?${editorQuery.toString()}`;

  const libraryBackParams = new URLSearchParams({
    handoff: handoffToken,
    step: "content",
  });
  if (selectedTemplateId) libraryBackParams.set("template", selectedTemplateId);
  const libraryContinueParams = new URLSearchParams({
    handoff: handoffToken,
    step: "sender",
    builderDraft: "1",
  });
  const libraryQuery = new URLSearchParams({
    campaign: campaignName,
    backTo: `/campaigns/new?${libraryBackParams.toString()}`,
    returnTo: `/campaigns/new?${libraryContinueParams.toString()}`,
  });
  const templateLibraryHref = `/templates?${libraryQuery.toString()}`;

  const validateStep = () => {
    if (currentStep === 0 && recipientCount <= 0) {
      setError("Выберите хотя бы одного получателя.");
      return false;
    }
    if (currentStep === 1) {
      if (selectedChannels.length === 0) {
        setError("Выберите хотя бы один канал.");
        return false;
      }
      if (
        selectedChannels.includes("email") &&
        contentMode === "template" &&
        !selectedTemplateId
      ) {
        setError("Выберите шаблон, чтобы продолжить.");
        return false;
      }
      if (
        selectedChannels.includes("email") &&
        contentMode === "duplicate" &&
        !selectedDuplicateId
      ) {
        setError("Выберите кампанию для дублирования.");
        return false;
      }
      if (
        selectedChannels.some((channel) => channel !== "email") &&
        !messengerMessage.trim()
      ) {
        setError("Добавьте текст для Telegram или ВКонтакте.");
        return false;
      }
      if (
        selectedChannels.some((channel) => channel !== "email") &&
        messengerMessage.length > MESSENGER_MESSAGE_MAX_LENGTH
      ) {
        setError(
          `Сократите текст для мессенджеров до ${formatNumber(MESSENGER_MESSAGE_MAX_LENGTH)} символов.`,
        );
        return false;
      }
    }
    if (currentStep === 2) {
      if (
        selectedChannels.includes("email") &&
        (!senderName.trim() || !/^\S+@\S+\.\S+$/.test(senderEmail))
      ) {
        setError("Укажите имя отправителя и корректный адрес электронной почты.");
        return false;
      }
      if (selectedChannels.includes("email") && !subject.trim()) {
        setError("Добавьте тему письма перед проверкой.");
        return false;
      }
      if (!channelConsentConfirmed) {
        setError(
          "Подтвердите согласие аудитории и наличие идентификаторов для выбранных каналов.",
        );
        return false;
      }
    }
    setError(null);
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setCurrentStep((step) => Math.min(wizardSteps.length - 1, step + 1));
  };

  const goBack = () => {
    setError(null);
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const submitCampaign = () => {
    if (!channelConsentConfirmed) {
      setError(
        "Подтвердите согласие аудитории в настройках провайдеров.",
      );
      return;
    }
    if (
      selectedChannels.some((channel) => channel !== "email") &&
      !messengerMessage.trim()
    ) {
      setError("Добавьте текст для Telegram или ВКонтакте.");
      return;
    }
    if (
      selectedChannels.some((channel) => channel !== "email") &&
      messengerMessage.length > MESSENGER_MESSAGE_MAX_LENGTH
    ) {
      setError(
        `Сократите текст для мессенджеров до ${formatNumber(MESSENGER_MESSAGE_MAX_LENGTH)} символов.`,
      );
      return;
    }
    if (sendMode === "schedule" && (!scheduleDate || !scheduleTime)) {
      setError("Выберите дату и время демоплана кампании.");
      return;
    }
    setError(null);
    setSubmitState("processing");
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    submitTimerRef.current = setTimeout(() => {
      const now = new Date().toISOString();
      const generatedId = `campaign-demo-${Date.now()}`;
      const demoCampaign: Campaign = {
        id: generatedId,
        name: campaignName,
        subject,
        previewText,
        audience: audienceLabel,
        segmentId: audienceType === "segment" ? selectedSegmentId : null,
        templateId: selectedTemplateId || null,
        deliveryChannels: selectedChannels,
        status: "draft",
        senderName,
        senderEmail,
        owner: "Егор Сабалин",
        metrics: createCampaignMetrics({
          recipients: recipientCount,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          replies: 0,
          bounced: 0,
          unsubscribed: 0,
        }),
        createdAt: now,
        scheduledAt: sendMode === "schedule"
          ? new Date(`${scheduleDate}T${scheduleTime}:00+04:00`).toISOString()
          : now,
        sentAt: null,
      };

      try {
        window.localStorage.setItem(`mailflow:campaign:${generatedId}`, JSON.stringify(demoCampaign));
        window.localStorage.setItem("mailflow:last-campaign", JSON.stringify(demoCampaign));
        window.localStorage.setItem(
          `${CAMPAIGN_WIZARD_RESUME_STORAGE_PREFIX}${generatedId}`,
          wizardSnapshotJson,
        );
        const savedCampaigns = (() => {
          try {
            const value = JSON.parse(
              window.localStorage.getItem("mailflow:demo-campaigns") ?? "[]",
            ) as Campaign[];
            return Array.isArray(value) ? value : [];
          } catch {
            return [];
          }
        })();
        window.localStorage.setItem(
          "mailflow:demo-campaigns",
          JSON.stringify([
            demoCampaign,
            ...savedCampaigns.filter((item) => item.id !== generatedId),
          ].slice(0, 20)),
        );
        window.localStorage.setItem(
          `mailflow:campaign-delivery:${generatedId}`,
          JSON.stringify({
            demo: true,
            channels: selectedChannels.map((channel) => ({
              channel,
              provider: channelProviders[channel],
              estimatedCoverage: channelCoverage[channel] ?? 0,
            })),
            messengerMessage,
            consentConfirmed: channelConsentConfirmed,
          }),
        );
        setCreatedCampaignId(generatedId);
      } catch {
        setCreatedCampaignId(
          sendMode === "schedule" ? "campaign-product-brief" : "campaign-legal-conference",
        );
      }
      setSubmitState("success");
    }, 1250);
  };

  const saveDraft = () => {
    persistWizardSnapshot(CAMPAIGN_WIZARD_DRAFT_STORAGE_KEY);
    setNotice("Черновик сохранён");
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2800);
  };

  if (submitState === "success") {
    const detailId = createdCampaignId ??
      (sendMode === "schedule" ? "campaign-product-brief" : "campaign-legal-conference");
    return (
      <div className="mx-auto flex min-h-[min(720px,calc(100vh-150px))] max-w-2xl items-center justify-center py-8">
        <section className="card w-full overflow-hidden text-center">
          <div className="bg-[radial-gradient(circle_at_top,var(--primary-subtle),transparent_68%)] px-6 py-10 sm:px-10 sm:py-14">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-subtle text-success ring-8 ring-success-subtle/45">
              <CheckCircle2 aria-hidden="true" className="size-7" />
            </span>
            <Badge variant="accent" className="mt-6">
              Демозапуск создан
            </Badge>
            <h1 className="mt-3 mb-0 text-[25px] font-semibold tracking-[-0.035em] text-text-strong sm:text-[29px]">
              План кампании сохранён
            </h1>
            <p className="mx-auto mt-2 mb-0 max-w-md text-[13px] leading-5 text-text-muted">
              Ни одно письмо или сообщение не отправлено. Кампания «{campaignName}»
              сохранена как демонстрационный план на {formatNumber(recipientCount)} контактов.
              Реальный запуск станет доступен после подключения выбранных провайдеров.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <Link href="/campaigns" className={buttonVariants({ variant: "secondary" })}>
                Все кампании
              </Link>
              <Link
                href={`/campaigns/${detailId}`}
                className={buttonVariants({ variant: "primary" })}
              >
                Открыть кампанию
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
          <div className="grid border-t border-border bg-surface-subtle/45 sm:grid-cols-3">
            {[
              ["Аудитория", audienceLabel],
              ["Каналы", channelLabel],
              ["Статус", "Ожидает подключения"],
            ].map(([label, value]) => (
              <div key={label} className="border-b border-border p-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
                <p className="m-0 text-[10px] font-medium text-text-subtle">{label}</p>
                <p className="mt-1 mb-0 truncate text-[12px] font-semibold text-text-strong">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl pb-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/campaigns"
            className="mb-3 inline-flex items-center gap-1.5 rounded-md text-[11px] font-medium text-text-muted hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Кампании
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[25px] font-semibold tracking-[-0.035em] text-text-strong sm:text-[29px]">
              Создание кампании
            </h1>
            <Badge variant="accent">Деморежим</Badge>
          </div>
          <p className="mt-1.5 mb-0 text-[13px] text-text-muted">
            Настройте единую кампанию для email, Telegram и ВКонтакте.
          </p>
        </div>
        <Button
          variant="secondary"
          leadingIcon={<Save className="size-4" />}
          onClick={saveDraft}
          disabled={submitState === "processing"}
        >
          Сохранить черновик
        </Button>
      </header>

      <section className="card mb-5 px-4 py-5 sm:px-7" aria-label="Ход настройки кампании">
        <Stepper
          steps={wizardSteps.map(({ label, description }) => ({ label, description }))}
          currentStep={currentStep}
          aria-label="Ход настройки кампании"
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card min-w-0 p-5 sm:p-7">
          {currentStep === 0 && (
            <AudienceStep
              audienceType={audienceType}
              onAudienceTypeChange={chooseAudienceType}
              selectedSegmentId={selectedSegmentId}
              onSegmentChange={(id) => {
                setSelectedSegmentId(id);
                setExplicitCount(0);
              }}
              savedListId={savedListId}
              onSavedListChange={(id) => {
                setSavedListId(id);
                setExplicitCount(0);
              }}
              selectedContactIds={selectedContactIds}
              onToggleContact={toggleContact}
              explicitCount={explicitCount}
              excludeUnsubscribed={excludeUnsubscribed}
              excludeBounced={excludeBounced}
              excludePreviouslyContacted={excludePreviouslyContacted}
              onExcludeUnsubscribed={setExcludeUnsubscribed}
              onExcludeBounced={setExcludeBounced}
              onExcludePreviouslyContacted={setExcludePreviouslyContacted}
            />
          )}
          {currentStep === 1 && (
            <ContentStep
              selectedChannels={selectedChannels}
              onToggleChannel={toggleChannel}
              recipientCount={recipientCount}
              channelCoverage={channelCoverage}
              coverageIsExact={hasExactChannelCoverage}
              messengerMessage={messengerMessage}
              onMessengerMessageChange={setMessengerMessage}
              contentMode={contentMode}
              onContentModeChange={(value) => {
                setContentMode(value);
                setError(null);
                if (value === "scratch" || value === "ai") setSelectedTemplateId("");
              }}
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={selectTemplate}
              selectedDuplicateId={selectedDuplicateId}
              onDuplicateChange={selectDuplicate}
              subject={subject}
              setSubject={setSubject}
              previewText={previewText}
              setPreviewText={setPreviewText}
              editorHref={editorHref}
              templateLibraryHref={templateLibraryHref}
              onBeforeEditorNavigation={() =>
                persistWizardSnapshot(handoffStorageKey)
              }
            />
          )}
          {currentStep === 2 && (
            <SenderStep
              selectedChannels={selectedChannels}
              channelProviders={channelProviders}
              onProviderChange={(channel, provider) =>
                setChannelProviders((current) => ({
                  ...current,
                  [channel]: provider,
                }))
              }
              channelCoverage={channelCoverage}
              recipientCount={recipientCount}
              channelConsentConfirmed={channelConsentConfirmed}
              onChannelConsentConfirmedChange={setChannelConsentConfirmed}
              senderName={senderName}
              senderEmail={senderEmail}
              subject={subject}
              previewText={previewText}
              onSenderNameChange={setSenderName}
              onSenderEmailChange={setSenderEmail}
              onSubjectChange={setSubject}
              onPreviewTextChange={setPreviewText}
              editorHref={editorHref}
              onBeforeEditorNavigation={() =>
                persistWizardSnapshot(handoffStorageKey)
              }
            />
          )}
          {currentStep === 3 && (
            <ReviewStep
              campaignName={campaignName}
              setCampaignName={setCampaignName}
              audienceLabel={audienceLabel}
              recipientCount={recipientCount}
              contentLabel={
                contentMode === "template"
                  ? selectedTemplate?.name ?? "Шаблон"
                  : contentMode === "duplicate"
                    ? selectedDuplicate?.name ?? "Дублированная кампания"
                    : contentMode === "ai"
                      ? "Черновик с ИИ"
                      : "Собственное письмо"
              }
              senderName={senderName}
              senderEmail={senderEmail}
              subject={subject}
              selectedChannels={selectedChannels}
              channelProviders={channelProviders}
              channelCoverage={channelCoverage}
              messengerMessage={messengerMessage}
              channelConsentConfirmed={channelConsentConfirmed}
              exclusions={{
                unsubscribed: excludeUnsubscribed,
                bounced: excludeBounced,
                previouslyContacted: excludePreviouslyContacted,
              }}
              sendMode={sendMode}
              onSendModeChange={setSendMode}
              scheduleDate={scheduleDate}
              scheduleTime={scheduleTime}
              onScheduleDateChange={setScheduleDate}
              onScheduleTimeChange={setScheduleTime}
            />
          )}

          {error && (
            <Alert tone="danger" title="Перед продолжением" className="mt-5">
              {error}
            </Alert>
          )}

          <footer className="mt-7 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {currentStep === 0 ? (
              <Link href="/campaigns" className={buttonVariants({ variant: "ghost" })}>
                Отменить
              </Link>
            ) : (
              <Button variant="ghost" leadingIcon={<ArrowLeft className="size-4" />} onClick={goBack}>
                Назад
              </Button>
            )}
            {currentStep < wizardSteps.length - 1 ? (
              <Button trailingIcon={<ArrowRight className="size-4" />} onClick={goNext}>
                Далее: {wizardSteps[currentStep + 1]?.label}
              </Button>
            ) : (
              <Button
                loading={submitState === "processing"}
                loadingText="Сохраняем демоплан…"
                leadingIcon={
                  sendMode === "schedule" ? (
                    <CalendarClock className="size-4" />
                  ) : (
                    <Send className="size-4" />
                  )
                }
                onClick={submitCampaign}
              >
                {sendMode === "schedule" ? "Создать демоплан" : "Сохранить демозапуск"}
              </Button>
            )}
          </footer>
        </section>

        <aside className="card p-5 xl:sticky xl:top-5" aria-label="Сводка кампании">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-[13px] font-semibold text-text-strong">Сводка кампании</h2>
            <Badge variant={recipientCount > 0 ? "success" : "warning"} dot>
              {recipientCount > 0 ? "Готово" : "Не завершено"}
            </Badge>
          </div>
          <dl className="mt-5 grid gap-4">
            <SummaryItem icon={<UsersRound className="size-3.5" />} label="Аудитория" value={audienceLabel} />
            <SummaryItem
              icon={<Cable className="size-3.5" />}
              label="Каналы"
              value={channelLabel}
            />
            <SummaryItem icon={<ShieldCheck className="size-3.5" />} label="Провайдеры" value={providerLabel} />
          </dl>
          <div className="mt-5 rounded-[11px] bg-primary-subtle/55 p-4">
            <p className="m-0 text-[10px] font-medium text-primary">Получателей</p>
            <p className="mt-1 mb-0 text-[25px] font-semibold tracking-[-0.04em] text-text-strong">
              {formatNumber(recipientCount)}
            </p>
            <p className="mt-1 mb-0 text-[10px] leading-4 text-text-muted">
              Охват по каналам проверяется отдельно по email, chat_id и VK ID.
            </p>
          </div>
        </aside>
      </div>

      {notice && (
        <div className="fixed right-4 bottom-4 z-[170] w-[min(340px,calc(100vw-32px))]">
          <ToastSurface
            tone="success"
            title={notice}
            description="Настройки кампании сохранены для текущей демонстрационной сессии."
            onDismiss={() => setNotice(null)}
          />
        </div>
      )}
    </div>
  );
}

function AudienceStep({
  audienceType,
  onAudienceTypeChange,
  selectedSegmentId,
  onSegmentChange,
  savedListId,
  onSavedListChange,
  selectedContactIds,
  onToggleContact,
  explicitCount,
  excludeUnsubscribed,
  excludeBounced,
  excludePreviouslyContacted,
  onExcludeUnsubscribed,
  onExcludeBounced,
  onExcludePreviouslyContacted,
}: {
  audienceType: AudienceType;
  onAudienceTypeChange: (value: AudienceType) => void;
  selectedSegmentId: string;
  onSegmentChange: (value: string) => void;
  savedListId: string;
  onSavedListChange: (value: string) => void;
  selectedContactIds: string[];
  onToggleContact: (id: string) => void;
  explicitCount: number;
  excludeUnsubscribed: boolean;
  excludeBounced: boolean;
  excludePreviouslyContacted: boolean;
  onExcludeUnsubscribed: (value: boolean) => void;
  onExcludeBounced: (value: boolean) => void;
  onExcludePreviouslyContacted: (value: boolean) => void;
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Шаг 1"
        title="Кто должен получить эту кампанию?"
        description="Выберите готовую аудиторию или используйте контакты из базы."
      />
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {audienceOptions.map(({ value, label, description, icon: Icon }) => {
          const selected = audienceType === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => onAudienceTypeChange(value)}
              className={cn(
                "flex items-start gap-3 rounded-[11px] border p-3.5 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                selected
                  ? "border-primary/35 bg-primary-subtle/45 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
                  : "border-border hover:border-border-strong hover:bg-surface-subtle/55",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-[9px]",
                  selected ? "bg-primary text-white" : "bg-surface-subtle text-text-muted",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[12px] font-semibold text-text-strong">
                  {label}
                  {selected && <Check aria-hidden="true" className="size-3.5 text-primary" />}
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-text-muted">
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[12px] border border-border bg-surface-subtle/35 p-4">
        {audienceType === "segment" && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-[12px] font-semibold text-text-strong">Выберите сегмент</h3>
                <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Количество обновляется при изменении правил сегмента.</p>
              </div>
              <Badge variant="accent">Динамический</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {segments.slice(0, 6).map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  aria-pressed={selectedSegmentId === segment.id}
                  onClick={() => onSegmentChange(segment.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[9px] border bg-surface p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                    selectedSegmentId === segment.id
                      ? "border-primary/35"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-text-strong">{segment.name}</span>
                    <span className="mt-0.5 block text-[9px] text-text-muted">
                      Контактов: {formatNumber(segment.contactCount)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border",
                      selectedSegmentId === segment.id
                        ? "border-primary bg-primary text-white"
                        : "border-border-strong",
                    )}
                  >
                    {selectedSegmentId === segment.id && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {audienceType === "saved-list" && (
          <FormField label="Сохранённый список" htmlFor="campaign-saved-list">
            <Select
              id="campaign-saved-list"
              value={savedListId}
              onChange={(event) => onSavedListChange(event.target.value)}
              options={savedLists.map((list) => ({
                value: list.id,
                label: `${list.name} — контактов: ${formatNumber(list.count)}`,
              }))}
            />
          </FormField>
        )}

        {audienceType === "custom-filter" && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="font-semibold text-text-muted">ГДЕ</span>
              {[
                ["Должность", "равно", "Юрист"],
                ["Город", "равно", "Москва"],
                ["Статус", "равно", "Активный"],
              ].map((rule, index) => (
                <React.Fragment key={rule[0]}>
                  {index > 0 && <Badge variant="accent">И</Badge>}
                  <span className="rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-text">
                    {rule.join(" · ")}
                  </span>
                </React.Fragment>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div>
                <p className="m-0 text-[10px] text-text-muted">Подходящая аудитория</p>
                <p className="mt-0.5 mb-0 text-[17px] font-semibold text-text-strong">843 контакта</p>
              </div>
              <Link href="/contacts?filter=lawyers-moscow-active" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Изменить в контактах
              </Link>
            </div>
          </div>
        )}

        {audienceType === "contacts" && (
          <div>
            {explicitCount > 0 && selectedContactIds.length === 0 && (
              <Alert tone="info" title={`Получено из контактов: ${formatNumber(explicitCount)}`}>
                Выбранная группа контактов добавлена в эту кампанию.
              </Alert>
            )}
            <p className={cn("mb-2 text-[10px] text-text-muted", explicitCount > 0 && "mt-4")}>
              Добавьте или удалите отдельные контакты
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {contacts.slice(0, 6).map((contact) => {
                const selected = selectedContactIds.includes(contact.id);
                return (
                  <button
                    key={contact.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onToggleContact(contact.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[9px] border bg-surface p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                      selected ? "border-primary/35 bg-primary-subtle/25" : "border-border hover:border-border-strong",
                    )}
                  >
                    <span
                      className="grid size-7 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: contact.avatarColor }}
                    >
                      {contact.firstName[0]}
                      {contact.lastName[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-semibold text-text-strong">{contact.fullName}</span>
                      <span className="block truncate text-[9px] text-text-muted">{contact.email}</span>
                    </span>
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-[5px] border",
                        selected ? "border-primary bg-primary text-white" : "border-border-strong",
                      )}
                    >
                      {selected && <Check className="size-2.5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="m-0 text-[12px] font-semibold text-text-strong">Защита аудитории</h3>
        <p className="mt-1 mb-4 text-[10px] text-text-muted">Эти проверки повторятся непосредственно перед отправкой.</p>
        <div className="grid gap-4">
          <ProtectionToggle
            label="Исключить отписавшихся"
            description="Обязательно для каждой кампании"
            checked={excludeUnsubscribed}
            onCheckedChange={onExcludeUnsubscribed}
          />
          <ProtectionToggle
            label="Исключить недоставляемые адреса"
            description="Защищает репутацию отправителя"
            checked={excludeBounced}
            onCheckedChange={onExcludeBounced}
          />
          <ProtectionToggle
            label="Исключить недавних получателей"
            description="Не отправлять тем, кто получал письма за последние 14 дней"
            checked={excludePreviouslyContacted}
            onCheckedChange={onExcludePreviouslyContacted}
          />
        </div>
      </div>
    </div>
  );
}

function ContentStep({
  selectedChannels,
  onToggleChannel,
  recipientCount,
  channelCoverage,
  coverageIsExact,
  messengerMessage,
  onMessengerMessageChange,
  contentMode,
  onContentModeChange,
  selectedTemplateId,
  onTemplateChange,
  selectedDuplicateId,
  onDuplicateChange,
  subject,
  setSubject,
  previewText,
  setPreviewText,
  editorHref,
  templateLibraryHref,
  onBeforeEditorNavigation,
}: {
  selectedChannels: CampaignChannel[];
  onToggleChannel: (channel: CampaignChannel) => void;
  recipientCount: number;
  channelCoverage: Partial<Record<CampaignChannel, number>>;
  coverageIsExact: boolean;
  messengerMessage: string;
  onMessengerMessageChange: (value: string) => void;
  contentMode: ContentMode;
  onContentModeChange: (value: ContentMode) => void;
  selectedTemplateId: string;
  onTemplateChange: (value: string) => void;
  selectedDuplicateId: string;
  onDuplicateChange: (value: string) => void;
  subject: string;
  setSubject: (value: string) => void;
  previewText: string;
  setPreviewText: (value: string) => void;
  editorHref: string;
  templateLibraryHref: string;
  onBeforeEditorNavigation: () => void;
}) {
  const [aiGenerated, setAiGenerated] = React.useState(false);
  return (
    <div>
      <StepHeading
        eyebrow="Шаг 2"
        title="Где и что отправить?"
        description="Выберите один или несколько каналов. Один контакт может получить разные версии сообщения."
      />
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {campaignChannelDefinitions.map((channel) => {
          const selected = selectedChannels.includes(channel.id);
          const Icon = channelIcons[channel.id];
          const coverage = channelCoverage[channel.id] ?? 0;
          return (
            <button
              key={channel.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggleChannel(channel.id)}
              className={cn(
                "rounded-[11px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                selected
                  ? "border-primary/35 bg-primary-subtle/40"
                  : "border-border hover:border-border-strong hover:bg-surface-subtle/55",
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-[10px]",
                    selected ? "bg-primary text-white" : "bg-surface-subtle text-text-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border",
                    selected
                      ? "border-primary bg-primary text-white"
                      : "border-border-strong bg-surface",
                  )}
                >
                  {selected && <Check aria-hidden="true" className="size-3" strokeWidth={3} />}
                </span>
              </span>
              <span className="mt-3 block text-[12px] font-semibold text-text-strong">
                {channel.label}
              </span>
              <span className="mt-1 block min-h-8 text-[9px] leading-4 text-text-muted">
                {channel.description}
              </span>
              <span className="mt-2 block text-[9px] font-medium text-text">
                Нужно: {channel.identityLabel}
              </span>
              <span className="mt-3 flex items-center justify-between gap-2 border-t border-border/80 pt-3 text-[9px]">
                <span className="text-text-subtle">
                  {coverageIsExact ? "Точный охват" : "Охват в демобазе"}
                </span>
                <span className="font-semibold text-text-strong">
                  {formatNumber(coverage)} / {formatNumber(recipientCount)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Alert
        tone="info"
        title={coverageIsExact ? "Охват проверен по выбранным контактам" : "Охват показан как демооценка"}
        className="mt-4"
      >
        {coverageIsExact
          ? "Учтены активные email, сохранённые Telegram chat_id и разрешения на сообщения ВК."
          : `После синхронизации контактов ${BRAND_NAME} пересчитает точный охват по email, Telegram chat_id и VK ID с учётом разрешений.`}
      </Alert>

      {selectedChannels.includes("email") && (
        <div className="mt-7 border-t border-border pt-6">
          <div className="mb-3">
            <h3 className="m-0 text-[13px] font-semibold text-text-strong">Письмо</h3>
            <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Выберите основу и сохраните персонализацию.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
        {contentOptions.map(({ value, label, description, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={contentMode === value}
            onClick={() => onContentModeChange(value)}
            className={cn(
              "flex items-start gap-3 rounded-[11px] border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
              contentMode === value
                ? "border-primary/35 bg-primary-subtle/40"
                : "border-border hover:border-border-strong hover:bg-surface-subtle/55",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-[9px]",
                contentMode === value ? "bg-primary text-white" : "bg-surface-subtle text-text-muted",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span>
              <span className="block text-[12px] font-semibold text-text-strong">{label}</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-text-muted">{description}</span>
            </span>
          </button>
        ))}
          </div>
        </div>
      )}

      {selectedChannels.includes("email") && contentMode === "template" && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-[12px] font-semibold text-text-strong">Выберите шаблон</h3>
              <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Каждый блок можно редактировать.</p>
            </div>
            <Link
              href={templateLibraryHref}
              onClick={onBeforeEditorNavigation}
              className="text-[10px] font-semibold text-primary hover:text-primary-hover"
            >
              Открыть библиотеку
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.slice(0, 6).map((template) => (
              <TemplateChoice
                key={template.id}
                template={template}
                selected={selectedTemplateId === template.id}
                onSelect={() => onTemplateChange(template.id)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedChannels.includes("email") && contentMode === "duplicate" && (
        <div className="mt-6 grid gap-2">
          {campaigns.slice(0, 5).map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              onClick={() => onDuplicateChange(campaign.id)}
              aria-pressed={selectedDuplicateId === campaign.id}
              className={cn(
                "flex items-center justify-between gap-4 rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                selectedDuplicateId === campaign.id
                  ? "border-primary/35 bg-primary-subtle/35"
                  : "border-border hover:border-border-strong",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-text-strong">{campaign.name}</span>
                <span className="mt-0.5 block truncate text-[9px] text-text-muted">{campaign.subject}</span>
              </span>
              <Badge variant={selectedDuplicateId === campaign.id ? "accent" : "neutral"}>
                {campaignStatusLabels[campaign.status]}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {selectedChannels.includes("email") && (contentMode === "scratch" || contentMode === "ai") && (
        <div className="mt-6 rounded-[12px] border border-border bg-surface-subtle/40 p-4">
          {contentMode === "ai" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-[12px] font-semibold text-text-strong">Черновик с ИИ {BRAND_NAME}</h3>
                <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Краткий первый вариант с учётом выбранной аудитории.</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                leadingIcon={<Bot className="size-3.5" />}
                onClick={() => {
                  setSubject("Персональное приглашение для {{company}}");
                  setPreviewText("Одна веская причина присоединиться к обсуждению в сентябре.");
                  setAiGenerated(true);
                }}
              >
                {aiGenerated ? "Создать заново" : "Создать черновик"}
              </Button>
            </div>
          )}
          <div className="grid gap-4">
            <FormField label="Тема письма" htmlFor="content-subject">
              <Input id="content-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            </FormField>
            <FormField label="Текст предпросмотра" htmlFor="content-preview">
              <Input id="content-preview" value={previewText} onChange={(event) => setPreviewText(event.target.value)} />
            </FormField>
          </div>
        </div>
      )}

      {selectedChannels.includes("email") && <div className="mt-6 flex flex-col gap-3 rounded-[12px] border border-primary/15 bg-primary-subtle/35 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-white">
            <PencilLine aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="m-0 text-[11px] font-semibold text-text-strong">Готовы доработать письмо?</p>
            <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Откройте редактор, а затем вернитесь к выбору отправителя.</p>
          </div>
        </div>
        <a
          href={editorHref}
          onClick={onBeforeEditorNavigation}
          className={buttonVariants({ variant: "primary", size: "sm" })}
        >
          Открыть редактор писем
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </a>
      </div>}

      {selectedChannels.some((channel) => channel !== "email") && (
        <div className="mt-7 border-t border-border pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-[13px] font-semibold text-text-strong">
                Текст для {selectedChannels.filter((channel) => channel !== "email").map((channel) => getCampaignChannelDefinition(channel).shortLabel).join(" и ")}
              </h3>
              <p className="mt-0.5 mb-0 text-[10px] text-text-muted">
                Общая текстовая версия. Переменные {"{{first_name}}"} и {"{{company}}"} сохранятся.
              </p>
            </div>
            <Badge variant="accent">Деморежим</Badge>
          </div>
          <FormField
            label="Сообщение"
            htmlFor="messenger-message"
            hint={`${formatNumber(messengerMessage.length)} / ${formatNumber(MESSENGER_MESSAGE_MAX_LENGTH)} символов`}
            className="mt-4"
          >
            <Textarea
              id="messenger-message"
              rows={6}
              maxLength={MESSENGER_MESSAGE_MAX_LENGTH}
              value={messengerMessage}
              onChange={(event) => onMessengerMessageChange(event.target.value)}
              placeholder="Напишите короткое сообщение…"
            />
          </FormField>
          <div className="mt-3 flex items-start gap-3 rounded-[10px] border border-border bg-surface-subtle/40 p-3.5">
            <MessageCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="m-0 text-[10px] font-semibold text-text-strong">Предпросмотр сообщения</p>
              <p className="mt-1 mb-0 whitespace-pre-wrap text-[10px] leading-5 text-text-muted">
                {messengerMessage || "Здесь появится текст для мессенджеров."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SenderStep({
  selectedChannels,
  channelProviders,
  onProviderChange,
  channelCoverage,
  recipientCount,
  channelConsentConfirmed,
  onChannelConsentConfirmedChange,
  senderName,
  senderEmail,
  subject,
  previewText,
  onSenderNameChange,
  onSenderEmailChange,
  onSubjectChange,
  onPreviewTextChange,
  editorHref,
  onBeforeEditorNavigation,
}: {
  selectedChannels: CampaignChannel[];
  channelProviders: Record<CampaignChannel, string>;
  onProviderChange: (channel: CampaignChannel, provider: string) => void;
  channelCoverage: Partial<Record<CampaignChannel, number>>;
  recipientCount: number;
  channelConsentConfirmed: boolean;
  onChannelConsentConfirmedChange: (value: boolean) => void;
  senderName: string;
  senderEmail: string;
  subject: string;
  previewText: string;
  onSenderNameChange: (value: string) => void;
  onSenderEmailChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onPreviewTextChange: (value: string) => void;
  editorHref: string;
  onBeforeEditorNavigation: () => void;
}) {
  const consentStatements = [
    selectedChannels.includes("email")
      ? "Подтверждаю законное основание для email-рассылки и исключение отписавшихся контактов."
      : null,
    selectedChannels.includes("telegram")
      ? "Для Telegram сохранены chat_id и разрешение боту."
      : null,
    selectedChannels.includes("vk")
      ? "Для ВКонтакте сохранены VK ID и разрешение сообществу."
      : null,
  ].filter((statement): statement is string => Boolean(statement));
  const consentDescription = `${consentStatements.join(" ")} Недоступные контакты исключаются отдельно по каждому выбранному каналу.`;

  return (
    <div>
      <StepHeading
        eyebrow="Шаг 3"
        title="Через какие платформы отправить?"
        description="Выберите провайдера для каждого канала. В деморежиме ключи и внешние API не используются."
      />

      <div className="mt-6 grid gap-3">
        {selectedChannels.map((channelId) => {
          const channel = getCampaignChannelDefinition(channelId);
          const Icon = channelIcons[channelId];
          const provider = getCampaignChannelProvider(
            channelId,
            channelProviders[channelId],
          );
          return (
            <div key={channelId} className="rounded-[12px] border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-subtle text-primary">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div>
                    <h3 className="m-0 text-[12px] font-semibold text-text-strong">
                      {channel.label}
                    </h3>
                    <p className="mt-0.5 mb-0 text-[9px] text-text-muted">
                      Доступно контактов: {formatNumber(channelCoverage[channelId] ?? 0)} из {formatNumber(recipientCount)}
                    </p>
                  </div>
                </div>
                <Badge variant="warning" dot>Не подключён</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
                <FormField label="Провайдер" htmlFor={`channel-provider-${channelId}`}>
                  <Select
                    id={`channel-provider-${channelId}`}
                    value={channelProviders[channelId]}
                    onChange={(event) => onProviderChange(channelId, event.target.value)}
                    options={campaignChannelProviders[channelId].map((item) => ({
                      value: item.id,
                      label: item.label,
                    }))}
                  />
                </FormField>
                <div className="rounded-[9px] bg-surface-subtle/55 px-3 py-2.5">
                  <p className="m-0 text-[9px] font-medium text-text-strong">
                    {provider?.description}
                  </p>
                  {channelId === "email" && channelProviders[channelId] === "vk-workspace" && (
                    <p className="mt-1 mb-0 text-[9px] leading-4 text-text-muted">
                      В мастере маршрут работает через SMTP только после серверного подключения.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 border-t border-border pt-3">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <p className="m-0 text-[9px] leading-4 text-text-muted">{channel.consentHint}</p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedChannels.includes("email") && <div className="mt-7 border-t border-border pt-6">
        <div className="mb-3">
          <h3 className="m-0 text-[13px] font-semibold text-text-strong">Отправитель email</h3>
          <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Выберите проверенный адрес и проверьте вид письма.</p>
        </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {senderProfiles.map((profile) => {
          const selected = senderEmail === profile.email;
          return (
            <button
              key={profile.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onSenderNameChange(profile.name);
                onSenderEmailChange(profile.email);
              }}
              className={cn(
                "flex items-center gap-3 rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                selected ? "border-primary/35 bg-primary-subtle/35" : "border-border hover:border-border-strong",
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-[10px] font-semibold text-primary">
                {profile.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-text-strong">{profile.name}</span>
                <span className="block truncate text-[9px] text-text-muted">{profile.email}</span>
              </span>
              {selected && <CheckCircle2 aria-hidden="true" className="size-4 text-success" />}
            </button>
          );
        })}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FormField label="Имя отправителя" htmlFor="sender-name" required>
          <Input id="sender-name" value={senderName} onChange={(event) => onSenderNameChange(event.target.value)} />
        </FormField>
        <FormField label="Адрес отправителя" htmlFor="sender-email" required hint="Проверенный домен отправки">
          <Input id="sender-email" type="email" value={senderEmail} onChange={(event) => onSenderEmailChange(event.target.value)} />
        </FormField>
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="m-0 text-[12px] font-semibold text-text-strong">Предпросмотр во входящих</h3>
            <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Проверьте тему и текст предпросмотра.</p>
          </div>
          <a
            href={editorHref}
            onClick={onBeforeEditorNavigation}
            className="text-[10px] font-semibold text-primary hover:text-primary-hover"
          >
            Изменить содержимое письма
          </a>
        </div>
        <div className="mt-4 grid gap-4">
          <FormField label="Тема письма" htmlFor="sender-subject" required>
            <Input id="sender-subject" value={subject} onChange={(event) => onSubjectChange(event.target.value)} />
          </FormField>
          <FormField label="Текст предпросмотра" htmlFor="sender-preview">
            <Input id="sender-preview" value={previewText} onChange={(event) => onPreviewTextChange(event.target.value)} />
          </FormField>
        </div>
        <div className="mt-4 rounded-[10px] border border-border bg-surface-subtle/45 p-3.5">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-white">
              {senderName
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("") || "MF"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 truncate text-[11px] font-semibold text-text-strong">{senderName || "Отправитель"}</p>
                <span className="text-[9px] text-text-subtle">09:41</span>
              </div>
              <p className="mt-0.5 mb-0 truncate text-[10px] font-medium text-text">{subject || "Тема вашего письма"}</p>
              <p className="mt-0.5 mb-0 truncate text-[9px] text-text-muted">{previewText || "Здесь появится текст предпросмотра."}</p>
            </div>
          </div>
        </div>
      </div>
      </div>}

      <div className="mt-6 rounded-[11px] border border-primary/15 bg-primary-subtle/35 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="m-0 text-[11px] font-semibold text-text-strong">
              Согласия и доступность проверены
            </p>
            <p className="mt-1 mb-0 max-w-2xl text-[9px] leading-4 text-text-muted">
              {consentDescription}
            </p>
          </div>
          <Switch
            checked={channelConsentConfirmed}
            onCheckedChange={onChannelConsentConfirmedChange}
            label="Подтвердить согласие"
          />
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  campaignName,
  setCampaignName,
  audienceLabel,
  recipientCount,
  contentLabel,
  senderName,
  senderEmail,
  subject,
  selectedChannels,
  channelProviders,
  channelCoverage,
  messengerMessage,
  channelConsentConfirmed,
  exclusions,
  sendMode,
  onSendModeChange,
  scheduleDate,
  scheduleTime,
  onScheduleDateChange,
  onScheduleTimeChange,
}: {
  campaignName: string;
  setCampaignName: (value: string) => void;
  audienceLabel: string;
  recipientCount: number;
  contentLabel: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  selectedChannels: CampaignChannel[];
  channelProviders: Record<CampaignChannel, string>;
  channelCoverage: Partial<Record<CampaignChannel, number>>;
  messengerMessage: string;
  channelConsentConfirmed: boolean;
  exclusions: { unsubscribed: boolean; bounced: boolean; previouslyContacted: boolean };
  sendMode: SendMode;
  onSendModeChange: (value: SendMode) => void;
  scheduleDate: string;
  scheduleTime: string;
  onScheduleDateChange: (value: string) => void;
  onScheduleTimeChange: (value: string) => void;
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Шаг 4"
        title="Проверьте перед запуском"
        description="Проверьте аудиторию, каналы и время. В деморежиме ни одно письмо или сообщение не отправляется."
      />
      <div className="mt-6">
        <FormField label="Название кампании" htmlFor="review-campaign-name" required>
          <Input id="review-campaign-name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
        </FormField>
      </div>
      <div className="mt-5 divide-y divide-border rounded-[12px] border border-border">
        <ReviewRow icon={<UsersRound className="size-4" />} label="Аудитория" value={audienceLabel} meta={`Получателей: ${formatNumber(recipientCount)}`} />
        <ReviewRow
          icon={<Cable className="size-4" />}
          label="Каналы и охват"
          value={selectedChannels.map((channel) => getCampaignChannelDefinition(channel).shortLabel).join(" · ")}
          meta={selectedChannels.map((channel) => `${getCampaignChannelDefinition(channel).shortLabel}: ${formatNumber(channelCoverage[channel] ?? 0)}`).join(" · ")}
        />
        <ReviewRow
          icon={<ShieldCheck className="size-4" />}
          label="Провайдеры"
          value={selectedChannels.map((channel) => getCampaignChannelProvider(channel, channelProviders[channel])?.label ?? "Не выбран").join(" · ")}
          meta="Деморежим: учётные данные не подключены"
        />
        {selectedChannels.includes("email") && (
          <ReviewRow icon={<MailCheck className="size-4" />} label="Письмо" value={contentLabel} meta={subject} />
        )}
        {selectedChannels.some((channel) => channel !== "email") && (
          <ReviewRow
            icon={<MessageCircle className="size-4" />}
            label="Сообщение для мессенджеров"
            value={
              messengerMessage.trim().length > 96
                ? `${messengerMessage.trim().slice(0, 93)}…`
                : messengerMessage.trim() || "Текст не задан"
            }
            meta={`${messengerMessage.length} символов`}
          />
        )}
        {selectedChannels.includes("email") && (
          <ReviewRow icon={<UserRound className="size-4" />} label="Отправитель email" value={senderName} meta={senderEmail} />
        )}
      </div>

      <div className="mt-6">
        <h3 className="m-0 text-[12px] font-semibold text-text-strong">Режим демозапуска</h3>
        <p className="mt-1 mb-3 text-[10px] text-text-muted">Выберите, когда {BRAND_NAME} должен создать план обработки получателей.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "now" as const, label: "Создать сейчас", description: "Сохранить демоплан сразу", icon: Send },
            { value: "schedule" as const, label: "Запланировать демо", description: "Выбрать дату и время плана", icon: CalendarClock },
          ].map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={sendMode === value}
              onClick={() => onSendModeChange(value)}
              className={cn(
                "flex items-start gap-3 rounded-[10px] border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                sendMode === value ? "border-primary/35 bg-primary-subtle/35" : "border-border hover:border-border-strong",
              )}
            >
              <span className={cn("grid size-8 place-items-center rounded-[9px]", sendMode === value ? "bg-primary text-white" : "bg-surface-subtle text-text-muted")}>
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-text-strong">{label}</span>
                <span className="mt-0.5 block text-[9px] text-text-muted">{description}</span>
              </span>
            </button>
          ))}
        </div>
        {sendMode === "schedule" && (
          <div className="mt-3 grid gap-3 rounded-[10px] border border-border bg-surface-subtle/35 p-4 sm:grid-cols-2">
            <FormField label="Дата" htmlFor="schedule-date">
              <Input id="schedule-date" type="date" min="2026-08-12" value={scheduleDate} onChange={(event) => onScheduleDateChange(event.target.value)} />
            </FormField>
            <FormField label="Время" htmlFor="schedule-time" hint="Саратов (UTC+4)">
              <Input id="schedule-time" type="time" value={scheduleTime} onChange={(event) => onScheduleTimeChange(event.target.value)} />
            </FormField>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-[11px] border border-warning/15 bg-warning-subtle/55 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-warning">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Конфигурация готова к демозапуску
        </div>
        <ul className="mt-3 grid gap-2 text-[10px] text-text sm:grid-cols-2">
          <li className="flex items-center gap-2"><Check className="size-3 text-warning" />Каналы и провайдеры выбраны</li>
          <li className="flex items-center gap-2"><Check className="size-3 text-warning" />Внешние ключи не подключены</li>
          {selectedChannels.includes("email") && <li className="flex items-center gap-2"><Check className="size-3 text-warning" />Письмо и тема готовы</li>}
          {selectedChannels.some((channel) => channel !== "email") && <li className="flex items-center gap-2"><Check className="size-3 text-warning" />Текст для мессенджеров готов</li>}
          {channelConsentConfirmed && <li className="flex items-center gap-2"><Check className="size-3 text-warning" />Согласие аудитории подтверждено</li>}
          {exclusions.unsubscribed && <li className="flex items-center gap-2"><Check className="size-3 text-success" />Отписавшиеся исключены</li>}
          {exclusions.bounced && <li className="flex items-center gap-2"><Check className="size-3 text-success" />Недоставляемые адреса исключены</li>}
          {exclusions.previouslyContacted && <li className="flex items-center gap-2"><Check className="size-3 text-success" />Недавние получатели исключены</li>}
        </ul>
      </div>
    </div>
  );
}

function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="mt-1 mb-0 text-[20px] font-semibold tracking-[-0.025em] text-text-strong">{title}</h2>
      <p className="mt-1.5 mb-0 max-w-xl text-[12px] leading-5 text-text-muted">{description}</p>
    </div>
  );
}

function ProtectionToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="m-0 text-[11px] font-medium text-text-strong">{label}</p>
        <p className="mt-0.5 mb-0 text-[9px] text-text-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} label={label} />
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[8px] bg-surface-subtle text-text-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[9px] font-medium text-text-subtle">{label}</dt>
        <dd className="mt-0.5 mb-0 truncate text-[11px] font-semibold text-text-strong">{value}</dd>
      </div>
    </div>
  );
}

function ReviewRow({
  icon,
  label,
  value,
  meta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary-subtle text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[9px] font-medium text-text-subtle">{label}</p>
        <p className="mt-0.5 mb-0 text-[11px] font-semibold text-text-strong">{value}</p>
        <p className="mt-0.5 mb-0 truncate text-[9px] text-text-muted">{meta}</p>
      </div>
      <CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
    </div>
  );
}

function TemplateChoice({
  template,
  selected,
  onSelect,
}: {
  template: (typeof templates)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group overflow-hidden rounded-[11px] border bg-surface text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        selected ? "border-primary/45 shadow-[0_0_0_1px_var(--primary-muted)]" : "border-border hover:border-border-strong",
      )}
    >
      <span
        className="relative flex h-24 flex-col items-center justify-center overflow-hidden p-4"
        style={{ backgroundColor: template.backgroundColor }}
      >
        <span className="absolute inset-x-5 top-4 h-1 rounded-full bg-white/75" />
        <span className="mt-2 h-2 w-2/3 rounded-full" style={{ backgroundColor: template.accentColor }} />
        <span className="mt-2 h-1.5 w-4/5 rounded-full bg-white/90" />
        <span className="mt-1.5 h-1.5 w-3/5 rounded-full bg-white/75" />
        <span className="mt-3 h-4 w-16 rounded-[5px]" style={{ backgroundColor: template.accentColor }} />
        {selected && (
          <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-primary text-white shadow-sm">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="block border-t border-border p-3">
        <span className="block truncate text-[10px] font-semibold text-text-strong">{template.name}</span>
        <span className="mt-0.5 block text-[9px] text-text-muted">
          {templateCategoryLabels[template.category]}
        </span>
      </span>
    </button>
  );
}
