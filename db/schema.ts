import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  CampaignEventRecord,
  CampaignMetricsRecord,
  CampaignVersionSnapshot,
  DeliveryJobStatus,
  DeliveryOutboxStatus,
  EmailBuilderDocumentInput,
  IntegrationConnectionStatus,
  SegmentRule,
} from "@/types/api";
import type { TemplateCategory } from "@/types/template";
import type {
  DeliveryChannelId,
  IntegrationProviderId,
} from "@/config/integrations";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  companyName: text("company_name").notNull(),
  timezone: text("timezone").notNull().default("Europe/Moscow"),
  defaultSenderName: text("default_sender_name").notNull().default(""),
  defaultSenderEmail: text("default_sender_email").notNull().default(""),
  replyToEmail: text("reply_to_email").notNull().default(""),
  signature: text("signature").notNull().default(""),
  requireConsent: integer("require_consent", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyCampaignComplete: integer("notify_campaign_complete", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  notifyBlockedCampaign: integer("notify_blocked_campaign", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  ...timestamps,
});

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    authUserId: text("auth_user_id"),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_participants_workspace_singleton").on(table.workspaceId),
  ],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    companyId: text("company_id"),
    companyName: text("company_name").notNull().default(""),
    jobTitle: text("job_title").notNull().default(""),
    category: text("category").notNull().default("Client"),
    city: text("city").notNull().default(""),
    country: text("country").notNull().default("Россия"),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    status: text("status").notNull().default("active"),
    engagementScore: integer("engagement_score").notNull().default(0),
    avatarColor: text("avatar_color").notNull().default("#6558E8"),
    emailConsent: integer("email_consent", { mode: "boolean" })
      .notNull()
      .default(false),
    telegramChatId: text("telegram_chat_id"),
    telegramConsent: integer("telegram_consent", { mode: "boolean" })
      .notNull()
      .default(false),
    vkUserId: text("vk_user_id"),
    vkConsent: integer("vk_consent", { mode: "boolean" })
      .notNull()
      .default(false),
    lastContactedAt: text("last_contacted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_contacts_workspace_email")
      .on(table.workspaceId, table.email)
      .where(sql`${table.email} <> ''`),
    index("idx_contacts_workspace_status").on(
      table.workspaceId,
      table.status,
    ),
    index("idx_contacts_workspace_company").on(
      table.workspaceId,
      table.companyId,
    ),
    uniqueIndex("idx_contacts_workspace_telegram")
      .on(table.workspaceId, table.telegramChatId)
      .where(sql`${table.telegramChatId} IS NOT NULL`),
    uniqueIndex("idx_contacts_workspace_vk")
      .on(table.workspaceId, table.vkUserId)
      .where(sql`${table.vkUserId} IS NOT NULL`),
  ],
);

export const systemState = sqliteTable("system_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const segments = sqliteTable(
  "segments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    rules: text("rules", { mode: "json" })
      .$type<SegmentRule[]>()
      .notNull()
      .default(sql`'[]'`),
    color: text("color").notNull().default("#6558E8"),
    isDynamic: integer("is_dynamic", { mode: "boolean" })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_segments_workspace_name").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

export const integrations = sqliteTable(
  "integrations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    providerId: text("provider_id")
      .$type<IntegrationProviderId>()
      .notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    publicConfig: text("public_config", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'`),
    lastCheckedAt: text("last_checked_at"),
    checkStatus: text("check_status")
      .$type<IntegrationConnectionStatus>()
      .notNull()
      .default("disconnected"),
    checkMessage: text("check_message")
      .notNull()
      .default("Подключение ещё не проверено."),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_integrations_workspace_provider").on(
      table.workspaceId,
      table.providerId,
    ),
  ],
);

