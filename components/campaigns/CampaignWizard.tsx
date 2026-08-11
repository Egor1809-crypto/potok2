"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Filter,
  Mail,
  MailCheck,
  PencilLine,
  Save,
  Send,
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
import type { Campaign, CampaignWizardStep, TemplateCategory } from "@/types";
import { BRAND_NAME } from "@/config/brand";
import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  Select,
  Stepper,
  Switch,
  ToastSurface,
  buttonVariants,
  cn,
} from "@/components/ui";

type AudienceType = "segment" | "saved-list" | "custom-filter" | "contacts";
type ContentMode = "scratch" | "template" | "duplicate" | "ai";
type SendMode = "now" | "schedule";
type SubmitState = "idle" | "processing" | "success";

export type CampaignWizardSearchParams = Record<
  string,
  string | string[] | undefined
>;

export interface CampaignWizardProps {
  searchParams?: CampaignWizardSearchParams | URLSearchParams;
}

const wizardSteps: { value: CampaignWizardStep; label: string; description: string }[] = [
  { value: "audience", label: "Аудитория", description: "Выберите получателей" },
  { value: "content", label: "Письмо", description: "Подготовьте письмо" },
  { value: "sender", label: "Отправитель", description: "Настройте отправку" },
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

const campaignDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatCampaignDate(value: string): string {
  return campaignDateFormatter.format(new Date(`${value}T12:00:00Z`));
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
  const providedSearch = serializeParams(searchParams);
  const resolvedSearch = providedSearch ?? browserSearch.replace(/^\?/, "");

  return (
    <CampaignWizardState
      key={`${resolvedSearch || "campaign-wizard-default"}:${
        resolvedSearch.includes("builderDraft=1") ? builderDraftSnapshot : ""
      }`}
      params={new URLSearchParams(resolvedSearch)}
      builderDraftSnapshot={builderDraftSnapshot}
    />
  );
}

function CampaignWizardState({
  params,
  builderDraftSnapshot,
}: {
  params: URLSearchParams;
  builderDraftSnapshot: string;
}) {
  const builderDraft = (() => {
    if (params.get("builderDraft") !== "1" || !builderDraftSnapshot) return null;
    try {
      return JSON.parse(builderDraftSnapshot) as {
        campaignName?: string;
        document?: {
          templateId?: string;
          subject?: string;
          previewText?: string;
          blocks?: unknown[];
        };
      };
    } catch {
      return null;
    }
  })();
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
  const queryCompany = companies.find((company) => company.id === params.get("company"));
  const companyContactIds = queryCompany
    ? contacts
        .filter((contact) => contact.companyId === queryCompany.id)
        .map((contact) => contact.id)
    : [];
  const seededContactIds = queryContactIds.length > 0 ? queryContactIds : companyContactIds;
  const queryCount = Math.max(0, Number.parseInt(params.get("count") ?? "0", 10) || 0);
  const queryFilter = params.get("filter") === "lawyers-moscow-active";
  const queryAudienceType = audienceTypeFromQuery(params.get("audienceType"));
  const fromContacts =
    params.get("source") === "contacts" || seededContactIds.length > 0;
  const queryTemplate = templates.find(
    (template) =>
      template.id === (params.get("template") ?? builderDraft?.document?.templateId),
  );
  const duplicateTemplate = templates.find(
    (template) => template.id === sourceCampaign?.templateId,
  );
  const startingTemplate = queryTemplate ?? duplicateTemplate ?? templates[0];

  const [currentStep, setCurrentStep] = React.useState(() =>
    stepFromQuery(params.get("step")),
  );
  const [campaignName, setCampaignName] = React.useState(
    builderDraft?.campaignName ??
    (sourceCampaign
      ? duplicateId
        ? `${sourceCampaign.name} — копия`
        : sourceCampaign.name
      : params.get("name")?.trim() || "Кампания без названия"),
  );
  const [audienceType, setAudienceType] = React.useState<AudienceType>(() =>
    queryAudienceType ?? (queryFilter
      ? "custom-filter"
      : querySegment || sourceCampaign?.segmentId
      ? "segment"
      : fromContacts || queryCount > 0 || sourceCampaign
        ? "contacts"
        : "segment"),
  );
  const [selectedSegmentId, setSelectedSegmentId] = React.useState(
    params.get("segment") ?? querySegment?.id ?? sourceCampaign?.segmentId ?? segments[0]?.id ?? "",
  );
  const [savedListId, setSavedListId] = React.useState(
    savedLists.some((list) => list.id === params.get("savedList"))
      ? params.get("savedList")!
      : savedLists[0].id,
  );
  const [selectedContactIds, setSelectedContactIds] = React.useState<string[]>(
    seededContactIds,
  );
  const [explicitCount, setExplicitCount] = React.useState(
    queryCount || queryCompany?.contactsCount || (sourceCampaign && !sourceCampaign.segmentId ? sourceCampaign.metrics.recipients : 0),
  );
  const [excludeUnsubscribed, setExcludeUnsubscribed] = React.useState(true);
  const [excludeBounced, setExcludeBounced] = React.useState(true);
  const [excludePreviouslyContacted, setExcludePreviouslyContacted] = React.useState(false);
  const [contentMode, setContentMode] = React.useState<ContentMode>(
    builderDraft
      ? builderDraft.document?.templateId
        ? "template"
        : "scratch"
      : sourceCampaign
        ? "duplicate"
        : "template",
  );
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(
    builderDraft?.document?.templateId ?? startingTemplate?.id ?? "",
  );
  const [selectedDuplicateId, setSelectedDuplicateId] = React.useState(
    sourceCampaign?.id ?? campaigns[0]?.id ?? "",
  );
  const [senderName, setSenderName] = React.useState(
    sourceCampaign?.senderName ?? senderProfiles[0].name,
  );
  const [senderEmail, setSenderEmail] = React.useState(
    sourceCampaign?.senderEmail ?? senderProfiles[0].email,
  );
  const [subject, setSubject] = React.useState(
    builderDraft?.document?.subject ??
      sourceCampaign?.subject ??
      startingTemplate?.subject ??
      "Полезное обновление для {{first_name}}",
  );
  const [previewText, setPreviewText] = React.useState(
    builderDraft?.document?.previewText ??
      sourceCampaign?.previewText ??
      startingTemplate?.previewText ??
      "Короткое сообщение от нашей команды.",
  );
  const [sendMode, setSendMode] = React.useState<SendMode>("schedule");
  const [scheduleDate, setScheduleDate] = React.useState("2026-08-13");
  const [scheduleTime, setScheduleTime] = React.useState("09:00");
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

  const campaignStateParams = new URLSearchParams({
    count: String(recipientCount),
    audience: audienceLabel,
    audienceType,
    name: campaignName,
  });
  if (audienceType === "segment" && selectedSegmentId) {
    campaignStateParams.set("segment", selectedSegmentId);
  }
  if (audienceType === "saved-list" && savedListId) {
    campaignStateParams.set("savedList", savedListId);
  }
  if (audienceType === "custom-filter") {
    campaignStateParams.set("filter", "lawyers-moscow-active");
  }
  if (audienceType === "contacts") {
    campaignStateParams.set("source", "contacts");
    selectedContactIds.forEach((id) => campaignStateParams.append("contact", id));
  }
  if (queryCompany) campaignStateParams.set("company", queryCompany.id);
  if (selectedTemplateId) campaignStateParams.set("template", selectedTemplateId);

  const editorReturnParams = new URLSearchParams(campaignStateParams);
  editorReturnParams.set("step", "sender");
  editorReturnParams.set("builderDraft", "1");
  const editorQuery = new URLSearchParams({
    campaign: campaignName,
    returnTo: `/campaigns/new?${editorReturnParams.toString()}`,
  });
  if (selectedTemplateId) editorQuery.set("template", selectedTemplateId);
  const editorHref = `/email-builder?${editorQuery.toString()}`;

  const libraryBackParams = new URLSearchParams(campaignStateParams);
  libraryBackParams.set("step", "content");
  libraryBackParams.delete("builderDraft");
  const libraryContinueParams = new URLSearchParams(campaignStateParams);
  libraryContinueParams.set("step", "sender");
  libraryContinueParams.set("builderDraft", "1");
  libraryContinueParams.delete("template");
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
      if (contentMode === "template" && !selectedTemplateId) {
        setError("Выберите шаблон, чтобы продолжить.");
        return false;
      }
      if (contentMode === "duplicate" && !selectedDuplicateId) {
        setError("Выберите кампанию для дублирования.");
        return false;
      }
    }
    if (currentStep === 2) {
      if (!senderName.trim() || !/^\S+@\S+\.\S+$/.test(senderEmail)) {
        setError("Укажите имя отправителя и корректный адрес электронной почты.");
        return false;
      }
      if (!subject.trim()) {
        setError("Добавьте тему письма перед проверкой.");
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
    if (sendMode === "schedule" && (!scheduleDate || !scheduleTime)) {
      setError("Выберите дату и время отправки кампании.");
      return;
    }
    setError(null);
    setSubmitState("processing");
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    submitTimerRef.current = setTimeout(() => {
      const now = new Date().toISOString();
      const generatedId = `campaign-demo-${Date.now()}`;
      const sent = sendMode === "now" ? Math.max(1, Math.round(recipientCount * 0.12)) : 0;
      const delivered = Math.round(sent * 0.982);
      const demoCampaign: Campaign = {
        id: generatedId,
        name: campaignName,
        subject,
        previewText,
        audience: audienceLabel,
        segmentId: audienceType === "segment" ? selectedSegmentId : null,
        templateId: selectedTemplateId || null,
        status: sendMode === "schedule" ? "scheduled" : "sending",
        senderName,
        senderEmail,
        owner: "Егор Сабалин",
        metrics: createCampaignMetrics({
          recipients: recipientCount,
          sent,
          delivered,
          opened: Math.round(delivered * 0.36),
          clicked: Math.round(delivered * 0.08),
          replies: Math.round(delivered * 0.01),
          bounced: Math.max(0, sent - delivered),
          unsubscribed: 0,
        }),
        createdAt: now,
        scheduledAt: sendMode === "schedule"
          ? new Date(`${scheduleDate}T${scheduleTime}:00+04:00`).toISOString()
          : now,
        sentAt: sendMode === "now" ? now : null,
      };

      try {
        window.localStorage.setItem(`mailflow:campaign:${generatedId}`, JSON.stringify(demoCampaign));
        window.localStorage.setItem("mailflow:last-campaign", JSON.stringify(demoCampaign));
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
    try {
      window.localStorage.setItem("mailflow:campaign-wizard-draft", JSON.stringify({
        name: campaignName,
        audienceType,
        segmentId: audienceType === "segment" ? selectedSegmentId : null,
        contactIds: selectedContactIds,
        recipientCount,
        templateId: selectedTemplateId || null,
        senderName,
        senderEmail,
        subject,
        previewText,
        updatedAt: new Date().toISOString(),
      }));
    } catch {
      // The demo remains usable when storage is unavailable.
    }
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
            <Badge variant="success" className="mt-6">
              {sendMode === "schedule" ? "Запланирована" : "Отправляется"}
            </Badge>
            <h1 className="mt-3 mb-0 text-[25px] font-semibold tracking-[-0.035em] text-text-strong sm:text-[29px]">
              {sendMode === "schedule" ? "Кампания запланирована" : "Кампания отправляется"}
            </h1>
            <p className="mx-auto mt-2 mb-0 max-w-md text-[13px] leading-5 text-text-muted">
              Кампания «{campaignName}» готова. Получателей: {formatNumber(recipientCount)}.
              {sendMode === "schedule"
                ? ` Отправка начнётся ${formatCampaignDate(scheduleDate)} в ${scheduleTime}.`
                : " Статистика будет обновляться по мере поступления ответов."}
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
              ["Отправитель", senderName],
              [
                "Отправка",
                sendMode === "schedule"
                  ? `${formatCampaignDate(scheduleDate)} · ${scheduleTime}`
                  : "Сейчас",
              ],
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
            Настройте аудиторию, письмо и отправку в одном окне.
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
            />
          )}
          {currentStep === 2 && (
            <SenderStep
              senderName={senderName}
              senderEmail={senderEmail}
              subject={subject}
              previewText={previewText}
              onSenderNameChange={setSenderName}
              onSenderEmailChange={setSenderEmail}
              onSubjectChange={setSubject}
              onPreviewTextChange={setPreviewText}
              editorHref={editorHref}
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
                loadingText={sendMode === "schedule" ? "Планируем…" : "Запускаем отправку…"}
                leadingIcon={
                  sendMode === "schedule" ? (
                    <CalendarClock className="size-4" />
                  ) : (
                    <Send className="size-4" />
                  )
                }
                onClick={submitCampaign}
              >
                {sendMode === "schedule" ? "Запланировать кампанию" : "Отправить кампанию"}
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
              icon={<Mail className="size-3.5" />}
              label="Письмо"
              value={
                contentMode === "template"
                  ? selectedTemplate?.name ?? "Выберите шаблон"
                  : contentMode === "duplicate"
                    ? selectedDuplicate?.name ?? "Выберите кампанию"
                    : contentMode === "ai"
                      ? "Черновик с ИИ"
                      : "С нуля"
              }
            />
            <SummaryItem icon={<UserRound className="size-3.5" />} label="Отправитель" value={senderName} />
          </dl>
          <div className="mt-5 rounded-[11px] bg-primary-subtle/55 p-4">
            <p className="m-0 text-[10px] font-medium text-primary">Получателей</p>
            <p className="mt-1 mb-0 text-[25px] font-semibold tracking-[-0.04em] text-text-strong">
              {formatNumber(recipientCount)}
            </p>
            <p className="mt-1 mb-0 text-[10px] leading-4 text-text-muted">
              Исключения будут применены непосредственно перед отправкой.
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
}: {
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
}) {
  const [aiGenerated, setAiGenerated] = React.useState(false);
  return (
    <div>
      <StepHeading
        eyebrow="Шаг 2"
        title="Как создать письмо?"
        description="Выберите основу, а затем доработайте письмо в редакторе."
      />
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
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

      {contentMode === "template" && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-[12px] font-semibold text-text-strong">Выберите шаблон</h3>
              <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Каждый блок можно редактировать.</p>
            </div>
            <Link href={templateLibraryHref} className="text-[10px] font-semibold text-primary hover:text-primary-hover">
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

      {contentMode === "duplicate" && (
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

      {(contentMode === "scratch" || contentMode === "ai") && (
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

      <div className="mt-6 flex flex-col gap-3 rounded-[12px] border border-primary/15 bg-primary-subtle/35 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-white">
            <PencilLine aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="m-0 text-[11px] font-semibold text-text-strong">Готовы доработать письмо?</p>
            <p className="mt-0.5 mb-0 text-[10px] text-text-muted">Откройте редактор, а затем вернитесь к выбору отправителя.</p>
          </div>
        </div>
        <a href={editorHref} className={buttonVariants({ variant: "primary", size: "sm" })}>
          Открыть редактор писем
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function SenderStep({
  senderName,
  senderEmail,
  subject,
  previewText,
  onSenderNameChange,
  onSenderEmailChange,
  onSubjectChange,
  onPreviewTextChange,
  editorHref,
}: {
  senderName: string;
  senderEmail: string;
  subject: string;
  previewText: string;
  onSenderNameChange: (value: string) => void;
  onSenderEmailChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onPreviewTextChange: (value: string) => void;
  editorHref: string;
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Шаг 3"
        title="От чьего имени отправить письмо?"
        description="Выберите проверенного отправителя и проверьте вид письма во входящих."
      />
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
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
          <a href={editorHref} className="text-[10px] font-semibold text-primary hover:text-primary-hover">
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
        description="Проверьте аудиторию, письмо и время отправки. В деморежиме письма не отправляются."
      />
      <div className="mt-6">
        <FormField label="Название кампании" htmlFor="review-campaign-name" required>
          <Input id="review-campaign-name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
        </FormField>
      </div>
      <div className="mt-5 divide-y divide-border rounded-[12px] border border-border">
        <ReviewRow icon={<UsersRound className="size-4" />} label="Аудитория" value={audienceLabel} meta={`Получателей: ${formatNumber(recipientCount)}`} />
        <ReviewRow icon={<MailCheck className="size-4" />} label="Письмо" value={contentLabel} meta={subject} />
        <ReviewRow icon={<UserRound className="size-4" />} label="Отправитель" value={senderName} meta={senderEmail} />
      </div>

      <div className="mt-6">
        <h3 className="m-0 text-[12px] font-semibold text-text-strong">Отправка</h3>
        <p className="mt-1 mb-3 text-[10px] text-text-muted">Выберите, когда {BRAND_NAME} должен начать обработку получателей.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "now" as const, label: "Отправить сейчас", description: "Начать отправку сразу", icon: Send },
            { value: "schedule" as const, label: "Запланировать", description: "Выбрать дату и время", icon: CalendarClock },
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

      <div className="mt-6 rounded-[11px] border border-success/15 bg-success-subtle/55 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-success">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Всё готово к запуску
        </div>
        <ul className="mt-3 grid gap-2 text-[10px] text-text sm:grid-cols-2">
          <li className="flex items-center gap-2"><Check className="size-3 text-success" />Домен отправки проверен</li>
          <li className="flex items-center gap-2"><Check className="size-3 text-success" />Письмо и тема готовы</li>
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
