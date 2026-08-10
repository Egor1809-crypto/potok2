export type ContactStatus = "active" | "unsubscribed" | "bounced" | "invalid";

export type ContactCategory =
  | "Lawyer"
  | "Partner"
  | "Client"
  | "Speaker"
  | "Arbitration Manager"
  | "Investor"
  | "Marketing"
  | "Operations";

export type ContactTag =
  | "VIP"
  | "Conference"
  | "Moscow"
  | "Partner"
  | "Hot"
  | "Warm"
  | "Speaker"
  | "Client"
  | "Legal Tech"
  | "Follow-up";

export type ContactActivityType =
  | "email_sent"
  | "email_opened"
  | "link_clicked"
  | "reply_received"
  | "tag_added"
  | "note_added";

export interface ContactActivity {
  id: string;
  contactId: string;
  type: ContactActivityType;
  title: string;
  detail: string;
  occurredAt: string;
  campaignId?: string;
}

export interface ContactNote {
  id: string;
  contactId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  companyId: string;
  companyName: string;
  role: string;
  category: ContactCategory;
  city: string;
  country: string;
  tags: ContactTag[];
  status: ContactStatus;
  owner: string;
  engagementScore: number;
  avatarColor: string;
  lastContactedAt: string | null;
  createdAt: string;
}
