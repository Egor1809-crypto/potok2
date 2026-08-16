import { and, asc, desc, eq, inArray, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaignEvents,
  campaignVersions,
  campaigns,
  contacts,
  deliveryJobs,
  deliveryOutbox,
  deliveryPlans,
  emailTemplates,
  integrations,
  participants,
  segments,
  workspaces,
} from "@/db/schema";
import {
  integrationProviders,
  type DeliveryChannelId,
  type IntegrationProviderId,
} from "@/config/integrations";
import type {
  CampaignChannelInput,
  CampaignEvaluation,
  CampaignEventRecord,
  CampaignMetricsRecord,
  CampaignMutationResponse,
  CampaignRecord,
  CampaignVersionRecord,
  CampaignVersionSnapshot,
  CampaignsListResponse,
  ContactCreateInput,
  ContactMutationResponse,
  ContactRecord,
  ContactsBatchCreateResponse,
  ContactsListResponse,
  ContactStatus,
  DeleteResponse,
  DeliveryPlanRecord,
  DeliveryJobRecord,
  DeliveryOutboxRecord,
  IntegrationMutationResponse,
  IntegrationPatchInput,
  IntegrationRecord,
  IntegrationsListResponse,
  ParticipantRecord,
  SegmentCreateInput,
  SegmentMutationResponse,
  SegmentRecord,
  SegmentRule,
  SegmentsListResponse,
  WorkspacePatchInput,
  WorkspacePatchResponse,
  WorkspaceRecord,
  WorkspaceSnapshot,
} from "@/types/api";
import {
  ApiRequestError,
  asObject,
  cleanText,
  newId,
  normalizeEmail,
  nullableText,
  optionalBoolean,
  optionalEmail,
  optionalInteger,
  optionalStringArray,
  optionalText,
  parseIsoDate,
} from "./api-utils";
import {
  assertProviderSupportsChannel,
  isIntegrationReadyForChannel,
  hasRuntimeCredentials,
  toIntegrationRecord,
} from "./runtime-integrations";
import { checkProviderConnection, automaticProviderSecrets } from "./provider-checks";
import {
  createUniSenderCampaign,
  renderMergeTemplate,
  sendTelegramMessage,
  sendVkMessage,
  unknownMergeTokens,
} from "./provider-adapters";
import {
  compileEmailDocument,
  parseEmailBuilderDocument,
  plainTextEmailHtml,
} from "./email-document";
import { uniqueAcceptedContactIds } from "./delivery-metrics";
import {
  ensureDatabase,
  ensureSystemDatabase,
  WORKSPACE_ID,
} from "./database-init";
import { sendVkWorkspaceSmtpBatch } from "./vk-workspace-smtp";
import {
  assertEmailTemplateReference,
  toEmailTemplateRecord,
} from "./template-store";
import { getPresentationProject } from "./presentation-store";
import { buildPresentationPptx, safePresentationFilename } from "./presentation-pptx";

type ContactRow = typeof contacts.$inferSelect;
type SegmentRow = typeof segments.$inferSelect;
type CampaignRow = typeof campaigns.$inferSelect;
type DeliveryPlanRow = typeof deliveryPlans.$inferSelect;
type CampaignEventRow = typeof campaignEvents.$inferSelect;
type CampaignVersionRow = typeof campaignVersions.$inferSelect;
type DeliveryJobRow = typeof deliveryJobs.$inferSelect;
type DeliveryOutboxRow = typeof deliveryOutbox.$inferSelect;

const WORKSPACE_HISTORY_LIMIT = 100;

const CONTACT_STATUSES: ContactStatus[] = [
  "active",
  "unsubscribed",
  "bounced",
  "invalid",
];
const CHANNELS: DeliveryChannelId[] = ["email", "telegram", "vk"];
const PROVIDERS = integrationProviders.map((provider) => provider.id);

const EMPTY_METRICS: CampaignMetricsRecord = {
  recipients: 0,
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  replies: 0,
  bounced: 0,
  unsubscribed: 0,
};

function chunksOf<T>(values: T[], size = 80): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function russianPlural(value: number, one: string, few: string, many: string) {
  const absolute = Math.abs(value) % 100;
  const last = absolute % 10;
  if (absolute > 10 && absolute < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function toWorkspace(row: typeof workspaces.$inferSelect): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    companyName: row.companyName,
    timezone: row.timezone,
    defaultSenderName: row.defaultSenderName,
    defaultSenderEmail: row.defaultSenderEmail,
    replyToEmail: row.replyToEmail,
    signature: row.signature,
    requireConsent: row.requireConsent,
    notifyCampaignComplete: row.notifyCampaignComplete,
    notifyBlockedCampaign: row.notifyBlockedCampaign,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toParticipant(
  row: typeof participants.$inferSelect,
): ParticipantRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    login: row.login ?? "",
    displayName: row.displayName,
    email: row.email,
    color: row.color,
    status: row.status === "disabled" ? "disabled" : "active",
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toContact(row: ContactRow): ContactRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    companyId: row.companyId,
    companyName: row.companyName,
    jobTitle: row.jobTitle,
    category: row.category,
    city: row.city,
    country: row.country,
    tags: row.tags,
    status: row.status as ContactStatus,
    engagementScore: row.engagementScore,
    avatarColor: row.avatarColor,
    emailConsent: row.emailConsent,
    telegramChatId: row.telegramChatId,
    telegramConsent: row.telegramConsent,
    vkUserId: row.vkUserId,
    vkConsent: row.vkConsent,
    lastContactedAt: row.lastContactedAt,
    responsibleParticipantId: row.responsibleParticipantId,
    createdByParticipantId: row.createdByParticipantId,
    updatedByParticipantId: row.updatedByParticipantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCampaign(row: CampaignRow): CampaignRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    audienceType: row.audienceType as CampaignRecord["audienceType"],
    audienceLabel: row.audienceLabel,
    segmentId: row.segmentId,
    contactIds: row.contactIds,
    templateId: row.templateId,
    presentationId: row.presentationId,
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    subject: row.subject,
    previewText: row.previewText,
    emailBodyText: row.emailBodyText,
    emailBodyHtml: row.emailBodyHtml,
    emailBuilderDocument: row.emailBuilderDocument,
    messengerMessage: row.messengerMessage,
    deliveryChannels: row.deliveryChannels,
    status: row.status as CampaignRecord["status"],
    statusReason: row.statusReason,
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    metrics: row.metrics,
    readyVersionId: row.readyVersionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCampaignVersion(row: CampaignVersionRow): CampaignVersionRecord {
  return {
    id: row.id,
    campaignId: row.campaignId,
    version: row.version,
    contentHash: row.contentHash,
    snapshot: row.snapshot,
    createdAt: row.createdAt,
  };
}

function toDeliveryJob(row: DeliveryJobRow): DeliveryJobRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    campaignId: row.campaignId,
    campaignVersionId: row.campaignVersionId,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    acceptedCount: row.acceptedCount,
    rejectedCount: row.rejectedCount,
    ambiguousCount: row.ambiguousCount,
    manualCount: row.manualCount,
    providerExternalIds: row.providerExternalIds,
    statusMessage: row.statusMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

function toDeliveryOutbox(row: DeliveryOutboxRow): DeliveryOutboxRecord {
  return {
    id: row.id,
    jobId: row.jobId,
    campaignId: row.campaignId,
    campaignVersionId: row.campaignVersionId,
    contactId: row.contactId,
    channel: row.channel,
    providerId: row.providerId,
    recipientEndpoint: row.recipientEndpoint,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    attempts: row.attempts,
    externalId: row.externalId,
    statusMessage: row.statusMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDeliveryPlan(row: DeliveryPlanRow): DeliveryPlanRecord {
  return {
    id: row.id,
    campaignId: row.campaignId,
    channel: row.channel,
    providerId: row.providerId,
    status: row.status as DeliveryPlanRecord["status"],
    eligibleCount: row.eligibleCount,
    blockedCount: row.blockedCount,
    statusReason: row.statusReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCampaignEvent(row: CampaignEventRow): CampaignEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    campaignId: row.campaignId,
    type: row.type,
    message: row.message,
    details: row.details,
    occurredAt: row.occurredAt,
  };
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("ru");
}

function compareRule(contact: ContactRecord, rule: SegmentRule): boolean {
  const source =
    rule.field === "tag"
      ? contact.tags
      : rule.field === "jobTitle"
        ? contact.jobTitle
        : rule.field === "companyName"
          ? contact.companyName
          : contact[rule.field];

  if (rule.field === "tag") {
    const expected = Array.isArray(rule.value) ? rule.value : [rule.value];
    const tags = (source as string[]).map(normalizedText);
    const expectedTags = expected.map(normalizedText);
    if (rule.operator === "not_equals") {
      return expectedTags.every((tag) => !tags.includes(tag));
    }
    if (rule.operator === "contains") {
      return expectedTags.some((tag) => tags.some((item) => item.includes(tag)));
    }
    return expectedTags.some((tag) => tags.includes(tag));
  }

  if (
    rule.field === "lastContactedAt" &&
    (rule.operator === "equals" || rule.operator === "not_equals")
  ) {
    const sourceDate = source ? String(source).slice(0, 10) : "";
    const expectedDates = (
      Array.isArray(rule.value) ? rule.value : [rule.value]
    ).map((value) => String(value).slice(0, 10));
    const equal = expectedDates.includes(sourceDate);
    return rule.operator === "equals" ? equal : !equal;
  }

  if (rule.operator === "greater_than" || rule.operator === "less_than") {
    const left = Number(source);
    const right = Number(rule.value);
    return rule.operator === "greater_than" ? left > right : left < right;
  }
  if (rule.operator === "before" || rule.operator === "after") {
    if (!source) return false;
    const left = Date.parse(String(source));
    const right = Date.parse(String(rule.value));
    if (Number.isNaN(left) || Number.isNaN(right)) return false;
    return rule.operator === "before" ? left < right : left > right;
  }

  const sourceText = normalizedText(source);
  const values = (Array.isArray(rule.value) ? rule.value : [rule.value]).map(
    normalizedText,
  );
  if (rule.operator === "contains") {
    return values.some((value) => sourceText.includes(value));
  }
  if (rule.operator === "not_equals") {
    return values.every((value) => sourceText !== value);
  }
  return values.some((value) => sourceText === value);
}

export function contactMatchesSegment(
  contact: ContactRecord,
  rules: SegmentRule[],
): boolean {
  if (!rules.length) return false;
  let result = compareRule(contact, rules[0]);
  for (const rule of rules.slice(1)) {
    result = rule.join === "or" ? result || compareRule(contact, rule) : result && compareRule(contact, rule);
  }
  return result;
}

function toSegment(
  row: SegmentRow,
  allContacts: ContactRecord[],
  allCampaigns: CampaignRow[],
): SegmentRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    rules: row.rules,
    color: row.color,
    isDynamic: row.isDynamic,
    contactCount: allContacts.filter((contact) =>
      contactMatchesSegment(contact, row.rules),
    ).length,
    campaignsCount: allCampaigns.filter(
      (campaign) => campaign.segmentId === row.id,
    ).length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function loadCoreRows(participantId: string) {
  const db = getDb();
  const [
    workspaceRows,
    participantRows,
    memberRows,
    contactRows,
    segmentRows,
    integrationRows,
    templateRows,
    campaignRows,
    planRows,
    jobRows,
    eventRows,
  ] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, WORKSPACE_ID)).limit(1),
    db
      .select()
      .from(participants)
      .where(eq(participants.id, participantId))
      .limit(1),
    db
      .select()
      .from(participants)
      .where(eq(participants.workspaceId, WORKSPACE_ID))
      .orderBy(participants.createdAt),
    db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, WORKSPACE_ID))
      .orderBy(desc(contacts.updatedAt)),
    db
      .select()
      .from(segments)
      .where(eq(segments.workspaceId, WORKSPACE_ID))
      .orderBy(desc(segments.updatedAt)),
    db
      .select()
      .from(integrations)
      .where(eq(integrations.workspaceId, WORKSPACE_ID))
      .orderBy(integrations.providerId),
    db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.workspaceId, WORKSPACE_ID))
      .orderBy(desc(emailTemplates.updatedAt)),
    db
      .select()
      .from(campaigns)
      .where(eq(campaigns.workspaceId, WORKSPACE_ID))
      .orderBy(desc(campaigns.updatedAt)),
    db.select().from(deliveryPlans),
    db
      .select()
      .from(deliveryJobs)
      .where(eq(deliveryJobs.workspaceId, WORKSPACE_ID))
      .orderBy(desc(deliveryJobs.createdAt))
      .limit(WORKSPACE_HISTORY_LIMIT),
    db
      .select()
      .from(campaignEvents)
      .where(eq(campaignEvents.workspaceId, WORKSPACE_ID))
      .orderBy(desc(campaignEvents.occurredAt))
      .limit(WORKSPACE_HISTORY_LIMIT),
  ]);
  const workspace = workspaceRows[0];
  const participant = participantRows[0];
  if (!workspace || !participant) {
    throw new Error("Singleton workspace was not initialized");
  }
  return {
    workspace,
    participant,
    memberRows,
    contactRows,
    segmentRows,
    integrationRows,
    templateRows,
    campaignRows,
    planRows,
    jobRows,
    eventRows,
  };
}