export const emailTemplates = sqliteTable(
  "email_templates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").$type<TemplateCategory>().notNull(),
    subject: text("subject").notNull(),
    previewText: text("preview_text").notNull().default(""),
    builderDocument: text("builder_document", { mode: "json" })
      .$type<EmailBuilderDocumentInput>()
      .notNull(),
    emailBodyHtml: text("email_body_html").notNull(),
    emailBodyText: text("email_body_text").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_email_templates_workspace_name_key").on(
      table.workspaceId,
      table.nameKey,
    ),
    index("idx_email_templates_workspace_updated").on(
      table.workspaceId,
      table.updatedAt,
    ),
  ],
);

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    name: text("name").notNull(),
    audienceType: text("audience_type").notNull(),
    audienceLabel: text("audience_label").notNull().default(""),
    segmentId: text("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    contactIds: text("contact_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    templateId: text("template_id"),
    senderName: text("sender_name").notNull().default(""),
    senderEmail: text("sender_email").notNull().default(""),
    subject: text("subject").notNull().default(""),
    previewText: text("preview_text").notNull().default(""),
    emailBodyText: text("email_body_text").notNull().default(""),
    emailBodyHtml: text("email_body_html").notNull().default(""),
    emailBuilderDocument: text("email_builder_document", { mode: "json" })
      .$type<EmailBuilderDocumentInput | null>()
      .default(null),
    messengerMessage: text("messenger_message").notNull().default(""),
    deliveryChannels: text("delivery_channels", { mode: "json" })
      .$type<DeliveryChannelId[]>()
      .notNull()
      .default(sql`'[]'`),
    status: text("status").notNull().default("draft"),
    statusReason: text("status_reason").notNull().default("Черновик сохранён"),
    scheduledAt: text("scheduled_at"),
    sentAt: text("sent_at"),
    metrics: text("metrics", { mode: "json" })
      .$type<CampaignMetricsRecord>()
      .notNull()
      .default(sql`'{"recipients":0,"sent":0,"delivered":0,"opened":0,"clicked":0,"replies":0,"bounced":0,"unsubscribed":0}'`),
    readyVersionId: text("ready_version_id"),
    ...timestamps,
  },
  (table) => [
    index("idx_campaigns_workspace_status_updated").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    index("idx_campaigns_segment").on(table.segmentId),
  ],
);

export const campaignVersions = sqliteTable(
  "campaign_versions",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    contentHash: text("content_hash").notNull(),
    snapshot: text("snapshot", { mode: "json" })
      .$type<CampaignVersionSnapshot>()
      .notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_campaign_versions_number").on(
      table.campaignId,
      table.version,
    ),
    uniqueIndex("idx_campaign_versions_hash").on(
      table.campaignId,
      table.contentHash,
    ),
  ],
);

export const deliveryJobs = sqliteTable(
  "delivery_jobs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    campaignVersionId: text("campaign_version_id")
      .notNull()
      .references(() => campaignVersions.id),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").$type<DeliveryJobStatus>().notNull().default("queued"),
    acceptedCount: integer("accepted_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    ambiguousCount: integer("ambiguous_count").notNull().default(0),
    manualCount: integer("manual_count").notNull().default(0),
    providerExternalIds: text("provider_external_ids", { mode: "json" })
      .$type<Record<string, Record<string, string>>>()
      .notNull()
      .default(sql`'{}'`),
    statusMessage: text("status_message").notNull().default("Задание создано."),
    completedAt: text("completed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_delivery_jobs_idempotency").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    uniqueIndex("idx_delivery_jobs_version").on(table.campaignVersionId),
    index("idx_delivery_jobs_campaign_created").on(
      table.campaignId,
      table.createdAt,
    ),
  ],
);

export const deliveryOutbox = sqliteTable(
  "delivery_outbox",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => deliveryJobs.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    campaignVersionId: text("campaign_version_id")
      .notNull()
      .references(() => campaignVersions.id),
    contactId: text("contact_id").notNull(),
    channel: text("channel").$type<DeliveryChannelId>().notNull(),
    providerId: text("provider_id").$type<IntegrationProviderId>().notNull(),
    recipientEndpoint: text("recipient_endpoint").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status")
      .$type<DeliveryOutboxStatus>()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    externalId: text("external_id"),
    statusMessage: text("status_message").notNull().default("Ожидает обработки."),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_delivery_outbox_idempotency").on(table.idempotencyKey),
    index("idx_delivery_outbox_job_status").on(table.jobId, table.status),
    index("idx_delivery_outbox_campaign_channel").on(
      table.campaignId,
      table.channel,
    ),
  ],
);

export const deliveryPlans = sqliteTable(
  "delivery_plans",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    channel: text("channel").$type<DeliveryChannelId>().notNull(),
    providerId: text("provider_id")
      .$type<IntegrationProviderId>()
      .notNull(),
    status: text("status").notNull().default("draft"),
    eligibleCount: integer("eligible_count").notNull().default(0),
    blockedCount: integer("blocked_count").notNull().default(0),
    statusReason: text("status_reason").notNull().default("План не проверен"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_delivery_plans_campaign_channel").on(
      table.campaignId,
      table.channel,
    ),
    index("idx_delivery_plans_provider").on(table.providerId),
  ],
);

export const campaignEvents = sqliteTable(
  "campaign_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").references(() => campaigns.id, {
      onDelete: "cascade",
    }),
    type: text("type").$type<CampaignEventRecord["type"]>().notNull(),
    message: text("message").notNull(),
    details: text("details", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_campaign_events_workspace_occurred").on(
      table.workspaceId,
      table.occurredAt,
    ),
    index("idx_campaign_events_campaign_occurred").on(
      table.campaignId,
      table.occurredAt,
    ),
  ],
);
