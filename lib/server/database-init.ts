import { and, eq, isNull } from "drizzle-orm";
import { getD1, getDb } from "@/db";
import {
  emailTemplates,
  integrations,
  participants,
  systemState,
  workspaces,
} from "@/db/schema";
import { integrationProviders } from "@/config/integrations";
import { BRAND_NAME } from "@/config/brand";
import { ApiRequestError } from "./api-utils";
import { starterEmailTemplateValues } from "./starter-template-library";

export const WORKSPACE_ID = "workspace-main";
export const PARTICIPANT_ID = "participant-main";

let initialization: Promise<void> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
    default_sender_name TEXT NOT NULL DEFAULT '',
    default_sender_email TEXT NOT NULL DEFAULT '',
    reply_to_email TEXT NOT NULL DEFAULT '',
    signature TEXT NOT NULL DEFAULT '',
    require_consent INTEGER NOT NULL DEFAULT 1,
    notify_campaign_complete INTEGER NOT NULL DEFAULT 1,
    notify_blocked_campaign INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    auth_user_id TEXT,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    company_id TEXT,
    company_name TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Client',
    city TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'Россия',
    tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    engagement_score INTEGER NOT NULL DEFAULT 0,
    avatar_color TEXT NOT NULL DEFAULT '#6558E8',
    email_consent INTEGER NOT NULL DEFAULT 0,
    telegram_chat_id TEXT,
    telegram_consent INTEGER NOT NULL DEFAULT 0,
    vk_user_id TEXT,
    vk_consent INTEGER NOT NULL DEFAULT 0,
    last_contacted_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS segments (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rules TEXT NOT NULL DEFAULT '[]',
    color TEXT NOT NULL DEFAULT '#6558E8',
    is_dynamic INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    public_config TEXT NOT NULL DEFAULT '{}',
    last_checked_at TEXT,
    check_status TEXT NOT NULL DEFAULT 'disconnected',
    check_message TEXT NOT NULL DEFAULT 'Подключение ещё не проверено.',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    preview_text TEXT NOT NULL DEFAULT '',
    builder_document TEXT NOT NULL,
    email_body_html TEXT NOT NULL,
    email_body_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS email_assets (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ai_request_limits (
    key TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    window_started_at TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ai_idempotency (
    key TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    asset_id TEXT REFERENCES email_assets(id) ON DELETE SET NULL,
    result_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS presentation_projects (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    theme_id TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    background_color TEXT NOT NULL,
    text_color TEXT NOT NULL,
    slides TEXT NOT NULL DEFAULT '[]',
    source_type TEXT NOT NULL DEFAULT 'blank',
    source_email_template_id TEXT REFERENCES email_templates(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    name TEXT NOT NULL,
    audience_type TEXT NOT NULL,
    audience_label TEXT NOT NULL DEFAULT '',
    segment_id TEXT REFERENCES segments(id) ON DELETE SET NULL,
    contact_ids TEXT NOT NULL DEFAULT '[]',
    template_id TEXT,
    presentation_id TEXT REFERENCES presentation_projects(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL DEFAULT '',
    sender_email TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    preview_text TEXT NOT NULL DEFAULT '',
    email_body_text TEXT NOT NULL DEFAULT '',
    email_body_html TEXT NOT NULL DEFAULT '',
    email_builder_document TEXT,
    messenger_message TEXT NOT NULL DEFAULT '',
    delivery_channels TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    status_reason TEXT NOT NULL DEFAULT 'Черновик сохранён',
    scheduled_at TEXT,
    sent_at TEXT,
    metrics TEXT NOT NULL DEFAULT '{"recipients":0,"sent":0,"delivered":0,"opened":0,"clicked":0,"replies":0,"bounced":0,"unsubscribed":0}',
    ready_version_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS campaign_versions (
    id TEXT PRIMARY KEY NOT NULL,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS delivery_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    campaign_version_id TEXT NOT NULL REFERENCES campaign_versions(id),
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    accepted_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    ambiguous_count INTEGER NOT NULL DEFAULT 0,
    manual_count INTEGER NOT NULL DEFAULT 0,
    provider_external_ids TEXT NOT NULL DEFAULT '{}',
    status_message TEXT NOT NULL DEFAULT 'Задание создано.',
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS delivery_outbox (
    id TEXT PRIMARY KEY NOT NULL,
    job_id TEXT NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    campaign_version_id TEXT NOT NULL REFERENCES campaign_versions(id),
    contact_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    recipient_endpoint TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    external_id TEXT,
    status_message TEXT NOT NULL DEFAULT 'Ожидает обработки.',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS delivery_plans (
    id TEXT PRIMARY KEY NOT NULL,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    eligible_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    status_reason TEXT NOT NULL DEFAULT 'План не проверен',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS campaign_events (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_workspace_singleton ON participants(workspace_id)`,
  `DROP INDEX IF EXISTS idx_contacts_workspace_email`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_email ON contacts(workspace_id, email) WHERE email <> ''`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_phone ON contacts(workspace_id, phone)`,
  `DROP INDEX IF EXISTS idx_contacts_workspace_telegram`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_telegram ON contacts(workspace_id, telegram_chat_id) WHERE telegram_chat_id IS NOT NULL`,
  `DROP INDEX IF EXISTS idx_contacts_workspace_vk`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_vk ON contacts(workspace_id, vk_user_id) WHERE vk_user_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_status ON contacts(workspace_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_company ON contacts(workspace_id, company_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_segments_workspace_name ON segments(workspace_id, name)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_workspace_provider ON integrations(workspace_id, provider_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_workspace_name_key ON email_templates(workspace_id, name_key)`,
  `CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_updated ON email_templates(workspace_id, updated_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_email_assets_object_key ON email_assets(object_key)`,
  `CREATE INDEX IF NOT EXISTS idx_email_assets_workspace_created ON email_assets(workspace_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_request_limits_workspace_scope ON ai_request_limits(workspace_id, scope)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_idempotency_workspace_operation_created ON ai_idempotency(workspace_id, operation, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_presentation_projects_workspace_updated ON presentation_projects(workspace_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_status_updated ON campaigns(workspace_id, status, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_campaigns_segment ON campaigns(segment_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_versions_number ON campaign_versions(campaign_id, version)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_versions_hash ON campaign_versions(campaign_id, content_hash)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_jobs_idempotency ON delivery_jobs(workspace_id, idempotency_key)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_jobs_version ON delivery_jobs(campaign_version_id)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_jobs_campaign_created ON delivery_jobs(campaign_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_outbox_idempotency ON delivery_outbox(idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_outbox_job_status ON delivery_outbox(job_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_outbox_campaign_channel ON delivery_outbox(campaign_id, channel)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_plans_campaign_channel ON delivery_plans(campaign_id, channel)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_plans_provider ON delivery_plans(provider_id)`,
  `CREATE INDEX IF NOT EXISTS idx_campaign_events_workspace_occurred ON campaign_events(workspace_id, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_occurred ON campaign_events(campaign_id, occurred_at)`,
  `CREATE TRIGGER IF NOT EXISTS prevent_campaign_versions_update
    BEFORE UPDATE ON campaign_versions
    BEGIN
      SELECT RAISE(ABORT, 'campaign versions are immutable');
    END`,
  `PRAGMA optimize`,
];

type RequestIdentity = {
  authUserId: string | null;
  displayName: string;
  email: string;
};

function identityFromRequest(request: Request): RequestIdentity {
  const forwardedUserId = request.headers.get("oai-authenticated-user-id");
  const forwardedEmail = request.headers.get("oai-authenticated-user-email");
  const authUserId =
    forwardedUserId && forwardedEmail ? forwardedUserId : null;
  const email = forwardedEmail ?? "participant@mailflow.local";
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  let displayName = `Участник ${BRAND_NAME}`;
  if (
    encodedName &&
    request.headers.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
  ) {
    try {
      displayName = decodeURIComponent(encodedName);
    } catch {
      // A malformed optional display-name header must not block the workspace.
    }
  }
  return { authUserId, displayName, email: email.toLowerCase() };
}

function isLocalDevelopmentRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export async function requireWorkspaceParticipant(request: Request) {
  const identity = identityFromRequest(request);
  if (!identity.authUserId) {
    if (isLocalDevelopmentRequest(request)) return;
    throw new ApiRequestError(
      "Для доступа к рабочему пространству необходимо войти в аккаунт.",
      401,
    );
  }

  const db = getDb();
  let [participant] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, PARTICIPANT_ID))
    .limit(1);
  if (!participant) {
    throw new ApiRequestError("Участник рабочего пространства не найден.", 403);
  }

  if (!participant.authUserId) {
    const now = new Date().toISOString();
    await db
      .update(participants)
      .set({
        authUserId: identity.authUserId,
        displayName: identity.displayName,
        email: identity.email,
        updatedAt: now,
      })
      .where(
        and(
          eq(participants.id, PARTICIPANT_ID),
          isNull(participants.authUserId),
        ),
      );
    [participant] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, PARTICIPANT_ID))
      .limit(1);
  }

  if (participant?.authUserId !== identity.authUserId) {
    throw new ApiRequestError(
      "Это рабочее пространство уже принадлежит другому аккаунту.",
      403,
    );
  }
}

async function createSchema() {
  const d1 = getD1();
  await d1.batch(schemaStatements.map((statement) => d1.prepare(statement)));
  const aiIdempotencyColumns = await d1
    .prepare("PRAGMA table_info(ai_idempotency)")
    .all<{ name: string }>();
  if (!aiIdempotencyColumns.results.some((column) => column.name === "result_json")) {
    await d1
      .prepare("ALTER TABLE ai_idempotency ADD COLUMN result_json TEXT")
      .run();
  }
  const campaignColumns = await d1
    .prepare("PRAGMA table_info(campaigns)")
    .all<{ name: string }>();
  if (!campaignColumns.results.some((column) => column.name === "email_body_text")) {
    await d1
      .prepare(
        "ALTER TABLE campaigns ADD COLUMN email_body_text TEXT NOT NULL DEFAULT ''",
      )
      .run();
  }
  if (!campaignColumns.results.some((column) => column.name === "ready_version_id")) {
    await d1
      .prepare("ALTER TABLE campaigns ADD COLUMN ready_version_id TEXT")
      .run();
  }
  if (!campaignColumns.results.some((column) => column.name === "email_body_html")) {
    await d1
      .prepare(
        "ALTER TABLE campaigns ADD COLUMN email_body_html TEXT NOT NULL DEFAULT ''",
      )
      .run();
  }
  if (!campaignColumns.results.some((column) => column.name === "email_builder_document")) {
    await d1
      .prepare("ALTER TABLE campaigns ADD COLUMN email_builder_document TEXT")
      .run();
  }
  if (!campaignColumns.results.some((column) => column.name === "presentation_id")) {
    await d1
      .prepare("ALTER TABLE campaigns ADD COLUMN presentation_id TEXT REFERENCES presentation_projects(id) ON DELETE SET NULL")
      .run();
  }
  const integrationColumns = await d1
    .prepare("PRAGMA table_info(integrations)")
    .all<{ name: string }>();
  if (!integrationColumns.results.some((column) => column.name === "check_status")) {
    await d1
      .prepare(
        "ALTER TABLE integrations ADD COLUMN check_status TEXT NOT NULL DEFAULT 'disconnected'",
      )
      .run();
  }
  if (!integrationColumns.results.some((column) => column.name === "check_message")) {
    await d1
      .prepare(
        "ALTER TABLE integrations ADD COLUMN check_message TEXT NOT NULL DEFAULT 'Подключение ещё не проверено.'",
      )
      .run();
  }
}

async function seedDatabase(request: Request) {
  const db = getDb();
  const identity = identityFromRequest(request);
  const now = new Date().toISOString();

  await db
    .insert(workspaces)
    .values({
      id: WORKSPACE_ID,
      name: `Рабочее пространство «${BRAND_NAME}»`,
      companyName: BRAND_NAME,
      timezone: "Europe/Moscow",
      defaultSenderName: identity.displayName,
      defaultSenderEmail: identity.email,
      replyToEmail: identity.email,
      signature: `С уважением,\n${identity.displayName}`,
      requireConsent: true,
      notifyCampaignComplete: true,
      notifyBlockedCampaign: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(participants)
    .values({
      id: PARTICIPANT_ID,
      workspaceId: WORKSPACE_ID,
      authUserId: identity.authUserId,
      displayName: identity.displayName,
      email: identity.email,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const existingParticipant = await db
    .select()
    .from(participants)
    .where(eq(participants.id, PARTICIPANT_ID))
    .limit(1);
  if (identity.authUserId && !existingParticipant[0]?.authUserId) {
    await db
      .update(participants)
      .set({ authUserId: identity.authUserId, updatedAt: now })
      .where(eq(participants.id, PARTICIPANT_ID));
  }

  const [initializationState] = await db
    .select()
    .from(systemState)
    .where(eq(systemState.key, "initial-data-version"))
    .limit(1);

  await db
    .insert(integrations)
    .values(
      integrationProviders.map((provider) => ({
        id: `integration-${provider.id}`,
        workspaceId: WORKSPACE_ID,
        providerId: provider.id,
        enabled: true,
        publicConfig: {},
        lastCheckedAt: null,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();

  const [templateLibraryState] = await db
    .select()
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v1"))
    .limit(1);
  if (!templateLibraryState) {
    for (const template of starterEmailTemplateValues()) {
      await db
        .insert(emailTemplates)
        .values({
          ...template,
          workspaceId: WORKSPACE_ID,
        })
        .onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v1",
      value: "seeded",
      updatedAt: now,
    });
  }

  const [expandedTemplateLibraryState] = await db
    .select()
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v2"))
    .limit(1);
  if (!expandedTemplateLibraryState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v2-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v2",
      value: "seeded",
      updatedAt: now,
    });
  }

  const [designerTemplateLibraryState] = await db
    .select()
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v3"))
    .limit(1);
  if (!designerTemplateLibraryState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v3-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v3",
      value: "seeded",
      updatedAt: now,
    });
  }

  const [legalTemplateLibraryState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v4-legal"))
    .limit(1);
  if (!legalTemplateLibraryState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v4-legal-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v4-legal",
      value: "seeded",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "seeded", updatedAt: now },
    });
  }

  const [visualTemplateLibraryState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v5-visual"))
    .limit(1);
  if (!visualTemplateLibraryState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v5-visual-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v5-visual",
      value: "seeded",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "seeded", updatedAt: now },
    });
  }

  const [scaledTemplateLibraryState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v6-scale"))
    .limit(1);
  if (!scaledTemplateLibraryState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v6-scale-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v6-scale",
      value: "seeded",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "seeded", updatedAt: now },
    });
  }

  const [studioTemplateLibraryState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v7-studio"))
    .limit(1);
  if (!studioTemplateLibraryState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v7-studio-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v7-studio",
      value: "seeded",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "seeded", updatedAt: now },
    });
  }

  const [creativeTemplateLibraryState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v8-creative"))
    .limit(1);
  if (!creativeTemplateLibraryState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v8-creative-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({ key: "email-template-library-v8-creative", value: "seeded", updatedAt: now }).onConflictDoUpdate({ target: systemState.key, set: { value: "seeded", updatedAt: now } });
  }

  const [creativeExpansionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v9-creative-expansion"))
    .limit(1);
  if (!creativeExpansionState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v8-creative-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({ key: "email-template-library-v9-creative-expansion", value: "seeded", updatedAt: now }).onConflictDoUpdate({ target: systemState.key, set: { value: "seeded", updatedAt: now } });
  }

  const [conferenceTemplateSeriesState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v10-conference-series"))
    .limit(1);
  if (!conferenceTemplateSeriesState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v10-conference-chain-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v10-conference-series",
      value: "seeded",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "seeded", updatedAt: now },
    });
  }

  const [conferenceSalesExpansionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v11-conference-sales-expansion"))
    .limit(1);
  if (!conferenceSalesExpansionState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v11-conference-chain-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v11-conference-sales-expansion",
      value: "seeded",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "seeded", updatedAt: now },
    });
  }

  const [templateHeadersState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-headers-v1"))
    .limit(1);
  if (!templateHeadersState) {
    for (const template of starterEmailTemplateValues()) {
      await db.update(emailTemplates).set({
        builderDocument: template.builderDocument,
        emailBodyHtml: template.emailBodyHtml,
        emailBodyText: template.emailBodyText,
        updatedAt: now,
      }).where(and(eq(emailTemplates.id, template.id), eq(emailTemplates.workspaceId, WORKSPACE_ID)));
    }
    await db.insert(systemState).values({
      key: "email-template-library-headers-v1",
      value: "seeded",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "seeded", updatedAt: now },
    });
  }

  const [brandRenameState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "visible-brand-potoc-v1"))
    .limit(1);
  if (!brandRenameState) {
    for (const template of starterEmailTemplateValues()) {
      await db.update(emailTemplates).set({
        subject: template.subject,
        previewText: template.previewText,
        builderDocument: template.builderDocument,
        emailBodyHtml: template.emailBodyHtml,
        emailBodyText: template.emailBodyText,
        updatedAt: now,
      }).where(and(eq(emailTemplates.id, template.id), eq(emailTemplates.workspaceId, WORKSPACE_ID)));
    }
    await db.insert(systemState).values({
      key: "visible-brand-potoc-v1",
      value: "renamed",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "renamed", updatedAt: now },
    });
  }

  if (!initializationState) {
    await db.insert(systemState).values({
      key: "initial-data-version",
      value: "empty-workspace-v2",
      updatedAt: now,
    });
  }
}

export async function ensureDatabase(request: Request): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      await createSchema();
      await seedDatabase(request);
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
  await requireWorkspaceParticipant(request);
}