export async function getWorkspaceSnapshot(
  request: Request,
): Promise<WorkspaceSnapshot> {
  const actor = await ensureDatabase(request);
  const rows = await loadCoreRows(actor.participant.id);
  const contactRecords = rows.contactRows.map(toContact);
  const campaignRecords = rows.campaignRows.map(toCampaign);
  // Rows from providers removed from the product stay inert in older databases
  // and must never make the current workspace snapshot fail.
  const integrationRecords = rows.integrationRows
    .filter((row) => PROVIDERS.includes(row.providerId))
    .map(toIntegrationRecord);
  return {
    workspace: toWorkspace(rows.workspace),
    participant: toParticipant(rows.participant),
    members: rows.memberRows.filter((member) => member.passwordHash).map(toParticipant),
    contacts: contactRecords,
    segments: rows.segmentRows.map((segment) =>
      toSegment(segment, contactRecords, rows.campaignRows),
    ),
    integrations: integrationRecords,
    templates: rows.templateRows.map(toEmailTemplateRecord),
    campaigns: campaignRecords,
    deliveryPlans: rows.planRows.map(toDeliveryPlan),
    deliveryJobs: rows.jobRows.map(toDeliveryJob),
    events: rows.eventRows.map(toCampaignEvent),
    historyWindow: {
      scope: "latest_workspace",
      deliveryJobsLimit: WORKSPACE_HISTORY_LIMIT,
      campaignEventsLimit: WORKSPACE_HISTORY_LIMIT,
    },
    stats: {
      totalContacts: contactRecords.length,
      activeContacts: contactRecords.filter((contact) => contact.status === "active").length,
      totalSegments: rows.segmentRows.length,
      totalCampaigns: campaignRecords.length,
      activeCampaigns: campaignRecords.filter((campaign) =>
        ["ready", "scheduled", "sending"].includes(campaign.status),
      ).length,
      connectedIntegrations: integrationRecords.filter(
        (integration) => integration.status === "connected",
      ).length,
    },
  };
}

function contactStatus(value: unknown, fallback?: ContactStatus): ContactStatus {
  if (value === undefined && fallback) return fallback;
  if (!CONTACT_STATUSES.includes(value as ContactStatus)) {
    throw new ApiRequestError("У контакта указан неизвестный статус.");
  }
  return value as ContactStatus;
}

function contactEmail(value: unknown, existing?: ContactRecord): string {
  if (value === undefined) return existing?.email ?? "";
  if (typeof value !== "string") {
    throw new ApiRequestError("Поле «Email» должно быть текстом.");
  }
  if (!value.trim()) return "";
  return normalizeEmail(value, "Email");
}

function contactPhone(value: unknown, existing?: ContactRecord): string {
  if (value === undefined) return existing?.phone ?? "";
  if (typeof value !== "string") {
    throw new ApiRequestError("Поле «Телефон» должно быть текстом.");
  }
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throw new ApiRequestError("В поле «Телефон» указан некорректный номер.");
  }
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  return `+${digits}`;
}

function parseContact(
  payload: unknown,
  existing?: ContactRecord,
): ContactCreateInput {
  const object = asObject(payload);
  const firstName =
    optionalText(object.firstName, "Имя", 100) ?? existing?.firstName ?? "";
  const lastName =
    optionalText(object.lastName, "Фамилия", 100) ?? existing?.lastName ?? "";
  const email = contactEmail(object.email, existing);
  const phone = contactPhone(object.phone, existing);
  if (!firstName) throw new ApiRequestError("Укажите имя контакта.");
  if (!lastName) throw new ApiRequestError("Укажите фамилию контакта.");

  const parsedTelegramChatId = nullableText(
    object.telegramChatId,
    "Идентификатор чата Telegram",
    80,
  );
  const telegramChatId =
    parsedTelegramChatId === undefined
      ? (existing?.telegramChatId ?? null)
      : parsedTelegramChatId;
  const telegramConsentInput = optionalBoolean(
    object.telegramConsent,
    "Согласие Telegram",
  );
  const telegramConsent = telegramChatId
    ? telegramConsentInput ?? existing?.telegramConsent ?? false
    : false;
  const parsedVkUserId = nullableText(
    object.vkUserId,
    "Идентификатор пользователя ВКонтакте",
    80,
  );
  const vkUserId =
    parsedVkUserId === undefined ? (existing?.vkUserId ?? null) : parsedVkUserId;
  const vkConsentInput = optionalBoolean(
    object.vkConsent,
    "Согласие ВКонтакте",
  );
  const vkConsent = vkUserId
    ? vkConsentInput ?? existing?.vkConsent ?? false
    : false;
  if (telegramConsentInput === true && !telegramChatId) {
    throw new ApiRequestError(
      "Для согласия Telegram нужен сохранённый идентификатор чата контакта.",
    );
  }
  if (telegramChatId && !/^-?\d+$/.test(telegramChatId)) {
    throw new ApiRequestError(
      "Идентификатор чата Telegram должен состоять из цифр.",
    );
  }
  if (vkConsentInput === true && !vkUserId) {
    throw new ApiRequestError(
      "Для согласия ВКонтакте нужен идентификатор пользователя.",
    );
  }
  if (vkUserId && !/^\d+$/.test(vkUserId)) {
    throw new ApiRequestError(
      "Идентификатор пользователя ВКонтакте должен состоять из цифр.",
    );
  }
  if (!email && !phone && !telegramChatId && !vkUserId) {
    throw new ApiRequestError(
      "Укажите хотя бы один канал контакта: email, телефон или идентификатор мессенджера.",
    );
  }
  const emailConsentInput = optionalBoolean(
    object.emailConsent,
    "Согласие на email",
  );
  if (emailConsentInput && !email) {
    throw new ApiRequestError(
      "Для email-согласия нужен сохранённый адрес электронной почты.",
    );
  }
  const emailConsent = email
    ? emailConsentInput ?? existing?.emailConsent ?? false
    : false;
  const parsedResponsibleParticipantId = nullableText(
    object.responsibleParticipantId,
    "Ответственный",
    120,
  );
  const responsibleParticipantId = parsedResponsibleParticipantId === undefined
    ? (existing?.responsibleParticipantId ?? null)
    : parsedResponsibleParticipantId;

  return {
    firstName,
    lastName,
    email,
    phone,
    companyId: (() => {
      const parsed = nullableText(object.companyId, "Компания", 120);
      return parsed === undefined ? (existing?.companyId ?? null) : parsed;
    })(),
    companyName:
      optionalText(object.companyName, "Название компании", 200) ??
      existing?.companyName ??
      "",
    jobTitle:
      optionalText(object.jobTitle, "Должность", 200) ??
      existing?.jobTitle ??
      "",
    category:
      optionalText(object.category, "Категория", 100) ||
      existing?.category ||
      "Клиент",
    city: optionalText(object.city, "Город", 120) ?? existing?.city ?? "",
    country:
      optionalText(object.country, "Страна", 120) ??
      existing?.country ??
      "Россия",
    tags: optionalStringArray(object.tags, "Теги") ?? existing?.tags ?? [],
    status: contactStatus(object.status, existing?.status ?? "active"),
    engagementScore:
      optionalInteger(object.engagementScore, "Вовлечённость", 0, 100) ??
      existing?.engagementScore ??
      0,
    emailConsent,
    telegramChatId,
    telegramConsent,
    vkUserId,
    vkConsent,
    responsibleParticipantId,
  };
}

function contactValues(
  input: ContactCreateInput,
  id: string,
  now: string,
  existing?: ContactRecord,
  actorId?: string,
) {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: `${input.firstName} ${input.lastName}`.trim(),
    email: input.email ?? "",
    phone: input.phone ?? "",
    companyId: input.companyId ?? null,
    companyName: input.companyName ?? "",
    jobTitle: input.jobTitle ?? "",
    category: input.category || "Клиент",
    city: input.city ?? "",
    country: input.country ?? "Россия",
    tags: input.tags ?? [],
    status: input.status ?? "active",
    engagementScore: input.engagementScore ?? 0,
    avatarColor: existing?.avatarColor ?? "#6558E8",
    emailConsent: Boolean(input.email && input.emailConsent),
    telegramChatId: input.telegramChatId ?? null,
    telegramConsent: input.telegramConsent ?? false,
    vkUserId: input.vkUserId ?? null,
    vkConsent: input.vkConsent ?? false,
    lastContactedAt: existing?.lastContactedAt ?? null,
    responsibleParticipantId: input.responsibleParticipantId ?? existing?.responsibleParticipantId ?? actorId ?? null,
    createdByParticipantId: existing?.createdByParticipantId ?? actorId ?? null,
    updatedByParticipantId: actorId ?? existing?.updatedByParticipantId ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

async function contactById(id: string): Promise<ContactRecord> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.workspaceId, WORKSPACE_ID)))
    .limit(1);
  if (!row) throw new ApiRequestError("Контакт не найден.", 404);
  return toContact(row);
}

function contactsShareIdentity(
  left: ContactCreateInput,
  right: ContactCreateInput,
): boolean {
  return Boolean(
    (left.email && right.email && left.email === right.email) ||
      (left.phone && right.phone && left.phone === right.phone) ||
      (left.telegramChatId &&
        right.telegramChatId &&
        left.telegramChatId === right.telegramChatId) ||
      (left.vkUserId && right.vkUserId && left.vkUserId === right.vkUserId),
  );
}

function rowMatchesContactInput(
  row: ContactRow,
  input: ContactCreateInput,
): boolean {
  return Boolean(
    (input.email && row.email === input.email) ||
      (input.phone && row.phone === input.phone) ||
      (input.telegramChatId && row.telegramChatId === input.telegramChatId) ||
      (input.vkUserId && row.vkUserId === input.vkUserId),
  );
}

async function findContactsByIdentifiers(
  input: ContactCreateInput,
): Promise<ContactRow[]> {
  return getDb()
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.workspaceId, WORKSPACE_ID),
        or(
          input.email ? eq(contacts.email, input.email) : undefined,
          input.phone ? eq(contacts.phone, input.phone) : undefined,
          input.telegramChatId
            ? eq(contacts.telegramChatId, input.telegramChatId)
            : undefined,
          input.vkUserId ? eq(contacts.vkUserId, input.vkUserId) : undefined,
        ),
      ),
    );
}

async function duplicateOwnerMessage(row: ContactRow, fallback: string) {
  if (!row.createdByParticipantId) return fallback;
  const [owner] = await getDb()
    .select({ displayName: participants.displayName })
    .from(participants)
    .where(eq(participants.id, row.createdByParticipantId))
    .limit(1);
  return owner?.displayName
    ? `${fallback} Его добавил участник ${owner.displayName}.`
    : fallback;
}

export async function listContacts(request: Request): Promise<ContactsListResponse> {
  await ensureDatabase(request);
  const db = getDb();
  const [rows, workspaceRows, memberRows] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, WORKSPACE_ID))
      .orderBy(desc(contacts.updatedAt)),
    db
      .select({ timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.id, WORKSPACE_ID))
      .limit(1),
    db
      .select()
      .from(participants)
      .where(eq(participants.workspaceId, WORKSPACE_ID))
      .orderBy(participants.createdAt),
  ]);
  return {
    contacts: rows.map(toContact),
    members: memberRows.map(toParticipant),
    timezone: workspaceRows[0]?.timezone ?? "Europe/Moscow",
  };
}

export async function createContact(
  request: Request,
  payload: unknown,
): Promise<ContactMutationResponse> {
  const actor = await ensureDatabase(request);
  const input = parseContact(payload);
  const db = getDb();
  const duplicate = await findContactsByIdentifiers(input);
  if (duplicate.length) {
    throw new ApiRequestError(
      await duplicateOwnerMessage(duplicate[0], "Контакт с таким email, телефоном или идентификатором мессенджера уже существует. Откройте его и сохраните изменения."),
      409,
    );
  }
  const now = new Date().toISOString();
  const [row] = await db
    .insert(contacts)
    .values(contactValues(input, newId("contact"), now, undefined, actor.participant.id))
    .onConflictDoNothing()
    .returning();
  if (!row) {
    throw new ApiRequestError(
      "Контакт с таким email, телефоном или идентификатором мессенджера уже существует.",
      409,
    );
  }
  return { contact: toContact(row) };
}

