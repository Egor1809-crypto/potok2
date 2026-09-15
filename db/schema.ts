import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  ContactAccessScope,
  TeamRole,
  CampaignEventRecord,
  CampaignMetricsRecord,
  CampaignVersionSnapshot,
  DeliveryJobStatus,
  DeliveryOutboxStatus,
  EmailBuilderDocumentInput,
  IntegrationConnectionStatus,
  PresentationSlide,
  PresentationSourceType,
  PresentationThemeId,
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

// Telegram credentials never appear in integrations.public_config or API responses.
export const telegramConnections = sqliteTable("telegram_connections", {
  workspaceId: text("workspace_id").primaryKey(), botId: text("bot_id").notNull(),
  username: text("username").notNull(), displayName: text("display_name").notNull(),
  encryptedToken: text("encrypted_token").notNull(), webhookId: text("webhook_id").notNull(),
  webhookSecretHash: text("webhook_secret_hash").notNull(), webhookUrl: text("webhook_url").notNull(),
  state: text("state").notNull(), operationId: text("operation_id").notNull(),
  operator: text("operator").notNull(), lastReceivedAt: text("last_received_at"),
  ...timestamps,
}, t => [uniqueIndex("idx_telegram_webhook").on(t.webhookId), uniqueIndex("idx_telegram_bot").on(t.botId)]);

export const telegramSubscribers = sqliteTable("telegram_subscribers", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull(), botId: text("bot_id").notNull(),
  chatId: text("chat_id").notNull(), status: text("status").notNull(), pendingNonce: text("pending_nonce").notNull().default(""),
  eventAt: integer("event_at").notNull(), updateId: integer("update_id").notNull(), eventNonce: text("event_nonce").notNull(),
  ...timestamps,
}, t => [uniqueIndex("idx_telegram_subscriber").on(t.workspaceId, t.botId, t.chatId), index("idx_telegram_subscriber_status").on(t.workspaceId, t.botId, t.status)]);

export const telegramUpdates = sqliteTable("telegram_updates", {
  id: text("id").primaryKey(), nonce: text("nonce").notNull(), createdAt: text("created_at").notNull(),
});

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
    login: text("login"),
    passwordHash: text("password_hash"),
    passwordSalt: text("password_salt"),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    color: text("color").notNull().default("#6558E8"),
    status: text("status").notNull().default("active"),
    // Existing accounts retain their previous administrative access. New
    // registrations always set the invitation's role explicitly.
    role: text("role").$type<TeamRole>().notNull().default("admin"),
    accessScope: text("access_scope", { mode: "json" }).$type<ContactAccessScope>().notNull().default(sql`'{"all":false,"baseIds":[],"groupTags":[]}'`),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_participants_global_login").on(table.login).where(sql`${table.login} IS NOT NULL`),
    uniqueIndex("idx_participants_workspace_login")
      .on(table.workspaceId, table.login)
      .where(sql`${table.login} IS NOT NULL`),
    index("idx_participants_workspace_status").on(table.workspaceId, table.status),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_auth_sessions_token_hash").on(table.tokenHash),
    index("idx_auth_sessions_participant").on(table.participantId),
    index("idx_auth_sessions_expires").on(table.expiresAt),
  ],
);

