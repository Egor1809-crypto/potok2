import { and, eq } from "drizzle-orm";
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
import { conferenceProductionTemplateValues } from "@/data/conference-production-templates.generated";
import { requireTeamSession, toTeamParticipant, type TeamSession } from "./team-auth";

export const WORKSPACE_ID = "workspace-main";
export const PARTICIPANT_ID = "participant-main";

/** Справочник ответственных для общей базы. Учётные записи они создают сами. */
const TEAM_DIRECTORY = [
  ["team-alla-artina", "Алла Артина", "#6558E8"],
  ["team-dmitry-putin", "Путин Дмитрий", "#0E7490"],
  ["team-egor-shabalin", "Шабалин Егор", "#C2410C"],
  ["team-egor-isakov", "Исаков Егор", "#047857"],
  ["team-dmitry-sizov", "Сизов Дмитрий", "#BE185D"],
  ["team-darya-samailova", "Дарья Самойлова", "#1D4ED8"],
  ["team-alexander-cherepanov", "Александр Черепанов", "#7E22CE"],
  ["team-vagan-oganesovich", "Ваган Оганесович", "#B45309"],
  ["team-darya-drygval", "Дарья Дрыгваль", "#0F766E"],
] as const;

const GEORGIY_ACCOUNT = {
  id: "team-georgiy-kondratyev",
  login: "georgiy.kondratyev",
  displayName: "Георгий Кондратьев",
  email: "georgiy.kondratyev@team.potok.local",
  color: "#DB2777",
  passwordSalt: "caesYYQFqFLYunWWW_ZegEHw",
  passwordHash: "O_BOOK6MzwR8IF_QYoE_jsmUjxxTOuCR41us-jWer4E",
} as const;