export async function createContactsBatch(
  request: Request,
  payload: unknown,
): Promise<ContactsBatchCreateResponse> {
  const actor = await ensureDatabase(request);
  const object = asObject(payload);
  if (!Array.isArray(object.contacts) || object.contacts.length === 0) {
    throw new ApiRequestError("Добавьте хотя бы один контакт для импорта.");
  }
  if (object.contacts.length > 500) {
    throw new ApiRequestError("За один раз можно импортировать не более 500 контактов.");
  }
  const strategy = object.duplicateStrategy ?? "skip";
  if (strategy !== "skip" && strategy !== "update") {
    throw new ApiRequestError("Неизвестная стратегия обработки дубликатов.");
  }

  const parsed = object.contacts.map((value, index) => {
    try {
      return parseContact(value);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw new ApiRequestError(
          "В импортируемом файле есть ошибки.",
          400,
          [`Строка ${index + 1}: ${error.message}`],
        );
      }
      throw error;
    }
  });

  const uniqueInputs: ContactCreateInput[] = [];
  let skippedCount = 0;
  for (const input of parsed) {
    const duplicateIndex = uniqueInputs.findIndex((candidate) =>
      contactsShareIdentity(candidate, input),
    );
    if (duplicateIndex === -1) {
      uniqueInputs.push(input);
    } else {
      skippedCount += 1;
      if (strategy === "update") {
        uniqueInputs[duplicateIndex] = {
          ...uniqueInputs[duplicateIndex],
          ...input,
        };
      }
    }
  }

  const db = getDb();
  const emails = uniqueInputs.flatMap((input) => (input.email ? [input.email] : []));
  const phones = uniqueInputs.flatMap((input) => (input.phone ? [input.phone] : []));
  const telegramChatIds = uniqueInputs.flatMap((input) =>
    input.telegramChatId ? [input.telegramChatId] : [],
  );
  const vkUserIds = uniqueInputs.flatMap((input) =>
    input.vkUserId ? [input.vkUserId] : [],
  );
  const existingById = new Map<string, ContactRow>();
  for (const emailChunk of chunksOf(emails)) {
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, WORKSPACE_ID),
          inArray(contacts.email, emailChunk),
        ),
      );
    rows.forEach((row) => existingById.set(row.id, row));
  }
  for (const phoneChunk of chunksOf(phones)) {
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, WORKSPACE_ID),
          inArray(contacts.phone, phoneChunk),
        ),
      );
    rows.forEach((row) => existingById.set(row.id, row));
  }
  for (const telegramChunk of chunksOf(telegramChatIds)) {
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, WORKSPACE_ID),
          inArray(contacts.telegramChatId, telegramChunk),
        ),
      );
    rows.forEach((row) => existingById.set(row.id, row));
  }
  for (const vkChunk of chunksOf(vkUserIds)) {
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, WORKSPACE_ID),
          inArray(contacts.vkUserId, vkChunk),
        ),
      );
    rows.forEach((row) => existingById.set(row.id, row));
  }
  const existingRows = [...existingById.values()];
  const operations = uniqueInputs.map((input) => {
    const matches = existingRows.filter((row) => rowMatchesContactInput(row, input));
    const matchIds = new Set(matches.map((row) => row.id));
    if (matchIds.size > 1) {
      throw new ApiRequestError(
        "Email, телефон и идентификаторы мессенджеров относятся к разным существующим контактам. Исправьте строку импорта.",
        409,
      );
    }
    return { input, existing: matches[0] };
  });
  const now = new Date().toISOString();
  const affectedIds: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;

  for (const { input, existing } of operations) {
    if (existing && strategy === "skip") {
      skippedCount += 1;
      continue;
    }
    if (existing) {
      const merged = parseContact(input, toContact(existing));
      await db
        .update(contacts)
        .set({ ...contactValues(merged, existing.id, now, toContact(existing), actor.participant.id), updatedAt: now })
        .where(eq(contacts.id, existing.id));
      affectedIds.push(existing.id);
      updatedCount += 1;
    } else {
      const id = newId("contact");
      const [created] = await db
        .insert(contacts)
        .values(contactValues(input, id, now, undefined, actor.participant.id))
        .onConflictDoNothing()
        .returning({ id: contacts.id });
      if (created) {
        affectedIds.push(id);
        createdCount += 1;
      } else {
        skippedCount += 1;
      }
    }
  }

  const affectedRows: ContactRow[] = [];
  for (const idChunk of chunksOf(affectedIds)) {
    affectedRows.push(
      ...(await db.select().from(contacts).where(inArray(contacts.id, idChunk))),
    );
  }
  return {
    contacts: affectedRows.map(toContact),
    createdCount,
    updatedCount,
    skippedCount,
  };
}

export async function updateContact(
  request: Request,
  payload: unknown,
): Promise<ContactMutationResponse> {
  const actor = await ensureDatabase(request);
  const object = asObject(payload);
  const id = cleanText(object.id, "Идентификатор контакта", 120);
  const existing = await contactById(id);
  const input = parseContact(object, existing);
  const db = getDb();
  const duplicate = await findContactsByIdentifiers(input);
  const conflictingContact = duplicate.find((row) => row.id !== id);
  if (conflictingContact) {
    throw new ApiRequestError(
      await duplicateOwnerMessage(conflictingContact, "Другой контакт уже использует этот email, телефон или идентификатор мессенджера."),
      409,
    );
  }
  const now = new Date().toISOString();
  const [row] = await db
    .update(contacts)
    .set({ ...contactValues(input, id, now, existing, actor.participant.id), updatedAt: now })
    .where(eq(contacts.id, id))
    .returning();
  return { contact: toContact(row) };
}

export async function deleteContact(
  request: Request,
  idValue: unknown,
): Promise<DeleteResponse> {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Идентификатор контакта", 120);
  await contactById(id);
  const db = getDb();
  const affectedCampaigns = (await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.workspaceId, WORKSPACE_ID)))
    .filter((campaign) => campaign.contactIds.includes(id));
  if (affectedCampaigns.some((campaign) => campaign.status === "sending")) {
    throw new ApiRequestError(
      "Контакт участвует в отправляемой кампании. Дождитесь её завершения перед удалением.",
      409,
    );
  }
  const now = new Date().toISOString();
  for (const campaign of affectedCampaigns) {
    const preserveStatus = ["completed", "cancelled"].includes(campaign.status);
    await db
      .update(campaigns)
      .set({
        contactIds: campaign.contactIds.filter((contactId) => contactId !== id),
        status: preserveStatus ? campaign.status : "blocked",
        statusReason:
          preserveStatus
            ? campaign.statusReason
            : "Один из выбранных контактов удалён. Проверьте аудиторию.",
        updatedAt: now,
      })
      .where(eq(campaigns.id, campaign.id));
    if (!preserveStatus) {
      await appendEvent(
        campaign.id,
        "campaign_updated",
        "Контакт удалён из аудитории; кампанию нужно проверить повторно.",
        { removedContactId: id },
      );
    }
  }
  await db.delete(contacts).where(eq(contacts.id, id));
  return { deletedId: id };
}

const RULE_FIELDS: SegmentRule["field"][] = [
  "jobTitle",
  "city",
  "status",
  "category",
  "tag",
  "companyName",
  "lastContactedAt",
  "engagementScore",
];
const RULE_OPERATORS: SegmentRule["operator"][] = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
  "before",
  "after",
];

function allowedRuleOperators(
  field: SegmentRule["field"],
): SegmentRule["operator"][] {
  if (field === "status") return ["equals", "not_equals"];
  if (field === "lastContactedAt") return ["before", "after"];
  if (field === "engagementScore") {
    return ["greater_than", "less_than", "equals"];
  }
  return ["equals", "not_equals", "contains"];
}

function parseRules(value: unknown): SegmentRule[] {
  if (!Array.isArray(value)) {
    throw new ApiRequestError("Добавьте хотя бы одно правило сегмента.");
  }
  if (value.length === 0 || value.length > 20) {
    throw new ApiRequestError("Сегмент должен содержать от 1 до 20 правил.");
  }
  return value.map((rawRule, index) => {
    const object = asObject(rawRule);
    const rawField = cleanText(object.field, `Поле правила ${index + 1}`, 50);
    const field =
      rawField === "role"
        ? "jobTitle"
        : rawField === "company"
          ? "companyName"
          : rawField;
    if (!RULE_FIELDS.includes(field as SegmentRule["field"])) {
      throw new ApiRequestError(`В правиле ${index + 1} выбрано неизвестное поле.`);
    }
    const operator = cleanText(
      object.operator,
      `Оператор правила ${index + 1}`,
      50,
    );
    if (!RULE_OPERATORS.includes(operator as SegmentRule["operator"])) {
      throw new ApiRequestError(`В правиле ${index + 1} выбран неизвестный оператор.`);
    }
    const join = object.join ?? "and";
    if (join !== "and" && join !== "or") {
      throw new ApiRequestError(`В правиле ${index + 1} выбрана неизвестная связка.`);
    }
    const ruleValue = object.value;
    if (
      typeof ruleValue !== "string" &&
      typeof ruleValue !== "number" &&
      !Array.isArray(ruleValue)
    ) {
      throw new ApiRequestError(`Заполните значение правила ${index + 1}.`);
    }
    let normalizedValue: SegmentRule["value"] = Array.isArray(ruleValue)
      ? optionalStringArray(ruleValue, `Значение правила ${index + 1}`, 30) ?? []
      : typeof ruleValue === "string"
        ? cleanText(ruleValue, `Значение правила ${index + 1}`, 200)
        : ruleValue;
    const normalizedField = field as SegmentRule["field"];
    const normalizedOperator = operator as SegmentRule["operator"];
    if (!allowedRuleOperators(normalizedField).includes(normalizedOperator)) {
      throw new ApiRequestError(
        `В правиле ${index + 1} оператор не подходит выбранному полю.`,
      );
    }
    if (Array.isArray(normalizedValue) && normalizedValue.length === 0) {
      throw new ApiRequestError(`Заполните значение правила ${index + 1}.`);
    }
    if (normalizedField === "status") {
      const values = Array.isArray(normalizedValue)
        ? normalizedValue
        : [normalizedValue];
      if (
        values.some(
          (value) =>
            typeof value !== "string" ||
            !CONTACT_STATUSES.includes(value as ContactStatus),
        )
      ) {
        throw new ApiRequestError(
          `В правиле ${index + 1} указан неизвестный статус контакта.`,
        );
      }
    } else if (normalizedField === "engagementScore") {
      const score = Number(normalizedValue);
      if (
        Array.isArray(normalizedValue) ||
        !Number.isInteger(score) ||
        score < 0 ||
        score > 100
      ) {
        throw new ApiRequestError(
          `В правиле ${index + 1} вовлечённость должна быть целым числом от 0 до 100.`,
        );
      }
      normalizedValue = score;
    } else if (normalizedField === "lastContactedAt") {
      if (
        typeof normalizedValue !== "string" ||
        Number.isNaN(Date.parse(normalizedValue))
      ) {
        throw new ApiRequestError(
          `В правиле ${index + 1} указана некорректная дата контакта.`,
        );
      }
    } else if (typeof normalizedValue === "number") {
      throw new ApiRequestError(
        `В правиле ${index + 1} ожидается текстовое значение.`,
      );
    }
    return {
      id:
        optionalText(object.id, `Идентификатор правила ${index + 1}`, 120) ??
        newId("rule"),
      field: normalizedField,
      operator: normalizedOperator,
      value: normalizedValue,
      join: index === 0 ? "and" : join,
    };
  });
}

function parseSegment(
  payload: unknown,
  existing?: SegmentRecord,
): SegmentCreateInput {
  const object = asObject(payload);
  const name = optionalText(object.name, "Название сегмента", 160) ?? existing?.name ?? "";
  if (name.length < 2) {
    throw new ApiRequestError(
      "Название сегмента должно содержать не менее двух символов.",
    );
  }
  const color =
    optionalText(object.color, "Цвет сегмента", 20) ??
    existing?.color ??
    "#6558E8";
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new ApiRequestError("Цвет сегмента должен быть указан в формате #625CF6.");
  }
  return {
    name,
    description:
      optionalText(object.description, "Описание сегмента", 1000) ??
      existing?.description ??
      "",
    rules: object.rules === undefined && existing ? existing.rules : parseRules(object.rules),
    color,
    isDynamic:
      optionalBoolean(object.isDynamic, "Динамический сегмент") ??
      existing?.isDynamic ??
      true,
  };
}

async function allSegmentRecords() {
  const db = getDb();
  const [segmentRows, contactRows, campaignRows] = await Promise.all([
    db.select().from(segments).where(eq(segments.workspaceId, WORKSPACE_ID)).orderBy(desc(segments.updatedAt)),
    db.select().from(contacts).where(eq(contacts.workspaceId, WORKSPACE_ID)),
    db.select().from(campaigns).where(eq(campaigns.workspaceId, WORKSPACE_ID)),
  ]);
  const contactRecords = contactRows.map(toContact);
  return segmentRows.map((segment) =>
    toSegment(segment, contactRecords, campaignRows),
  );
}

export async function listSegments(request: Request): Promise<SegmentsListResponse> {
  await ensureDatabase(request);
  const [records, workspaceRows] = await Promise.all([
    allSegmentRecords(),
    getDb()
      .select({ timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.id, WORKSPACE_ID))
      .limit(1),
  ]);
  return {
    segments: records,
    timezone: workspaceRows[0]?.timezone ?? "Europe/Moscow",
  };
}