export const teamInvites = sqliteTable(
  "team_invites",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").$type<TeamRole>().notNull().default("member"),
    accessScope: text("access_scope", { mode: "json" }).$type<ContactAccessScope>().notNull().default(sql`'{"all":false,"baseIds":[],"groupTags":[]}'`),
    label: text("label").notNull().default(""),
    targetParticipantId: text("target_participant_id"),
    revokedAt: text("revoked_at"),
    acceptedParticipantId: text("accepted_participant_id"),
    claimNonce: text("claim_nonce"),
    codeHash: text("code_hash").notNull(),
    createdByParticipantId: text("created_by_participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    maxUses: integer("max_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_team_invites_code_hash").on(table.codeHash),
    index("idx_team_invites_workspace_expires").on(table.workspaceId, table.expiresAt),
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
    customFields: text("custom_fields", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'`),
    responsibleParticipantId: text("responsible_participant_id").references(
      () => participants.id,
      { onDelete: "set null" },
    ),
    createdByParticipantId: text("created_by_participant_id").references(
      () => participants.id,
      { onDelete: "set null" },
    ),
    updatedByParticipantId: text("updated_by_participant_id").references(
      () => participants.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_contacts_workspace_email")
      .on(table.workspaceId, table.email)
      .where(sql`${table.email} <> ''`),
    // A company phone can legitimately belong to several people. The API still
    // detects likely duplicates before import, while this non-unique index keeps
    // lookups fast without making a schema migration fail on historical data.
    index("idx_contacts_workspace_phone").on(table.workspaceId, table.phone),
    index("idx_contacts_workspace_status").on(
      table.workspaceId,
      table.status,
    ),
    index("idx_contacts_workspace_status_updated").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    index("idx_contacts_workspace_updated").on(
      table.workspaceId,
      table.updatedAt,
    ),
    index("idx_contacts_workspace_last_contacted").on(
      table.workspaceId,
      table.lastContactedAt,
    ),
    index("idx_contacts_workspace_city").on(
      table.workspaceId,
      table.city,
    ),
    index("idx_contacts_workspace_company_name").on(
      table.workspaceId,
      table.companyName,
    ),
    index("idx_contacts_workspace_company").on(
      table.workspaceId,
      table.companyId,
    ),
    index("idx_contacts_workspace_creator").on(
      table.workspaceId,
      table.createdByParticipantId,
    ),
    index("idx_contacts_workspace_responsible").on(
      table.workspaceId,
      table.responsibleParticipantId,
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
    isFavorite: integer("is_favorite", { mode: "boolean" })
      .notNull()
      .default(false),
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

export const emailAssets = sqliteTable(
  "email_assets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type")
      .$type<"image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf">()
      .notNull(),
    size: integer("size").notNull(),
    kind: text("kind").$type<"photo" | "logo" | "document">().notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_email_assets_object_key").on(table.objectKey),
    index("idx_email_assets_workspace_created").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const aiRequestLimits = sqliteTable(
  "ai_request_limits",
  {
    key: text("key").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    windowStartedAt: text("window_started_at").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_ai_request_limits_workspace_scope").on(
      table.workspaceId,
      table.scope,
    ),
  ],
);

export const aiIdempotency = sqliteTable(
  "ai_idempotency",
  {
    key: text("key").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    operation: text("operation").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").$type<"pending" | "completed" | "failed">().notNull(),
    assetId: text("asset_id").references(() => emailAssets.id, { onDelete: "set null" }),
    resultJson: text("result_json"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_ai_idempotency_workspace_operation_created").on(
      table.workspaceId,
      table.operation,
      table.createdAt,
    ),
  ],
);

export const presentationProjects = sqliteTable(
  "presentation_projects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    themeId: text("theme_id").$type<PresentationThemeId>().notNull(),
    accentColor: text("accent_color").notNull(),
    backgroundColor: text("background_color").notNull(),
    textColor: text("text_color").notNull(),
    slides: text("slides", { mode: "json" })
      .$type<PresentationSlide[]>()
      .notNull()
      .default(sql`'[]'`),
    sourceType: text("source_type")
      .$type<PresentationSourceType>()
      .notNull()
      .default("blank"),
    sourceEmailTemplateId: text("source_email_template_id").references(
      () => emailTemplates.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("idx_presentation_projects_workspace_updated").on(
      table.workspaceId,
      table.updatedAt,
    ),
  ],
);

export const presentationFavorites = sqliteTable(
  "presentation_favorites",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    itemType: text("item_type").$type<"project" | "template">().notNull(),
    itemId: text("item_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_presentation_favorites_workspace_item").on(
      table.workspaceId,
      table.itemType,
      table.itemId,
    ),
    index("idx_presentation_favorites_workspace_created").on(
      table.workspaceId,
      table.createdAt,
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
    purpose: text("purpose").notNull().default("marketing"),
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
    presentationId: text("presentation_id").references(() => presentationProjects.id, {
      onDelete: "set null",
    }),
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
    messengerDocumentUrl: text("messenger_document_url"),
    messengerDocumentName: text("messenger_document_name"),
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
    index("idx_campaigns_workspace_participant_updated").on(
      table.workspaceId,
      table.participantId,
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
    index("idx_delivery_outbox_contact_updated").on(
      table.contactId,
      table.updatedAt,
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

// Communication controls: append-only evidence and immutable message timestamps.
export const communicationConsents = sqliteTable("communication_consents", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull(),
  contactId: text("contact_id").notNull(), endpoint: text("endpoint").notNull(),
  channel: text("channel").notNull(), purpose: text("purpose").notNull(),
  kind: text("kind").notNull(), source: text("source").notNull(),
  obtainedAt: text("obtained_at").notNull(), expiresAt: text("expires_at"),
  version: text("version").notNull(), statement: text("statement").notNull(),
  operator: text("operator").notNull(), digest: text("digest").notNull(),
  actorId: text("actor_id").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [index("idx_consent_endpoint_date").on(t.workspaceId, t.endpoint, t.channel, t.purpose, t.createdAt)]);
export const communicationHolds = sqliteTable("communication_holds", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull(),
  endpoint: text("endpoint").notNull(), channel: text("channel").notNull(),
  reason: text("reason").notNull(), untilAt: text("until_at"),
  active: integer("active").notNull().default(1), actorId: text("actor_id").notNull(),
  createdAt: text("created_at").notNull(), resolvedAt: text("resolved_at"),
}, (t) => [index("idx_hold_endpoint").on(t.workspaceId, t.endpoint, t.channel, t.active)]);
export const communicationMessages = sqliteTable("communication_messages", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull(),
  contactId: text("contact_id").notNull(), campaignId: text("campaign_id"),
  externalId: text("external_id").notNull(), sender: text("sender").notNull(),
  subject: text("subject").notNull(), body: text("body").notNull(),
  category: text("category").notNull(), confidence: integer("confidence").notNull(),
  classifier: text("classifier").notNull(), quote: text("quote").notNull(),
  suggestedDate: text("suggested_date"), suggestedAction: text("suggested_action"),
  receivedAt: text("received_at").notNull(), actorId: text("actor_id").notNull(),
  reviewed: integer("reviewed").notNull().default(0),
}, (t) => [uniqueIndex("idx_message_external").on(t.workspaceId, t.externalId), index("idx_message_received").on(t.workspaceId, t.receivedAt)]);
export const communicationTasks = sqliteTable("communication_tasks", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull(),
  messageId: text("message_id").notNull(), contactId: text("contact_id").notNull(),
  assignedTo: text("assigned_to").notNull(), title: text("title").notNull(),
  dueDate: text("due_date"), status: text("status").notNull().default("proposed"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (t) => [uniqueIndex("idx_task_message").on(t.workspaceId, t.messageId)]);
export const communicationPolicy = sqliteTable("communication_policy", {
  workspaceId: text("workspace_id").primaryKey(), windowDays: integer("window_days").notNull().default(14),
  contactLimit: integer("contact_limit").notNull().default(9), companyLimit: integer("company_limit").notNull().default(3),
  autoTasks: integer("auto_tasks").notNull().default(0), updatedAt: text("updated_at").notNull(), actorId: text("actor_id").notNull(),
});
export const communicationAudit = sqliteTable("communication_audit", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull(),
  actorId: text("actor_id").notNull(), action: text("action").notNull(),
  entityId: text("entity_id").notNull(), details: text("details").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [index("idx_communication_audit_entity").on(t.workspaceId, t.entityId, t.createdAt)]);
export const communicationTouches = sqliteTable("communication_touches", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull(), contactId: text("contact_id").notNull(),
  endpoint: text("endpoint").notNull(), companyKey: text("company_key").notNull(), channel: text("channel").notNull(),
  campaignId: text("campaign_id").notNull(), actorId: text("actor_id").notNull(), occurredAt: text("occurred_at").notNull(),
}, (t) => [index("idx_touches_endpoint_time").on(t.workspaceId, t.endpoint, t.occurredAt), index("idx_touches_company_time").on(t.workspaceId, t.companyKey, t.occurredAt)]);

export const teamAccessEvents = sqliteTable("team_access_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_team_access_events_workspace_created").on(table.workspaceId, table.createdAt)]);

export const oauthIdentities = sqliteTable("oauth_identities", {
  provider: text("provider").notNull(), subject: text("subject").notNull(),
  participantId: text("participant_id").notNull().references(() => participants.id, {onDelete:"cascade"}),
  createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("idx_oauth_identity_subject").on(t.provider,t.subject), uniqueIndex("idx_oauth_identity_participant").on(t.provider,t.participantId)]);
export const oauthFlows = sqliteTable("oauth_flows", {
  stateHash:text("state_hash").primaryKey(), browserHash:text("browser_hash").notNull(), verifier:text("verifier").notNull(),
  intent:text("intent").notNull(), nextPath:text("next_path").notNull(), origin:text("origin").notNull(),
  participantId:text("participant_id"), sessionId:text("session_id"), expiresAt:text("expires_at").notNull(),
  consentVersion: text("consent_version"), consentAcceptedAt: text("consent_accepted_at"),
}, t => [index("idx_oauth_flows_expiry").on(t.expiresAt)]);


export const registrationConsents = sqliteTable("registration_consents", {
  id: text("id").primaryKey(),
  participantId: text("participant_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  statement: text("statement").notNull(),
  method: text("method").notNull(),
  acceptedAt: text("accepted_at").notNull(),
}, t => [index("idx_registration_consents_participant").on(t.participantId, t.acceptedAt)]);
