import type {
  DeliveryChannelId,
  IntegrationProviderId,
} from "@/config/integrations";
import type { TemplateCategory } from "./template";

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
    | "footer"
    | "hero"
    | "quote"
    | "checklist"
    | "stats"
    | "product"
    | "signature"
    | "pattern"
    | "banner"
    | "timeline"
    | "faq"
    | "coupon"
    | "video"
    | "notice"
    | "comparison"
    | "document"
    | "compliance";
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
  fontFamily?: "Arial" | "Georgia" | "Verdana" | "Trebuchet MS";
  fontWeight?: 400 | 500 | 600 | 700;
  lineHeight?: number;
  letterSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  borderWidth?: number;
  borderColor?: string;
  widthPercent?: number;
  buttonStyle?: "solid" | "outline" | "soft";
};

export type EmailBuilderDocumentInput = {
  templateId: string;
  subject: string;
  previewText: string;
  accentColor: string;
  bodyBackground: string;
  backgroundImageUrl?: string;
  workspaceBackground: string;
  contentWidth: number;
  frameStyle?: "none" | "hairline" | "accent" | "double" | "dashed" | "top-bottom" | "left-band" | "soft" | "capsule" | "stamp" | "offset" | "inset" | "top-accent" | "bottom-accent" | "right-band" | "editorial" | "ticket" | "window" | "railway" | "archive" | "corner-cut" | "top-ribbon" | "side-lines" | "luxury" | "blueprint" | "poster" | "postcard" | "focus";
  frameColor?: string;
  frameRadius?: number;
  blocks: EmailBuilderBlockInput[];
};

export type EmailTemplateRecord = {
  id: string;
  workspaceId: string;
  isStarter: boolean;
  name: string;
  description: string;
  category: TemplateCategory;
  subject: string;
  previewText: string;
  builderDocument: EmailBuilderDocumentInput;
  emailBodyHtml: string;
  emailBodyText: string;
  createdAt: string;
  updatedAt: string;
};

export type EmailAssetRecord = {
  id: string;
  workspaceId: string;
  filename: string;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  size: number;
  kind: "photo" | "logo";
  url: string;
  createdAt: string;
};

export type EmailAssetsListResponse = { assets: EmailAssetRecord[] };
export type EmailAssetMutationResponse = { asset: EmailAssetRecord };

export type ImageStudioStyle =
  | "editorial"
  | "minimal"
  | "photo"
  | "abstract"
  | "collage"
  | "three-dimensional";

export type ImageStudioAspect = "square" | "landscape" | "portrait" | "banner";

export type ImageStudioStatusResponse = {
  configured: boolean;
  provider: "navyai" | null;
  model: string | null;
  referenceImageSupported: boolean;
  assets: EmailAssetRecord[];
};

export type ImageStudioGenerateRequest = {
  prompt: string;
  title?: string;
  style: ImageStudioStyle;
  aspect: ImageStudioAspect;
  quality: "standard" | "high";
  referenceAssetId?: string;
};

export type ImageStudioGenerateResponse = {
  asset: EmailAssetRecord;
  revisedPrompt: string;
};

export type EmailAiAction =
  | "brief"
  | "design"
  | "compose"
  | "rewrite"
  | "shorten"
  | "subject"
  | "cta";

export type EmailAiRequest = {
  action: EmailAiAction;
  goal: string;
  audience?: string;
  tone?: "business" | "friendly" | "expert" | "concise";
  currentSubject?: string;
  currentPreviewText?: string;
  currentText?: string;
  websiteUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  brandName?: string;
  includeLogo?: boolean;
  visualStyle?: "minimal" | "editorial" | "bold" | "premium";
  imageSource?: "internet" | "generate" | "none";
  availableAssets?: Array<Pick<EmailAssetRecord, "id" | "filename" | "kind" | "url">>;
  briefAnswers?: Array<{ question: string; answer: string }>;
};

export type EmailAiSuggestion = {
  subject: string;
  previewText: string;
  body: string;
  cta: string;
  document?: EmailBuilderDocumentInput;
  imagePrompts?: Array<{ blockId: string; prompt: string; alt: string; kind: "photo" | "logo" }>;
  questions?: Array<{ id: string; question: string; placeholder: string; required: boolean }>;
  artDirection?: string;
  contentStrategy?: string;
};