export async function createSegment(
  request: Request,
  payload: unknown,
): Promise<SegmentMutationResponse> {
  await ensureDatabase(request);
  const input = parseSegment(payload);
  const db = getDb();
  const duplicate = await db
    .select({ id: segments.id, name: segments.name })
    .from(segments)
    .where(eq(segments.workspaceId, WORKSPACE_ID));
  const normalizedName = input.name.toLocaleLowerCase("ru-RU");
  if (
    duplicate.some(
      (segment) => segment.name.toLocaleLowerCase("ru-RU") === normalizedName,
    )
  ) {
    throw new ApiRequestError("Сегмент с таким названием уже существует.", 409);
  }
  const now = new Date().toISOString();
  const id = newId("segment");
  await db.insert(segments).values({
    id,
    workspaceId: WORKSPACE_ID,
    name: input.name,
    description: input.description ?? "",
    rules: input.rules,
    color: input.color ?? "#6558E8",
    isDynamic: input.isDynamic ?? true,
    createdAt: now,
    updatedAt: now,
  });
  const record = (await allSegmentRecords()).find((segment) => segment.id === id);
  if (!record) throw new Error("Created segment was not found");
  return { segment: record };
}

export async function updateSegment(
  request: Request,
  payload: unknown,
): Promise<SegmentMutationResponse> {
  await ensureDatabase(request);
  const object = asObject(payload);
  const id = cleanText(object.id, "Идентификатор сегмента", 120);
  const existing = (await allSegmentRecords()).find((segment) => segment.id === id);
  if (!existing) throw new ApiRequestError("Сегмент не найден.", 404);
  const input = parseSegment(object, existing);
  const db = getDb();
  const duplicates = await db
    .select({ id: segments.id, name: segments.name })
    .from(segments)
    .where(eq(segments.workspaceId, WORKSPACE_ID));
  const normalizedName = input.name.toLocaleLowerCase("ru-RU");
  if (
    duplicates.some(
      (segment) =>
        segment.id !== id &&
        segment.name.toLocaleLowerCase("ru-RU") === normalizedName,
    )
  ) {
    throw new ApiRequestError("Другой сегмент уже использует это название.", 409);
  }
  await db
    .update(segments)
    .set({
      name: input.name,
      description: input.description ?? "",
      rules: input.rules,
      color: input.color ?? "#6558E8",
      isDynamic: input.isDynamic ?? true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(segments.id, id));
  const record = (await allSegmentRecords()).find((segment) => segment.id === id);
  if (!record) throw new Error("Updated segment was not found");
  return { segment: record };
}

export async function deleteSegment(
  request: Request,
  idValue: unknown,
): Promise<DeleteResponse> {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Идентификатор сегмента", 120);
  const db = getDb();
  const [row] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, id), eq(segments.workspaceId, WORKSPACE_ID)))
    .limit(1);
  if (!row) throw new ApiRequestError("Сегмент не найден.", 404);
  const linked = await db
    .select({ id: campaigns.id, name: campaigns.name, status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.segmentId, id));
  const activeLinks = linked.filter(
    (campaign) => !["completed", "cancelled"].includes(campaign.status),
  );
  if (activeLinks.length) {
    throw new ApiRequestError(
      "Сегмент используется в кампаниях и не может быть удалён.",
      409,
      activeLinks.slice(0, 5).map((campaign) => campaign.name),
    );
  }
  await db.delete(segments).where(eq(segments.id, id));
  return { deletedId: id };
}

function parseWorkspacePatch(payload: unknown): WorkspacePatchInput {
  const object = asObject(payload);
  const input: WorkspacePatchInput = {
    name: optionalText(object.name, "Название пространства", 160),
    companyName: optionalText(object.companyName, "Название компании", 200),
    timezone: optionalText(object.timezone, "Часовой пояс", 100),
    defaultSenderName: optionalText(object.defaultSenderName, "Имя отправителя", 160),
    defaultSenderEmail: optionalEmail(object.defaultSenderEmail, "Email отправителя"),
    replyToEmail: optionalEmail(object.replyToEmail, "Email для ответов"),
    signature: optionalText(object.signature, "Подпись", 4000),
    requireConsent: optionalBoolean(object.requireConsent, "Требовать согласие"),
    notifyCampaignComplete: optionalBoolean(object.notifyCampaignComplete, "Уведомлять о завершении"),
    notifyBlockedCampaign: optionalBoolean(object.notifyBlockedCampaign, "Уведомлять о блокировке"),
    participantName: optionalText(object.participantName, "Имя участника", 160),
    participantEmail: optionalEmail(object.participantEmail, "Email участника"),
  };
  Object.keys(input).forEach((key) => {
    if (input[key as keyof WorkspacePatchInput] === undefined) {
      delete input[key as keyof WorkspacePatchInput];
    }
  });
  if (!Object.keys(input).length) {
    throw new ApiRequestError("Нет настроек для сохранения.");
  }
  if (object.name !== undefined && !input.name) {
    throw new ApiRequestError("Название рабочего пространства не может быть пустым.");
  }
  if (object.companyName !== undefined && !input.companyName) {
    throw new ApiRequestError("Название компании не может быть пустым.");
  }
  if (object.participantName !== undefined && !input.participantName) {
    throw new ApiRequestError("Имя участника не может быть пустым.");
  }
  if (object.timezone !== undefined && !input.timezone) {
    throw new ApiRequestError("Часовой пояс не может быть пустым.");
  }
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat("ru-RU", { timeZone: input.timezone }).format();
    } catch {
      throw new ApiRequestError("Указан неизвестный часовой пояс.");
    }
  }
  return input;
}

export async function updateWorkspace(
  request: Request,
  payload: unknown,
): Promise<WorkspacePatchResponse> {
  const actor = await ensureDatabase(request);
  const input = parseWorkspacePatch(payload);
  const db = getDb();
  const now = new Date().toISOString();
  const {
    participantName,
    participantEmail,
    ...workspaceChanges
  } = input;
  if (Object.keys(workspaceChanges).length) {
    await db
      .update(workspaces)
      .set({ ...workspaceChanges, updatedAt: now })
      .where(eq(workspaces.id, WORKSPACE_ID));
  }
  if (participantName !== undefined || participantEmail !== undefined) {
    await db
      .update(participants)
      .set({
        ...(participantName !== undefined ? { displayName: participantName } : {}),
        ...(participantEmail !== undefined ? { email: participantEmail } : {}),
        updatedAt: now,
      })
      .where(eq(participants.id, actor.participant.id));
  }
  const [workspaceRow, participantRow] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, WORKSPACE_ID)).limit(1),
    db.select().from(participants).where(eq(participants.id, actor.participant.id)).limit(1),
  ]);
  return {
    workspace: toWorkspace(workspaceRow[0]),
    participant: toParticipant(participantRow[0]),
  };
}

function providerId(value: unknown): IntegrationProviderId {
  if (!PROVIDERS.includes(value as IntegrationProviderId)) {
    throw new ApiRequestError("Выбран неизвестный провайдер.");
  }
  return value as IntegrationProviderId;
}

const SENSITIVE_KEY = /(token|secret|password|api.?key|credential|access.?key)/i;

const PUBLIC_CONFIG_FIELDS: Record<IntegrationProviderId, string[]> = {
  "vk-workspace": ["senderEmail"],
  "telegram-bot-api": ["botUsername"],
  "vk-api": ["communityId"],
  unisender: ["senderEmail", "listId"],
};

function parsePublicConfig(
  value: unknown,
  selectedProvider: IntegrationProviderId,
): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  const object = asObject(value);
  const entries = Object.entries(object);
  if (entries.length > 30) {
    throw new ApiRequestError("Слишком много открытых параметров интеграции.");
  }
  const result: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    if (SENSITIVE_KEY.test(key)) {
      throw new ApiRequestError(
        "Секреты, токены и пароли нельзя сохранять через этот интерфейс. Добавьте их в защищённую конфигурацию сервера.",
      );
    }
    const safeKey = cleanText(key, "Название параметра", 80);
    if (!PUBLIC_CONFIG_FIELDS[selectedProvider].includes(safeKey)) {
      throw new ApiRequestError(
        `Параметр «${safeKey}» нельзя сохранять для этого провайдера.`,
      );
    }
    const safeValue = cleanText(rawValue, `Параметр ${safeKey}`, 500);
    if (safeKey.toLowerCase().includes("email") && safeValue) {
      normalizeEmail(safeValue, `Параметр ${safeKey}`);
    }
    if (safeKey.toLowerCase().endsWith("url") && safeValue) {
      try {
        const url = new URL(safeValue);
        if (url.protocol !== "https:") throw new Error("HTTPS is required");
      } catch {
        throw new ApiRequestError(
          `Параметр «${safeKey}» должен быть корректным HTTPS-адресом.`,
        );
      }
    }
    if (safeValue) result[safeKey] = safeValue;
  }
  return result;
}

async function allIntegrationRecords(): Promise<IntegrationRecord[]> {
  const rows = await getDb()
    .select()
    .from(integrations)
    .where(eq(integrations.workspaceId, WORKSPACE_ID))
    .orderBy(integrations.providerId);
  return rows
    .filter((row) => PROVIDERS.includes(row.providerId))
    .map(toIntegrationRecord);
}

export async function listIntegrations(
  request: Request,
): Promise<IntegrationsListResponse> {
  await ensureDatabase(request);
  return { integrations: await allIntegrationRecords() };
}

export async function updateIntegration(
  request: Request,
  payload: unknown,
): Promise<IntegrationMutationResponse> {
  await ensureDatabase(request);
  const object = asObject(payload);
  const selectedProvider = providerId(object.providerId);
  const input: IntegrationPatchInput = {
    providerId: selectedProvider,
    action: object.action as IntegrationPatchInput["action"],
    enabled: optionalBoolean(object.enabled, "Интеграция включена"),
    publicConfig: parsePublicConfig(object.publicConfig, selectedProvider),
  };
  if (
    input.action !== undefined &&
    input.action !== "save" &&
    input.action !== "check" &&
    input.action !== "disconnect"
  ) {
    throw new ApiRequestError("Неизвестное действие с интеграцией.");
  }
  const db = getDb();
  const [existing] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, WORKSPACE_ID),
        eq(integrations.providerId, input.providerId),
      ),
    )
    .limit(1);
  if (!existing) throw new ApiRequestError("Интеграция не найдена.", 404);
  const now = new Date().toISOString();
  const [savedRow] = await db
    .update(integrations)
    .set(
      input.action === "disconnect"
        ? {
            enabled: false,
            publicConfig: {},
            lastCheckedAt: null,
            checkStatus: "disconnected",
            checkMessage: "Интеграция отключена.",
            updatedAt: now,
          }
        : input.action === "check"
          ? { updatedAt: now }
        : {
            enabled: input.enabled ?? existing.enabled,
            publicConfig: input.publicConfig ?? existing.publicConfig,
            lastCheckedAt: null,
            checkStatus: "needs_attention",
            checkMessage: "Настройки изменены. Выполните проверку провайдера.",
            updatedAt: now,
          },
    )
    .where(eq(integrations.id, existing.id))
    .returning();
  if (input.action !== "check") {
    return { integration: toIntegrationRecord(savedRow) };
  }

  const checkedAt = new Date().toISOString();
  const checkedIntegration = toIntegrationRecord(savedRow);
  const check = await checkProviderConnection(checkedIntegration);
  const [checkedRow] = await db
    .update(integrations)
    .set({
      checkStatus: check.ok ? "connected" : "needs_attention",
      checkMessage: check.message,
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
    })
    .where(eq(integrations.id, existing.id))
    .returning();
  return { integration: toIntegrationRecord(checkedRow) };
}

function parseChannelInputs(value: unknown): CampaignChannelInput[] {
  if (!Array.isArray(value)) {
    throw new ApiRequestError("Каналы кампании должны быть переданы списком.");
  }
  if (value.length > CHANNELS.length) {
    throw new ApiRequestError("В кампании слишком много каналов.");
  }
  const result = value.map((raw) => {
    const object = asObject(raw);
    const channel = cleanText(object.channel, "Канал", 30) as DeliveryChannelId;
    if (!CHANNELS.includes(channel)) {
      throw new ApiRequestError("Выбран неизвестный канал кампании.");
    }
    const selectedProvider = providerId(object.providerId);
    if (!assertProviderSupportsChannel(selectedProvider, channel)) {
      throw new ApiRequestError(
        "Выбранный провайдер не поддерживает этот канал.",
      );
    }
    return { channel, providerId: selectedProvider };
  });
  if (new Set(result.map((item) => item.channel)).size !== result.length) {
    throw new ApiRequestError("Каждый канал можно добавить в кампанию только один раз.");
  }
  return result;
}

type ParsedCampaign = {
  name: string;
  audienceType: CampaignRecord["audienceType"];
  segmentId: string | null;
  contactIds: string[];
  templateId: string | null;
  presentationId: string | null;
  senderName: string;
  senderEmail: string;
  subject: string;
  previewText: string;
  emailBodyText: string;
  emailBodyHtml: string;
  emailBuilderDocument: CampaignRecord["emailBuilderDocument"];
  messengerMessage: string;
  channels: CampaignChannelInput[];
  scheduledAt: string | null;
};