let initialization: Promise<void> | null = null;
// A Worker isolate is short-lived in production. Running the entire DDL and
// template-seeding routine in every new isolate made even a simple page load
// wait several seconds for D1. Keep a durable completion marker instead.
// Bump this value whenever a runtime-only schema migration is added here.
const RUNTIME_SCHEMA_VERSION = "runtime-schema-v22-cost-template-hero-replacement";
const DEFAULT_SENDER_NAME = "ТехнологИИ Права";
const DEFAULT_SENDER_EMAIL = "info@tech-pravo.ru";

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
    login TEXT,
    password_hash TEXT,
    password_salt TEXT,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6558E8',
    status TEXT NOT NULL DEFAULT 'active',
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS team_invites (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    created_by_participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    custom_fields TEXT NOT NULL DEFAULT '{}',
    responsible_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
    created_by_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
    updated_by_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
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
    is_favorite INTEGER NOT NULL DEFAULT 0,
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
    purpose TEXT NOT NULL DEFAULT 'marketing',
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
  `DROP INDEX IF EXISTS idx_participants_workspace_singleton`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_participant ON auth_sessions(participant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_code_hash ON team_invites(code_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_team_invites_workspace_expires ON team_invites(workspace_id, expires_at)`,
  `DROP INDEX IF EXISTS idx_contacts_workspace_email`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_email ON contacts(workspace_id, email) WHERE email <> ''`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_phone ON contacts(workspace_id, phone)`,
  `DROP INDEX IF EXISTS idx_contacts_workspace_telegram`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_telegram ON contacts(workspace_id, telegram_chat_id) WHERE telegram_chat_id IS NOT NULL`,
  `DROP INDEX IF EXISTS idx_contacts_workspace_vk`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_vk ON contacts(workspace_id, vk_user_id) WHERE vk_user_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_status ON contacts(workspace_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_status_updated ON contacts(workspace_id, status, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_updated ON contacts(workspace_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_city ON contacts(workspace_id, city)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_workspace_company_name ON contacts(workspace_id, company_name)`,
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

export async function requireWorkspaceParticipant(request: Request): Promise<TeamSession> {
  try {
    return await requireTeamSession(request);
  } catch (error) {
    if (!isLocalDevelopmentRequest(request)) throw error;
    const [participant] = await getDb()
      .select()
      .from(participants)
      .where(eq(participants.id, PARTICIPANT_ID))
      .limit(1);
    if (!participant) throw new ApiRequestError("Участник рабочего пространства не найден.", 403);
    return { participant: toTeamParticipant(participant), sessionId: "local-development" };
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
  const participantColumns = await d1
    .prepare("PRAGMA table_info(participants)")
    .all<{ name: string }>();
  const participantAdditions = [
    ["login", "ALTER TABLE participants ADD COLUMN login TEXT"],
    ["password_hash", "ALTER TABLE participants ADD COLUMN password_hash TEXT"],
    ["password_salt", "ALTER TABLE participants ADD COLUMN password_salt TEXT"],
    ["color", "ALTER TABLE participants ADD COLUMN color TEXT NOT NULL DEFAULT '#6558E8'"],
    ["status", "ALTER TABLE participants ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"],
    ["last_login_at", "ALTER TABLE participants ADD COLUMN last_login_at TEXT"],
  ] as const;
  for (const [name, statement] of participantAdditions) {
    if (!participantColumns.results.some((column) => column.name === name)) {
      await d1.prepare(statement).run();
    }
  }
  const contactColumns = await d1
    .prepare("PRAGMA table_info(contacts)")
    .all<{ name: string }>();
  if (!contactColumns.results.some((column) => column.name === "created_by_participant_id")) {
    await d1.prepare("ALTER TABLE contacts ADD COLUMN created_by_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL").run();
  }
  if (!contactColumns.results.some((column) => column.name === "updated_by_participant_id")) {
    await d1.prepare("ALTER TABLE contacts ADD COLUMN updated_by_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL").run();
  }
  if (!contactColumns.results.some((column) => column.name === "responsible_participant_id")) {
    await d1.prepare("ALTER TABLE contacts ADD COLUMN responsible_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL").run();
  }
  if (!contactColumns.results.some((column) => column.name === "custom_fields")) {
    await d1.prepare("ALTER TABLE contacts ADD COLUMN custom_fields TEXT NOT NULL DEFAULT '{}'").run();
  }
  const templateColumns = await d1
    .prepare("PRAGMA table_info(email_templates)")
    .all<{ name: string }>();
  if (!templateColumns.results.some((column) => column.name === "is_favorite")) {
    await d1.prepare("ALTER TABLE email_templates ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0").run();
  }
  const canonicalHandle = (column: string) =>
    `${column} = REPLACE(REPLACE(${column}, 'https://t.me/@TechPravoAI', 'https://t.me/TechPravoAI'), 'TexPravoAI', 'TechPravoAI')`;
  await d1.batch([
    d1.prepare(`UPDATE email_templates SET ${[
      "name", "description", "subject", "preview_text", "builder_document", "email_body_html", "email_body_text",
    ].map(canonicalHandle).join(", ")} WHERE name LIKE '%TexPravoAI%' OR description LIKE '%TexPravoAI%' OR subject LIKE '%TexPravoAI%' OR preview_text LIKE '%TexPravoAI%' OR builder_document LIKE '%TexPravoAI%' OR email_body_html LIKE '%TexPravoAI%' OR email_body_text LIKE '%TexPravoAI%' OR email_body_html LIKE '%t.me/@TechPravoAI%'`),
    d1.prepare(`UPDATE campaigns SET ${[
      "name", "subject", "preview_text", "email_body_text", "email_body_html", "email_builder_document", "messenger_message",
    ].map(canonicalHandle).join(", ")} WHERE name LIKE '%TexPravoAI%' OR subject LIKE '%TexPravoAI%' OR preview_text LIKE '%TexPravoAI%' OR email_body_text LIKE '%TexPravoAI%' OR email_body_html LIKE '%TexPravoAI%' OR email_builder_document LIKE '%TexPravoAI%' OR messenger_message LIKE '%TexPravoAI%' OR email_body_html LIKE '%t.me/@TechPravoAI%'`),
    d1.prepare(`UPDATE presentation_projects SET ${["name", "description", "slides"].map(canonicalHandle).join(", ")} WHERE name LIKE '%TexPravoAI%' OR description LIKE '%TexPravoAI%' OR slides LIKE '%TexPravoAI%' OR slides LIKE '%t.me/@TechPravoAI%'`),
  ]);
  await d1.batch([
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_workspace_login ON participants(workspace_id, login) WHERE login IS NOT NULL"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_participants_workspace_status ON participants(workspace_id, status)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_workspace_creator ON contacts(workspace_id, created_by_participant_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_workspace_responsible ON contacts(workspace_id, responsible_participant_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_workspace_status_updated ON contacts(workspace_id, status, updated_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_workspace_updated ON contacts(workspace_id, updated_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_workspace_city ON contacts(workspace_id, city)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_contacts_workspace_company_name ON contacts(workspace_id, company_name)"),
  ]);
  await d1.prepare("PRAGMA optimize").run();
  const campaignColumns = await d1
    .prepare("PRAGMA table_info(campaigns)")
    .all<{ name: string }>();
  if (!campaignColumns.results.some((column) => column.name === "purpose")) {
    await d1.prepare("ALTER TABLE campaigns ADD COLUMN purpose TEXT NOT NULL DEFAULT 'marketing'").run();
  }
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
      defaultSenderName: DEFAULT_SENDER_NAME,
      defaultSenderEmail: DEFAULT_SENDER_EMAIL,
      replyToEmail: DEFAULT_SENDER_EMAIL,
      signature: `С уважением,\n${DEFAULT_SENDER_NAME}`,
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

  for (const [id, displayName, color] of TEAM_DIRECTORY) {
    await db.insert(participants).values({
      id,
      workspaceId: WORKSPACE_ID,
      displayName,
      email: "",
      color,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }

  await db.insert(participants).values({
    id: GEORGIY_ACCOUNT.id,
    workspaceId: WORKSPACE_ID,
    login: GEORGIY_ACCOUNT.login,
    passwordHash: GEORGIY_ACCOUNT.passwordHash,
    passwordSalt: GEORGIY_ACCOUNT.passwordSalt,
    displayName: GEORGIY_ACCOUNT.displayName,
    email: GEORGIY_ACCOUNT.email,
    color: GEORGIY_ACCOUNT.color,
    status: "active",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

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

  const [uniSenderConfigState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "unisender-tech-pravo-list-v1"))
    .limit(1);
  if (!uniSenderConfigState) {
    await db
      .update(integrations)
      .set({
        enabled: true,
        publicConfig: { senderEmail: DEFAULT_SENDER_EMAIL, listId: "2" },
        checkStatus: "connected",
        checkMessage: "API-ключ и список «Поток — ТехнологИИ Права» проверены. Отправитель: info@tech-pravo.ru.",
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(integrations.workspaceId, WORKSPACE_ID),
        eq(integrations.providerId, "unisender"),
      ));
    await db.insert(systemState).values({
      key: "unisender-tech-pravo-list-v1",
      value: "list:2;sender:info@tech-pravo.ru",
      updatedAt: now,
    }).onConflictDoNothing();
  }

  const [senderDefaultsState] = await db
    .select()
    .from(systemState)
    .where(eq(systemState.key, "workspace-default-sender-tech-pravo-v1"))
    .limit(1);
  if (!senderDefaultsState) {
    await db
      .update(workspaces)
      .set({
        defaultSenderName: DEFAULT_SENDER_NAME,
        defaultSenderEmail: DEFAULT_SENDER_EMAIL,
        replyToEmail: DEFAULT_SENDER_EMAIL,
        signature: `С уважением,\n${DEFAULT_SENDER_NAME}`,
        updatedAt: now,
      })
      .where(eq(workspaces.id, WORKSPACE_ID));
    await db.insert(systemState).values({
      key: "workspace-default-sender-tech-pravo-v1",
      value: "applied",
      updatedAt: now,
    }).onConflictDoNothing();
  }

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

  const [techPravoBrandTemplateState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "email-template-library-v12-tech-pravo-brand"))
    .limit(1);
  if (!techPravoBrandTemplateState) {
    for (const template of starterEmailTemplateValues().filter((item) => item.id.startsWith("template-v12-tech-pravo-brand-"))) {
      await db.insert(emailTemplates).values({ ...template, workspaceId: WORKSPACE_ID }).onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "email-template-library-v12-tech-pravo-brand",
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

  const [productionConferenceState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v1"))
    .limit(1);
  if (!productionConferenceState) {
    for (const template of conferenceProductionTemplateValues) {
      await db
        .insert(emailTemplates)
        .values({ ...template, workspaceId: WORKSPACE_ID })
        .onConflictDoNothing();
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v1",
      value: "seeded",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "seeded", updatedAt: now },
    });
  }

  const [practiceLabCorrectionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v2-practice-lab"))
    .limit(1);
  if (!practiceLabCorrectionState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-08-practice-lab",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v2-practice-lab",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [executiveMemoCorrectionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v3-executive-memo"))
    .limit(1);
  if (!executiveMemoCorrectionState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-07-executive-memo",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v3-executive-memo",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [personalInvitationCorrectionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v4-personal-invitation"))
    .limit(1);
  if (!personalInvitationCorrectionState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-01-personal-invitation",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v4-personal-invitation",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [professionalCircleCorrectionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v5-professional-circle"))
    .limit(1);
  if (!professionalCircleCorrectionState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-09-professional-circle",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v5-professional-circle",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [marketRaceCorrectionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v6-market-race"))
    .limit(1);
  if (!marketRaceCorrectionState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-10-market-race",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v6-market-race",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [conferenceCompanyNameCorrectionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v7-company-name"))
    .limit(1);
  if (!conferenceCompanyNameCorrectionState) {
    for (const template of conferenceProductionTemplateValues) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v7-company-name",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [practiceMarketCopyCorrectionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v8-practice-market-copy"))
    .limit(1);
  if (!practiceMarketCopyCorrectionState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-06-editorial-manifesto",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v8-practice-market-copy",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [personalInvitationCopyCorrectionState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v9-personal-invitation-copy"))
    .limit(1);
  if (!personalInvitationCopyCorrectionState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-01-personal-invitation",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v9-personal-invitation-copy",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [inboxFriendlyPersonalInvitationState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v10-inbox-friendly-personal-invitation"))
    .limit(1);
  if (!inboxFriendlyPersonalInvitationState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-01-personal-invitation",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v10-inbox-friendly-personal-invitation",
      value: "corrected",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "corrected", updatedAt: now },
    });
  }

  const [restoredPersonalInvitationDesignState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v11-restore-personal-invitation-design"))
    .limit(1);
  if (!restoredPersonalInvitationDesignState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-01-personal-invitation",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v11-restore-personal-invitation-design",
      value: "restored",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "restored", updatedAt: now },
    });
  }

  const [conferenceLinksAndCostTemplateState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v12-links-and-cost-template"))
    .limit(1);
  if (!conferenceLinksAndCostTemplateState) {
    for (const template of conferenceProductionTemplateValues) {
      if (template.id === "template-user-conference-11-cost-reduction") {
        await db
          .insert(emailTemplates)
          .values({ ...template, workspaceId: WORKSPACE_ID, isFavorite: true })
          .onConflictDoUpdate({
            target: emailTemplates.id,
            set: {
              name: template.name,
              nameKey: template.nameKey,
              description: template.description,
              category: template.category,
              subject: template.subject,
              previewText: template.previewText,
              builderDocument: template.builderDocument,
              emailBodyHtml: template.emailBodyHtml,
              emailBodyText: template.emailBodyText,
              isFavorite: true,
              updatedAt: now,
            },
          });
        continue;
      }
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v12-links-and-cost-template",
      value: "updated",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "updated", updatedAt: now },
    });
  }

  const [costTemplateHeroImageState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v13-cost-template-hero-image"))
    .limit(1);
  if (!costTemplateHeroImageState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-11-cost-reduction",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          subject: template.subject,
          previewText: template.previewText,
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          isFavorite: true,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v13-cost-template-hero-image",
      value: "updated",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "updated", updatedAt: now },
    });
  }

  const [costTemplateHeroReplacementState] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, "conference-production-html-v14-cost-template-hero-replacement"))
    .limit(1);
  if (!costTemplateHeroReplacementState) {
    const template = conferenceProductionTemplateValues.find(
      (item) => item.id === "template-user-conference-11-cost-reduction",
    );
    if (template) {
      await db
        .update(emailTemplates)
        .set({
          builderDocument: template.builderDocument,
          emailBodyHtml: template.emailBodyHtml,
          emailBodyText: template.emailBodyText,
          isFavorite: true,
          updatedAt: now,
        })
        .where(and(
          eq(emailTemplates.id, template.id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ));
    }
    await db.insert(systemState).values({
      key: "conference-production-html-v14-cost-template-hero-replacement",
      value: "updated",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: systemState.key,
      set: { value: "updated", updatedAt: now },
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

export async function rebalanceContactsForChannelMask(mask: number) {
  if (!Number.isInteger(mask) || mask < 0 || mask > 15) {
    throw new ApiRequestError("Неверная группа каналов.");
  }
  const d1 = getD1();
  const teamRows = await d1.prepare(
    `SELECT id FROM participants
     WHERE workspace_id = ? AND status = 'active' AND login IS NOT NULL AND login <> ''
     ORDER BY login`,
  ).bind(WORKSPACE_ID).all<{ id: string }>();
  const memberIds = (teamRows.results ?? []).map((row) => row.id);
  if (memberIds.length === 0) throw new ApiRequestError("В команде нет активных рабочих аккаунтов.", 409);
  const cases = memberIds.map((_, index) => `WHEN ${index} THEN ?`).join(" ");
  const result = await d1.prepare(
    `WITH ranked AS (
       SELECT id, row_number() OVER (ORDER BY id) - 1 AS position
       FROM contacts
       WHERE workspace_id = ?
         AND (CASE WHEN email <> '' THEN 1 ELSE 0 END
              + CASE WHEN telegram_chat_id IS NOT NULL AND telegram_chat_id <> '' THEN 2 ELSE 0 END
              + CASE WHEN vk_user_id IS NOT NULL AND vk_user_id <> '' THEN 4 ELSE 0 END
              + CASE WHEN phone <> '' THEN 8 ELSE 0 END) = ?
     )
     UPDATE contacts AS target
     SET responsible_participant_id = CASE ((ranked.position + ${mask}) % ${memberIds.length}) ${cases} END
     FROM ranked
     WHERE target.id = ranked.id`,
  ).bind(WORKSPACE_ID, mask, ...memberIds).run();
  await d1.prepare(
    `INSERT INTO system_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(`balanced-team-distribution-mask-${mask}`, `members:${memberIds.length}`, new Date().toISOString()).run();
  return { mask, members: memberIds.length, updatedCount: Number(result.meta.changes ?? 0) };
}

export async function ensureDatabase(request: Request): Promise<TeamSession> {
  await ensureSystemDatabase();
  return requireWorkspaceParticipant(request);
}

async function applyTeamDirectoryCorrections() {
  const now = new Date().toISOString();
  await getD1().prepare(
    `UPDATE participants
     SET display_name = ?, login = ?, email = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(
    "Дарья Самойлова",
    "darya.samoylova",
    "darya.samoylova@team.potok.local",
    now,
    "team-darya-samailova",
  ).run();
}

export async function ensureSystemDatabase(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      const d1 = getD1();
      // This tiny table is safe to create before the full schema and lets a
      // warm or newly-created Worker skip the expensive initialization path.
      await d1
        .prepare(
          `CREATE TABLE IF NOT EXISTS system_state (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
        )
        .run();
      const marker = await d1
        .prepare("SELECT value FROM system_state WHERE key = ?")
        .bind("runtime-schema-version")
        .first<{ value: string }>();
      if (marker?.value === RUNTIME_SCHEMA_VERSION) {
        await applyTeamDirectoryCorrections();
        return;
      }
      await createSchema();
      await seedDatabase(new Request("http://potok.internal/system"));
      await applyTeamDirectoryCorrections();
      await d1
        .prepare(
          `INSERT INTO system_state (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .bind("runtime-schema-version", RUNTIME_SCHEMA_VERSION, new Date().toISOString())
        .run();
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}