export type EmailExportResponse = {
  html: string;
  text: string;
};

export type EmailAiResponse = {
  configured: boolean;
  provider?: "navyai" | "openai";
  suggestion?: EmailAiSuggestion;
};

export type PresentationThemeId =
  | "atelier"
  | "violet"
  | "noir"
  | "ocean"
  | "sunrise";

export type PresentationSlideLayout =
  | "title"
  | "statement"
  | "split"
  | "bullets"
  | "quote"
  | "stats"
  | "closing";

export type PresentationSlide = {
  id: string;
  layout: PresentationSlideLayout;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  speakerNotes: string;
  assetId?: string;
  imageUrl?: string;
};

export type PresentationSourceType = "blank" | "template" | "ai" | "email";

export type PresentationProjectRecord = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  themeId: PresentationThemeId;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  slides: PresentationSlide[];
  sourceType: PresentationSourceType;
  sourceEmailTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PresentationCreateInput = {
  name: string;
  description?: string;
  themeId?: PresentationThemeId;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  slides?: PresentationSlide[];
  sourceType?: PresentationSourceType;
  sourceEmailTemplateId?: string | null;
};

export type PresentationPatchInput = Partial<PresentationCreateInput> & {
  id: string;
  expectedUpdatedAt?: string;
};

export type PresentationsListResponse = {
  presentations: PresentationProjectRecord[];
};

export type PresentationMutationResponse = {
  presentation: PresentationProjectRecord;
};

export type PresentationAiRequest = {
  goal: string;
  audience?: string;
  context?: string;
  desiredAction?: string;
  tone?: "executive" | "persuasive" | "educational" | "visual";
  slideCount?: number;
  themeId?: PresentationThemeId;
};

export type PresentationAiResponse = {
  configured: boolean;
  provider?: "navyai" | "openai";
  generationMode?: "provider" | "topic_fallback";
  generationNotice?: string;
  outline?: Pick<
    PresentationProjectRecord,
    | "name"
    | "description"
    | "themeId"
    | "accentColor"
    | "backgroundColor"
    | "textColor"
    | "slides"
  >;
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
  presentationId: string | null;
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
  presentationId: string | null;
  senderName: string;
  senderEmail: string;
  subject: string;
  previewText: string;
  emailBodyText: string;
  emailBodyHtml: string;
  emailBuilderDocument: EmailBuilderDocumentInput | null;
  messengerMessage: string;
  workspaceSignature?: string;
  replyToEmail?: string;
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

export type WorkspaceHistoryWindow = {
  scope: "latest_workspace";
  deliveryJobsLimit: number;
  campaignEventsLimit: number;
};

export type WorkspaceSnapshot = {
  workspace: WorkspaceRecord;
  participant: ParticipantRecord;
  contacts: ContactRecord[];
  segments: SegmentRecord[];
  integrations: IntegrationRecord[];
  templates: EmailTemplateRecord[];
  campaigns: CampaignRecord[];
  deliveryPlans: DeliveryPlanRecord[];
  deliveryJobs: DeliveryJobRecord[];
  events: CampaignEventRecord[];
  historyWindow: WorkspaceHistoryWindow;
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

export type ContactsListResponse = {
  contacts: ContactRecord[];
  timezone: string;
};
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

export type SegmentsListResponse = {
  segments: SegmentRecord[];
  timezone: string;
};
export type SegmentMutationResponse = { segment: SegmentRecord };

export type EmailTemplateCreateInput = {
  name: string;
  description?: string;
  category: TemplateCategory;
  subject: string;
  previewText?: string;
  builderDocument: EmailBuilderDocumentInput;
};

export type EmailTemplatePatchInput = Partial<EmailTemplateCreateInput> & {
  id: string;
  expectedUpdatedAt: string;
};

export type EmailTemplateCloneInput = {
  action: "clone";
  id: string;
  name?: string;
};

export type EmailTemplatesListResponse = {
  templates: EmailTemplateRecord[];
};

export type EmailTemplateMutationResponse = {
  template: EmailTemplateRecord;
};

export type EmailTemplateDeleteResponse = DeleteResponse & {
  detachedCampaignCount: number;
  detachedCampaignNames: string[];
};

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
  presentationId?: string | null;
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
  historyWindow: WorkspaceHistoryWindow;
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