function campaignSenderEmail(
  value: unknown,
  existing: CampaignRecord | undefined,
  workspace: WorkspaceRecord,
): string {
  if (value === undefined) {
    return existing?.senderEmail ?? workspace.defaultSenderEmail;
  }
  if (typeof value !== "string") {
    throw new ApiRequestError("Поле «Email отправителя» должно быть текстом.");
  }
  return value.trim() ? normalizeEmail(value, "Email отправителя") : "";
}

function parseCampaign(
  payload: unknown,
  defaults: {
    workspace: WorkspaceRecord;
    campaign?: CampaignRecord;
    plans?: DeliveryPlanRecord[];
  },
): ParsedCampaign {
  const object = asObject(payload);
  const existing = defaults.campaign;
  const name = optionalText(object.name, "Название кампании", 200) ?? existing?.name ?? "";
  if (!name) throw new ApiRequestError("Укажите название кампании.");
  const audienceType =
    (object.audienceType as ParsedCampaign["audienceType"] | undefined) ??
    existing?.audienceType ??
    "none";
  if (
    audienceType !== "none" &&
    audienceType !== "segment" &&
    audienceType !== "contacts"
  ) {
    throw new ApiRequestError("Выбран неизвестный тип аудитории.");
  }
  const parsedSegmentId = nullableText(object.segmentId, "Сегмент", 120);
  const segmentId =
    parsedSegmentId === undefined ? (existing?.segmentId ?? null) : parsedSegmentId;
  const contactIds =
    optionalStringArray(object.contactIds, "Контакты", 50_000) ??
    existing?.contactIds ??
    [];
  const existingChannels = defaults.plans?.map((plan) => ({
    channel: plan.channel,
    providerId: plan.providerId,
  }));
  const channels =
    object.channels === undefined && existingChannels
      ? existingChannels
      : object.channels === undefined
        ? []
        : parseChannelInputs(object.channels);
  const scheduledAt = (() => {
    const parsed = parseIsoDate(object.scheduledAt, "Дата запуска");
    return parsed === undefined ? (existing?.scheduledAt ?? null) : parsed;
  })();
  if (scheduledAt && Date.parse(scheduledAt) <= Date.now()) {
    throw new ApiRequestError(
      "Дата запуска уже прошла. Выберите будущую дату или уберите расписание.",
    );
  }
  const emailBodyText =
    optionalText(object.emailBodyText, "Текст email-письма", 20_000) ??
    existing?.emailBodyText ??
    "";
  const subject =
    optionalText(object.subject, "Тема письма", 300) ?? existing?.subject ?? "";
  const previewText =
    optionalText(object.previewText, "Прехедер", 500) ??
    existing?.previewText ??
    "";
  const parsedBuilderDocument =
    object.emailBuilderDocument === undefined
      ? (existing?.emailBuilderDocument ?? null)
      : parseEmailBuilderDocument(object.emailBuilderDocument);
  const emailBuilderDocument = parsedBuilderDocument
    ? { ...parsedBuilderDocument, subject, previewText }
    : null;
  const emailBodyHtml = emailBuilderDocument
    ? compileEmailDocument(emailBuilderDocument)
    : plainTextEmailHtml(emailBodyText, previewText);
  return {
    name,
    audienceType,
    segmentId: audienceType === "segment" ? segmentId : null,
    contactIds: audienceType === "contacts" ? contactIds : [],
    templateId: (() => {
      const parsed = nullableText(object.templateId, "Шаблон", 120);
      return parsed === undefined ? (existing?.templateId ?? null) : parsed;
    })(),
    presentationId: (() => {
      const parsed = nullableText(object.presentationId, "Презентация", 160);
      return parsed === undefined ? (existing?.presentationId ?? null) : parsed;
    })(),
    senderName:
      optionalText(object.senderName, "Имя отправителя", 160) ??
      existing?.senderName ??
      defaults.workspace.defaultSenderName,
    senderEmail: campaignSenderEmail(
      object.senderEmail,
      existing,
      defaults.workspace,
    ),
    subject,
    previewText,
    emailBodyText,
    emailBodyHtml,
    emailBuilderDocument,
    messengerMessage:
      optionalText(object.messengerMessage, "Сообщение", 4000) ??
      existing?.messengerMessage ??
      "",
    channels,
    scheduledAt,
  };
}

async function workspaceRecord(): Promise<WorkspaceRecord> {
  const [row] = await getDb()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, WORKSPACE_ID))
    .limit(1);
  if (!row) throw new Error("Workspace is unavailable");
  return toWorkspace(row);
}

async function campaignBundle(id: string) {
  const db = getDb();
  const [campaignRows, planRows] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, WORKSPACE_ID)))
      .limit(1),
    db.select().from(deliveryPlans).where(eq(deliveryPlans.campaignId, id)),
  ]);
  if (!campaignRows[0]) throw new ApiRequestError("Кампания не найдена.", 404);
  return {
    campaign: toCampaign(campaignRows[0]),
    plans: planRows.map(toDeliveryPlan),
  };
}

async function validateAudience(input: ParsedCampaign) {
  const db = getDb();
  if (input.audienceType === "none") return "Аудитория не выбрана";
  if (input.audienceType === "segment") {
    if (!input.segmentId) return "Аудитория не выбрана";
    const [segment] = await db
      .select()
      .from(segments)
      .where(
        and(
          eq(segments.id, input.segmentId!),
          eq(segments.workspaceId, WORKSPACE_ID),
        ),
      )
      .limit(1);
    if (!segment) throw new ApiRequestError("Выбранный сегмент не найден.");
    return segment.name;
  }
  if (!input.contactIds.length) return "Аудитория не выбрана";
  const rows: { id: string }[] = [];
  for (const idChunk of chunksOf(input.contactIds)) {
    rows.push(
      ...(await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.workspaceId, WORKSPACE_ID),
            inArray(contacts.id, idChunk),
          ),
        )),
    );
  }
  if (rows.length !== input.contactIds?.length) {
    throw new ApiRequestError(
      "Некоторые выбранные контакты больше не существуют. Обновите аудиторию.",
    );
  }
  return `${rows.length} ${rows.length === 1 ? "контакт" : "контактов"}`;
}

