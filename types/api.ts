import type {
  DeliveryChannelId,
  IntegrationProviderId,
} from "@/config/integrations";

export type ApiError = {
  error: string;
  details?: string[];
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  companyName: string;
  timezone: string;
  defaultSenderName: string;
  defaultSenderEmail: string;
  replyToEmail: string;
  signature: string;
  requireConsent: boolean;
  notifyCampaignComplete: boolean;
  notifyBlockedCampaign: boolean;
  createdAt: string;
  updatedAt: string;
};

/** MAILFLOW has one participant with full product access and no role model. */
export type ParticipantRecord = {
  id: string;
  workspaceId: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type ContactStatus =
  | "active"
  | "unsubscribed"
  | "bounced"
  | "invalid";

export type ContactRecord = {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  companyId: string | null;
  companyName: string;
  jobTitle: string;
  category: string;
  city: string;
  country: string;
  tags: string[];
  status: ContactStatus;
  engagementScore: number;
  avatarColor: string;
  emailConsent: boolean;
  telegramChatId: string | null;
  telegramConsent: boolean;
  vkUserId: string | null;
  vkConsent: boolean;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SegmentRuleField =
  | "jobTitle"
  | "city"
  | "status"
  | "category"
  | "tag"
  | "companyName"
  | "lastContactedAt"
  | "engagementScore";

export type SegmentRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "before"
  | "after";

export type SegmentRule = {
  id: string;
  field: SegmentRuleField;
  operator: SegmentRuleOperator;
  value: string | number | string[];
  join: "and" | "or";
};

export type SegmentRecord = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  color: string;
  isDynamic: boolean;
  contactCount: number;
  campaignsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type IntegrationConnectionStatus =
  | "disconnected"
  | "needs_attention"
  | "connected";

export type IntegrationRecord = {
  id: string;
  workspaceId: string;
  providerId: IntegrationProviderId;
  name: string;
  channels: DeliveryChannelId[];
  enabled: boolean;
  status: IntegrationConnectionStatus;
  credentialsConfigured: boolean;
  publicConfig: Record<string, string>;
  statusMessage: string;
  lastCheckedAt: string | null;
  updatedAt: string;
  deliveryMode: "automatic" | "manual_export" | "roadmap";
};

export type CampaignStatus =
  | "draft"
  | "ready"
  | "blocked"
  | "scheduled"
  | "sending"
  | "completed"
  | "cancelled";

export type EmailBuilderBlockInput = {
  id: string;
  type:
    | "logo"
    | "heading"
    | "text"
    | "image"
    | "button"
    | "columns"
    | "divider"
    | "spacer"
    | "social"
    | "footer";
  content: string;
  label?: string;
  href?: string;
  alignment?: "left" | "center" | "right";
  paddingTop: number;
  paddingBottom: number;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  borderRadius: number;
};

export type EmailBuilderDocumentInput = {
  templateId: string;
  subject: string;
  previewText: string;
  accentColor: string;
  bodyBackground: string;
  workspaceBackground: string;
  contentWidth: number;
  blocks: EmailBuilderBlockInput[];
};

export type CampaignRecord = {
  id: string;
  workspaceId: string;
  name: string;
  audienceType: "none" | "segment" | "contacts";
  audienceLabel: string;
  segmentId: string | null;
  contactIds: string[];
  templateId: string | null;
  senderName: string;
  senderEmail: string;
  subject: string;
  previewText: string;
  emailBodyText: string;
  emailBodyHtml: string;
  emailBuilderDocument: EmailBuilderDocumentInput | null;
  messengerMessage: string;
  deliveryChannels: DeliveryChannelId[];
  status: CampaignStatus;
  statusReason: string;
  scheduledAt: string | null;
  sentAt: string | null;
  metrics: CampaignMetricsRecord;
  readyVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignMetricsRecord = {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replies: number;
  bounced: number;
  unsubscribed: number;
};

export type DeliveryPlanStatus = "draft" | "ready" | "blocked";

export type DeliveryPlanRecord = {
  id: string;
  campaignId: string;
  channel: DeliveryChannelId;
  providerId: IntegrationProviderId;
  status: DeliveryPlanStatus;
  eligibleCount: number;
  blockedCount: number;
  statusReason: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignEventRecord = {
  id: string;
  workspaceId: string;
  campaignId: string | null;
  type:
    | "campaign_created"
    | "campaign_updated"
    | "launch_ready"
    | "launch_blocked"
    | "launch_scheduled"
    | "campaign_cancelled"
    | "dispatch_started"
    | "dispatch_completed"
    | "dispatch_partial"
    | "dispatch_blocked";
  message: string;
  details: Record<string, unknown>;
  occurredAt: string;
};

export type CampaignVersionSnapshot = {
  campaignId: string;
  name: string;
  audienceType: CampaignRecord["audienceType"];
  segmentId: string | null;
  contactIds: string[];
  audienceContactIds: string[];
  senderName: string;
  senderEmail: string;
  subject: string;
  previewText: string;
  emailBodyText: string;
  emailBodyHtml: string;
  emailBuilderDocument: EmailBuilderDocumentInput | null;
  messengerMessage: string;
  channels: CampaignChannelInput[];
  scheduledAt: string | null;
  recipientFingerprints: string[];
};

export type CampaignVersionRecord = {
  id: string;
  campaignId: string;
  version: number;
  contentHash: string;
  snapshot: CampaignVersionSnapshot;
  createdAt: string;
};

export type DeliveryJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "partial"
  | "manual_required"
  | "failed";

export type DeliveryJobRecord = {
  id: string;
  workspaceId: string;
  campaignId: string;
  campaignVersionId: string;
  idempotencyKey: string;
  status: DeliveryJobStatus;
  acceptedCount: number;
  rejectedCount: number;
  ambiguousCount: number;
  manualCount: number;
  providerExternalIds: Record<string, Record<string, string>>;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DeliveryOutboxStatus =
  | "pending"
  | "processing"
  | "accepted"
  | "rejected"
  | "ambiguous"
  | "manual_export";

export type DeliveryOutboxRecord = {
  id: string;
  jobId: string;
  campaignId: string;
  campaignVersionId: string;
  contactId: string;
  channel: DeliveryChannelId;
  providerId: IntegrationProviderId;
  recipientEndpoint: string;
  idempotencyKey: string;
  status: DeliveryOutboxStatus;
  attempts: number;
  externalId: string | null;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceStats = {
  totalContacts: number;
  activeContacts: number;
  totalSegments: number;
  totalCampaigns: number;
  activeCampaigns: number;
  connectedIntegrations: number;
};

export type WorkspaceSnapshot = {
  workspace: WorkspaceRecord;
  participant: ParticipantRecord;
  contacts: ContactRecord[];
  segments: SegmentRecord[];
  integrations: IntegrationRecord[];
  campaigns: CampaignRecord[];
  deliveryPlans: DeliveryPlanRecord[];
  deliveryJobs: DeliveryJobRecord[];
  events: CampaignEventRecord[];
  stats: WorkspaceStats;
};

export type WorkspacePatchInput = Partial<
  Pick<
    WorkspaceRecord,
    | "name"
    | "companyName"
    | "timezone"
    | "defaultSenderName"
    | "defaultSenderEmail"
    | "replyToEmail"
    | "signature"
    | "requireConsent"
    | "notifyCampaignComplete"
    | "notifyBlockedCampaign"
  >
> & {
  participantName?: string;
  participantEmail?: string;
};

export type ContactCreateInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyId?: string | null;
  companyName?: string;
  jobTitle?: string;
  category?: string;
  city?: string;
  country?: string;
  tags?: string[];
  status?: ContactStatus;
  engagementScore?: number;
  emailConsent?: boolean;
  telegramChatId?: string | null;
  telegramConsent?: boolean;
  vkUserId?: string | null;
  vkConsent?: boolean;
};

export type ContactPatchInput = Partial<ContactCreateInput> & { id: string };

export type ContactsListResponse = { contacts: ContactRecord[] };
export type ContactMutationResponse = { contact: ContactRecord };
export type ContactsBatchCreateInput = {
  contacts: ContactCreateInput[];
  duplicateStrategy?: "skip" | "update";
};
export type ContactsBatchCreateResponse = {
  contacts: ContactRecord[];
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};
export type DeleteResponse = { deletedId: string };

export type SegmentCreateInput = {
  name: string;
  description?: string;
  rules: SegmentRule[];
  color?: string;
  isDynamic?: boolean;
};

export type SegmentPatchInput = Partial<SegmentCreateInput> & { id: string };

export type SegmentsListResponse = { segments: SegmentRecord[] };
export type SegmentMutationResponse = { segment: SegmentRecord };

export type CampaignChannelInput = {
  channel: DeliveryChannelId;
  providerId: IntegrationProviderId;
};

export type CampaignCreateInput = {
  name: string;
  audienceType?: "none" | "segment" | "contacts";
  segmentId?: string | null;
  contactIds?: string[];
  templateId?: string | null;
  senderName?: string;
  senderEmail?: string;
  subject?: string;
  previewText?: string;
  emailBodyText?: string;
  emailBuilderDocument?: EmailBuilderDocumentInput | null;
  messengerMessage?: string;
  channels?: CampaignChannelInput[];
  scheduledAt?: string | null;
};

export type CampaignPatchInput = Partial<CampaignCreateInput> & {
  id: string;
  action?: "save" | "launch" | "dispatch" | "cancel";
  idempotencyKey?: string;
};

export type CampaignEvaluation = {
  status: "ready" | "blocked" | "scheduled";
  eligibleByChannel: Partial<Record<DeliveryChannelId, number>>;
  blockers: string[];
};

export type CampaignsListResponse = {
  campaigns: CampaignRecord[];
  deliveryPlans: DeliveryPlanRecord[];
  events: CampaignEventRecord[];
  deliveryJobs: DeliveryJobRecord[];
};

export type CampaignMutationResponse = {
  campaign: CampaignRecord;
  deliveryPlans: DeliveryPlanRecord[];
  event?: CampaignEventRecord;
  evaluation?: CampaignEvaluation;
  deliveryJob?: DeliveryJobRecord;
};

export type IntegrationPatchInput = {
  providerId: IntegrationProviderId;
  action?: "save" | "check" | "disconnect";
  enabled?: boolean;
  publicConfig?: Record<string, string>;
};

export type IntegrationsListResponse = {
  integrations: IntegrationRecord[];
};

export type IntegrationMutationResponse = {
  integration: IntegrationRecord;
};

export type WorkspacePatchResponse = {
  workspace: WorkspaceRecord;
  participant: ParticipantRecord;
};
