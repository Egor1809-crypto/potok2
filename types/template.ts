export type TemplateCategory =
  | "Business"
  | "Events"
  | "Outreach"
  | "Newsletter"
  | "Follow-up"
  | "Transactional";

export type EmailBlockType =
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

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  content: string;
  alignment?: "left" | "center" | "right";
  href?: string;
  label?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  subject: string;
  previewText: string;
  accentColor: string;
  backgroundColor: string;
  thumbnailVariant: "editorial" | "minimal" | "bold" | "classic";
  blocks: EmailBlock[];
  isFavorite: boolean;
  updatedAt: string;
}
