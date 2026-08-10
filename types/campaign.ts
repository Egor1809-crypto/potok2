export type CampaignStatus = "draft" | "scheduled" | "sending" | "completed";

export interface CampaignMetrics {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replies: number;
  bounced: number;
  unsubscribed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  audience: string;
  segmentId: string | null;
  templateId: string | null;
  status: CampaignStatus;
  senderName: string;
  senderEmail: string;
  owner: string;
  metrics: CampaignMetrics;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
}

export type CampaignWizardStep = "audience" | "content" | "sender" | "review";

export interface CampaignDraft {
  name: string;
  audienceType: "segment" | "saved-list" | "custom-filter" | "contacts";
  segmentId: string | null;
  contactIds: string[];
  templateId: string | null;
  senderName: string;
  senderEmail: string;
  subject: string;
  previewText: string;
  excludeUnsubscribed: boolean;
  excludeBounced: boolean;
  excludePreviouslyContacted: boolean;
}