async function savePlans(
  campaignId: string,
  channelInputs: CampaignChannelInput[],
  existingPlans: DeliveryPlanRecord[],
  now: string,
) {
  const db = getDb();
  const selectedChannels = new Set(channelInputs.map((item) => item.channel));
  for (const plan of existingPlans) {
    if (!selectedChannels.has(plan.channel)) {
      await db.delete(deliveryPlans).where(eq(deliveryPlans.id, plan.id));
    }
  }
  for (const input of channelInputs) {
    const existing = existingPlans.find((plan) => plan.channel === input.channel);
    if (existing) {
      await db
        .update(deliveryPlans)
        .set({
          providerId: input.providerId,
          status: "draft",
          eligibleCount: 0,
          blockedCount: 0,
          statusReason: "План нужно проверить перед запуском.",
          updatedAt: now,
        })
        .where(eq(deliveryPlans.id, existing.id));
    } else {
      await db.insert(deliveryPlans).values({
        id: newId("plan"),
        campaignId,
        channel: input.channel,
        providerId: input.providerId,
        status: "draft",
        eligibleCount: 0,
        blockedCount: 0,
        statusReason: "План нужно проверить перед запуском.",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

async function appendEvent(
  campaignId: string,
  type: CampaignEventRecord["type"],
  message: string,
  details: Record<string, unknown>,
): Promise<CampaignEventRecord> {
  const now = new Date().toISOString();
  const [row] = await getDb()
    .insert(campaignEvents)
    .values({
      id: newId("event"),
      workspaceId: WORKSPACE_ID,
      campaignId,
      type,
      message,
      details,
      occurredAt: now,
    })
    .returning();
  return toCampaignEvent(row);
}

export async function listCampaigns(
  request: Request,
): Promise<CampaignsListResponse> {
  await ensureDatabase(request);
  const db = getDb();
  const [campaignRows, planRows, jobRows, eventRows] = await Promise.all([
    db.select().from(campaigns).where(eq(campaigns.workspaceId, WORKSPACE_ID)).orderBy(desc(campaigns.updatedAt)),
    db.select().from(deliveryPlans),
    db
      .select()
      .from(deliveryJobs)
      .where(eq(deliveryJobs.workspaceId, WORKSPACE_ID))
      .orderBy(desc(deliveryJobs.createdAt))
      .limit(WORKSPACE_HISTORY_LIMIT),
    db.select().from(campaignEvents).where(eq(campaignEvents.workspaceId, WORKSPACE_ID)).orderBy(desc(campaignEvents.occurredAt)).limit(WORKSPACE_HISTORY_LIMIT),
  ]);
  return {
    campaigns: campaignRows.map(toCampaign),
    deliveryPlans: planRows.map(toDeliveryPlan),
    deliveryJobs: jobRows.map(toDeliveryJob),
    events: eventRows.map(toCampaignEvent),
    historyWindow: {
      scope: "latest_workspace",
      deliveryJobsLimit: WORKSPACE_HISTORY_LIMIT,
      campaignEventsLimit: WORKSPACE_HISTORY_LIMIT,
    },
  };
}

export async function createCampaign(
  request: Request,
  payload: unknown,
): Promise<CampaignMutationResponse> {
  const actor = await ensureDatabase(request);
  const workspace = await workspaceRecord();
  const input = parseCampaign(payload, { workspace });
  const audienceLabel = await validateAudience(input);
  if (input.templateId) {
    await assertEmailTemplateReference(request, input.templateId);
  }
  const now = new Date().toISOString();
  const id = newId("campaign");
  const db = getDb();
  await db.insert(campaigns).values({
    id,
    workspaceId: WORKSPACE_ID,
    participantId: actor.participant.id,
    name: input.name,
    audienceType: input.audienceType,
    audienceLabel,
    segmentId: input.segmentId ?? null,
    contactIds: input.contactIds ?? [],
    templateId: input.templateId ?? null,
    presentationId: input.presentationId ?? null,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    subject: input.subject,
    previewText: input.previewText,
    emailBodyText: input.emailBodyText,
    emailBodyHtml: input.emailBodyHtml,
    emailBuilderDocument: input.emailBuilderDocument,
    messengerMessage: input.messengerMessage,
    deliveryChannels: input.channels.map((item) => item.channel),
    status: "draft",
    statusReason: "Черновик сохранён. Запустите проверку перед отправкой.",
    scheduledAt: input.scheduledAt ?? null,
    sentAt: null,
    metrics: EMPTY_METRICS,
    readyVersionId: null,
    createdAt: now,
    updatedAt: now,
  });
  await savePlans(id, input.channels, [], now);
  const event = await appendEvent(
    id,
    "campaign_created",
    "Кампания создана как черновик.",
    { channels: input.channels.map((item) => item.channel) },
  );
  const bundle = await campaignBundle(id);
  return { campaign: bundle.campaign, deliveryPlans: bundle.plans, event };
}

async function audienceForCampaign(
  campaign: CampaignRecord,
): Promise<ContactRecord[]> {
  const db = getDb();
  const contactRows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.workspaceId, WORKSPACE_ID));
  const records = contactRows.map(toContact);
  if (campaign.audienceType === "contacts") {
    const selected = new Set(campaign.contactIds);
    return records.filter((contact) => selected.has(contact.id));
  }
  if (!campaign.segmentId) return [];
  const [segment] = await db
    .select()
    .from(segments)
    .where(eq(segments.id, campaign.segmentId))
    .limit(1);
  return segment
    ? records.filter((contact) => contactMatchesSegment(contact, segment.rules))
    : [];
}

async function versionHash(snapshot: CampaignVersionSnapshot): Promise<string> {
  const value = JSON.stringify(snapshot);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256-${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function recipientFingerprints(
  plans: DeliveryPlanRecord[],
  audience: ContactRecord[],
  requireConsent: boolean,
) {
  return plans.flatMap((plan) =>
    audience
      .filter((contact) => contactEligible(contact, plan.channel, requireConsent))
      .map((contact) =>
        JSON.stringify([
          plan.channel,
          plan.providerId,
          contact.id,
          endpointForContact(contact, plan.channel),
          contact.status,
          plan.channel === "email"
            ? contact.emailConsent
            : plan.channel === "telegram"
              ? contact.telegramConsent
              : contact.vkConsent,
          contact.firstName,
          contact.lastName,
          contact.companyName,
          contact.jobTitle,
          contact.city,
        ]),
      ),
  ).sort();
}

async function ensureCampaignVersion(
  campaign: CampaignRecord,
  plans: DeliveryPlanRecord[],
  audience: ContactRecord[],
  workspace: WorkspaceRecord,
): Promise<CampaignVersionRecord> {
  const snapshot: CampaignVersionSnapshot = {
    campaignId: campaign.id,
    name: campaign.name,
    audienceType: campaign.audienceType,
    segmentId: campaign.segmentId,
    contactIds: campaign.contactIds,
    presentationId: campaign.presentationId,
    audienceContactIds: audience.map((contact) => contact.id).sort(),
    senderName: campaign.senderName,
    senderEmail: campaign.senderEmail,
    subject: campaign.subject,
    previewText: campaign.previewText,
    emailBodyText: campaign.emailBodyText,
    emailBodyHtml: campaign.emailBodyHtml,
    emailBuilderDocument: campaign.emailBuilderDocument,
    messengerMessage: campaign.messengerMessage,
    channels: [...plans]
      .sort((left, right) => left.channel.localeCompare(right.channel))
      .map((plan) => ({ channel: plan.channel, providerId: plan.providerId })),
    scheduledAt: campaign.scheduledAt,
    recipientFingerprints: recipientFingerprints(
      plans,
      audience,
      workspace.requireConsent,
    ),
  };
  const contentHash = await versionHash(snapshot);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(campaignVersions)
    .where(
      and(
        eq(campaignVersions.campaignId, campaign.id),
        eq(campaignVersions.contentHash, contentHash),
      ),
    )
    .limit(1);
  if (existing) {
    if (JSON.stringify(existing.snapshot) !== JSON.stringify(snapshot)) {
      throw new Error("SHA-256 collision detected for campaign version");
    }
    return toCampaignVersion(existing);
  }
  const [latest] = await db
    .select({ version: campaignVersions.version })
    .from(campaignVersions)
    .where(eq(campaignVersions.campaignId, campaign.id))
    .orderBy(desc(campaignVersions.version))
    .limit(1);
  const id = newId("campaign-version");
  await db
    .insert(campaignVersions)
    .values({
      id,
      campaignId: campaign.id,
      version: (latest?.version ?? 0) + 1,
      contentHash,
      snapshot,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  const [created] = await db
    .select()
    .from(campaignVersions)
    .where(
      and(
        eq(campaignVersions.campaignId, campaign.id),
        eq(campaignVersions.contentHash, contentHash),
      ),
    )
    .limit(1);
  if (!created) throw new Error("Campaign version was not created");
  return toCampaignVersion(created);
}

function contactEligible(
  contact: ContactRecord,
  channel: DeliveryChannelId,
  requireConsent: boolean,
) {
  if (contact.status !== "active") return false;
  if (channel === "email") {
    return Boolean(contact.email) && (!requireConsent || contact.emailConsent);
  }
  if (channel === "telegram") {
    return Boolean(contact.telegramChatId) && contact.telegramConsent;
  }
  return Boolean(contact.vkUserId) && contact.vkConsent;
}

function renderContactTemplate(value: string, contact: ContactRecord) {
  return renderMergeTemplate(value, {
    first_name: contact.firstName,
    last_name: contact.lastName,
    company: contact.companyName,
    position: contact.jobTitle,
    city: contact.city,
  });
}

function localEmailAssetUrls(campaign: CampaignRecord) {
  return (campaign.emailBuilderDocument?.blocks ?? [])
    .filter((block) => block.type === "image" || block.type === "logo")
    .map((block) => block.href)
    .filter((href): href is string => Boolean(href))
    .filter((href) => {
      try {
        const url = new URL(href);
        const host = url.hostname.toLocaleLowerCase("en");
        return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
      } catch {
        return false;
      }
    });
}

async function evaluateLaunch(
  request: Request,
  campaignId: string,
): Promise<{
  evaluation: CampaignEvaluation;
  event: CampaignEventRecord;
  campaign: CampaignRecord;
  deliveryPlans: DeliveryPlanRecord[];
}> {
  const db = getDb();
  const [{ campaign, plans }, workspace, integrationRecords] = await Promise.all([
    campaignBundle(campaignId),
    workspaceRecord(),
    allIntegrationRecords(),
  ]);
  const audience = await audienceForCampaign(campaign);
  const blockers: string[] = [];
  const eligibleByChannel: CampaignEvaluation["eligibleByChannel"] = {};
  const unknownTokens = unknownMergeTokens(
    campaign.subject,
    campaign.emailBodyText,
    campaign.emailBodyHtml,
    campaign.messengerMessage,
  );
  if (unknownTokens.length) {
    blockers.push(
      `Неизвестные поля персонализации: ${unknownTokens.map((token) => `{{${token}}}`).join(", ")}.`,
    );
  }
  if (localEmailAssetUrls(campaign).length) {
    blockers.push(
      "В письме есть изображение с локального адреса. Откройте и сохраните шаблон на опубликованном домене «Потока», затем повторите проверку — иначе получатель не увидит картинку.",
    );
  }
  if (!audience.length) blockers.push("В аудитории нет подходящих контактов.");
  if (!plans.length) blockers.push("В кампании не настроен ни один канал.");
  if (campaign.presentationId) {
    const emailPlan = plans.find((plan) => plan.channel === "email");
    if (!emailPlan || emailPlan.providerId !== "unisender") {
      blockers.push("Презентацию во вложении можно отправить только через Email → UniSender.");
    } else {
      try {
        const { presentation } = await getPresentationProject(request, campaign.presentationId);
        const pptx = await buildPresentationPptx(request, presentation);
        if (pptx.byteLength > 500_000) blockers.push("Презентация больше 500 КБ — уменьшите изображения перед отправкой через UniSender.");
      } catch (error) {
        blockers.push(error instanceof Error ? error.message : "Презентация для вложения недоступна.");
      }
    }
  }
  if (campaign.scheduledAt && Date.parse(campaign.scheduledAt) <= Date.now()) {
    blockers.push("Дата запланированного запуска уже прошла. Выберите новую дату или режим «Сейчас».");
  }

  for (const plan of plans) {
    const channelBlockers: string[] = [];
    const eligibleCount = audience.filter((contact) =>
      contactEligible(contact, plan.channel, workspace.requireConsent),
    ).length;
    eligibleByChannel[plan.channel] = eligibleCount;
    const provider = integrationRecords.find(
      (integration) => integration.providerId === plan.providerId,
    );
    const definition = integrationProviders.find(
      (item) => item.id === plan.providerId,
    );
    if (definition?.deliveryMode === "roadmap") {
      channelBlockers.push(
        `${definition.name}: адаптер отправки находится в плане развития. Выберите реализованный провайдер.`,
      );
    } else if (!provider || !isIntegrationReadyForChannel(provider, plan.channel)) {
      channelBlockers.push(
        `${provider?.name ?? plan.providerId}: выполните успешную проверку подключения.`,
      );
    }
    if (eligibleCount === 0) {
      channelBlockers.push(
        `${plan.channel}: нет контактов с адресом и подтверждённым согласием.`,
      );
    }
    if (
      (plan.providerId === "telegram-bot-api" || plan.providerId === "vk-api") &&
      eligibleCount > 100
    ) {
      channelBlockers.push(
        `${provider?.name ?? plan.providerId}: прямой синхронный маршрут ограничен 100 получателями; для большего объёма нужна серверная очередь.`,
      );
    }
    if (plan.channel === "email") {
      if (!campaign.subject.trim()) channelBlockers.push("Укажите тему email-письма.");
      if (!campaign.senderName.trim()) channelBlockers.push("Укажите имя отправителя.");
      if (!campaign.senderEmail.trim()) channelBlockers.push("Укажите email отправителя.");
      if (!campaign.emailBodyText.trim()) channelBlockers.push("Добавьте текст email-письма.");
      if (
        (plan.providerId === "unisender" || plan.providerId === "vk-workspace") &&
        provider?.publicConfig.senderEmail?.toLocaleLowerCase("en") !==
          campaign.senderEmail.toLocaleLowerCase("en")
      ) {
        channelBlockers.push(
          `Email отправителя кампании должен совпадать с адресом, настроенным для ${provider?.name ?? "провайдера"}.`,
        );
      }
    } else if (!campaign.messengerMessage.trim()) {
      channelBlockers.push(`Заполните сообщение для канала ${plan.channel}.`);
    }
    blockers.push(...channelBlockers);
    await db
      .update(deliveryPlans)
      .set({
        status: channelBlockers.length ? "blocked" : "ready",
        eligibleCount,
        blockedCount: Math.max(0, audience.length - eligibleCount),
        statusReason: channelBlockers.length
          ? channelBlockers.join(" ")
          : definition?.deliveryMode === "manual_export"
            ? "Готов к ручному CSV-экспорту; автоматической отправки нет."
            : "Канал готов к явному запуску отправки.",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(deliveryPlans.id, plan.id));
  }

  const scheduled =
    !blockers.length &&
    campaign.scheduledAt !== null &&
    Date.parse(campaign.scheduledAt) > Date.now();
  const status: CampaignEvaluation["status"] = blockers.length
    ? "blocked"
    : scheduled
      ? "scheduled"
      : "ready";
  const statusReason =
    status === "blocked"
      ? blockers.join(" ")
      : status === "scheduled"
        ? `Проверка пройдена. Письмо будет передано провайдеру по расписанию: ${campaign.scheduledAt}.`
        : "Проверка пройдена. Кампания готова, но внешняя отправка не запускалась.";
  const metrics = { ...campaign.metrics, recipients: audience.length };
  const readyVersion = blockers.length
    ? null
    : await ensureCampaignVersion(
        campaign,
        plans,
        audience,
        workspace,
      );
  await db
    .update(campaigns)
    .set({
      status,
      statusReason,
      metrics,
      readyVersionId: readyVersion?.id ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(campaigns.id, campaignId));
  const eventType =
    status === "blocked"
      ? "launch_blocked"
      : status === "scheduled"
        ? "launch_scheduled"
        : "launch_ready";
  const event = await appendEvent(
    campaignId,
    eventType,
    statusReason,
    {
      eligibleByChannel,
      blockers,
      readyVersionId: readyVersion?.id ?? null,
      externalSendPerformed: false,
    },
  );
  const updated = await campaignBundle(campaignId);
  return {
    evaluation: { status, eligibleByChannel, blockers },
    event,
    campaign: updated.campaign,
    deliveryPlans: updated.plans,
  };
}

async function campaignVersionById(id: string): Promise<CampaignVersionRecord> {
  const [row] = await getDb()
    .select()
    .from(campaignVersions)
    .where(eq(campaignVersions.id, id))
    .limit(1);
  if (!row) {
    throw new ApiRequestError(
      "Проверенная версия кампании не найдена. Повторите проверку готовности.",
      409,
    );
  }
  return toCampaignVersion(row);
}

async function blockDispatch(campaignId: string, reason: string): Promise<never> {
  const now = new Date().toISOString();
  await getDb()
    .update(campaigns)
    .set({
      status: "blocked",
      statusReason: reason,
      readyVersionId: null,
      updatedAt: now,
    })
    .where(eq(campaigns.id, campaignId));
  await appendEvent(campaignId, "dispatch_blocked", reason, {
    externalSendPerformed: false,
  });
  throw new ApiRequestError(reason, 409);
}

function endpointForContact(
  contact: ContactRecord,
  channel: DeliveryChannelId,
): string {
  if (channel === "email") return contact.email;
  if (channel === "telegram") return contact.telegramChatId ?? "";
  return contact.vkUserId ?? "";
}

async function updateOutboxResult(
  row: DeliveryOutboxRecord,
  result: {
    status: "accepted" | "rejected" | "ambiguous";
    externalId?: string;
    message: string;
  },
) {
  await getDb()
    .update(deliveryOutbox)
    .set({
      status: result.status,
      externalId: result.externalId ?? null,
      statusMessage: result.message,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(deliveryOutbox.id, row.id));
}

async function processDirectOutbox(
  rows: DeliveryOutboxRecord[],
  messengerMessage: string,
) {
  const contactsById = new Map(
    (await getDb()
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, WORKSPACE_ID)))
      .map(toContact)
      .map((contact) => [contact.id, contact]),
  );
  for (const [providerId, paceMs] of [
    ["telegram-bot-api", 40],
    ["vk-api", 350],
  ] as const) {
    const providerRows = rows.filter((row) => row.providerId === providerId);
    for (let index = 0; index < providerRows.length; index += 1) {
      const row = providerRows[index];
      const contact = contactsById.get(row.contactId);
      if (!contact) {
        await updateOutboxResult(row, {
          status: "rejected",
          message: "Контакт удалён до обработки задания.",
        });
        continue;
      }
        await getDb()
          .update(deliveryOutbox)
          .set({
            status: "processing",
            attempts: row.attempts + 1,
            statusMessage: "Запрос передан адаптеру.",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(deliveryOutbox.id, row.id));
        if (row.providerId === "telegram-bot-api") {
          const credentials = automaticProviderSecrets(row.providerId) as {
            token?: string;
          };
          const result = await sendTelegramMessage({
            token: credentials.token ?? "",
            chatId: row.recipientEndpoint,
            text: renderContactTemplate(messengerMessage, contact),
            signal: AbortSignal.timeout(15_000),
          });
          await updateOutboxResult(row, result);
        } else {
          const credentials = automaticProviderSecrets(row.providerId) as {
            accessToken?: string;
          };
          const result = await sendVkMessage({
            accessToken: credentials.accessToken ?? "",
            peerId: row.recipientEndpoint,
            message: renderContactTemplate(messengerMessage, contact),
            idempotencyKey: row.idempotencyKey,
            signal: AbortSignal.timeout(15_000),
          });
          await updateOutboxResult(row, result);
        }
      if (index < providerRows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, paceMs));
      }
    }
  }
}

async function processUniSenderOutbox(
  request: Request,
  rows: DeliveryOutboxRecord[],
  integration: IntegrationRecord,
  version: CampaignVersionRecord,
) {
  if (!rows.length) return {} as Record<string, string>;
  const contactsById = new Map(
    (await getDb()
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, WORKSPACE_ID)))
      .map(toContact)
      .map((contact) => [contact.id, contact]),
  );
  await getDb()
    .update(deliveryOutbox)
    .set({
      status: "processing",
      attempts: 1,
      statusMessage: "UniSender импортирует аудиторию перед созданием письма.",
      updatedAt: new Date().toISOString(),
    })
    .where(inArray(deliveryOutbox.id, rows.map((row) => row.id)));
  const credentials = automaticProviderSecrets("unisender") as {
    apiKey?: string;
  };
  const attachment = version.snapshot.presentationId
    ? await (async () => {
        const { presentation } = await getPresentationProject(request, version.snapshot.presentationId);
        const bytes = await buildPresentationPptx(request, presentation);
        if (bytes.byteLength > 500_000) {
          throw new ApiRequestError("Презентация больше 500 КБ — UniSender не примет такое вложение. Уменьшите изображения или отправьте ссылку.", 422);
        }
        return { filename: safePresentationFilename(presentation.name), bytes };
      })()
    : null;
  const result = await createUniSenderCampaign({
    apiKey: credentials.apiKey ?? "",
    listId: integration.publicConfig.listId ?? "",
    senderName: version.snapshot.senderName,
    senderEmail: version.snapshot.senderEmail,
    subject: version.snapshot.subject,
    textBody: version.snapshot.emailBodyText,
    htmlBody: version.snapshot.emailBodyHtml,
    attachments: attachment ? [attachment] : undefined,
    recipients: rows.map((row) => ({
      email: row.recipientEndpoint,
      name: contactsById.get(row.contactId)?.fullName ?? "",
      outboxId: row.id,
      mergeFields: (() => {
        const contact = contactsById.get(row.contactId);
        return contact
          ? {
              first_name: contact.firstName,
              last_name: contact.lastName,
              company: contact.companyName,
              position: contact.jobTitle,
              city: contact.city,
            }
          : {};
      })(),
    })),
    signal: AbortSignal.timeout(30_000),
  });
  const acceptedIds = new Set(result.acceptedOutboxIds);
  const rejectedIds = new Set(result.rejectedOutboxIds);
  for (const row of rows) {
    if (acceptedIds.has(row.id) && result.status === "accepted") {
      await updateOutboxResult(row, {
        status: "accepted",
        externalId: result.campaignId,
        message: result.message,
      });
    } else if (rejectedIds.has(row.id)) {
      await updateOutboxResult(row, {
        status: "rejected",
        message: "UniSender не включил этот адрес в принятую кампанию.",
      });
    } else {
      await updateOutboxResult(row, {
        status: result.status === "rejected" ? "rejected" : "ambiguous",
        externalId: result.campaignId ?? result.messageId,
        message: result.message,
      });
    }
  }
  return {
    ...(result.messageId ? { messageId: result.messageId } : {}),
    ...(result.campaignId ? { campaignId: result.campaignId } : {}),
    listId: integration.publicConfig.listId ?? "",
  };
}

async function processVkWorkspaceSmtpOutbox(
  rows: DeliveryOutboxRecord[],
  integration: IntegrationRecord,
  version: CampaignVersionRecord,
) {
  if (!rows.length) return {} as Record<string, string>;
  const contactsById = new Map(
    (await getDb().select().from(contacts).where(eq(contacts.workspaceId, WORKSPACE_ID)))
      .map(toContact)
      .map((contact) => [contact.id, contact]),
  );
  await getDb().update(deliveryOutbox).set({
    status: "processing",
    attempts: 1,
    statusMessage: "Поток передаёт персонализированное HTML-письмо в VK WorkSpace SMTP.",
    updatedAt: new Date().toISOString(),
  }).where(inArray(deliveryOutbox.id, rows.map((row) => row.id)));
  const credentials = automaticProviderSecrets("vk-workspace") as { password?: string };
  const senderEmail = integration.publicConfig.senderEmail?.trim() || version.snapshot.senderEmail;
  const results = await sendVkWorkspaceSmtpBatch({
    host: "smtp.mail.ru",
    port: 465,
    username: senderEmail,
    password: credentials.password ?? "",
    senderName: version.snapshot.senderName,
    senderEmail,
    timeoutMs: 20_000,
  }, rows.flatMap((row) => {
    const contact = contactsById.get(row.contactId);
    if (!contact) return [];
    return [{
      outboxId: row.id,
      to: row.recipientEndpoint,
      subject: renderContactTemplate(version.snapshot.subject, contact),
      text: renderContactTemplate(version.snapshot.emailBodyText, contact),
      html: renderContactTemplate(version.snapshot.emailBodyHtml, contact),
    }];
  }));
  const byId = new Map(results.map((result) => [result.outboxId, result]));
  for (const row of rows) {
    const result = byId.get(row.id);
    await updateOutboxResult(row, result ?? {
      status: "rejected",
      message: "Контакт удалён до обработки SMTP-задания.",
    });
  }
  return { mailbox: senderEmail, accepted: String(results.filter((item) => item.status === "accepted").length) };
}

async function dispatchCampaign(
  request: Request,
  campaignId: string,
  requestedIdempotencyKey: unknown,
): Promise<CampaignMutationResponse> {
  const db = getDb();
  const current = await campaignBundle(campaignId);
  const clientKey = requestedIdempotencyKey === undefined
    ? ""
    : cleanText(requestedIdempotencyKey, "Ключ идемпотентности", 200);
  if (clientKey) {
    const [jobByKey] = await db
      .select()
      .from(deliveryJobs)
      .where(
        and(
          eq(deliveryJobs.workspaceId, WORKSPACE_ID),
          eq(deliveryJobs.idempotencyKey, clientKey),
        ),
      )
      .limit(1);
    if (jobByKey) {
      if (jobByKey.campaignId !== campaignId) {
        throw new ApiRequestError(
          "Этот ключ идемпотентности уже использован другой кампанией.",
          409,
        );
      }
      return {
        campaign: current.campaign,
        deliveryPlans: current.plans,
        deliveryJob: toDeliveryJob(jobByKey),
      };
    }
  }
  if (current.campaign.readyVersionId) {
    const [jobByVersion] = await db
      .select()
      .from(deliveryJobs)
      .where(
        eq(
          deliveryJobs.campaignVersionId,
          current.campaign.readyVersionId,
        ),
      )
      .limit(1);
    if (jobByVersion) {
      return {
        campaign: current.campaign,
        deliveryPlans: current.plans,
        deliveryJob: toDeliveryJob(jobByVersion),
      };
    }
  }
  const scheduledIsDue = current.campaign.status === "scheduled" &&
    Boolean(current.campaign.scheduledAt) &&
    Date.parse(current.campaign.scheduledAt ?? "") <= Date.now();
  if ((current.campaign.status !== "ready" && !scheduledIsDue) || !current.campaign.readyVersionId) {
    throw new ApiRequestError(
      current.campaign.status === "scheduled"
        ? "Время запланированной отправки ещё не наступило."
        : "Начать отправку можно только для кампании со статусом «Готова». Повторите проверку готовности.",
      409,
    );
  }
  const version = await campaignVersionById(current.campaign.readyVersionId);
  if (version.campaignId !== campaignId) {
    return blockDispatch(campaignId, "Проверенная версия не принадлежит кампании. Повторите проверку.");
  }
  const [workspace, integrationsNow, freshAudience] = await Promise.all([
    workspaceRecord(),
    allIntegrationRecords(),
    audienceForCampaign(current.campaign),
  ]);
  const freshAudienceIds = freshAudience.map((contact) => contact.id).sort();
  if (JSON.stringify(freshAudienceIds) !== JSON.stringify(version.snapshot.audienceContactIds)) {
    return blockDispatch(
      campaignId,
      "Состав аудитории изменился после проверки. Проверьте готовность повторно; отправка не начиналась.",
    );
  }
  const freshFingerprints = recipientFingerprints(
    current.plans,
    freshAudience,
    workspace.requireConsent,
  );
  if (
    JSON.stringify(freshFingerprints) !==
    JSON.stringify(version.snapshot.recipientFingerprints)
  ) {
    return blockDispatch(
      campaignId,
      "Адрес, согласие или статус одного из получателей изменился после проверки. Проверьте готовность повторно.",
    );
  }

  const eligibleByPlan = new Map<string, ContactRecord[]>();
  for (const plan of current.plans) {
    const integration = integrationsNow.find(
      (item) => item.providerId === plan.providerId,
    );
    const definition = integrationProviders.find(
      (item) => item.id === plan.providerId,
    );
    if (
      !integration ||
      definition?.deliveryMode === "roadmap" ||
      !hasRuntimeCredentials(plan.providerId) ||
      !isIntegrationReadyForChannel(integration, plan.channel)
    ) {
      return blockDispatch(
        campaignId,
        `${definition?.name ?? plan.providerId}: серверная конфигурация больше не готова. Отправка не начиналась.`,
      );
    }
    const eligible = freshAudience.filter((contact) =>
      contactEligible(contact, plan.channel, workspace.requireConsent),
    );
    if (eligible.length !== plan.eligibleCount || eligible.length === 0) {
      return blockDispatch(
        campaignId,
        `Доступность контактов в канале ${plan.channel} изменилась. Повторите проверку согласий и адресов.`,
      );
    }
    if (
      (plan.providerId === "telegram-bot-api" || plan.providerId === "vk-api") &&
      eligible.length > 100
    ) {
      return blockDispatch(
        campaignId,
        `${integration.name}: прямой маршрут ограничен 100 получателями без отдельной серверной очереди.`,
      );
    }
    if (definition?.deliveryMode === "automatic") {
      const checked = await checkProviderConnection(integration);
      if (!checked.ok) {
        return blockDispatch(
          campaignId,
          `${integration.name}: контрольная проверка провайдера не пройдена. ${checked.message}`,
        );
      }
    }
    eligibleByPlan.set(plan.id, eligible);
  }

  const idempotencyKey = clientKey || `dispatch:${version.id}`;
  const now = new Date().toISOString();
  const jobId = newId("delivery-job");
  const inserted = await db
    .insert(deliveryJobs)
    .values({
      id: jobId,
      workspaceId: WORKSPACE_ID,
      campaignId,
      campaignVersionId: version.id,
      idempotencyKey,
      status: "queued",
      acceptedCount: 0,
      rejectedCount: 0,
      ambiguousCount: 0,
      manualCount: 0,
      providerExternalIds: {},
      statusMessage: "Задание создано; автоматические маршруты ещё не вызывались.",
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();
  if (!inserted[0]) {
    const [existingJob] = await db
      .select()
      .from(deliveryJobs)
      .where(
        or(
          eq(deliveryJobs.campaignVersionId, version.id),
          and(
            eq(deliveryJobs.workspaceId, WORKSPACE_ID),
            eq(deliveryJobs.idempotencyKey, idempotencyKey),
          ),
        ),
      )
      .limit(1);
    if (!existingJob) throw new Error("Idempotent delivery job was not found");
    if (existingJob.campaignId !== campaignId) {
      throw new ApiRequestError(
        "Этот ключ идемпотентности уже использован другой кампанией.",
        409,
      );
    }
    return {
      campaign: current.campaign,
      deliveryPlans: current.plans,
      deliveryJob: toDeliveryJob(existingJob),
    };
  }

  const outboxValues = current.plans.flatMap((plan) =>
    (eligibleByPlan.get(plan.id) ?? []).map((contact) => ({
      id: newId("outbox"),
      jobId,
      campaignId,
      campaignVersionId: version.id,
      contactId: contact.id,
      channel: plan.channel,
      providerId: plan.providerId,
      recipientEndpoint: endpointForContact(contact, plan.channel),
      idempotencyKey: `${version.id}:${plan.channel}:${contact.id}`,
      status: "pending" as const,
      attempts: 0,
      externalId: null,
      statusMessage: "Ожидает обработки.",
      createdAt: now,
      updatedAt: now,
    })),
  );
  if (outboxValues.length) {
    for (const values of chunksOf(outboxValues, 80)) {
      await db.insert(deliveryOutbox).values(values).onConflictDoNothing();
    }
  }
  await db
    .update(deliveryJobs)
    .set({
      status: "processing",
      statusMessage: "Адаптеры обрабатывают зафиксированную версию кампании.",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(deliveryJobs.id, jobId));
  const startEvent = await appendEvent(
    campaignId,
    "dispatch_started",
    "Участник явно начал отправку проверенной версии кампании.",
    { jobId, campaignVersionId: version.id },
  );

  let providerExternalIds: Record<string, Record<string, string>> = {};
  try {
    const rows = (
      await db.select().from(deliveryOutbox).where(eq(deliveryOutbox.jobId, jobId))
    ).map(toDeliveryOutbox);
    const manualRows = rows.filter(
      (row) =>
        integrationProviders.find((provider) => provider.id === row.providerId)
          ?.deliveryMode === "manual_export",
    );
    if (manualRows.length) {
      await db
        .update(deliveryOutbox)
        .set({
          status: "manual_export",
          statusMessage: "Скачайте CSV и запустите рассылку вручную в VK WorkSpace.",
          updatedAt: new Date().toISOString(),
        })
        .where(inArray(deliveryOutbox.id, manualRows.map((row) => row.id)));
    }
    await processDirectOutbox(
      rows.filter((row) =>
        row.providerId === "telegram-bot-api" || row.providerId === "vk-api",
      ),
      version.snapshot.messengerMessage,
    );
    const unisenderRows = rows.filter((row) => row.providerId === "unisender");
    if (unisenderRows.length) {
      const integration = integrationsNow.find(
        (item) => item.providerId === "unisender",
      );
      if (!integration) throw new Error("UniSender integration disappeared");
      providerExternalIds = {
        ...providerExternalIds,
        unisender: await processUniSenderOutbox(
          request,
          unisenderRows,
          integration,
          version,
        ),
      };
    }
    const smtpRows = rows.filter((row) => row.providerId === "vk-workspace");
    if (smtpRows.length) {
      const integration = integrationsNow.find((item) => item.providerId === "vk-workspace");
      if (!integration) throw new Error("Интеграция VK WorkSpace недоступна");
      providerExternalIds = {
        ...providerExternalIds,
        "vk-workspace": await processVkWorkspaceSmtpOutbox(smtpRows, integration, version),
      };
    }
  } catch (error) {
    await db
      .update(deliveryOutbox)
      .set({
        status: "ambiguous",
        statusMessage:
          "Обработка оборвалась; перед повтором сверьте состояние у провайдера.",
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(deliveryOutbox.jobId, jobId),
          or(
            eq(deliveryOutbox.status, "pending"),
            eq(deliveryOutbox.status, "processing"),
          ),
        ),
      );
    providerExternalIds.system = {
      error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
    };
  }

  const finalRows = (
    await db.select().from(deliveryOutbox).where(eq(deliveryOutbox.jobId, jobId))
  ).map(toDeliveryOutbox);
  const acceptedRows = finalRows.filter((row) => row.status === "accepted");
  const acceptedContactIds = uniqueAcceptedContactIds(finalRows);
  const rejectedCount = finalRows.filter((row) => row.status === "rejected").length;
  const ambiguousCount = finalRows.filter((row) => row.status === "ambiguous").length;
  const manualCount = finalRows.filter((row) => row.status === "manual_export").length;
  const acceptedCount = acceptedRows.length;
  const jobStatus: DeliveryJobRecord["status"] =
    manualCount === finalRows.length
      ? "manual_required"
      : rejectedCount || ambiguousCount || manualCount
        ? acceptedCount || manualCount
          ? "partial"
          : "failed"
        : "completed";
  const statusMessage =
    jobStatus === "completed"
      ? `Провайдеры приняли ${acceptedCount} сообщений. Это ещё не подтверждение доставки.`
      : jobStatus === "manual_required"
        ? `Подготовлено ${manualCount} ${russianPlural(manualCount, "строка", "строки", "строк")} для ручного экспорта; автоматические запросы не выполнялись.`
        : `Принято: ${acceptedCount}; отклонено: ${rejectedCount}; неопределённо: ${ambiguousCount}; вручную: ${manualCount}.`;
  const completedAt = new Date().toISOString();
  const [finalJobRow] = await db
    .update(deliveryJobs)
    .set({
      status: jobStatus,
      acceptedCount,
      rejectedCount,
      ambiguousCount,
      manualCount,
      providerExternalIds,
      statusMessage,
      completedAt,
      updatedAt: completedAt,
    })
    .where(eq(deliveryJobs.id, jobId))
    .returning();
  const campaignStatus: CampaignRecord["status"] =
    jobStatus === "completed" || jobStatus === "partial"
      ? "completed"
      : jobStatus === "manual_required"
        ? "ready"
        : jobStatus === "failed"
          ? "blocked"
          : "blocked";
  await db
    .update(campaigns)
    .set({
      status: campaignStatus,
      statusReason: statusMessage,
      sentAt: acceptedCount ? completedAt : null,
      metrics: {
        ...current.campaign.metrics,
        sent: acceptedContactIds.length,
      },
      updatedAt: completedAt,
    })
    .where(eq(campaigns.id, campaignId));
  if (acceptedRows.length) {
    await db
      .update(contacts)
      .set({ lastContactedAt: completedAt, updatedAt: completedAt })
      .where(inArray(contacts.id, acceptedContactIds));
  }
  const event = await appendEvent(
    campaignId,
    jobStatus === "completed" ? "dispatch_completed" : "dispatch_partial",
    statusMessage,
    {
      jobId,
      acceptedCount,
      uniqueAcceptedCount: acceptedContactIds.length,
      rejectedCount,
      ambiguousCount,
      manualCount,
      providerExternalIds,
    },
  );
  const updated = await campaignBundle(campaignId);
  return {
    campaign: updated.campaign,
    deliveryPlans: updated.plans,
    deliveryJob: toDeliveryJob(finalJobRow),
    event: event ?? startEvent,
  };
}

export type ScheduledRunResult = {
  checkedAt: string;
  dueCount: number;
  dispatched: Array<{ campaignId: string; status: string; message: string }>;
};

async function runDueScheduledCampaignsCore(): Promise<ScheduledRunResult> {
  const now = new Date().toISOString();
  const due = await getDb().select().from(campaigns).where(and(
    eq(campaigns.workspaceId, WORKSPACE_ID),
    eq(campaigns.status, "scheduled"),
    lte(campaigns.scheduledAt, now),
  )).orderBy(asc(campaigns.scheduledAt)).limit(20);
  const dispatched: ScheduledRunResult["dispatched"] = [];
  for (const row of due) {
    try {
      const result = await dispatchCampaign(
        new Request("http://potok.internal/scheduler"),
        row.id,
        `schedule:${row.readyVersionId ?? row.id}`,
      );
      dispatched.push({ campaignId: row.id, status: result.deliveryJob?.status ?? result.campaign.status, message: result.deliveryJob?.statusMessage ?? result.campaign.statusReason });
    } catch (error) {
      dispatched.push({ campaignId: row.id, status: "blocked", message: error instanceof Error ? error.message : "Не удалось обработать запланированную отправку." });
    }
  }
  return { checkedAt: now, dueCount: due.length, dispatched };
}

export async function runDueScheduledCampaignsSystem() {
  await ensureSystemDatabase();
  return runDueScheduledCampaignsCore();
}

export async function runDueScheduledCampaigns(request: Request) {
  await ensureDatabase(request);
  return runDueScheduledCampaignsCore();
}

function csvValue(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function exportCampaignManualCsv(
  request: Request,
  campaignIdValue: unknown,
): Promise<{ filename: string; csv: string; count: number }> {
  await ensureDatabase(request);
  const campaignId = cleanText(
    campaignIdValue,
    "Идентификатор кампании",
    120,
  );
  const bundle = await campaignBundle(campaignId);
  if (
    !["ready", "completed"].includes(bundle.campaign.status) ||
    !bundle.campaign.readyVersionId
  ) {
    throw new ApiRequestError(
      "CSV доступен только после успешной проверки готовности кампании.",
      409,
    );
  }
  const manualPlan = bundle.plans.find(
    (plan) => plan.channel === "email" && plan.providerId === "vk-workspace",
  );
  if (!manualPlan) {
    throw new ApiRequestError(
      "В кампании нет ручного маршрута VK WorkSpace.",
      409,
    );
  }
  const [workspace, version, audience] = await Promise.all([
    workspaceRecord(),
    campaignVersionById(bundle.campaign.readyVersionId),
    audienceForCampaign(bundle.campaign),
  ]);
  const freshIds = audience.map((contact) => contact.id).sort();
  if (JSON.stringify(freshIds) !== JSON.stringify(version.snapshot.audienceContactIds)) {
    throw new ApiRequestError(
      "Аудитория изменилась. Повторите проверку готовности перед экспортом.",
      409,
    );
  }
  const eligible = audience.filter((contact) =>
    contactEligible(contact, "email", workspace.requireConsent),
  );
  if (eligible.length !== manualPlan.eligibleCount) {
    throw new ApiRequestError(
      "Согласия или email контактов изменились. Повторите проверку готовности.",
      409,
    );
  }
  const currentFingerprints = recipientFingerprints(
    [manualPlan],
    audience,
    workspace.requireConsent,
  );
  const versionFingerprints = (version.snapshot.recipientFingerprints ?? [])
    .filter((fingerprint) => {
      try {
        const [channel, providerId] = JSON.parse(fingerprint) as string[];
        return channel === "email" && providerId === "vk-workspace";
      } catch {
        return false;
      }
    })
    .sort();
  if (JSON.stringify(currentFingerprints) !== JSON.stringify(versionFingerprints)) {
    throw new ApiRequestError(
      "Email, согласие или статус получателя изменился после проверки. Повторите проверку перед экспортом.",
      409,
    );
  }
  const rows = [
    ["email", "first_name", "last_name", "company", "mailflow_campaign"],
    ...eligible.map((contact) => [
      contact.email,
      contact.firstName,
      contact.lastName,
      contact.companyName,
      bundle.campaign.name,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(",")).join("\r\n")}`;
  return {
    filename: `mailflow-${campaignId}-vk-workspace.csv`,
    csv,
    count: eligible.length,
  };
}

export async function updateCampaign(
  request: Request,
  payload: unknown,
): Promise<CampaignMutationResponse> {
  await ensureDatabase(request);
  const object = asObject(payload);
  const id = cleanText(object.id, "Идентификатор кампании", 120);
  const action = object.action ?? "save";
  if (
    action !== "save" &&
    action !== "launch" &&
    action !== "dispatch" &&
    action !== "cancel"
  ) {
    throw new ApiRequestError("Неизвестное действие с кампанией.");
  }
  const current = await campaignBundle(id);
  if (action === "dispatch") {
    return dispatchCampaign(request, id, object.idempotencyKey);
  }
  if (["sending", "completed"].includes(current.campaign.status)) {
    throw new ApiRequestError(
      "Отправляемую или завершённую кампанию нельзя изменить.",
      409,
    );
  }
  if (action === "cancel") {
    const now = new Date().toISOString();
    await getDb()
      .update(campaigns)
      .set({
        status: "cancelled",
        statusReason: "Кампания отменена участником.",
        updatedAt: now,
      })
      .where(eq(campaigns.id, id));
    const event = await appendEvent(
      id,
      "campaign_cancelled",
      "Кампания отменена.",
      {},
    );
    const updated = await campaignBundle(id);
    return { campaign: updated.campaign, deliveryPlans: updated.plans, event };
  }

  const workspace = await workspaceRecord();
  const input = parseCampaign(object, {
    workspace,
    campaign: current.campaign,
    plans: current.plans,
  });
  const audienceLabel = await validateAudience(input);
  if (input.templateId) {
    await assertEmailTemplateReference(request, input.templateId);
  }
  const now = new Date().toISOString();
  await getDb()
    .update(campaigns)
    .set({
      name: input.name,
      audienceType: input.audienceType,
      audienceLabel,
      segmentId: input.segmentId ?? null,
      contactIds: input.contactIds ?? [],
      templateId: input.templateId ?? null,
      presentationId: input.presentationId ?? null,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      subject: input.subject,
      previewText: input.previewText,
      emailBodyText: input.emailBodyText,
      emailBodyHtml: input.emailBodyHtml,
      emailBuilderDocument: input.emailBuilderDocument,
      messengerMessage: input.messengerMessage,
      deliveryChannels: input.channels.map((item) => item.channel),
      scheduledAt: input.scheduledAt ?? null,
      status: "draft",
      statusReason: "Изменения сохранены. Повторите проверку перед запуском.",
      readyVersionId: null,
      updatedAt: now,
    })
    .where(eq(campaigns.id, id));
  await savePlans(id, input.channels, current.plans, now);

  if (action === "launch") {
    return evaluateLaunch(request, id);
  }
  const event = await appendEvent(
    id,
    "campaign_updated",
    "Изменения кампании сохранены.",
    { channels: input.channels.map((item) => item.channel) },
  );
  const updated = await campaignBundle(id);
  return { campaign: updated.campaign, deliveryPlans: updated.plans, event };
}

export async function deleteCampaign(
  request: Request,
  idValue: unknown,
): Promise<DeleteResponse> {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Идентификатор кампании", 120);
  const current = await campaignBundle(id);
  if (["sending", "completed"].includes(current.campaign.status)) {
    throw new ApiRequestError(
      "Отправляемую или завершённую кампанию нельзя удалить.",
      409,
    );
  }
  const db = getDb();
  await db.delete(campaignEvents).where(eq(campaignEvents.campaignId, id));
  await db.delete(deliveryPlans).where(eq(deliveryPlans.campaignId, id));
  await db.delete(campaigns).where(eq(campaigns.id, id));
  return { deletedId: id };
}
